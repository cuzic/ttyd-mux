/**
 * Context Renderer Inline Blocks Tests
 *
 * Tests for rendering inline blocks (Claude turns) in AI context.
 */

import { describe, expect, test } from 'bun:test';
import { renderCombinedContext, renderInlineBlocks } from './context-renderer.js';
import type { BlockContext, FileContext, InlineBlock } from './types.js';

describe('renderInlineBlocks', () => {
  test('should return empty string for empty array', () => {
    const result = renderInlineBlocks([]);
    expect(result).toBe('');
  });

  test('should render Claude conversation block', () => {
    const blocks: InlineBlock[] = [
      {
        id: 'claude-turn-1',
        type: 'claude',
        content: '## User\nHello!\n\n## Assistant\nHi there!',
        metadata: {
          userMessage: 'Hello!',
          toolCallCount: 0
        }
      }
    ];

    const result = renderInlineBlocks(blocks);

    expect(result).toContain('# Inline Context');
    expect(result).toContain('Total items: 1');
    expect(result).toContain('Claude Conversation #1');
    expect(result).toContain('[claude-turn-1]');
    expect(result).toContain('User: Hello!');
    expect(result).toContain('Tool calls: 0');
    expect(result).toContain('```markdown');
    expect(result).toContain('Hi there!');
  });

  test('should render command block', () => {
    const blocks: InlineBlock[] = [
      {
        id: 'cmd-1',
        type: 'command',
        content: '$ ls -la\ntotal 64',
        metadata: {
          command: 'ls -la',
          exitCode: 0,
          status: 'success'
        }
      }
    ];

    const result = renderInlineBlocks(blocks);

    expect(result).toContain('Command Output #1');
    expect(result).toContain('[cmd-1]');
    expect(result).toContain('Command: ls -la');
    expect(result).toContain('Exit code: 0');
    expect(result).toContain('total 64');
  });

  test('should render multiple blocks', () => {
    const blocks: InlineBlock[] = [
      {
        id: 'block-1',
        type: 'claude',
        content: 'Content 1'
      },
      {
        id: 'block-2',
        type: 'command',
        content: 'Content 2'
      }
    ];

    const result = renderInlineBlocks(blocks);

    expect(result).toContain('Total items: 2');
    expect(result).toContain('Claude Conversation #1');
    expect(result).toContain('Command Output #2');
  });

  test('should truncate long user messages in metadata', () => {
    const longMessage = 'A'.repeat(200);
    const blocks: InlineBlock[] = [
      {
        id: 'long-1',
        type: 'claude',
        content: 'Content',
        metadata: {
          userMessage: longMessage
        }
      }
    ];

    const result = renderInlineBlocks(blocks);

    // Should be truncated to 100 chars + ...
    expect(result).toContain(`${'A'.repeat(100)}...`);
    expect(result).not.toContain('A'.repeat(101));
  });
});

describe('renderCombinedContext with inlineBlocks', () => {
  test('should render only inline blocks when no regular blocks or files', () => {
    const blocks: BlockContext[] = [];
    const files: FileContext[] = [];
    const inlineBlocks: InlineBlock[] = [
      {
        id: 'inline-1',
        type: 'claude',
        content: 'Claude turn content'
      }
    ];

    const result = renderCombinedContext(blocks, files, 'full', {}, inlineBlocks);

    expect(result).toContain('# Inline Context');
    expect(result).toContain('Claude turn content');
    expect(result).not.toContain('# Terminal Session Context');
  });

  test('should render blocks, inline blocks, and files together', () => {
    const blocks: BlockContext[] = [
      {
        id: 'block-1',
        command: 'echo hello',
        output: btoa('hello\n'),
        status: 'success',
        exitCode: 0,
        startedAt: '2024-03-02T10:00:00Z',
        endedAt: '2024-03-02T10:00:01Z'
      }
    ];
    const files: FileContext[] = [
      {
        source: 'project',
        path: 'README.md',
        name: 'README.md',
        content: '# Test',
        size: 6,
        modifiedAt: '2024-03-02T10:00:00Z'
      }
    ];
    const inlineBlocks: InlineBlock[] = [
      {
        id: 'claude-1',
        type: 'claude',
        content: 'AI response'
      }
    ];

    const result = renderCombinedContext(blocks, files, 'full', {}, inlineBlocks);

    // All sections should be present
    expect(result).toContain('# Terminal Session Context');
    expect(result).toContain('# Inline Context');
    expect(result).toContain('# Attached Files');

    // Separators should be present
    expect(result).toContain('---');
  });

  test('should work with empty inline blocks', () => {
    const blocks: BlockContext[] = [
      {
        id: 'block-1',
        command: 'ls',
        output: btoa('files'),
        status: 'success',
        startedAt: '2024-03-02T10:00:00Z'
      }
    ];

    const result = renderCombinedContext(blocks, [], 'full', {}, []);

    expect(result).toContain('# Terminal Session Context');
    expect(result).not.toContain('# Inline Context');
  });
});
