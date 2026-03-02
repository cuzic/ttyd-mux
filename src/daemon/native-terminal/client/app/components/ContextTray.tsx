/**
 * Context Tray Component
 *
 * Shows selected blocks for AI context.
 */

import { type FC, useMemo } from 'react';
import { useBlockStore } from '../stores/blockStore.js';
import { useChatStore } from '../stores/chatStore.js';

export interface ContextTrayProps {
  onClose?: () => void;
}

export const ContextTray: FC<ContextTrayProps> = ({ onClose }) => {
  // Block state
  const blocks = useBlockStore((s) => s.blocks);

  // Chat state
  const contextBlockIds = useChatStore((s) => s.contextBlockIds);
  const removeContextBlock = useChatStore((s) => s.removeContextBlock);
  const clearContextBlocks = useChatStore((s) => s.clearContextBlocks);

  // Get context blocks
  const contextBlocks = useMemo(() => {
    return contextBlockIds
      .map((id) => blocks.find((b) => b.id === id))
      .filter((b): b is NonNullable<typeof b> => b !== undefined);
  }, [contextBlockIds, blocks]);

  // Estimate context size
  const contextEstimate = useMemo(() => {
    let totalChars = 0;
    for (const block of contextBlocks) {
      totalChars += block.command.length;
      totalChars += block.output?.length ?? 0;
    }
    const estimatedTokens = Math.ceil(totalChars / 4);
    return { totalChars, estimatedTokens };
  }, [contextBlocks]);

  if (contextBlockIds.length === 0) {
    return null;
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <span style={styles.title}>AI Context</span>
        <span style={styles.count}>{contextBlockIds.length} blocks</span>
        <span style={styles.estimate}>~{contextEstimate.estimatedTokens} tokens</span>
        <button type="button" style={styles.clearButton} onClick={clearContextBlocks}>
          Clear All
        </button>
      </div>

      {/* Block list */}
      <div style={styles.blockList}>
        {contextBlocks.map((block) => (
          <div key={block.id} style={styles.blockItem}>
            <span style={{ ...styles.statusDot, backgroundColor: getStatusColor(block.status) }} />
            <span style={styles.command}>{truncateCommand(block.command, 40)}</span>
            <button
              type="button"
              style={styles.removeButton}
              onClick={() => removeContextBlock(block.id)}
              title="Remove from context"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {/* Warning for large context */}
      {contextEstimate.estimatedTokens > 50000 && (
        <div style={styles.warning}>Large context may slow down responses and increase costs.</div>
      )}
    </div>
  );
};

// Helper functions
function getStatusColor(status: string): string {
  switch (status) {
    case 'success':
      return '#4caf50';
    case 'error':
      return '#f44336';
    case 'running':
      return '#ff9800';
    default:
      return '#888';
  }
}

function truncateCommand(command: string, maxLength: number): string {
  if (command.length <= maxLength) return command;
  return command.slice(0, maxLength - 3) + '...';
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    backgroundColor: 'rgba(30, 30, 30, 0.95)',
    borderBottom: '1px solid #333',
    padding: '8px'
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '8px'
  },
  title: {
    color: '#fff',
    fontSize: '12px',
    fontWeight: 'bold'
  },
  count: {
    color: '#888',
    fontSize: '11px'
  },
  estimate: {
    color: '#666',
    fontSize: '10px',
    flex: 1
  },
  clearButton: {
    padding: '2px 8px',
    fontSize: '11px',
    color: '#888',
    backgroundColor: 'transparent',
    border: '1px solid #555',
    borderRadius: '3px',
    cursor: 'pointer'
  },
  blockList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    maxHeight: '120px',
    overflowY: 'auto'
  },
  blockItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 6px',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: '4px',
    fontSize: '11px'
  },
  statusDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    flexShrink: 0
  },
  command: {
    color: '#ccc',
    fontFamily: 'monospace',
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  removeButton: {
    padding: '0 4px',
    fontSize: '14px',
    color: '#888',
    backgroundColor: 'transparent',
    border: 'none',
    cursor: 'pointer',
    lineHeight: 1
  },
  warning: {
    marginTop: '8px',
    padding: '6px 8px',
    fontSize: '11px',
    color: '#ff9800',
    backgroundColor: 'rgba(255, 152, 0, 0.1)',
    borderRadius: '4px'
  }
};
