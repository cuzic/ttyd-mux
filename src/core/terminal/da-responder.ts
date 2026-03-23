/**
 * Device Attributes Responder
 *
 * Filters DA responses and focus events from xterm.js input to prevent
 * echo loops and input timing interference.
 */

// CSI (Control Sequence Introducer) for terminal responses
// These are responses FROM the terminal TO applications, not display content
// DA1 response: CSI ? Ps ; Ps ; ... c (e.g., ESC[?64;1;2;...c)
// DA2 response: CSI > Ps ; Ps ; Ps c (e.g., ESC[>0;276;0c)
// DA3 response: CSI = Ps c (e.g., ESC[=...c)
// Note: DA queries (CSI > c or CSI > 0 c) have no semicolons, so we require at least one
// Pattern string - create new RegExp instances to avoid global state race conditions
const CSI_DA_RESPONSE_PATTERN_STR = '\\x1b\\[[>?=]\\d*;\\d+[;\\d]*c';

// Focus events from xterm.js - these can interfere with input timing
// Focus In: ESC [ I
// Focus Out: ESC [ O
const FOCUS_EVENT_PATTERN_STR = '\\x1b\\[[IO]';

/**
 * Filter DA responses from xterm.js input before writing to PTY.
 * Prevents echo loops where xterm.js responds to our DA queries.
 *
 * @returns The filtered text, or null if the entire input was DA responses
 */
export function filterDAResponses(text: string): string | null {
  const daPattern = new RegExp(CSI_DA_RESPONSE_PATTERN_STR, 'g');
  if (!daPattern.test(text)) {
    return text;
  }
  const filtered = text.replace(new RegExp(CSI_DA_RESPONSE_PATTERN_STR, 'g'), '');
  return filtered || null;
}

/**
 * Filter focus events from xterm.js input.
 * Focus In (ESC [ I) and Focus Out (ESC [ O) can interfere with input timing.
 *
 * @returns The filtered text, or null if the entire input was focus events
 */
export function filterFocusEvents(text: string): string | null {
  const focusPattern = new RegExp(FOCUS_EVENT_PATTERN_STR, 'g');
  if (!focusPattern.test(text)) {
    return text;
  }
  const filtered = text.replace(new RegExp(FOCUS_EVENT_PATTERN_STR, 'g'), '');
  return filtered || null;
}
