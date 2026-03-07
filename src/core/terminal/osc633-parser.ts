/**
 * OSC 633 Parser - Parse shell integration sequences
 *
 * OSC 633 is the escape sequence protocol used by VS Code shell integration.
 * This parser extracts OSC 633 sequences from terminal output and returns
 * the filtered output without these control sequences.
 *
 * Sequence format: ESC ] 633 ; <type> [; <data>] BEL
 *
 * Types:
 * - A: Prompt start
 * - B: Prompt end / command start
 * - C: Pre-execution (command about to run)
 * - D: Command finished (with exit code)
 * - E: Explicit command line
 * - P: Property (e.g., Cwd=...)
 */

// OSC 633 control sequence markers
const OSC_START = '\x1b]633;';
const OSC_END = '\x07';

export type OSC633Type = 'A' | 'B' | 'C' | 'D' | 'E' | 'P';

export interface OSC633Sequence {
  type: OSC633Type;
  data?: string;
}

export interface ParseResult {
  /** Output text with OSC 633 sequences removed */
  filteredOutput: string;
  /** Parsed OSC 633 sequences */
  sequences: OSC633Sequence[];
}

/**
 * OSC 633 Parser for shell integration sequences
 */
export class Osc633Parser {
  // Buffer for incomplete sequences across chunk boundaries
  private buffer = '';

  /**
   * Parse OSC 633 sequences from output text
   * @param text Raw terminal output text
   * @returns Filtered output and parsed sequences
   */
  parse(text: string): ParseResult {
    const sequences: OSC633Sequence[] = [];
    let filteredOutput = '';
    let i = 0;

    // Prepend any buffered incomplete sequence
    const fullText = this.buffer + text;
    this.buffer = '';

    while (i < fullText.length) {
      // Look for OSC 633 start sequence
      if (fullText.slice(i).startsWith(OSC_START)) {
        const startIndex = i + OSC_START.length;
        const endIndex = fullText.indexOf(OSC_END, startIndex);

        if (endIndex === -1) {
          // Incomplete sequence - buffer for next chunk
          this.buffer = fullText.slice(i);
          break;
        }

        // Parse the sequence content
        const content = fullText.slice(startIndex, endIndex);
        const seq = this.parseContent(content);
        if (seq) {
          sequences.push(seq);
        }

        i = endIndex + OSC_END.length;
      } else {
        filteredOutput += fullText[i];
        i++;
      }
    }

    return { filteredOutput, sequences };
  }

  /**
   * Parse OSC 633 sequence content (the part after "633;")
   */
  private parseContent(content: string): OSC633Sequence | null {
    if (content.length === 0) {
      return null;
    }

    const type = content[0] as OSC633Type;
    const validTypes: OSC633Type[] = ['A', 'B', 'C', 'D', 'E', 'P'];

    if (!validTypes.includes(type)) {
      return null;
    }

    // Check for data after the type (separated by ";")
    const dataStart = content.indexOf(';');
    const data = dataStart !== -1 ? content.slice(dataStart + 1) : undefined;

    return { type, data };
  }

  /**
   * Reset the parser state (clear buffer)
   */
  reset(): void {
    this.buffer = '';
  }

  /**
   * Check if there's a partial sequence buffered
   */
  hasPartialSequence(): boolean {
    return this.buffer.length > 0;
  }
}

/**
 * Unescape an OSC 633 command string
 *
 * OSC 633 E sequences escape special characters:
 * - \\n -> newline
 * - \\; -> semicolon
 * - \\\\ -> backslash
 */
export function unescapeOsc633Command(escaped: string): string {
  return escaped.replace(/\\n/g, '\n').replace(/\\;/g, ';').replace(/\\\\/g, '\\');
}

/**
 * Extract exit code from OSC 633 D sequence data
 */
export function parseExitCode(data: string | undefined): number {
  if (!data) {
    return 0;
  }
  const parsed = Number.parseInt(data, 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * Extract property from OSC 633 P sequence data
 * Returns null if not a valid property format
 */
export function parseProperty(data: string | undefined): { key: string; value: string } | null {
  if (!data) {
    return null;
  }

  const eqIndex = data.indexOf('=');
  if (eqIndex === -1) {
    return null;
  }

  return {
    key: data.slice(0, eqIndex),
    value: data.slice(eqIndex + 1)
  };
}
