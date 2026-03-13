/**
 * Protocol Helper Functions
 *
 * Functions for parsing client messages and serializing server messages.
 */

import type {
  Block,
  BlockEndMessage,
  BlockListMessage,
  BlockOutputMessage,
  BlockStartMessage
} from './blocks.js';
import type { ServerMessage } from './index.js';
import type { ClientMessage } from './messages.js';
import type {
  BellMessage,
  ErrorMessage,
  ExitMessage,
  FileChangeMessage,
  OutputMessage,
  PongMessage,
  TitleMessage
} from './messages.js';

/**
 * Parse a client message from JSON string
 */
export function parseClientMessage(data: string): ClientMessage | null {
  try {
    const parsed = JSON.parse(data);
    if (typeof parsed !== 'object' || parsed === null) {
      return null;
    }

    switch (parsed.type) {
      case 'input':
        if (typeof parsed.data === 'string') {
          return { type: 'input', data: parsed.data };
        }
        break;
      case 'resize':
        if (
          typeof parsed.cols === 'number' &&
          typeof parsed.rows === 'number' &&
          parsed.cols > 0 &&
          parsed.rows > 0
        ) {
          return { type: 'resize', cols: parsed.cols, rows: parsed.rows };
        }
        break;
      case 'ping':
        return { type: 'ping' };
      case 'watchFile':
        if (typeof parsed.path === 'string') {
          return { type: 'watchFile', path: parsed.path };
        }
        break;
      case 'unwatchFile':
        if (typeof parsed.path === 'string') {
          return { type: 'unwatchFile', path: parsed.path };
        }
        break;
      case 'watchDir':
        if (typeof parsed.path === 'string') {
          return { type: 'watchDir', path: parsed.path };
        }
        break;
      case 'unwatchDir':
        if (typeof parsed.path === 'string') {
          return { type: 'unwatchDir', path: parsed.path };
        }
        break;
      case 'replayRequest':
        return { type: 'replayRequest' };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Serialize a server message to JSON string
 */
export function serializeServerMessage(message: ServerMessage): string {
  return JSON.stringify(message);
}

/**
 * Create an output message from raw PTY data
 */
export function createOutputMessage(data: Buffer | Uint8Array): OutputMessage {
  const base64 = Buffer.from(data).toString('base64');
  return { type: 'output', data: base64 };
}

/**
 * Create an error message
 */
export function createErrorMessage(message: string): ErrorMessage {
  return { type: 'error', message };
}

/**
 * Create an exit message
 */
export function createExitMessage(code: number): ExitMessage {
  return { type: 'exit', code };
}

/**
 * Create a title message
 */
export function createTitleMessage(title: string): TitleMessage {
  return { type: 'title', title };
}

/**
 * Create a pong message
 */
export function createPongMessage(): PongMessage {
  return { type: 'pong' };
}

/**
 * Create a bell message
 */
export function createBellMessage(): BellMessage {
  return { type: 'bell' };
}

/**
 * Create a file change message
 */
export function createFileChangeMessage(path: string): FileChangeMessage {
  return { type: 'fileChange', path, timestamp: Date.now() };
}

/**
 * Create a block start message
 */
export function createBlockStartMessage(block: Block): BlockStartMessage {
  return { type: 'blockStart', block };
}

/**
 * Create a block end message
 */
export function createBlockEndMessage(
  blockId: string,
  exitCode: number,
  endedAt: string,
  endLine: number
): BlockEndMessage {
  return { type: 'blockEnd', blockId, exitCode, endedAt, endLine };
}

/**
 * Create a block output message
 */
export function createBlockOutputMessage(blockId: string, data: string): BlockOutputMessage {
  return { type: 'blockOutput', blockId, data };
}

/**
 * Create a block list message
 */
export function createBlockListMessage(blocks: Block[]): BlockListMessage {
  return { type: 'blockList', blocks };
}
