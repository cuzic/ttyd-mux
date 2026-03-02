/**
 * Terminal Pane Component
 *
 * Wraps xterm.js terminal with React integration.
 */

import { type FC, useEffect } from 'react';
import { useTerminal } from '../hooks/useTerminal.js';
import { BlockOverlay } from './BlockOverlay.js';

export interface TerminalPaneProps {
  wsUrl: string;
  sessionName: string;
  fontSize?: number;
  scrollback?: number;
  onConnected?: () => void;
  onDisconnected?: () => void;
  onError?: (error: string) => void;
}

export const TerminalPane: FC<TerminalPaneProps> = ({
  wsUrl,
  sessionName,
  fontSize = 14,
  scrollback = 10000,
  onConnected,
  onDisconnected,
  onError
}) => {
  const { containerRef, terminal, isConnected, isLoading, error, connect, fit, sendInput, focus } =
    useTerminal({
      wsUrl,
      fontSize,
      scrollback,
      autoReconnect: true
    });

  // Connect on mount
  useEffect(() => {
    connect().catch((err) => {
      console.error('[TerminalPane] Connection failed:', err);
    });
  }, [connect]);

  // Callback effects
  useEffect(() => {
    if (isConnected) {
      onConnected?.();
    } else {
      onDisconnected?.();
    }
  }, [isConnected, onConnected, onDisconnected]);

  useEffect(() => {
    if (error) {
      onError?.(error);
    }
  }, [error, onError]);

  // Handle resize
  useEffect(() => {
    const handleResize = () => fit();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [fit]);

  return (
    <div class="terminal-pane" style={styles.container}>
      {/* Loading overlay */}
      {isLoading && (
        <div style={styles.loading}>
          <span>Connecting to {sessionName}...</span>
        </div>
      )}

      {/* Error overlay */}
      {error && !isLoading && (
        <div style={styles.error}>
          <span>Connection error: {error}</span>
        </div>
      )}

      {/* Terminal container */}
      <div ref={containerRef} style={styles.terminal} onClick={() => focus()} />

      {/* Block overlay (rendered on top of terminal) */}
      {terminal && <BlockOverlay terminalElement={containerRef.current} />}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'relative',
    width: '100%',
    height: '100%',
    backgroundColor: '#1e1e1e',
    overflow: 'hidden'
  },
  terminal: {
    width: '100%',
    height: '100%'
  },
  loading: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    color: '#888',
    fontSize: '14px',
    zIndex: 10
  },
  error: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    color: '#f44336',
    fontSize: '14px',
    textAlign: 'center',
    padding: '20px',
    zIndex: 10
  }
};
