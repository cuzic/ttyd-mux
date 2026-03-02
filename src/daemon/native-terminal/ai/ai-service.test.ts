/**
 * AI Service Tests
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { AIService, resetAIService } from './ai-service.js';
import { renderContext } from './context-renderer.js';
import { RateLimiter } from './rate-limiter.js';
import { parseResponse } from './response-parser.js';
import { RunCache } from './run-cache.js';
import type { BlockContext } from './types.js';

describe('AIService', () => {
  let service: AIService;

  beforeEach(() => {
    resetAIService();
    service = new AIService({
      enableCache: true,
      enableRateLimit: true,
      rateLimitMaxRequests: 5,
      rateLimitWindowMs: 1000
    });
  });

  afterEach(() => {
    service.dispose();
    resetAIService();
  });

  it('should create service instance', () => {
    expect(service).toBeDefined();
  });

  it('should get runner statuses', async () => {
    const statuses = await service.getRunnerStatuses();
    expect(Array.isArray(statuses)).toBe(true);
    // All runners should be in the list
    const names = statuses.map((s) => s.name);
    expect(names).toContain('claude');
    expect(names).toContain('codex');
    expect(names).toContain('gemini');
  });

  it('should get best available runner', async () => {
    const runner = await service.getBestRunner();
    expect(runner).toBeDefined();
    expect(runner.name).toBeDefined();
  });

  it('should get stats', () => {
    const stats = service.getStats();
    expect(stats.cache).toBeDefined();
    expect(stats.rateLimit).toBeDefined();
    expect(stats.threads).toBe(0);
    expect(stats.runs).toBe(0);
  });
});

describe('RunCache', () => {
  let cache: RunCache;

  beforeEach(() => {
    cache = new RunCache({ ttlMs: 1000 });
  });

  it('should generate cache key', () => {
    const key = cache.generateKey('question', 'context', 'claude');
    expect(typeof key).toBe('string');
    expect(key.length).toBe(16);
  });

  it('should cache and retrieve response', () => {
    const key = cache.generateKey('q', 'c', 'claude');
    const response = {
      runId: 'run_123',
      content: 'Test response',
      citations: [],
      nextCommands: [],
      cached: false,
      durationMs: 100,
      runner: 'claude' as const
    };

    cache.set(key, response);
    const retrieved = cache.get(key);

    expect(retrieved).not.toBeNull();
    expect(retrieved?.content).toBe('Test response');
    expect(retrieved?.cached).toBe(true);
  });

  it('should return null for non-existent key', () => {
    const result = cache.get('nonexistent');
    expect(result).toBeNull();
  });

  it('should invalidate cache entry', () => {
    const key = cache.generateKey('q', 'c', 'claude');
    cache.set(key, {
      runId: 'run_123',
      content: 'Test',
      citations: [],
      nextCommands: [],
      cached: false,
      durationMs: 100,
      runner: 'claude'
    });

    expect(cache.get(key)).not.toBeNull();
    cache.invalidate(key);
    expect(cache.get(key)).toBeNull();
  });
});

describe('RateLimiter', () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = new RateLimiter({
      maxRequests: 3,
      windowMs: 1000
    });
  });

  afterEach(() => {
    limiter.dispose();
  });

  it('should allow requests within limit', () => {
    const result1 = limiter.check('user1');
    const result2 = limiter.check('user1');
    const result3 = limiter.check('user1');

    expect(result1.allowed).toBe(true);
    expect(result2.allowed).toBe(true);
    expect(result3.allowed).toBe(true);
  });

  it('should block requests over limit', () => {
    limiter.check('user1');
    limiter.check('user1');
    limiter.check('user1');
    const result4 = limiter.check('user1');

    expect(result4.allowed).toBe(false);
    expect(result4.retryAfterMs).toBeGreaterThan(0);
  });

  it('should track remaining requests', () => {
    const result1 = limiter.check('user1');
    expect(result1.remaining).toBe(2);

    const result2 = limiter.check('user1');
    expect(result2.remaining).toBe(1);
  });

  it('should reset for user', () => {
    limiter.check('user1');
    limiter.check('user1');
    limiter.reset('user1');

    const result = limiter.check('user1');
    expect(result.remaining).toBe(2);
  });
});

describe('parseResponse', () => {
  it('should parse JSON response', () => {
    const jsonResponse = JSON.stringify({
      answer: 'This is the answer',
      citations: [{ blockId: 'block_123', reason: 'Referenced this block' }],
      nextCommands: [{ command: 'npm install', description: 'Install deps', risk: 'safe' }]
    });

    const result = parseResponse(jsonResponse);

    expect(result.wasJson).toBe(true);
    expect(result.answer).toBe('This is the answer');
    expect(result.citations).toHaveLength(1);
    expect(result.citations[0]?.blockId).toBe('block_123');
    expect(result.nextCommands).toHaveLength(1);
    expect(result.nextCommands[0]?.command).toBe('npm install');
  });

  it('should parse plain text response', () => {
    const textResponse = 'This is a plain text response without JSON.';

    const result = parseResponse(textResponse);

    expect(result.wasJson).toBe(false);
    expect(result.answer).toBe(textResponse);
    expect(result.citations).toHaveLength(0);
  });

  it('should extract commands from code blocks', () => {
    const textWithCode = `
Here's what you should do:

\`\`\`bash
npm install
npm run build
\`\`\`
`;

    const result = parseResponse(textWithCode);

    expect(result.nextCommands.length).toBeGreaterThan(0);
    const commands = result.nextCommands.map((c) => c.command);
    expect(commands).toContain('npm install');
    expect(commands).toContain('npm run build');
  });
});

describe('renderContext', () => {
  const testBlocks: BlockContext[] = [
    {
      id: 'block_1',
      command: 'npm install',
      output: Buffer.from('installed packages').toString('base64'),
      exitCode: 0,
      status: 'success',
      cwd: '/home/user/project',
      startedAt: '2024-01-01T00:00:00.000Z',
      endedAt: '2024-01-01T00:00:05.000Z'
    },
    {
      id: 'block_2',
      command: 'npm run build',
      output: Buffer.from('Error: Build failed').toString('base64'),
      exitCode: 1,
      status: 'error',
      cwd: '/home/user/project',
      startedAt: '2024-01-01T00:00:10.000Z',
      endedAt: '2024-01-01T00:00:15.000Z'
    }
  ];

  it('should render full context', () => {
    const context = renderContext(testBlocks, 'full');

    expect(context).toContain('Terminal Session Context');
    expect(context).toContain('npm install');
    expect(context).toContain('npm run build');
    expect(context).toContain('installed packages');
    expect(context).toContain('Error: Build failed');
  });

  it('should render errorOnly context', () => {
    const context = renderContext(testBlocks, 'errorOnly');

    expect(context).toContain('npm install');
    expect(context).toContain('npm run build');
    // Error block output should be included
    expect(context).toContain('Error: Build failed');
  });

  it('should render commandOnly context', () => {
    const context = renderContext(testBlocks, 'commandOnly');

    expect(context).toContain('npm install');
    expect(context).toContain('npm run build');
    // Outputs should not be included
    expect(context).not.toContain('installed packages');
    expect(context).not.toContain('Error: Build failed');
  });
});
