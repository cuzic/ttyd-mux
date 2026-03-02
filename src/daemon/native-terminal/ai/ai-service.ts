/**
 * AI Service (Gateway)
 *
 * Main entry point for AI features. Manages runners, caching,
 * rate limiting, and request processing.
 */

import { randomUUID } from 'node:crypto';
import { renderContext } from './context-renderer.js';
import { RateLimiter } from './rate-limiter.js';
import { parseResponse } from './response-parser.js';
import { RunCache } from './run-cache.js';
import { DisabledRunner, type Runner } from './runner.js';
import { ClaudeRunner } from './runners/claude-runner.js';
import { CodexRunner } from './runners/codex-runner.js';
import { GeminiRunner } from './runners/gemini-runner.js';
import type {
  AIChatRequest,
  AIChatResponse,
  AIRun,
  AIThread,
  BlockContext,
  BlockSnapshot,
  RunnerName,
  RunnerStatus
} from './types.js';

export interface AIServiceOptions {
  /** Enable caching (default: true) */
  enableCache?: boolean;
  /** Cache TTL in ms (default: 1 hour) */
  cacheTtlMs?: number;
  /** Enable rate limiting (default: true) */
  enableRateLimit?: boolean;
  /** Rate limit: max requests per window */
  rateLimitMaxRequests?: number;
  /** Rate limit: window duration in ms */
  rateLimitWindowMs?: number;
  /** Default runner */
  defaultRunner?: RunnerName;
}

const DEFAULT_OPTIONS: Required<AIServiceOptions> = {
  enableCache: true,
  cacheTtlMs: 60 * 60 * 1000, // 1 hour
  enableRateLimit: true,
  rateLimitMaxRequests: 20,
  rateLimitWindowMs: 60 * 1000, // 1 minute
  defaultRunner: 'auto'
};

const SYSTEM_PROMPT = `You are a helpful terminal assistant analyzing command outputs.
Your task is to help users understand terminal errors, suggest fixes, and provide guidance.

Guidelines:
- Be concise and practical
- Focus on the specific error or question
- Provide actionable suggestions
- When suggesting commands, assess their risk level
- Reference specific blocks by ID when citing evidence

Response format (JSON when possible):
{
  "answer": "Your explanation here",
  "citations": [{"blockId": "block_xxx", "reason": "why this block is relevant"}],
  "nextCommands": [{"command": "...", "description": "...", "risk": "safe|caution|dangerous"}]
}`;

/**
 * AI Service - main gateway for AI features
 */
export class AIService {
  private runners: Map<RunnerName, Runner> = new Map();
  private cache: RunCache;
  private rateLimiter: RateLimiter;
  private options: Required<AIServiceOptions>;
  private threads: Map<string, AIThread> = new Map();
  private runSnapshots: Map<string, AIRun> = new Map();

  constructor(options: AIServiceOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };

    // Initialize cache
    this.cache = new RunCache({
      enabled: this.options.enableCache,
      ttlMs: this.options.cacheTtlMs
    });

    // Initialize rate limiter
    this.rateLimiter = new RateLimiter({
      enabled: this.options.enableRateLimit,
      maxRequests: this.options.rateLimitMaxRequests,
      windowMs: this.options.rateLimitWindowMs
    });

    // Initialize runners
    this.initializeRunners();
  }

  /**
   * Initialize available runners
   */
  private initializeRunners(): void {
    this.runners.set('claude', new ClaudeRunner());
    this.runners.set('codex', new CodexRunner());
    this.runners.set('gemini', new GeminiRunner());
    this.runners.set('disabled', new DisabledRunner());
  }

  /**
   * Get all runner statuses
   */
  async getRunnerStatuses(): Promise<RunnerStatus[]> {
    const statuses: RunnerStatus[] = [];

    for (const runner of this.runners.values()) {
      if (runner.name === 'disabled') continue;
      const status = await runner.checkAvailability();
      statuses.push(status);
    }

    return statuses;
  }

  /**
   * Get the best available runner
   */
  async getBestRunner(): Promise<Runner> {
    // Check preferred runners in order
    const preferredOrder: RunnerName[] = ['claude', 'gemini', 'codex'];

    for (const name of preferredOrder) {
      const runner = this.runners.get(name);
      if (runner) {
        const status = await runner.checkAvailability();
        if (status.available && status.authenticated) {
          return runner;
        }
      }
    }

    // Fall back to disabled runner
    return this.runners.get('disabled') ?? new DisabledRunner();
  }

  /**
   * Get a specific runner by name
   */
  getRunner(name: RunnerName): Runner | null {
    return this.runners.get(name) ?? null;
  }

  /**
   * Execute an AI chat request
   */
  async chat(
    request: AIChatRequest,
    blocks: BlockContext[],
    userId?: string
  ): Promise<AIChatResponse> {
    const startTime = Date.now();
    const runId = `run_${randomUUID().slice(0, 8)}`;

    // Rate limit check
    const rateLimitKey = userId ?? 'default';
    const rateLimitResult = this.rateLimiter.check(rateLimitKey);

    if (!rateLimitResult.allowed) {
      return {
        runId,
        content: 'Rate limit exceeded. Please wait before making another request.',
        citations: [],
        nextCommands: [],
        cached: false,
        durationMs: Date.now() - startTime,
        runner: 'disabled',
        error: `Rate limit exceeded. Retry after ${Math.ceil((rateLimitResult.retryAfterMs ?? 0) / 1000)} seconds.`
      };
    }

    // Render context from blocks
    const contextText = renderContext(blocks, request.context.renderMode);

    // Select runner
    let runner: Runner;
    if (request.runner && request.runner !== 'auto') {
      const requestedRunner = this.runners.get(request.runner);
      if (requestedRunner) {
        runner = requestedRunner;
      } else {
        runner = await this.getBestRunner();
      }
    } else {
      runner = await this.getBestRunner();
    }

    // Check cache
    const cacheKey = this.cache.generateKey(request.question, contextText, runner.name);
    const cachedResponse = this.cache.get(cacheKey);

    if (cachedResponse) {
      // Update run ID but keep cached flag
      return {
        ...cachedResponse,
        runId,
        durationMs: Date.now() - startTime
      };
    }

    // Execute request
    try {
      const result = await runner.run({
        prompt: request.question,
        systemPrompt: SYSTEM_PROMPT,
        context: contextText,
        conversationId: request.conversationId
      });

      if (result.error) {
        return {
          runId,
          content: result.error,
          citations: [],
          nextCommands: [],
          cached: false,
          durationMs: Date.now() - startTime,
          runner: runner.name,
          error: result.error
        };
      }

      // Parse response
      const parsed = parseResponse(result.content);

      const response: AIChatResponse = {
        runId,
        content: parsed.answer || result.content,
        citations: parsed.citations,
        nextCommands: parsed.nextCommands,
        cached: false,
        durationMs: Date.now() - startTime,
        runner: runner.name
      };

      // Store in cache
      this.cache.set(cacheKey, response);

      // Create snapshot for history
      this.createRunSnapshot(runId, request, blocks, response);

      return response;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        runId,
        content: `Error: ${errorMessage}`,
        citations: [],
        nextCommands: [],
        cached: false,
        durationMs: Date.now() - startTime,
        runner: runner.name,
        error: errorMessage
      };
    }
  }

  /**
   * Create a run snapshot for history
   */
  private createRunSnapshot(
    runId: string,
    request: AIChatRequest,
    blocks: BlockContext[],
    response: AIChatResponse
  ): void {
    // Create block snapshots
    const blockSnapshots: BlockSnapshot[] = blocks.map((block) => ({
      id: block.id,
      command: block.command,
      outputPreview: this.getOutputPreview(block.output),
      exitCode: block.exitCode,
      status: block.status
    }));

    // Get or create thread
    const threadId = request.conversationId ?? `thread_${randomUUID().slice(0, 8)}`;
    let thread = this.threads.get(threadId);

    if (!thread) {
      thread = {
        id: threadId,
        sessionId: request.context.sessionId,
        runs: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      this.threads.set(threadId, thread);
    }

    // Create run
    const run: AIRun = {
      id: runId,
      threadId,
      request,
      contextSnapshot: { blocks: blockSnapshots },
      response,
      createdAt: new Date().toISOString()
    };

    // Store run
    thread.runs.push(run);
    thread.updatedAt = new Date().toISOString();
    this.runSnapshots.set(runId, run);

    // Limit history size (keep last 100 runs per thread)
    if (thread.runs.length > 100) {
      const removed = thread.runs.shift();
      if (removed) {
        this.runSnapshots.delete(removed.id);
      }
    }
  }

  /**
   * Get preview of output (first 200 chars)
   */
  private getOutputPreview(base64Output: string): string {
    try {
      const decoded = Buffer.from(base64Output, 'base64').toString('utf-8');
      if (decoded.length <= 200) {
        return decoded;
      }
      return decoded.slice(0, 197) + '...';
    } catch {
      return '';
    }
  }

  /**
   * Get a run by ID
   */
  getRun(runId: string): AIRun | null {
    return this.runSnapshots.get(runId) ?? null;
  }

  /**
   * Get a thread by ID
   */
  getThread(threadId: string): AIThread | null {
    return this.threads.get(threadId) ?? null;
  }

  /**
   * Get all threads for a session
   */
  getSessionThreads(sessionId: string): AIThread[] {
    const threads: AIThread[] = [];
    for (const thread of this.threads.values()) {
      if (thread.sessionId === sessionId) {
        threads.push(thread);
      }
    }
    return threads;
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Clear history for a session
   */
  clearSessionHistory(sessionId: string): void {
    for (const [threadId, thread] of this.threads.entries()) {
      if (thread.sessionId === sessionId) {
        // Remove runs
        for (const run of thread.runs) {
          this.runSnapshots.delete(run.id);
        }
        // Remove thread
        this.threads.delete(threadId);
      }
    }
  }

  /**
   * Get service statistics
   */
  getStats(): {
    cache: ReturnType<RunCache['getStats']>;
    rateLimit: ReturnType<RateLimiter['getStats']>;
    threads: number;
    runs: number;
  } {
    return {
      cache: this.cache.getStats(),
      rateLimit: this.rateLimiter.getStats(),
      threads: this.threads.size,
      runs: this.runSnapshots.size
    };
  }

  /**
   * Dispose service resources
   */
  dispose(): void {
    this.rateLimiter.dispose();
    this.cache.clear();
    this.threads.clear();
    this.runSnapshots.clear();
  }
}

// Singleton instance
let aiServiceInstance: AIService | null = null;

/**
 * Get or create the AI service instance
 */
export function getAIService(options?: AIServiceOptions): AIService {
  if (!aiServiceInstance) {
    aiServiceInstance = new AIService(options);
  }
  return aiServiceInstance;
}

/**
 * Reset the AI service instance (for testing)
 */
export function resetAIService(): void {
  if (aiServiceInstance) {
    aiServiceInstance.dispose();
    aiServiceInstance = null;
  }
}
