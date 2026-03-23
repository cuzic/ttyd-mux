/**
 * File Conflict Detector
 *
 * Tracks file edits by agents and detects when multiple agents
 * edit the same file within a configurable time window.
 */

/** Tools that modify files */
const FILE_EDIT_TOOLS = new Set(['Edit', 'Write']);

export interface FileConflict {
  filePath: string;
  agents: string[];
  detectedAt: string;
}

interface FileEditEntry {
  agentName: string;
  timestamp: number;
}

/** Default conflict window: 5 minutes */
const DEFAULT_WINDOW_MS = 5 * 60 * 1000;

export class FileConflictDetector {
  private readonly edits: Map<string, FileEditEntry[]> = new Map();
  private readonly windowMs: number;

  constructor(windowMs: number = DEFAULT_WINDOW_MS) {
    this.windowMs = windowMs;
  }

  /**
   * Track a file edit by an agent.
   * Only Edit and Write tools are tracked.
   */
  trackFileEdit(agentName: string, toolName: string, filePath: string): void {
    if (!FILE_EDIT_TOOLS.has(toolName)) {
      return;
    }

    const entries = this.edits.get(filePath) ?? [];
    const now = Date.now();

    // Update timestamp if agent already tracked for this file, otherwise add
    const existing = entries.find((e) => e.agentName === agentName);
    if (existing) {
      existing.timestamp = now;
    } else {
      entries.push({ agentName, timestamp: now });
    }

    this.edits.set(filePath, entries);
  }

  /**
   * Get current file conflicts (files edited by 2+ agents within the window).
   */
  getConflicts(): FileConflict[] {
    const now = Date.now();
    const conflicts: FileConflict[] = [];

    for (const [filePath, entries] of this.edits) {
      const recent = entries.filter((e) => now - e.timestamp < this.windowMs);
      if (recent.length >= 2) {
        conflicts.push({
          filePath,
          agents: recent.map((e) => e.agentName),
          detectedAt: new Date().toISOString()
        });
      }
    }

    return conflicts;
  }

  /**
   * Remove entries older than the time window.
   */
  cleanup(): void {
    const now = Date.now();

    for (const [filePath, entries] of this.edits) {
      const recent = entries.filter((e) => now - e.timestamp < this.windowMs);
      if (recent.length === 0) {
        this.edits.delete(filePath);
      } else {
        this.edits.set(filePath, recent);
      }
    }
  }
}
