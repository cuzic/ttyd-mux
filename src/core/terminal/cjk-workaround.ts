/**
 * CJK Input Workaround
 *
 * Workaround for first-character loss on mobile with CJK text.
 * Sends a space first to "wake up" the PTY, then sends the actual text
 * after a short delay. This prevents the first character from being lost
 * in certain terminal environments.
 *
 * See ADR 054 for details.
 */

// CJK character detection
// Includes: Hiragana, Katakana, CJK Unified Ideographs, Hangul Syllables
const CJK_PATTERN = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF]/;

// Newline-only input detection (skip CJK workaround for Enter key)
const NEWLINE_ONLY_PATTERN = /^[\r\n]+$/;

interface TerminalWriter {
  write(data: string): void;
  readonly closed: boolean;
}

/**
 * Check if text requires the CJK workaround (contains CJK chars and is not newline-only).
 */
export function needsCjkWorkaround(text: string): boolean {
  return CJK_PATTERN.test(text) && !NEWLINE_ONLY_PATTERN.test(text);
}

/**
 * Apply the CJK workaround: send space to wake up PTY, then send text after delay.
 *
 * @param text - The CJK text to write
 * @param terminal - Terminal writer
 */
export function applyCjkWorkaround(text: string, terminal: TerminalWriter): void {
  // Send space to "wake up" the PTY
  terminal.write(' ');

  // Send actual text after short delay
  setTimeout(() => {
    if (!terminal.closed) {
      terminal.write(text);
    }
  }, 50);
}
