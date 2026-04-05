/**
 * WebSocket Connection Manager
 *
 * Handles connection to terminal server via TerminalClient
 * and provides methods for sending text data.
 */

// TerminalClientInterface and Window.__TERMINAL_CLIENT__ are declared in @/browser/shared/types.ts

export class WebSocketConnection {
  /**
   * Check if connection is open
   */
  get isConnected(): boolean {
    return window.__TERMINAL_CLIENT__?.isConnected ?? false;
  }

  /**
   * Send text to terminal via TerminalClient
   */
  sendText(text: string): boolean {
    const client = window.__TERMINAL_CLIENT__;
    if (!client || !client.isConnected) {
      return false;
    }
    client.sendInput(text);
    return true;
  }

  /**
   * Send raw bytes to terminal (converted to text)
   */
  sendBytes(bytes: number[]): boolean {
    const text = String.fromCharCode(...bytes);
    return this.sendText(text);
  }
}
