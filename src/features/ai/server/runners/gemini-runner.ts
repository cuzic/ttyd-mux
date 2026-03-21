/**
 * Gemini CLI Runner
 *
 * Runs queries using Google's Gemini CLI tool.
 */

import type { RunRequest, RunnerCapabilities, RunnerName } from '@/features/ai/server/types.js';
import { BaseCLIRunner } from './base-cli-runner.js';

export class GeminiRunner extends BaseCLIRunner {
  readonly name: RunnerName = 'gemini';
  protected readonly cliCommand = 'gemini';
  protected readonly versionFlag = '--version';

  capabilities(): RunnerCapabilities {
    return {
      supportsStreaming: true,
      supportsConversation: true,
      maxContextLength: 1000000, // Gemini 1.5 Pro context window
      supportedFeatures: ['code-analysis', 'error-explanation', 'command-suggestion']
    };
  }

  /**
   * Check if Gemini CLI is authenticated
   */
  protected override async checkAuthentication(): Promise<boolean> {
    try {
      // Check if GOOGLE_API_KEY or GEMINI_API_KEY is set
      if (process.env['GOOGLE_API_KEY'] || process.env['GEMINI_API_KEY']) {
        return true;
      }

      // Try running help command
      const proc = Bun.spawn(['gemini', '--help'], {
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
   * Gemini uses: gemini --prompt <prompt> [--system <system>]
   */
  protected buildRunArgs(request: RunRequest, prompt: string): string[] {
    const args: string[] = [];

    if (request.systemPrompt) {
      args.push('--system', request.systemPrompt);
    }

    args.push('--prompt', prompt);
    return args;
  }

  /**
   * Build CLI arguments for stream mode
   * Gemini uses: gemini --prompt <prompt> --stream [--system <system>]
   */
  protected buildStreamArgs(request: RunRequest, prompt: string): string[] {
    const args: string[] = [];

    if (request.systemPrompt) {
      args.push('--system', request.systemPrompt);
    }

    args.push('--prompt', prompt, '--stream');
    return args;
  }
}
