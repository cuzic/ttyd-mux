/**
 * File Transfer Tests (TDD)
 *
 * Tests for file upload/download functionality.
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  DEFAULT_FILE_TRANSFER_CONFIG,
  type FileTransferConfig,
  createFileTransferManager,
  isPathSafe,
  resolveFilePath,
  saveClipboardImages
} from './file-transfer.js';

// Test directory setup
let testDir: string;
let testSessionDir: string;

beforeEach(() => {
  testDir = join(tmpdir(), `ttyd-mux-file-test-${Date.now()}`);
  testSessionDir = join(testDir, 'session');
  mkdirSync(testSessionDir, { recursive: true });
});

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
});

// =============================================================================
// Path validation tests
// =============================================================================

describe('isPathSafe', () => {
  test('rejects paths with ".." traversal', () => {
    expect(isPathSafe('../etc/passwd')).toBe(false);
    expect(isPathSafe('foo/../../../etc/passwd')).toBe(false);
    expect(isPathSafe('..%2f..%2fetc/passwd')).toBe(false);
  });

  test('rejects paths starting with /', () => {
    expect(isPathSafe('/etc/passwd')).toBe(false);
    expect(isPathSafe('/home/user/file.txt')).toBe(false);
  });

  test('accepts valid relative paths', () => {
    expect(isPathSafe('file.txt')).toBe(true);
    expect(isPathSafe('subdir/file.txt')).toBe(true);
    expect(isPathSafe('deep/nested/path/file.log')).toBe(true);
  });

  test('accepts paths with dots in filename', () => {
    expect(isPathSafe('file.tar.gz')).toBe(true);
    expect(isPathSafe('.gitignore')).toBe(true);
    expect(isPathSafe('dir/.hidden')).toBe(true);
  });

  test('rejects empty paths', () => {
    expect(isPathSafe('')).toBe(false);
  });

  test('rejects null bytes', () => {
    expect(isPathSafe('file\x00.txt')).toBe(false);
  });
});

describe('resolveFilePath', () => {
  test('resolves relative path within base directory', () => {
    const result = resolveFilePath('/home/user', 'file.txt');
    expect(result).toBe('/home/user/file.txt');
  });

  test('resolves nested paths', () => {
    const result = resolveFilePath('/home/user', 'subdir/file.txt');
    expect(result).toBe('/home/user/subdir/file.txt');
  });

  test('returns null for path traversal attempts', () => {
    const result = resolveFilePath('/home/user', '../etc/passwd');
    expect(result).toBeNull();
  });

  test('returns null for absolute paths', () => {
    const result = resolveFilePath('/home/user', '/etc/passwd');
    expect(result).toBeNull();
  });
});

// =============================================================================
// FileTransferManager tests
// =============================================================================

describe('FileTransferManager', () => {
  describe('config defaults', () => {
    test('has correct default max file size (100MB)', () => {
      expect(DEFAULT_FILE_TRANSFER_CONFIG.max_file_size).toBe(100 * 1024 * 1024);
    });

    test('has correct default allowed extensions (empty = all allowed)', () => {
      expect(DEFAULT_FILE_TRANSFER_CONFIG.allowed_extensions).toEqual([]);
    });

    test('has enabled by default', () => {
      expect(DEFAULT_FILE_TRANSFER_CONFIG.enabled).toBe(true);
    });
  });

  describe('downloadFile', () => {
    test('returns file content for existing file', async () => {
      const filePath = join(testSessionDir, 'test.txt');
      writeFileSync(filePath, 'Hello, World!');

      const manager = createFileTransferManager({ baseDir: testSessionDir });
      const result = await manager.downloadFile('test.txt');

      expect(result.success).toBe(true);
      expect(result.data?.toString()).toBe('Hello, World!');
      expect(result.filename).toBe('test.txt');
    });

    test('returns file content for nested file', async () => {
      const subdir = join(testSessionDir, 'logs');
      mkdirSync(subdir, { recursive: true });
      const filePath = join(subdir, 'app.log');
      writeFileSync(filePath, 'Log content');

      const manager = createFileTransferManager({ baseDir: testSessionDir });
      const result = await manager.downloadFile('logs/app.log');

      expect(result.success).toBe(true);
      expect(result.data?.toString()).toBe('Log content');
    });

    test('returns error for non-existent file', async () => {
      const manager = createFileTransferManager({ baseDir: testSessionDir });
      const result = await manager.downloadFile('nonexistent.txt');

      expect(result.success).toBe(false);
      expect(result.error).toBe('not_found');
    });

    test('returns error for path traversal attempt', async () => {
      const manager = createFileTransferManager({ baseDir: testSessionDir });
      const result = await manager.downloadFile('../../../etc/passwd');

      expect(result.success).toBe(false);
      expect(result.error).toBe('invalid_path');
    });

    test('returns error for file exceeding size limit', async () => {
      const filePath = join(testSessionDir, 'large.bin');
      // Create a file larger than 1KB limit
      writeFileSync(filePath, Buffer.alloc(2 * 1024));

      const config: FileTransferConfig = {
        ...DEFAULT_FILE_TRANSFER_CONFIG,
        max_file_size: 1024 // 1KB
      };
      const manager = createFileTransferManager({ baseDir: testSessionDir, config });
      const result = await manager.downloadFile('large.bin');

      expect(result.success).toBe(false);
      expect(result.error).toBe('file_too_large');
    });

    test('returns error when transfer is disabled', async () => {
      const config: FileTransferConfig = {
        ...DEFAULT_FILE_TRANSFER_CONFIG,
        enabled: false
      };
      const manager = createFileTransferManager({ baseDir: testSessionDir, config });
      const result = await manager.downloadFile('test.txt');

      expect(result.success).toBe(false);
      expect(result.error).toBe('disabled');
    });

    test('returns correct mime type for common extensions', async () => {
      const files = [
        { name: 'file.txt', mime: 'text/plain' },
        { name: 'file.json', mime: 'application/json' },
        { name: 'file.html', mime: 'text/html' },
        { name: 'file.log', mime: 'text/plain' }
      ];

      for (const { name, mime } of files) {
        const filePath = join(testSessionDir, name);
        writeFileSync(filePath, 'content');

        const manager = createFileTransferManager({ baseDir: testSessionDir });
        const result = await manager.downloadFile(name);

        expect(result.mimeType).toBe(mime);
      }
    });
  });

  describe('uploadFile', () => {
    test('saves file to base directory', async () => {
      const manager = createFileTransferManager({ baseDir: testSessionDir });
      const content = Buffer.from('Upload content');
      const result = await manager.uploadFile('uploaded.txt', content);

      expect(result.success).toBe(true);
      expect(result.path).toBe('uploaded.txt');

      // Verify file was created
      const savedPath = join(testSessionDir, 'uploaded.txt');
      const saved = await Bun.file(savedPath).text();
      expect(saved).toBe('Upload content');
    });

    test('saves file to subdirectory', async () => {
      const manager = createFileTransferManager({ baseDir: testSessionDir });
      const content = Buffer.from('Nested content');
      const result = await manager.uploadFile('subdir/file.txt', content);

      expect(result.success).toBe(true);

      // Verify file was created in subdirectory
      const savedPath = join(testSessionDir, 'subdir/file.txt');
      const saved = await Bun.file(savedPath).text();
      expect(saved).toBe('Nested content');
    });

    test('returns error for path traversal attempt', async () => {
      const manager = createFileTransferManager({ baseDir: testSessionDir });
      const content = Buffer.from('Malicious content');
      const result = await manager.uploadFile('../../../etc/malicious', content);

      expect(result.success).toBe(false);
      expect(result.error).toBe('invalid_path');
    });

    test('returns error for file exceeding size limit', async () => {
      const config: FileTransferConfig = {
        ...DEFAULT_FILE_TRANSFER_CONFIG,
        max_file_size: 1024 // 1KB
      };
      const manager = createFileTransferManager({ baseDir: testSessionDir, config });
      const content = Buffer.alloc(2 * 1024); // 2KB
      const result = await manager.uploadFile('large.bin', content);

      expect(result.success).toBe(false);
      expect(result.error).toBe('file_too_large');
    });

    test('returns error when transfer is disabled', async () => {
      const config: FileTransferConfig = {
        ...DEFAULT_FILE_TRANSFER_CONFIG,
        enabled: false
      };
      const manager = createFileTransferManager({ baseDir: testSessionDir, config });
      const result = await manager.uploadFile('test.txt', Buffer.from('content'));

      expect(result.success).toBe(false);
      expect(result.error).toBe('disabled');
    });

    test('enforces allowed extensions', async () => {
      const config: FileTransferConfig = {
        ...DEFAULT_FILE_TRANSFER_CONFIG,
        allowed_extensions: ['.txt', '.log']
      };
      const manager = createFileTransferManager({ baseDir: testSessionDir, config });

      // Allowed extension
      const result1 = await manager.uploadFile('file.txt', Buffer.from('content'));
      expect(result1.success).toBe(true);

      // Disallowed extension
      const result2 = await manager.uploadFile('file.exe', Buffer.from('content'));
      expect(result2.success).toBe(false);
      expect(result2.error).toBe('extension_not_allowed');
    });

    test('overwrites existing file', async () => {
      const filePath = join(testSessionDir, 'existing.txt');
      writeFileSync(filePath, 'Original content');

      const manager = createFileTransferManager({ baseDir: testSessionDir });
      const result = await manager.uploadFile('existing.txt', Buffer.from('New content'));

      expect(result.success).toBe(true);

      const saved = await Bun.file(filePath).text();
      expect(saved).toBe('New content');
    });
  });

  describe('listFiles', () => {
    test('lists files in directory', async () => {
      writeFileSync(join(testSessionDir, 'file1.txt'), 'content1');
      writeFileSync(join(testSessionDir, 'file2.log'), 'content2');

      const manager = createFileTransferManager({ baseDir: testSessionDir });
      const result = await manager.listFiles('.');

      expect(result.success).toBe(true);
      expect(result.files?.length).toBe(2);
      expect(result.files?.map((f) => f.name).sort()).toEqual(['file1.txt', 'file2.log']);
    });

    test('lists files in subdirectory', async () => {
      const subdir = join(testSessionDir, 'logs');
      mkdirSync(subdir, { recursive: true });
      writeFileSync(join(subdir, 'app.log'), 'log content');

      const manager = createFileTransferManager({ baseDir: testSessionDir });
      const result = await manager.listFiles('logs');

      expect(result.success).toBe(true);
      expect(result.files?.length).toBe(1);
      expect(result.files?.[0].name).toBe('app.log');
    });

    test('returns error for non-existent directory', async () => {
      const manager = createFileTransferManager({ baseDir: testSessionDir });
      const result = await manager.listFiles('nonexistent');

      expect(result.success).toBe(false);
      expect(result.error).toBe('not_found');
    });

    test('returns error for path traversal attempt', async () => {
      const manager = createFileTransferManager({ baseDir: testSessionDir });
      const result = await manager.listFiles('../../../');

      expect(result.success).toBe(false);
      expect(result.error).toBe('invalid_path');
    });

    test('includes file metadata', async () => {
      const filePath = join(testSessionDir, 'test.txt');
      writeFileSync(filePath, 'Hello');

      const manager = createFileTransferManager({ baseDir: testSessionDir });
      const result = await manager.listFiles('.');

      expect(result.files?.[0]).toMatchObject({
        name: 'test.txt',
        size: 5,
        isDirectory: false
      });
      expect(result.files?.[0].modifiedAt).toBeDefined();
    });
  });
});

// =============================================================================
// saveClipboardImages tests
// =============================================================================

describe('saveClipboardImages', () => {
  // Create a simple 1x1 PNG as base64 for testing
  const MINIMAL_PNG_BASE64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  test('saves a single image successfully', async () => {
    const result = await saveClipboardImages(testSessionDir, [
      { data: MINIMAL_PNG_BASE64, mimeType: 'image/png' }
    ]);

    expect(result.success).toBe(true);
    expect(result.paths).toBeDefined();
    expect(result.paths?.length).toBe(1);
    expect(result.paths?.[0]).toMatch(/^clipboard-.*\.png$/);

    // Verify file exists
    const savedPath = join(testSessionDir, result.paths?.[0]);
    const fileExists = await Bun.file(savedPath).exists();
    expect(fileExists).toBe(true);
  });

  test('saves multiple images successfully', async () => {
    const result = await saveClipboardImages(testSessionDir, [
      { data: MINIMAL_PNG_BASE64, mimeType: 'image/png' },
      { data: MINIMAL_PNG_BASE64, mimeType: 'image/png' },
      { data: MINIMAL_PNG_BASE64, mimeType: 'image/png' }
    ]);

    expect(result.success).toBe(true);
    expect(result.paths?.length).toBe(3);
  });

  test('uses custom filename if provided', async () => {
    const result = await saveClipboardImages(testSessionDir, [
      { data: MINIMAL_PNG_BASE64, mimeType: 'image/png', name: 'custom-image.png' }
    ]);

    expect(result.success).toBe(true);
    expect(result.paths?.[0]).toBe('custom-image.png');
  });

  test('uses correct extension for different MIME types', async () => {
    const testCases = [
      { mimeType: 'image/png', expectedExt: 'png' },
      { mimeType: 'image/jpeg', expectedExt: 'jpg' },
      { mimeType: 'image/gif', expectedExt: 'gif' },
      { mimeType: 'image/webp', expectedExt: 'webp' }
    ];

    for (const { mimeType, expectedExt } of testCases) {
      const result = await saveClipboardImages(testSessionDir, [
        { data: MINIMAL_PNG_BASE64, mimeType }
      ]);

      expect(result.success).toBe(true);
      expect(result.paths?.[0]).toMatch(new RegExp(`\\.${expectedExt}$`));
    }
  });

  test('returns error when no images provided', async () => {
    const result = await saveClipboardImages(testSessionDir, []);

    expect(result.success).toBe(false);
    expect(result.error).toBe('No images provided');
  });

  test('returns error when file transfer is disabled', async () => {
    const config: FileTransferConfig = {
      ...DEFAULT_FILE_TRANSFER_CONFIG,
      enabled: false
    };
    const result = await saveClipboardImages(
      testSessionDir,
      [{ data: MINIMAL_PNG_BASE64, mimeType: 'image/png' }],
      config
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe('File transfer is disabled');
  });

  test('returns error when image exceeds max file size', async () => {
    // Create a large base64 string (larger than 1KB limit)
    const largeData = Buffer.alloc(2 * 1024).toString('base64');
    const config: FileTransferConfig = {
      ...DEFAULT_FILE_TRANSFER_CONFIG,
      max_file_size: 1024 // 1KB limit
    };

    const result = await saveClipboardImages(
      testSessionDir,
      [{ data: largeData, mimeType: 'image/png' }],
      config
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('exceeds maximum file size');
  });

  test('creates base directory if it does not exist', async () => {
    const newDir = join(testSessionDir, 'new-subdir');

    const result = await saveClipboardImages(newDir, [
      { data: MINIMAL_PNG_BASE64, mimeType: 'image/png' }
    ]);

    expect(result.success).toBe(true);

    // Verify directory was created
    const savedPath = join(newDir, result.paths?.[0]);
    const fileExists = await Bun.file(savedPath).exists();
    expect(fileExists).toBe(true);
  });

  test('generates unique filenames with incrementing suffixes', async () => {
    // Save multiple images in same call - should have unique names
    const result = await saveClipboardImages(testSessionDir, [
      { data: MINIMAL_PNG_BASE64, mimeType: 'image/png' },
      { data: MINIMAL_PNG_BASE64, mimeType: 'image/png' }
    ]);

    expect(result.success).toBe(true);
    expect(result.paths?.[0]).not.toBe(result.paths?.[1]);
    // Second image should have -002 suffix
    expect(result.paths?.[1]).toMatch(/-002\.png$/);
  });
});
