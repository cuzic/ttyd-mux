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
 * Parse turns from a Claude session file
 * @param sessionFile Path to the session JSONL file
 * @param count Maximum number of turns to return
 * @returns Array of turn summaries (newest first)
 */
export function parseTurnsFromSessionFile(
  sessionFile: string,
  count: number
): ClaudeTurnSummary[] {
  const entries = readJsonlFile<SessionEntry>(sessionFile);

  const turns: ClaudeTurnSummary[] = [];
  let currentUserContent = '';
  let currentUuid = '';
  let currentTimestamp = '';
  let currentHasToolUse = false;
  let currentEditedFiles: string[] = [];

  for (const entry of entries) {
    // Skip meta entries
    if (entry.isMeta) continue;

    if (entry.type === 'user' && entry.message?.role === 'user') {
      // Only store human user messages (string content), not tool results (array content)
      if (typeof entry.message.content === 'string') {
        currentUserContent = entry.message.content.slice(0, 500);
        currentUuid = entry.uuid ?? '';
        currentTimestamp = entry.timestamp ?? '';
        currentHasToolUse = false;
        currentEditedFiles = [];
      }
      // Skip tool_result entries (array content) - they don't start a new turn
    } else if (entry.type === 'assistant' && Array.isArray(entry.message?.content)) {
      // Extract summary from assistant content
      // Note: message structure is { role: 'assistant', content: [...blocks] }
      let assistantSummary = '';

      for (const block of entry.message.content) {
        if (block.type === 'text' && block.text && !assistantSummary) {
          assistantSummary = block.text.slice(0, 500);
        }
        if (block.type === 'tool_use') {
          currentHasToolUse = true;
          // Track edited files
          if (block.name === 'Edit' || block.name === 'Write') {
            const filePath = block.input?.['file_path'] || block.input?.['path'];
            if (typeof filePath === 'string') {
              currentEditedFiles.push(filePath);
            }
          }
        }
      }

      // Only create a turn when we have text content (not just tool_use)
      if (currentUuid && assistantSummary) {
        turns.push({
          uuid: currentUuid,
          userContent: currentUserContent,
          assistantSummary,
          timestamp: currentTimestamp,
          hasToolUse: currentHasToolUse,
          editedFiles: currentEditedFiles.length > 0 ? [...currentEditedFiles] : undefined
        });

        // Reset for next turn
        currentUserContent = '';
        currentUuid = '';
        currentTimestamp = '';
        currentHasToolUse = false;
        currentEditedFiles = [];
      }
      // If no text content, keep accumulating tool info for next assistant entry
    }
  }

  // Return most recent turns (reversed so newest first)
  return turns.slice(-count).reverse();
}

/**
 * Parse a specific turn by UUID from a Claude session file
 * @param sessionFile Path to the session JSONL file
 * @param uuid The turn UUID to find
 * @returns Full turn content or null if not found
 */
export function parseTurnByUuidFromSessionFile(
  sessionFile: string,
  uuid: string
): ClaudeTurnFull | null {
  const entries = readJsonlFile<SessionEntry>(sessionFile);

  let userContent = '';
  let timestamp = '';
  let foundUser = false;

  for (const entry of entries) {
    if (entry.uuid === uuid && entry.type === 'user' && entry.message?.role === 'user') {
      userContent = typeof entry.message.content === 'string' ? entry.message.content : '';
      timestamp = entry.timestamp ?? '';
      foundUser = true;
    } else if (foundUser && entry.parentUuid === uuid && entry.type === 'assistant') {
      // Extract full assistant content
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
        userContent,
        assistantContent: assistantContent.trim(),
        timestamp,
        toolUses
      };
    }
  }

  return null;
}
