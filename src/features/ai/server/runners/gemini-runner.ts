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
  protected override readonly authEnvVars = ['GOOGLE_API_KEY', 'GEMINI_API_KEY'];

  capabilities(): RunnerCapabilities {
    return {
      supportsStreaming: true,
      supportsConversation: true,
      maxContextLength: 1000000, // Gemini 1.5 Pro context window
      supportedFeatures: ['code-analysis', 'error-explanation', 'command-suggestion']
    };
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
