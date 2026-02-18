import { afterEach, describe, expect, mock, test } from 'bun:test';
import { EventEmitter } from 'node:events';
import type { IncomingMessage } from 'node:http';
import type { Socket } from 'node:net';
import WebSocket from 'ws';
import { closeWebSocket, setupWebSocketForwarding } from './ws-proxy.js';

/**
 * Create a mock WebSocket for testing
 */
function createMockWebSocket(readyState: number = WebSocket.OPEN): WebSocket {
  const ws = new EventEmitter() as WebSocket;
  ws.readyState = readyState;
  ws.close = mock(() => undefined);
  ws.terminate = mock(() => undefined);
  ws.send = mock(() => undefined);
  return ws;
}

/**
 * Create a mock Socket for testing
 */
function createMockSocket(): Socket {
  const socket = new EventEmitter() as Socket;
  socket.destroy = mock(() => socket);
  return socket;
}

/**
 * Create a mock IncomingMessage for testing
 */
function createMockRequest(url: string, protocol?: string): IncomingMessage {
  const req = new EventEmitter() as IncomingMessage;
  req.url = url;
  req.headers = {};
  if (protocol) {
    req.headers['sec-websocket-protocol'] = protocol;
  }
  return req;
}

describe('closeWebSocket', () => {
  test('closes WebSocket when in OPEN state', () => {
    const ws = createMockWebSocket(WebSocket.OPEN);
    closeWebSocket(ws, 1000, 'normal');
    expect(ws.close).toHaveBeenCalledWith(1000, 'normal');
    expect(ws.terminate).not.toHaveBeenCalled();
  });

  test('terminates WebSocket when not in OPEN state', () => {
    const ws = createMockWebSocket(WebSocket.CONNECTING);
    closeWebSocket(ws, 1000, 'normal');
    expect(ws.terminate).toHaveBeenCalled();
    expect(ws.close).not.toHaveBeenCalled();
  });

  test('terminates WebSocket in CLOSING state', () => {
    const ws = createMockWebSocket(WebSocket.CLOSING);
    closeWebSocket(ws, 1000, 'normal');
    expect(ws.terminate).toHaveBeenCalled();
  });

  test('terminates WebSocket in CLOSED state', () => {
    const ws = createMockWebSocket(WebSocket.CLOSED);
    closeWebSocket(ws, 1000, 'normal');
    expect(ws.terminate).toHaveBeenCalled();
  });
});

describe('setupWebSocketForwarding', () => {
  test('forwards messages from client to backend', () => {
    const clientWs = createMockWebSocket();
    const backendWs = createMockWebSocket();

    setupWebSocketForwarding(clientWs, backendWs);

    // Simulate client sending message
    clientWs.emit('message', Buffer.from('hello'), false);

    expect(backendWs.send).toHaveBeenCalledWith(Buffer.from('hello'), { binary: false });
  });

  test('forwards messages from backend to client', () => {
    const clientWs = createMockWebSocket();
    const backendWs = createMockWebSocket();

    setupWebSocketForwarding(clientWs, backendWs);

    // Simulate backend sending message
    backendWs.emit('message', Buffer.from('world'), true);

    expect(clientWs.send).toHaveBeenCalledWith(Buffer.from('world'), { binary: true });
  });

  test('does not forward if backend is not OPEN', () => {
    const clientWs = createMockWebSocket();
    const backendWs = createMockWebSocket(WebSocket.CLOSING);

    setupWebSocketForwarding(clientWs, backendWs);

    // Simulate client sending message
    clientWs.emit('message', Buffer.from('hello'), false);

    expect(backendWs.send).not.toHaveBeenCalled();
  });

  test('does not forward if client is not OPEN', () => {
    const clientWs = createMockWebSocket(WebSocket.CLOSING);
    const backendWs = createMockWebSocket();

    setupWebSocketForwarding(clientWs, backendWs);

    // Simulate backend sending message
    backendWs.emit('message', Buffer.from('world'), true);

    expect(clientWs.send).not.toHaveBeenCalled();
  });

  test('closes backend when client closes', () => {
    const clientWs = createMockWebSocket();
    const backendWs = createMockWebSocket();

    setupWebSocketForwarding(clientWs, backendWs);

    // Simulate client close
    clientWs.emit('close', 1000, Buffer.from('normal'));

    expect(backendWs.close).toHaveBeenCalledWith(1000, 'normal');
  });

  test('closes client when backend closes', () => {
    const clientWs = createMockWebSocket();
    const backendWs = createMockWebSocket();

    setupWebSocketForwarding(clientWs, backendWs);

    // Simulate backend close
    backendWs.emit('close', 1001, Buffer.from('going away'));

    expect(clientWs.close).toHaveBeenCalledWith(1001, 'going away');
  });

  test('cleanup only runs once', () => {
    const clientWs = createMockWebSocket();
    const backendWs = createMockWebSocket();

    setupWebSocketForwarding(clientWs, backendWs);

    // Simulate both sides closing
    clientWs.emit('close', 1000, Buffer.from(''));
    backendWs.emit('close', 1000, Buffer.from(''));

    // Should only close backend once (from client close)
    expect(backendWs.close).toHaveBeenCalledTimes(1);
  });

  test('handles client error', () => {
    const clientWs = createMockWebSocket();
    const backendWs = createMockWebSocket();

    setupWebSocketForwarding(clientWs, backendWs);

    // Simulate client error
    clientWs.emit('error', new Error('connection reset'));

    expect(clientWs.terminate).toHaveBeenCalled();
    expect(backendWs.close).toHaveBeenCalledWith(1006, '');
  });

  test('handles backend error', () => {
    const clientWs = createMockWebSocket();
    const backendWs = createMockWebSocket();

    setupWebSocketForwarding(clientWs, backendWs);

    // Simulate backend error
    backendWs.emit('error', new Error('connection refused'));

    expect(backendWs.terminate).toHaveBeenCalled();
    expect(clientWs.close).toHaveBeenCalledWith(1006, '');
  });

  test('uses default close code when not provided', () => {
    const clientWs = createMockWebSocket();
    const backendWs = createMockWebSocket();

    setupWebSocketForwarding(clientWs, backendWs);

    // Simulate close without code
    clientWs.emit('close', undefined, undefined);

    expect(backendWs.close).toHaveBeenCalledWith(1000, '');
  });
});

describe('handleUpgrade', () => {
  afterEach(() => {
    mock.restore();
  });

  test('destroys socket when no session found', async () => {
    // Mock the router module
    mock.module('./router.js', () => ({
      findSessionForPath: () => undefined
    }));

    // Re-import to get mocked version
    const { handleUpgrade: mockedHandleUpgrade } = await import('./ws-proxy.js');

    const socket = createMockSocket();
    const req = createMockRequest('/ttyd-mux/unknown/ws');

    mockedHandleUpgrade({} as never, req, socket, Buffer.alloc(0));

    expect(socket.destroy).toHaveBeenCalled();
  });
});
