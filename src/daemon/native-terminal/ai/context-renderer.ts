/**
 * Context Renderer
 *
 * Converts block context to LLM-friendly text format.
 */

import type { BlockContext, RenderMode } from './types.js';

export interface ContextRendererOptions {
  /** Maximum output length per block (characters) */
  maxOutputLength?: number;
  /** Include ANSI escape codes */
  includeAnsiCodes?: boolean;
  /** Include timestamps */
  includeTimestamps?: boolean;
  /** Include working directory */
  includeWorkingDirectory?: boolean;
}

const DEFAULT_OPTIONS: Required<ContextRendererOptions> = {
  maxOutputLength: 5000,
  includeAnsiCodes: false,
  includeTimestamps: true,
  includeWorkingDirectory: true
};

/**
 * Render blocks to LLM context text
 */
export function renderContext(
  blocks: BlockContext[],
  mode: RenderMode,
  options: ContextRendererOptions = {}
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const parts: string[] = [];

  parts.push(`# Terminal Session Context\n`);
  parts.push(`Total blocks: ${blocks.length}\n`);
  parts.push('');

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    if (!block) continue;

    const blockText = renderBlock(block, mode, opts, i + 1);
    if (blockText) {
      parts.push(blockText);
      parts.push('');
    }
  }

  return parts.join('\n');
}

/**
 * Render a single block
 */
function renderBlock(
  block: BlockContext,
  mode: RenderMode,
  options: Required<ContextRendererOptions>,
  index: number
): string {
  const lines: string[] = [];

  // Block header
  lines.push(`## Block #${index} [${block.id}]`);

  // Status indicator
  const statusEmoji = getStatusEmoji(block.status, block.exitCode);
  lines.push(`Status: ${statusEmoji} ${block.status}`);

  // Exit code (if available)
  if (block.exitCode !== undefined) {
    lines.push(`Exit code: ${block.exitCode}`);
  }

  // Timestamps
  if (options.includeTimestamps) {
    lines.push(`Started: ${formatTimestamp(block.startedAt)}`);
    if (block.endedAt) {
      lines.push(`Ended: ${formatTimestamp(block.endedAt)}`);
      lines.push(`Duration: ${calculateDuration(block.startedAt, block.endedAt)}`);
    }
  }

  // Working directory
  if (options.includeWorkingDirectory && block.cwd) {
    lines.push(`Directory: ${block.cwd}`);
  }

  lines.push('');

  // Command
  lines.push('### Command');
  lines.push('```bash');
  lines.push(block.command);
  lines.push('```');

  // Output (based on mode)
  const shouldIncludeOutput = shouldRenderOutput(mode, block);
  if (shouldIncludeOutput && block.output) {
    lines.push('');
    lines.push('### Output');

    let output = decodeOutput(block.output);

    // Strip ANSI codes if configured
    if (!options.includeAnsiCodes) {
      output = stripAnsiCodes(output);
    }

    // Truncate if needed
    if (output.length > options.maxOutputLength) {
      const truncated = output.slice(0, options.maxOutputLength);
      const remaining = output.length - options.maxOutputLength;
      output = truncated + `\n... [${remaining} characters truncated]`;
    }

    // Determine language for syntax highlighting
    const lang = detectOutputLanguage(output, block.command);
    lines.push(`\`\`\`${lang}`);
    lines.push(output.trim());
    lines.push('```');
  }

  return lines.join('\n');
}

/**
 * Determine if output should be rendered based on mode
 */
function shouldRenderOutput(mode: RenderMode, block: BlockContext): boolean {
  switch (mode) {
    case 'full':
      return true;
    case 'errorOnly':
      return block.status === 'error' || (block.exitCode !== undefined && block.exitCode !== 0);
    case 'preview':
      return true; // But will be truncated more aggressively
    case 'commandOnly':
      return false;
    default:
      return true;
  }
}

/**
 * Decode Base64 output to string
 */
function decodeOutput(base64Output: string): string {
  try {
    // Handle browser vs Node.js environments
    if (typeof atob === 'function') {
      const bytes = Uint8Array.from(atob(base64Output), (c) => c.charCodeAt(0));
      const decoder = new TextDecoder('utf-8', { fatal: false });
      return decoder.decode(bytes);
    }
    // Node.js / Bun
    return Buffer.from(base64Output, 'base64').toString('utf-8');
  } catch {
    return '[Unable to decode output]';
  }
}

/**
 * Strip ANSI escape codes from text
 */
function stripAnsiCodes(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
}

/**
 * Get status emoji
 */
function getStatusEmoji(status: string, exitCode?: number): string {
  switch (status) {
    case 'running':
      return '⏳';
    case 'success':
      return '✅';
    case 'error':
      return '❌';
    default:
      if (exitCode !== undefined && exitCode !== 0) {
        return '❌';
      }
      return '⏳';
  }
}

/**
 * Format timestamp for display
 */
function formatTimestamp(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  } catch {
    return isoString;
  }
}

/**
 * Calculate duration between two timestamps
 */
function calculateDuration(start: string, end: string): string {
  try {
    const startTime = new Date(start).getTime();
    const endTime = new Date(end).getTime();
    const durationMs = endTime - startTime;

    if (durationMs < 1000) {
      return `${durationMs}ms`;
    }

    const seconds = Math.floor(durationMs / 1000);
    if (seconds < 60) {
      return `${seconds}s`;
    }

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes < 60) {
      return `${minutes}m ${remainingSeconds}s`;
    }

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  } catch {
    return 'unknown';
  }
}

/**
 * Detect output language for syntax highlighting
 */
function detectOutputLanguage(output: string, command: string): string {
  // Check command for hints
  if (
    command.startsWith('npm') ||
    command.startsWith('yarn') ||
    command.startsWith('pnpm') ||
    command.startsWith('bun')
  ) {
    return ''; // No specific highlighting for package manager output
  }

  if (command.startsWith('git')) {
    return 'diff';
  }

  if (command.startsWith('cat') || command.startsWith('head') || command.startsWith('tail')) {
    // Try to detect from output
    if (output.includes('function ') || output.includes('const ') || output.includes('let ')) {
      return 'javascript';
    }
    if (output.includes('def ') || output.includes('import ') || output.includes('class ')) {
      return 'python';
    }
  }

  // Check output for JSON
  if (output.trim().startsWith('{') || output.trim().startsWith('[')) {
    try {
      JSON.parse(output.trim());
      return 'json';
    } catch {
      // Not valid JSON
    }
  }

  return ''; // No specific language
}

/**
 * Estimate token count for context
 * Rough estimation: ~4 characters per token for English/code
 */
export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Get context summary for UI display
 */
export function getContextSummary(blocks: BlockContext[]): {
  blockCount: number;
  totalChars: number;
  estimatedTokens: number;
  errorCount: number;
} {
  let totalChars = 0;
  let errorCount = 0;

  for (const block of blocks) {
    totalChars += block.command.length;
    if (block.output) {
      try {
        const decoded = decodeOutput(block.output);
        totalChars += decoded.length;
      } catch {
        // Ignore decode errors
      }
    }

    if (block.status === 'error' || (block.exitCode !== undefined && block.exitCode !== 0)) {
      errorCount++;
    }
  }

  return {
    blockCount: blocks.length,
    totalChars,
    estimatedTokens: estimateTokenCount(totalChars.toString()),
    errorCount
  };
}
