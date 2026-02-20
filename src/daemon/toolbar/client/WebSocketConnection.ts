/**
 * WebSocket Connection Manager
 *
 * Handles WebSocket connection to ttyd server and provides
 * methods for sending text and binary data.
 */

const OriginalWebSocket = window.WebSocket;

export class WebSocketConnection {
  private ws: WebSocket | null = null;

  constructor() {
    this.interceptWebSocketCreation();
  }

  /**
   * Intercept WebSocket creation to capture ttyd connection
   */
  private interceptWebSocketCreation(): void {
    // biome-ignore lint/suspicious/noExplicitAny: WebSocket constructor override
    (window as any).WebSocket = (url: string, protocols?: string | string[]) => {
      const socket = new OriginalWebSocket(url, protocols);
      if (url.includes('/ws')) {
        this.ws = socket;
      }
      return socket;
    };

    // Copy static properties
    window.WebSocket.prototype = OriginalWebSocket.prototype;
    Object.defineProperty(window.WebSocket, 'CONNECTING', { value: OriginalWebSocket.CONNECTING });
    Object.defineProperty(window.WebSocket, 'OPEN', { value: OriginalWebSocket.OPEN });
    Object.defineProperty(window.WebSocket, 'CLOSING', { value: OriginalWebSocket.CLOSING });
    Object.defineProperty(window.WebSocket, 'CLOSED', { value: OriginalWebSocket.CLOSED });
  }

  /**
   * Find active WebSocket connection
   */
  findWebSocket(): WebSocket | null {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return this.ws;
    }

    if (window.socket && window.socket.readyState === WebSocket.OPEN) {
      this.ws = window.socket;
      return this.ws;
    }

    return null;
  }

  /**
   * Check if connection is open
   */
  isConnected(): boolean {
    return this.findWebSocket() !== null;
  }

  /**
   * Send text to terminal
   * ttyd protocol: binary data with '0' (input command) as first byte
   */
  sendText(text: string): boolean {
    const socket = this.findWebSocket();
    if (!socket) {
      return false;
    }

    const encoder = new TextEncoder();
    const textBytes = encoder.encode(text);
    const data = new Uint8Array(textBytes.length + 1);
    data[0] = 0x30; // '0' = input command
    data.set(textBytes, 1);
    socket.send(data);
    return true;
  }

  /**
   * Send raw bytes to terminal
   */
  sendBytes(bytes: number[]): boolean {
    const socket = this.findWebSocket();
    if (!socket) {
      return false;
    }

    const data = new Uint8Array(bytes.length + 1);
    data[0] = 0x30; // '0' = input command
    data.set(bytes, 1);
    socket.send(data);
    return true;
  }
}
