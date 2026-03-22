/**
 * Codex CLI Runner
 *
 * Runs queries using the OpenAI Codex CLI tool.
 */

import type { RunRequest, RunnerCapabilities, RunnerName } from '@/features/ai/server/types.js';
import { BaseCLIRunner } from './base-cli-runner.js';

export class CodexRunner extends BaseCLIRunner {
  readonly name: RunnerName = 'codex';
  protected readonly cliCommand = 'codex';
  protected override readonly authEnvVars = ['OPENAI_API_KEY'];

  capabilities(): RunnerCapabilities {
    return {
      supportsStreaming: true,
      supportsConversation: false,
      maxContextLength: 128000, // GPT-4 context window
      supportedFeatures: ['code-analysis', 'error-explanation', 'command-suggestion']
    };
  }

  /**
   * Build the prompt with systemPrompt embedded
   * Codex doesn't have a --system flag, so we prepend it to the prompt
   */
  protected override buildPrompt(request: RunRequest): string {
    const parts: string[] = [];

    // Add system prompt if provided (Codex doesn't have --system flag)
    if (request.systemPrompt) {
      parts.push(request.systemPrompt);
      parts.push('\n\n');
    }

    // Call parent to add context, question, and response format
    parts.push(super.buildPrompt(request));

    return parts.join('');
  }

  /**
   * Build CLI arguments for run mode
   * Codex uses: codex --quiet <prompt>
   */
  protected buildRunArgs(_request: RunRequest, prompt: string): string[] {
    return ['--quiet', prompt];
  }

  /**
   * Build CLI arguments for stream mode
   * Same as run mode for Codex
   */
  protected buildStreamArgs(request: RunRequest, prompt: string): string[] {
    return this.buildRunArgs(request, prompt);
  }
}
