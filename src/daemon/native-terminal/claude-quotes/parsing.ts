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
    content?: string | Array<ContentBlock>;
  };
}

/**
 * Content block in assistant message
 */
interface ContentBlock {
  type: string;
  text?: string;
  name?: string;
  input?: Record<string, unknown>;
}

/**
 * Parsed assistant content
 */
interface ParsedAssistantContent {
  fullText: string;
  hasToolUse: boolean;
  editedFiles: string[];
  toolUses: Array<{ name: string; input: Record<string, unknown> }>;
}

/**
 * Parse content blocks from an assistant entry
 */
function parseAssistantContent(blocks: ContentBlock[]): ParsedAssistantContent {
  let fullText = '';
  let hasToolUse = false;
  const editedFiles: string[] = [];
  const toolUses: Array<{ name: string; input: Record<string, unknown> }> = [];

  for (const block of blocks) {
    if (block.type === 'text' && block.text) {
      if (!fullText) {
        fullText = block.text;
      }
    }
    if (block.type === 'tool_use' && block.name) {
      hasToolUse = true;
      if (block.input) {
        toolUses.push({ name: block.name, input: block.input });
      }
      if (block.name === 'Edit' || block.name === 'Write') {
        const filePath = block.input?.['file_path'] || block.input?.['path'];
        if (typeof filePath === 'string') {
          editedFiles.push(filePath);
        }
      }
    }
  }

  return { fullText, hasToolUse, editedFiles, toolUses };
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
    if (entry.isMeta || entry.type !== 'assistant' || !Array.isArray(entry.message?.content)) {
      continue;
    }

    const { fullText, hasToolUse, editedFiles } = parseAssistantContent(entry.message.content);

    // Only include entries with text content that has 3+ lines
    if (fullText && entry.uuid && fullText.split('\n').length >= 3) {
      turns.push({
        uuid: entry.uuid,
        assistantSummary: fullText.slice(0, 500),
        timestamp: entry.timestamp ?? '',
        hasToolUse,
        editedFiles: editedFiles.length > 0 ? editedFiles : undefined
      });
    }
  }

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
    if (entry.uuid !== uuid || entry.type !== 'assistant' || !Array.isArray(entry.message?.content)) {
      continue;
    }

    const { fullText, toolUses } = parseAssistantContent(entry.message.content);

    return {
      uuid,
      assistantContent: fullText,
      timestamp: entry.timestamp ?? '',
      toolUses
    };
  }

  return null;
}
