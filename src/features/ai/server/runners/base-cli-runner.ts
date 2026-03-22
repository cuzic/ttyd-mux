/**
 * Base CLI Runner
 *
 * Template Method pattern for CLI-based LLM runners.
 * Subclasses only need to implement:
 * - buildRunArgs(): CLI arguments for run()
 * - buildStreamArgs(): CLI arguments for stream()
 * - capabilities(): Runner capabilities
 * - checkAuthentication(): Authentication check
 */

import { CLIRunner } from '@/features/ai/server/runner.js';
import type { RunChunk, RunRequest, RunResult } from '@/features/ai/server/types.js';

/**
 * Configuration for a CLI runner
 */
export interface CLIRunnerConfig {
  /** Environment variables to set when spawning */
  env?: Record<string, string>;
}

/**
 * Base class for CLI runners with shared run/stream implementation
 */
export abstract class BaseCLIRunner extends CLIRunner {
  protected readonly config: CLIRunnerConfig;

  /** Version flag for the CLI (default: --version) */
  protected readonly versionFlag: string = '--version';

  /** Environment variables that indicate authentication (checked before --help) */
  protected readonly authEnvVars: string[] = [];

  constructor(config: CLIRunnerConfig = {}) {
    super();
    this.config = config;
  }

  /**
   * Check if the CLI is authenticated
   * Default implementation checks authEnvVars, then spawns --help
   */
  protected override async checkAuthentication(): Promise<boolean> {
    // Check if any auth env vars are set
    for (const envVar of this.authEnvVars) {
      if (process.env[envVar]) {
        return true;
      }
    }

    // Try running help command
    try {
      const proc = Bun.spawn([this.cliCommand, '--help'], {
        stdout: 'pipe',
        stderr: 'pipe'
      });

      const exitCode = await proc.exited;
      return exitCode === 0;
    } catch {
      return false;
    }
  }

  /**
   * Build CLI arguments for run mode
   * @returns Array of CLI arguments (excluding the command itself)
   */
  protected abstract buildRunArgs(request: RunRequest, prompt: string): string[];

  /**
   * Build CLI arguments for stream mode
   * @returns Array of CLI arguments (excluding the command itself)
   */
  protected abstract buildStreamArgs(request: RunRequest, prompt: string): string[];

  /**
   * Build the full prompt with context and response format
   */
  protected buildPrompt(request: RunRequest): string {
    const parts: string[] = [];

    // Add context if provided
    if (request.context) {
      parts.push('## Context\n');
      parts.push(request.context);
      parts.push('\n\n');
    }

    // Add the question
    parts.push('## Question\n');
    parts.push(request.prompt);

    // Add response format instructions
    parts.push('\n\n## Response Format\n');
    parts.push('Please respond with a JSON object containing:\n');
    parts.push('- `answer`: Your answer to the question\n');
    parts.push('- `citations`: Array of {blockId, reason} for blocks you referenced\n');
    parts.push(
      '- `nextCommands`: Array of {command, description, risk} for suggested commands (risk: "safe", "caution", or "dangerous")\n'
    );
    parts.push('\nIf you cannot provide JSON, respond with plain text.');

    return parts.join('');
  }

  /**
   * Get environment variables for spawning the CLI
   */
  protected getSpawnEnv(): Record<string, string | undefined> {
    return {
      ...process.env,
      CI: 'true', // Disable interactive features
      ...this.config.env
    };
  }

  /**
   * Execute a run request and return the result
   */
  async run(request: RunRequest): Promise<RunResult> {
    const startTime = Date.now();

    try {
      const fullPrompt = this.buildPrompt(request);
      const args = this.buildRunArgs(request, fullPrompt);

      const proc = Bun.spawn([this.cliCommand, ...args], {
        stdout: 'pipe',
        stderr: 'pipe',
        env: this.getSpawnEnv()
      });

      const [exitCode, stdout, stderr] = await Promise.all([
        proc.exited,
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text()
      ]);

      const durationMs = Date.now() - startTime;

      if (exitCode !== 0) {
        return {
          content: '',
          raw: stdout,
          error: stderr || `${this.cliCommand} CLI exited with code ${exitCode}`,
          durationMs
        };
      }

      return {
        content: stdout.trim(),
        raw: stdout,
        durationMs
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      return {
        content: '',
        error: error instanceof Error ? error.message : `Failed to run ${this.cliCommand} CLI`,
        durationMs
      };
    }
  }

  /**
   * Stream execution using CLI
   */
  async *stream(request: RunRequest): AsyncIterable<RunChunk> {
    try {
      const fullPrompt = this.buildPrompt(request);
      const args = this.buildStreamArgs(request, fullPrompt);

      const proc = Bun.spawn([this.cliCommand, ...args], {
        stdout: 'pipe',
        stderr: 'pipe',
        env: this.getSpawnEnv()
      });

      const reader = proc.stdout.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        const text = decoder.decode(value, { stream: true });
        if (text) {
          yield { type: 'content', content: text };
        }
      }

      const exitCode = await proc.exited;
      if (exitCode !== 0) {
        const stderr = await new Response(proc.stderr).text();
        yield { type: 'error', error: stderr || `Exit code: ${exitCode}` };
      } else {
        yield { type: 'done' };
      }
    } catch (error) {
      yield {
        type: 'error',
        error: error instanceof Error ? error.message : 'Stream failed'
      };
    }
  }
}
