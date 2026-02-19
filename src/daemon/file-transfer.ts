/**
 * File Transfer Manager
 *
 * Handles secure file upload/download operations for ttyd-mux sessions.
 * Provides path validation, size limits, and extension filtering.
 */

import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join, normalize, resolve } from 'node:path';
import { createLogger } from '@/utils/logger.js';

const log = createLogger('file-transfer');

// =============================================================================
// Types
// =============================================================================

export interface FileTransferConfig {
  /** Maximum file size in bytes (default: 100MB) */
  max_file_size: number;
  /** Allowed file extensions (empty = all allowed) */
  allowed_extensions: string[];
  /** Enable/disable file transfer */
  enabled: boolean;
}

export const DEFAULT_FILE_TRANSFER_CONFIG: FileTransferConfig = {
  max_file_size: 100 * 1024 * 1024, // 100MB
  allowed_extensions: [],
  enabled: true
};

export interface FileInfo {
  name: string;
  size: number;
  isDirectory: boolean;
  modifiedAt: string;
}

export type FileTransferError =
  | 'not_found'
  | 'invalid_path'
  | 'file_too_large'
  | 'disabled'
  | 'extension_not_allowed'
  | 'permission_denied'
  | 'unknown';

export interface DownloadResult {
  success: boolean;
  data?: Buffer;
  filename?: string;
  mimeType?: string;
  error?: FileTransferError;
}

export interface UploadResult {
  success: boolean;
  path?: string;
  error?: FileTransferError;
}

export interface ListResult {
  success: boolean;
  files?: FileInfo[];
  error?: FileTransferError;
}

export interface FileTransferManager {
  downloadFile(relativePath: string): Promise<DownloadResult>;
  uploadFile(relativePath: string, content: Buffer): Promise<UploadResult>;
  listFiles(relativePath: string): Promise<ListResult>;
}

// =============================================================================
// Clipboard image types
// =============================================================================

export interface ClipboardImageInput {
  /** Base64 encoded image data */
  data: string;
  /** MIME type (e.g., 'image/png') */
  mimeType: string;
  /** Optional filename */
  name?: string;
}

export interface SaveClipboardImagesResult {
  success: boolean;
  paths?: string[];
  error?: string;
}

// =============================================================================
// Path validation
// =============================================================================

/**
 * Check if a path is safe (no traversal, no absolute paths)
 */
export function isPathSafe(path: string): boolean {
  if (!path || path.length === 0) {
    return false;
  }

  // Check for null bytes
  if (path.includes('\x00')) {
    return false;
  }

  // Check for absolute paths
  if (path.startsWith('/')) {
    return false;
  }

  // Normalize and check for path traversal
  const normalized = normalize(path);

  // Check for ".." components
  if (normalized.includes('..')) {
    return false;
  }

  // Check for URL-encoded traversal
  if (path.includes('%2e') || path.includes('%2E')) {
    return false;
  }

  return true;
}

/**
 * Resolve a relative path within a base directory
 * Returns null if the resolved path escapes the base directory
 */
export function resolveFilePath(baseDir: string, relativePath: string): string | null {
  if (!isPathSafe(relativePath)) {
    return null;
  }

  const resolvedBase = resolve(baseDir);
  const resolvedPath = resolve(baseDir, relativePath);

  // Ensure resolved path is within base directory
  if (!resolvedPath.startsWith(resolvedBase)) {
    return null;
  }

  return resolvedPath;
}

// =============================================================================
// MIME type detection
// =============================================================================

const MIME_TYPES: Record<string, string> = {
  '.txt': 'text/plain',
  '.log': 'text/plain',
  '.md': 'text/markdown',
  '.json': 'application/json',
  '.yaml': 'text/yaml',
  '.yml': 'text/yaml',
  '.xml': 'application/xml',
  '.html': 'text/html',
  '.htm': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.ts': 'text/typescript',
  '.sh': 'application/x-sh',
  '.bash': 'application/x-sh',
  '.py': 'text/x-python',
  '.rb': 'text/x-ruby',
  '.go': 'text/x-go',
  '.rs': 'text/x-rust',
  '.c': 'text/x-c',
  '.cpp': 'text/x-c++',
  '.h': 'text/x-c',
  '.java': 'text/x-java',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.zip': 'application/zip',
  '.tar': 'application/x-tar',
  '.gz': 'application/gzip',
  '.bz2': 'application/x-bzip2'
};

function getMimeType(filename: string): string {
  const ext = extname(filename).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

// =============================================================================
// FileTransferManager implementation
// =============================================================================

interface FileTransferManagerOptions {
  baseDir: string;
  config?: FileTransferConfig;
}

export function createFileTransferManager(
  options: FileTransferManagerOptions
): FileTransferManager {
  const { baseDir, config = DEFAULT_FILE_TRANSFER_CONFIG } = options;

  async function downloadFile(relativePath: string): Promise<DownloadResult> {
    // Check if transfer is enabled
    if (!config.enabled) {
      return { success: false, error: 'disabled' };
    }

    // Validate and resolve path
    const resolvedPath = resolveFilePath(baseDir, relativePath);
    if (!resolvedPath) {
      return { success: false, error: 'invalid_path' };
    }

    // Check if file exists
    if (!existsSync(resolvedPath)) {
      return { success: false, error: 'not_found' };
    }

    try {
      // Check file size before reading
      const stats = statSync(resolvedPath);
      if (stats.size > config.max_file_size) {
        return { success: false, error: 'file_too_large' };
      }

      // Read file content
      const data = await readFile(resolvedPath);
      const filename = basename(resolvedPath);
      const mimeType = getMimeType(filename);

      log.info(`Downloaded file: ${relativePath} (${stats.size} bytes)`);

      return {
        success: true,
        data,
        filename,
        mimeType
      };
    } catch (err) {
      log.error(`Failed to download file: ${relativePath}`, err);
      return { success: false, error: 'unknown' };
    }
  }

  async function uploadFile(relativePath: string, content: Buffer): Promise<UploadResult> {
    // Check if transfer is enabled
    if (!config.enabled) {
      return { success: false, error: 'disabled' };
    }

    // Validate and resolve path
    const resolvedPath = resolveFilePath(baseDir, relativePath);
    if (!resolvedPath) {
      return { success: false, error: 'invalid_path' };
    }

    // Check file size
    if (content.length > config.max_file_size) {
      return { success: false, error: 'file_too_large' };
    }

    // Check extension if filter is configured
    if (config.allowed_extensions.length > 0) {
      const ext = extname(relativePath).toLowerCase();
      if (!config.allowed_extensions.includes(ext)) {
        return { success: false, error: 'extension_not_allowed' };
      }
    }

    try {
      // Create parent directory if needed
      const parentDir = dirname(resolvedPath);
      if (!existsSync(parentDir)) {
        mkdirSync(parentDir, { recursive: true });
      }

      // Write file
      await writeFile(resolvedPath, content);

      log.info(`Uploaded file: ${relativePath} (${content.length} bytes)`);

      return {
        success: true,
        path: relativePath
      };
    } catch (err) {
      log.error(`Failed to upload file: ${relativePath}`, err);
      return { success: false, error: 'unknown' };
    }
  }

  async function listFiles(relativePath: string): Promise<ListResult> {
    // Check if transfer is enabled
    if (!config.enabled) {
      return { success: false, error: 'disabled' };
    }

    // Handle "." as current directory
    const pathToResolve = relativePath === '.' ? '' : relativePath;

    // Validate and resolve path
    const resolvedPath = pathToResolve ? resolveFilePath(baseDir, pathToResolve) : baseDir;
    if (!resolvedPath) {
      return { success: false, error: 'invalid_path' };
    }

    // Check if directory exists
    if (!existsSync(resolvedPath)) {
      return { success: false, error: 'not_found' };
    }

    try {
      const entries = readdirSync(resolvedPath, { withFileTypes: true });
      const files: FileInfo[] = [];

      for (const entry of entries) {
        const entryPath = join(resolvedPath, entry.name);
        const stats = statSync(entryPath);

        files.push({
          name: entry.name,
          size: stats.size,
          isDirectory: entry.isDirectory(),
          modifiedAt: stats.mtime.toISOString()
        });
      }

      return {
        success: true,
        files
      };
    } catch (err) {
      log.error(`Failed to list files: ${relativePath}`, err);
      return { success: false, error: 'unknown' };
    }
  }

  return {
    downloadFile,
    uploadFile,
    listFiles
  };
}

// =============================================================================
// Clipboard image saving
// =============================================================================

/**
 * Get file extension from MIME type
 */
function getExtensionFromMimeType(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
    'image/bmp': 'bmp',
    'image/tiff': 'tiff'
  };
  return mimeToExt[mimeType] || 'png';
}

/**
 * Generate a unique filename for clipboard images
 */
function generateClipboardFilename(mimeType: string, index: number): string {
  const now = new Date();
  const timestamp = now
    .toISOString()
    .replace(/[-:]/g, '')
    .replace('T', '-')
    .replace(/\.\d{3}Z/, '');
  const ext = getExtensionFromMimeType(mimeType);
  const suffix = index > 0 ? `-${String(index + 1).padStart(3, '0')}` : '';
  return `clipboard-${timestamp}${suffix}.${ext}`;
}

/**
 * Save clipboard images to the session directory
 */
export async function saveClipboardImages(
  baseDir: string,
  images: ClipboardImageInput[],
  config?: FileTransferConfig
): Promise<SaveClipboardImagesResult> {
  const effectiveConfig = config || DEFAULT_FILE_TRANSFER_CONFIG;

  // Check if transfer is enabled
  if (!effectiveConfig.enabled) {
    return { success: false, error: 'File transfer is disabled' };
  }

  if (!images || images.length === 0) {
    return { success: false, error: 'No images provided' };
  }

  const savedPaths: string[] = [];

  try {
    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      if (!image) continue;

      // Decode base64 data
      const buffer = Buffer.from(image.data, 'base64');

      // Check file size
      if (buffer.length > effectiveConfig.max_file_size) {
        return {
          success: false,
          error: `Image ${i + 1} exceeds maximum file size (${Math.round(effectiveConfig.max_file_size / 1024 / 1024)}MB)`
        };
      }

      // Generate or use provided filename
      const filename = image.name ?? generateClipboardFilename(image.mimeType, i);

      // Resolve the full path
      const fullPath = join(baseDir, filename);

      // Ensure base directory exists
      if (!existsSync(baseDir)) {
        mkdirSync(baseDir, { recursive: true });
      }

      // Write the file
      await writeFile(fullPath, buffer);

      // Store relative path for response
      savedPaths.push(filename);

      log.info(`Saved clipboard image: ${filename} (${buffer.length} bytes)`);
    }

    return {
      success: true,
      paths: savedPaths
    };
  } catch (err) {
    log.error('Failed to save clipboard images', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error'
    };
  }
}
