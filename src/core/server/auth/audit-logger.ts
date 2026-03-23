/**
 * Audit Logger - Records authentication and session events
 *
 * Writes audit events as JSON Lines to a log file for
 * tracking who connected, when, and from where.
 */

import { chmodSync, closeSync, existsSync, mkdirSync, openSync } from 'node:fs';
import { appendFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export type AuditEventType =
  | 'auth_success'
  | 'auth_failure'
  | 'session_create'
  | 'session_end'
  | 'otp_attempt'
  | 'ws_connect'
  | 'ws_disconnect';

export interface AuditEvent {
  type: AuditEventType;
  remoteAddr: string;
  sessionName?: string;
  user?: string;
  details?: string;
}

interface AuditRecord {
  timestamp: string;
  type: AuditEventType;
  remoteAddr: string;
  sessionName?: string;
  user?: string;
  details?: string;
}

export class AuditLogger {
  private readonly logPath: string;
  private initialized = false;

  constructor(logPath: string) {
    this.logPath = logPath;
  }

  /**
   * Log an audit event. Appends a JSON line to the log file.
   */
  async log(event: AuditEvent): Promise<void> {
    this.ensureInitialized();

    const record: AuditRecord = {
      timestamp: new Date().toISOString(),
      type: event.type,
      remoteAddr: event.remoteAddr,
      ...(event.sessionName !== undefined && { sessionName: event.sessionName }),
      ...(event.user !== undefined && { user: event.user }),
      ...(event.details !== undefined && { details: event.details })
    };

    const line = `${JSON.stringify(record)}\n`;
    await appendFile(this.logPath, line);
  }

  /**
   * Flush and close the audit log.
   */
  async dispose(): Promise<void> {
    // appendFile flushes on each call, nothing to flush
  }

  /**
   * Ensure the log file directory exists and set permissions on first write.
   */
  private ensureInitialized(): void {
    if (this.initialized) {
      return;
    }

    const dir = dirname(this.logPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    // Create the file if it doesn't exist, then set permissions
    if (!existsSync(this.logPath)) {
      const fd = openSync(this.logPath, 'w');
      closeSync(fd);
    }
    chmodSync(this.logPath, 0o600);

    this.initialized = true;
  }
}
