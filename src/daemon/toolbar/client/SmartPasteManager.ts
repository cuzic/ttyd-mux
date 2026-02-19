/**
 * Smart Paste Manager
 *
 * Handles smart clipboard operations that detect content type
 * (text/image/file) and process accordingly.
 * - Text: send directly to terminal
 * - Image: show preview modal, upload to server, send path to terminal
 * - File: upload to server, send path to terminal
 */

import type { ClipboardHistoryManager } from './ClipboardHistoryManager.js';
import type { InputHandler } from './InputHandler.js';
import type { PendingUpload, SmartPasteElements, ToolbarConfig } from './types.js';

export class SmartPasteManager {
  private config: ToolbarConfig;
  private inputHandler: InputHandler;
  private historyManager: ClipboardHistoryManager;
  private elements: SmartPasteElements | null = null;
  private pendingUploads: PendingUpload[] = [];
  private currentIndex = 0;
  private isUploading = false;

  constructor(
    config: ToolbarConfig,
    inputHandler: InputHandler,
    historyManager: ClipboardHistoryManager
  ) {
    this.config = config;
    this.inputHandler = inputHandler;
    this.historyManager = historyManager;
  }

  /**
   * Bind DOM elements for preview modal and drop zone
   */
  bindElements(elements: SmartPasteElements): void {
    this.elements = elements;
    this.setupEventListeners();
    this.setupDropZone();
  }

  /**
   * Setup event listeners for modal controls
   */
  private setupEventListeners(): void {
    if (!this.elements) return;

    // Close button
    this.elements.previewClose.addEventListener('click', () => this.hidePreview());

    // Cancel button
    this.elements.previewCancel.addEventListener('click', () => this.hidePreview());

    // Submit button
    this.elements.previewSubmit.addEventListener('click', () => this.uploadAll());

    // Navigation buttons
    this.elements.previewPrev.addEventListener('click', () => this.prevItem());
    this.elements.previewNext.addEventListener('click', () => this.nextItem());

    // Remove current item button
    this.elements.previewRemove.addEventListener('click', () => this.removeCurrentItem());

    // Close on backdrop click
    this.elements.previewModal.addEventListener('click', (e) => {
      if (e.target === this.elements?.previewModal) {
        this.hidePreview();
      }
    });

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
      if (!this.isPreviewVisible()) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        this.hidePreview();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        this.prevItem();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        this.nextItem();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        this.uploadAll();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        this.removeCurrentItem();
      }
    });

    // Setup dot click handler (event delegation)
    this.setupDotClickHandler();
  }

  /**
   * Setup drag and drop zone
   */
  private setupDropZone(): void {
    // Prevent default drag behaviors on document
    document.addEventListener('dragover', (e) => {
      e.preventDefault();
    });

    document.addEventListener('drop', (e) => {
      e.preventDefault();
      this.hideDropZone();
    });

    // Show drop zone when dragging files
    document.addEventListener('dragenter', (e) => {
      if (this.hasFiles(e.dataTransfer)) {
        this.showDropZone();
      }
    });

    // Hide drop zone when leaving
    document.addEventListener('dragleave', (e) => {
      // Only hide if leaving the document
      if (e.relatedTarget === null) {
        this.hideDropZone();
      }
    });

    // Handle drop on drop zone
    if (this.elements?.dropZone) {
      this.elements.dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
      });

      this.elements.dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.hideDropZone();
        this.handleDrop(e);
      });
    }
  }

  /**
   * Check if dataTransfer contains files
   */
  private hasFiles(dataTransfer: DataTransfer | null): boolean {
    if (!dataTransfer) return false;
    return (
      dataTransfer.types.includes('Files') ||
      dataTransfer.types.includes('application/x-moz-file')
    );
  }

  /**
   * Show drop zone overlay
   */
  private showDropZone(): void {
    this.elements?.dropZone.classList.remove('hidden');
  }

  /**
   * Hide drop zone overlay
   */
  private hideDropZone(): void {
    this.elements?.dropZone.classList.add('hidden');
  }

  /**
   * Handle file drop event
   */
  handleDrop(e: DragEvent): void {
    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) return;
    this.handleFiles(files);
  }

  /**
   * Handle file input (from drop or file picker)
   */
  async handleFiles(files: FileList): Promise<void> {
    this.pendingUploads = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Check if it's an image
      if (file.type.startsWith('image/')) {
        const dataUrl = await this.readFileAsDataUrl(file);
        this.pendingUploads.push({
          blob: file,
          dataUrl,
          name: file.name,
          mimeType: file.type
        });
      } else {
        // Non-image files - upload directly
        await this.uploadSingleFile(file);
      }
    }

    // If we have images, show preview
    if (this.pendingUploads.length > 0) {
      this.currentIndex = 0;
      this.showPreview();
    }
  }

  /**
   * Read file as data URL
   */
  private readFileAsDataUrl(file: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /**
   * Main smart paste function - detect content type and handle accordingly
   */
  async smartPaste(): Promise<boolean> {
    try {
      // Try to read clipboard items (for images)
      if (navigator.clipboard.read) {
        try {
          const items = await navigator.clipboard.read();

          for (const item of items) {
            // Check for images first
            for (const type of item.types) {
              if (type.startsWith('image/')) {
                const blob = await item.getType(type);
                const dataUrl = await this.readFileAsDataUrl(blob);

                // Generate filename
                const ext = type.split('/')[1] || 'png';
                const name = `clipboard-${this.formatTimestamp()}.${ext}`;

                this.pendingUploads = [
                  {
                    blob,
                    dataUrl,
                    name,
                    mimeType: type
                  }
                ];
                this.currentIndex = 0;
                this.showPreview();
                return true;
              }
            }
          }
        } catch (err) {
          // Clipboard.read() might fail due to permissions
          console.log('[SmartPaste] clipboard.read() failed, falling back to readText', err);
        }
      }

      // Fall back to text paste
      const text = await navigator.clipboard.readText();
      if (text) {
        const result = this.inputHandler.sendText(text);
        if (result) {
          this.historyManager.addToHistory(text);
        }
        return result;
      }

      return false;
    } catch (err) {
      console.error('[SmartPaste] Failed to read clipboard:', err);
      return false;
    }
  }

  /**
   * Format current timestamp for filename
   */
  private formatTimestamp(): string {
    const now = new Date();
    return now
      .toISOString()
      .replace(/[-:]/g, '')
      .replace('T', '-')
      .replace(/\.\d{3}Z/, '');
  }

  /**
   * Check if preview modal is visible
   */
  isPreviewVisible(): boolean {
    return this.elements?.previewModal
      ? !this.elements.previewModal.classList.contains('hidden')
      : false;
  }

  /**
   * Show preview modal
   */
  showPreview(): void {
    if (!this.elements || this.pendingUploads.length === 0) return;

    this.elements.previewModal.classList.remove('hidden');
    this.renderPreview();
  }

  /**
   * Hide preview modal
   */
  hidePreview(): void {
    this.elements?.previewModal.classList.add('hidden');
    this.pendingUploads = [];
    this.currentIndex = 0;
  }

  /**
   * Render current preview item
   */
  private renderPreview(): void {
    if (!this.elements || this.pendingUploads.length === 0) return;

    const current = this.pendingUploads[this.currentIndex];
    if (!current) return;

    // Update image
    this.elements.previewImg.src = current.dataUrl;
    this.elements.previewImg.alt = current.name;

    // Update counter
    this.elements.previewCounter.textContent = `${this.currentIndex + 1}/${this.pendingUploads.length}`;

    // Update submit button text
    const count = this.pendingUploads.length;
    this.elements.previewSubmit.textContent = count > 1 ? `送信 (${count}枚)` : '送信';

    // Update navigation buttons visibility
    const showNav = this.pendingUploads.length > 1;
    this.elements.previewPrev.style.display = showNav ? 'block' : 'none';
    this.elements.previewNext.style.display = showNav ? 'block' : 'none';

    // Update dots
    this.renderDots();

    // Show/hide remove button
    this.elements.previewRemove.style.display = this.pendingUploads.length > 0 ? 'block' : 'none';
  }

  /**
   * Render navigation dots
   */
  private renderDots(): void {
    if (!this.elements) return;

    this.elements.previewDots.innerHTML = '';

    if (this.pendingUploads.length <= 1) return;

    for (let i = 0; i < this.pendingUploads.length; i++) {
      const dot = document.createElement('span');
      dot.className = 'ttyd-preview-dot';
      dot.dataset.index = String(i);
      if (i === this.currentIndex) {
        dot.classList.add('active');
      }
      this.elements.previewDots.appendChild(dot);
    }
  }

  /**
   * Setup dot click handler using event delegation
   */
  private setupDotClickHandler(): void {
    if (!this.elements) return;

    this.elements.previewDots.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('ttyd-preview-dot') && target.dataset.index) {
        this.currentIndex = parseInt(target.dataset.index, 10);
        this.renderPreview();
      }
    });
  }

  /**
   * Navigate to previous item
   */
  private prevItem(): void {
    if (this.pendingUploads.length <= 1) return;
    this.currentIndex = (this.currentIndex - 1 + this.pendingUploads.length) % this.pendingUploads.length;
    this.renderPreview();
  }

  /**
   * Navigate to next item
   */
  private nextItem(): void {
    if (this.pendingUploads.length <= 1) return;
    this.currentIndex = (this.currentIndex + 1) % this.pendingUploads.length;
    this.renderPreview();
  }

  /**
   * Remove current item from pending uploads
   */
  private removeCurrentItem(): void {
    if (this.pendingUploads.length === 0) return;

    this.pendingUploads.splice(this.currentIndex, 1);

    if (this.pendingUploads.length === 0) {
      this.hidePreview();
      return;
    }

    // Adjust index if needed
    if (this.currentIndex >= this.pendingUploads.length) {
      this.currentIndex = this.pendingUploads.length - 1;
    }

    this.renderPreview();
  }

  /**
   * Get session name from URL
   */
  private getSessionName(): string {
    // URL pattern: /<base_path>/<session-name>/...
    const basePath = this.config.base_path.replace(/^\/|\/$/g, ''); // Remove leading/trailing slashes
    const pathname = window.location.pathname;

    // Create regex pattern to match base_path followed by session name
    const pattern = new RegExp(`^/${basePath}/([^/]+)`);
    const match = pathname.match(pattern);
    return match ? match[1] : '';
  }

  /**
   * Upload all pending images
   */
  async uploadAll(): Promise<void> {
    if (this.pendingUploads.length === 0 || this.isUploading) return;

    this.isUploading = true;

    // Disable submit button and show loading state
    if (this.elements) {
      this.elements.previewSubmit.disabled = true;
      this.elements.previewSubmit.textContent = 'アップロード中...';
    }

    try {
      const sessionName = this.getSessionName();
      if (!sessionName) {
        console.error('[SmartPaste] Could not determine session name');
        alert('セッション名を取得できませんでした');
        return;
      }

      // Prepare images data
      const images = await Promise.all(
        this.pendingUploads.map(async (upload) => {
          // Convert blob to base64
          const arrayBuffer = await upload.blob.arrayBuffer();
          const base64 = btoa(
            new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
          );
          return {
            data: base64,
            mimeType: upload.mimeType,
            name: upload.name
          };
        })
      );

      // Upload to server
      const response = await fetch(
        `${this.config.base_path}/api/clipboard-image?session=${encodeURIComponent(sessionName)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ images })
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Upload failed');
      }

      // Send paths to terminal
      const paths = result.paths as string[];
      if (paths.length > 0) {
        // Join multiple paths with space
        const pathText = paths.join(' ');
        this.inputHandler.sendText(pathText);
        console.log('[SmartPaste] Uploaded images and sent paths:', pathText);
      }

      this.hidePreview();
    } catch (err) {
      console.error('[SmartPaste] Upload failed:', err);
      alert(`アップロードに失敗しました: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      this.isUploading = false;

      // Reset submit button
      if (this.elements) {
        this.elements.previewSubmit.disabled = false;
        const count = this.pendingUploads.length;
        this.elements.previewSubmit.textContent = count > 1 ? `送信 (${count}枚)` : '送信';
      }
    }
  }

  /**
   * Upload a single non-image file
   */
  private async uploadSingleFile(file: File): Promise<void> {
    try {
      const sessionName = this.getSessionName();
      if (!sessionName) {
        console.error('[SmartPaste] Could not determine session name');
        return;
      }

      // Create form data
      const formData = new FormData();
      formData.append('file', file);

      // Upload to file upload endpoint
      const response = await fetch(
        `${this.config.base_path}/api/files/upload?session=${encodeURIComponent(sessionName)}`,
        {
          method: 'POST',
          body: formData
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Upload failed');
      }

      // Send path to terminal
      if (result.path) {
        this.inputHandler.sendText(result.path);
        console.log('[SmartPaste] Uploaded file and sent path:', result.path);
      }
    } catch (err) {
      console.error('[SmartPaste] File upload failed:', err);
    }
  }
}
