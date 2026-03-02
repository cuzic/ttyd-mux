/**
 * Response Parser
 *
 * Parses LLM responses to extract structured data:
 * - JSON extraction
 * - Citations extraction
 * - Next commands extraction
 */

import type { Citation, CommandRisk, NextCommand } from './types.js';

export interface ParsedResponse {
  /** Main answer content */
  answer: string;
  /** Extracted citations */
  citations: Citation[];
  /** Suggested next commands */
  nextCommands: NextCommand[];
  /** Whether the response was successfully parsed as JSON */
  wasJson: boolean;
  /** Raw response (for debugging) */
  raw: string;
}

/**
 * Parse LLM response and extract structured data
 */
export function parseResponse(rawResponse: string): ParsedResponse {
  const trimmed = rawResponse.trim();

  // Try to extract and parse JSON
  const jsonResult = extractJson(trimmed);

  if (jsonResult) {
    return parseJsonResponse(jsonResult, trimmed);
  }

  // Fall back to plain text parsing
  return parsePlainTextResponse(trimmed);
}

/**
 * Extract the first balanced JSON object from text
 */
function extractJson(text: string): object | null {
  // Try to find JSON object
  const jsonStart = text.indexOf('{');
  if (jsonStart === -1) {
    return null;
  }

  // Find matching closing brace
  let depth = 0;
  let inString = false;
  let escapeNext = false;

  for (let i = jsonStart; i < text.length; i++) {
    const char = text[i];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (char === '\\') {
      escapeNext = true;
      continue;
    }

    if (char === '"' && !escapeNext) {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === '{') {
      depth++;
    } else if (char === '}') {
      depth--;
      if (depth === 0) {
        const jsonStr = text.slice(jsonStart, i + 1);
        try {
          return JSON.parse(jsonStr) as object;
        } catch {
          return null;
        }
      }
    }
  }

  return null;
}

/**
 * Parse JSON response
 */
function parseJsonResponse(json: object, raw: string): ParsedResponse {
  const obj = json as Record<string, unknown>;

  // Extract answer
  let answer = '';
  if (typeof obj['answer'] === 'string') {
    answer = obj['answer'];
  } else if (typeof obj['content'] === 'string') {
    answer = obj['content'];
  } else if (typeof obj['response'] === 'string') {
    answer = obj['response'];
  } else if (typeof obj['text'] === 'string') {
    answer = obj['text'];
  }

  // Extract citations
  const citations = parseCitations(obj['citations']);

  // Extract next commands
  const nextCommands = parseNextCommands(
    obj['nextCommands'] ?? obj['commands'] ?? obj['suggestions']
  );

  return {
    answer,
    citations,
    nextCommands,
    wasJson: true,
    raw
  };
}

/**
 * Parse citations from response
 */
function parseCitations(raw: unknown): Citation[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const citations: Citation[] = [];

  for (const item of raw) {
    if (typeof item !== 'object' || item === null) {
      continue;
    }

    const obj = item as Record<string, unknown>;

    if (typeof obj['blockId'] === 'string' && typeof obj['reason'] === 'string') {
      citations.push({
        blockId: obj['blockId'],
        reason: obj['reason'],
        excerpt: typeof obj['excerpt'] === 'string' ? obj['excerpt'] : undefined
      });
    }
  }

  return citations;
}

/**
 * Parse next commands from response
 */
function parseNextCommands(raw: unknown): NextCommand[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const commands: NextCommand[] = [];

  for (const item of raw) {
    if (typeof item !== 'object' || item === null) {
      continue;
    }

    const obj = item as Record<string, unknown>;

    if (typeof obj['command'] === 'string') {
      const risk = parseRisk(obj['risk']);
      commands.push({
        command: obj['command'],
        description: typeof obj['description'] === 'string' ? obj['description'] : '',
        risk
      });
    }
  }

  return commands;
}

/**
 * Parse risk level
 */
function parseRisk(raw: unknown): CommandRisk {
  if (typeof raw !== 'string') {
    return 'safe';
  }

  const normalized = raw.toLowerCase();

  if (normalized === 'dangerous' || normalized === 'high' || normalized === 'critical') {
    return 'dangerous';
  }

  if (normalized === 'caution' || normalized === 'medium' || normalized === 'warning') {
    return 'caution';
  }

  return 'safe';
}

/**
 * Parse plain text response (fallback)
 */
function parsePlainTextResponse(text: string): ParsedResponse {
  // Extract citations from text mentions
  const citations = extractCitationsFromText(text);

  // Extract command suggestions from code blocks
  const nextCommands = extractCommandsFromText(text);

  return {
    answer: text,
    citations,
    nextCommands,
    wasJson: false,
    raw: text
  };
}

/**
 * Extract citations from plain text
 */
function extractCitationsFromText(text: string): Citation[] {
  const citations: Citation[] = [];

  // Pattern: Block #N, block_xxx, etc.
  const blockPatterns = [
    /Block #(\d+)/gi,
    /block[_-]([a-z0-9]+)/gi,
    /\[([a-z0-9_-]+)\]/gi // References like [block_123]
  ];

  const seenBlockIds = new Set<string>();

  for (const pattern of blockPatterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const blockId = match[1] ?? match[0];
      if (!blockId || seenBlockIds.has(blockId)) continue;

      seenBlockIds.add(blockId);

      // Extract surrounding context as reason
      const start = Math.max(0, match.index - 50);
      const end = Math.min(text.length, match.index + match[0].length + 50);
      const context = text.slice(start, end).trim();

      citations.push({
        blockId,
        reason: `Referenced in context: "${context}..."`
      });
    }
  }

  return citations;
}

/**
 * Extract commands from plain text code blocks
 */
function extractCommandsFromText(text: string): NextCommand[] {
  const commands: NextCommand[] = [];

  // Pattern: bash/shell code blocks
  const codeBlockPattern = /```(?:bash|shell|sh)?\s*\n([^`]+)\n```/g;

  let match: RegExpExecArray | null;
  while ((match = codeBlockPattern.exec(text)) !== null) {
    const code = match[1]?.trim() ?? '';

    // Skip empty or multi-line code blocks (probably not commands)
    if (!code || code.includes('\n\n')) {
      continue;
    }

    // Extract individual commands
    const lines = code.split('\n');
    for (const line of lines) {
      const trimmedLine = line.trim();

      // Skip comments and empty lines
      if (!trimmedLine || trimmedLine.startsWith('#')) {
        continue;
      }

      // Remove leading $ or > if present
      const command = trimmedLine.replace(/^[$>]\s*/, '');

      if (command) {
        const risk = assessCommandRisk(command);
        commands.push({
          command,
          description: extractCommandDescription(text, command),
          risk
        });
      }
    }
  }

  // Also look for inline commands
  const inlinePattern = /`([^`]+)`/g;
  while ((match = inlinePattern.exec(text)) !== null) {
    const cmd = match[1]?.trim() ?? '';

    // Check if it looks like a command
    if (looksLikeCommand(cmd) && !commands.some((c) => c.command === cmd)) {
      const risk = assessCommandRisk(cmd);
      commands.push({
        command: cmd,
        description: '',
        risk
      });
    }
  }

  return commands;
}

/**
 * Check if text looks like a command
 */
function looksLikeCommand(text: string): boolean {
  if (!text || text.length < 2 || text.length > 200) {
    return false;
  }

  // Common command patterns
  const commandPatterns = [
    /^(npm|yarn|pnpm|bun)\s+/,
    /^(git)\s+/,
    /^(docker|kubectl|helm)\s+/,
    /^(ls|cd|mkdir|rm|cp|mv|cat|grep|find)\s+/,
    /^(curl|wget)\s+/,
    /^(python|node|ruby|go|cargo)\s+/,
    /^(make|cmake)\s*/,
    /^\.?\//
  ];

  return commandPatterns.some((p) => p.test(text));
}

/**
 * Assess risk level of a command
 */
function assessCommandRisk(command: string): CommandRisk {
  const lower = command.toLowerCase();

  // Dangerous commands
  const dangerousPatterns = [
    /rm\s+-rf?\s+[/*]/,
    /rm\s+-rf?\s+--no-preserve-root/,
    /:(){ :|:& };:/, // Fork bomb
    /mkfs\./,
    /dd\s+if=.*of=\/dev/,
    /\>\s*\/dev\/(sd|hd|nvme)/,
    /chmod\s+-R\s+777/,
    /curl.*\|\s*(bash|sh)/,
    /wget.*\|\s*(bash|sh)/,
    /git\s+push\s+--force/,
    /git\s+reset\s+--hard/,
    /drop\s+database/i,
    /truncate\s+table/i
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(lower)) {
      return 'dangerous';
    }
  }

  // Caution commands
  const cautionPatterns = [
    /rm\s+-/,
    /git\s+(checkout|reset|rebase)/,
    /sudo\s+/,
    /chmod\s+/,
    /chown\s+/,
    /npm\s+(publish|unpublish)/,
    /docker\s+(rm|rmi|prune)/,
    /kubectl\s+delete/
  ];

  for (const pattern of cautionPatterns) {
    if (pattern.test(lower)) {
      return 'caution';
    }
  }

  return 'safe';
}

/**
 * Extract description for a command from surrounding text
 */
function extractCommandDescription(text: string, command: string): string {
  // Find the command in text and look for preceding description
  const index = text.indexOf(command);
  if (index === -1) {
    return '';
  }

  // Look backwards for a sentence or phrase
  const before = text.slice(Math.max(0, index - 200), index);
  const lines = before.split('\n').filter((l) => l.trim());
  const lastLine = lines[lines.length - 1]?.trim() ?? '';

  // Clean up the description
  if (lastLine && !lastLine.startsWith('```') && !lastLine.startsWith('`')) {
    // Remove leading punctuation and whitespace
    return lastLine.replace(/^[-*>:\s]+/, '').trim();
  }

  return '';
}
