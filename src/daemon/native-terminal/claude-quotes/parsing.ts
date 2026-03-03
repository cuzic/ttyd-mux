/**
 * Claude Session File Parsing
 *
 * Parses Claude Code session JSONL files to extract conversation turns.
 */

import { readJsonlFile } from '../utils/jsonl.js';
import type { ClaudeTurnFull, ClaudeTurnSummary } from './types.js';

/**
 * Claude session JSONL entry structure
 */
interface SessionEntry {
  isMeta?: boolean;
  type?: 'user' | 'assistant';
  uuid?: string;
  parentUuid?: string;
  timestamp?: string;
  message?: {
    role?: string;
    content?: string | Array<{ type: string; text?: string; name?: string; input?: Record<string, unknown> }>;
  };
}

/**
 * Parse assistant responses from a Claude session file
 * @param sessionFile Path to the session JSONL file
 * @param count Maximum number of responses to return
 * @returns Array of assistant response summaries (newest first)
 */
export function parseTurnsFromSessionFile(
  sessionFile: string,
  count: number
): ClaudeTurnSummary[] {
  const entries = readJsonlFile<SessionEntry>(sessionFile);

  const turns: ClaudeTurnSummary[] = [];

  for (const entry of entries) {
    // Skip meta entries and user entries - only process assistant entries
    if (entry.isMeta) continue;
    if (entry.type !== 'assistant') continue;
    if (!Array.isArray(entry.message?.content)) continue;

    // Extract text and tool info from assistant content
    let assistantSummary = '';
    let hasToolUse = false;
    const editedFiles: string[] = [];

    for (const block of entry.message.content) {
      if (block.type === 'text' && block.text && !assistantSummary) {
        assistantSummary = block.text.slice(0, 500);
      }
      if (block.type === 'tool_use') {
        hasToolUse = true;
        // Track edited files
        if (block.name === 'Edit' || block.name === 'Write') {
          const filePath = block.input?.['file_path'] || block.input?.['path'];
          if (typeof filePath === 'string') {
            editedFiles.push(filePath);
          }
        }
      }
    }

    // Only include entries with text content (not just tool_use)
    if (assistantSummary && entry.uuid) {
      turns.push({
        uuid: entry.uuid,
        assistantSummary,
        timestamp: entry.timestamp ?? '',
        hasToolUse,
        editedFiles: editedFiles.length > 0 ? editedFiles : undefined
      });
    }
  }

  // Return most recent turns (reversed so newest first)
  return turns.slice(-count).reverse();
}

/**
 * Parse a specific assistant response by UUID from a Claude session file
 * @param sessionFile Path to the session JSONL file
 * @param uuid The assistant response UUID to find
 * @returns Full assistant content or null if not found
 */
export function parseTurnByUuidFromSessionFile(
  sessionFile: string,
  uuid: string
): ClaudeTurnFull | null {
  const entries = readJsonlFile<SessionEntry>(sessionFile);

  for (const entry of entries) {
    // Find the assistant entry with matching UUID
    if (entry.uuid === uuid && entry.type === 'assistant') {
      let assistantContent = '';
      const toolUses: Array<{ name: string; input: Record<string, unknown> }> = [];

      const content = entry.message?.content;
      if (Array.isArray(content)) {
        for (const block of content) {
          if (block.type === 'text' && block.text) {
            assistantContent += block.text + '\n\n';
          }
          if (block.type === 'tool_use' && block.name && block.input) {
            toolUses.push({
              name: block.name,
              input: block.input
            });
          }
        }
      }

      return {
        uuid,
        assistantContent: assistantContent.trim(),
        timestamp: entry.timestamp ?? '',
        toolUses
      };
    }
  }

  return null;
}
