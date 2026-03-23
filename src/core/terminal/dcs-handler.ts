/**
 * DCS / OSC 52 Handler
 *
 * Fixes OSC 52 clipboard sequences that have been partially processed by tmux.
 * When set-clipboard is enabled, tmux strips the clipboard target for its own
 * handling, outputting ESC]52;;base64... instead of ESC]52;c;base64...
 * We restore the 'c' target for xterm.js ClipboardAddon to work.
 */

/**
 * Fix OSC 52 sequences missing the clipboard target.
 *
 * @param text - Terminal output text
 * @returns Processed text with OSC 52 target restored
 */
export function fixOsc52ClipboardTarget(text: string): string {
  if (!text.includes('\x1b]52;;')) {
    return text;
  }
  return text.replace(/\x1b\]52;;/g, '\x1b]52;c;');
}
