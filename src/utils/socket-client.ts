/**
 * SocketClient interface for abstracting Unix socket communication
 * Allows mocking in tests without actual socket connections
 */

import { access } from 'node:fs/promises';
import { connect, type Socket } from 'node:net';

export interface SocketClient {
  /**
   * Connect to a Unix socket
   */
  connect(path: string): Socket;

  /**
   * Check if a socket file exists
   */
  exists(path: string): Promise<boolean>;
}

/**
 * Default implementation using Node.js net module
 */
export const defaultSocketClient: SocketClient = {
  connect(path: string): Socket {
    return connect(path);
  },

  async exists(path: string): Promise<boolean> {
    try {
      await access(path);
      return true;
    } catch {
      return false;
    }
  }
};

/**
 * Create a mock SocketClient for testing
 */
export function createMockSocketClient(overrides?: Partial<SocketClient>): SocketClient {
  return {
    connect:
      overrides?.connect ??
      (() => {
        throw new Error('connect not mocked');
      }),
    exists: overrides?.exists ?? (async () => false)
  };
}
