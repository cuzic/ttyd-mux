/**
 * Claude CLI Runner
 *
 * Runs queries using the `claude` CLI tool (Claude Code / claude-cli).
 */

import type { RunRequest, RunnerCapabilities, RunnerName } from '@/features/ai/server/types.js';
import { BaseCLIRunner } from './base-cli-runner.js';

export class ClaudeRunner extends BaseCLIRunner {
  readonly name: RunnerName = 'claude';
  protected readonly cliCommand = 'claude';
  protected readonly versionFlag = '--version';

  capabilities(): RunnerCapabilities {
    return {
      supportsStreaming: true,
      supportsConversation: true,
      maxContextLength: 200000, // Claude 3.5 context window
      supportedFeatures: ['code-analysis', 'error-explanation', 'command-suggestion']
    };
  }

  /**
   * Check if Claude CLI is authenticated
   */
  protected override async checkAuthentication(): Promise<boolean> {
    try {
      const proc = Bun.spawn(['claude', '--help'], {
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
   * Claude uses: claude -p <prompt> [--system <system>]
   */
  protected buildRunArgs(request: RunRequest, prompt: string): string[] {
    const args: string[] = [];

    if (request.systemPrompt) {
      args.push('--system', request.systemPrompt);
    }

    args.push('-p', prompt);
    return args;
  }

  /**
   * Build CLI arguments for stream mode
   * Same as run mode for Claude
   */
  protected buildStreamArgs(request: RunRequest, prompt: string): string[] {
    return this.buildRunArgs(request, prompt);
  }
}
