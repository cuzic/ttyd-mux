/**
 * Claude Session File Parsing
 *
 * Parses Claude Code session JSONL files to extract conversation turns.
 */

import { readFileSync } from 'node:fs';
import type { ClaudeTurnFull, ClaudeTurnSummary } from './types.js';

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
  try {
    const content = readFileSync(sessionFile, 'utf-8');
    const lines = content.trim().split('\n').filter((l) => l.trim());

    const turns: ClaudeTurnSummary[] = [];
    let currentUserContent = '';
    let currentUuid = '';
    let currentTimestamp = '';
    let currentHasToolUse = false;
    let currentEditedFiles: string[] = [];

    for (const line of lines) {
      try {
        const entry = JSON.parse(line);

        // Skip meta entries
        if (entry.isMeta) continue;

        if (entry.type === 'user' && entry.message?.role === 'user') {
          // Only store human user messages (string content), not tool results (array content)
          if (typeof entry.message.content === 'string') {
            currentUserContent = entry.message.content.slice(0, 500);
            currentUuid = entry.uuid;
            currentTimestamp = entry.timestamp;
            currentHasToolUse = false;
            currentEditedFiles = [];
          }
          // Skip tool_result entries (array content) - they don't start a new turn
        } else if (entry.type === 'assistant' && Array.isArray(entry.message?.content)) {
          // Extract summary from assistant content
          // Note: message structure is { role: 'assistant', content: [...blocks] }
          let assistantSummary = '';

          for (const block of entry.message.content) {
            if (block.type === 'text' && !assistantSummary) {
              assistantSummary = block.text.slice(0, 500);
            }
            if (block.type === 'tool_use') {
              currentHasToolUse = true;
              // Track edited files
              if (block.name === 'Edit' || block.name === 'Write') {
                const filePath = block.input?.file_path || block.input?.path;
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
      } catch {
        // Skip invalid JSON lines
      }
    }

    // Return most recent turns (reversed so newest first)
    return turns.slice(-count).reverse();
  } catch {
    return [];
  }
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
  try {
    const content = readFileSync(sessionFile, 'utf-8');
    const lines = content.trim().split('\n').filter((l) => l.trim());

    let userContent = '';
    let timestamp = '';
    let foundUser = false;

    for (const line of lines) {
      try {
        const entry = JSON.parse(line);

        if (entry.uuid === uuid && entry.type === 'user' && entry.message?.role === 'user') {
          userContent = typeof entry.message.content === 'string' ? entry.message.content : '';
          timestamp = entry.timestamp;
          foundUser = true;
        } else if (foundUser && entry.parentUuid === uuid && entry.type === 'assistant') {
          // Extract full assistant content
          let assistantContent = '';
          const toolUses: Array<{ name: string; input: Record<string, unknown> }> = [];

          for (const block of entry.message?.content || []) {
            if (block.type === 'text') {
              assistantContent += block.text + '\n\n';
            }
            if (block.type === 'tool_use') {
              toolUses.push({
                name: block.name,
                input: block.input
              });
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
      } catch {
        // Skip invalid JSON lines
      }
    }

    return null;
  } catch {
    return null;
  }
}
