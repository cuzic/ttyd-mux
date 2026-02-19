/**
 * Share Manager
 *
 * Handles read-only share link creation from the browser.
 */

import qrcode from 'qrcode-generator';
import type { ToolbarConfig } from './types.js';
import { getSessionNameFromURL } from './utils.js';

export class ShareManager {
  private config: ToolbarConfig;
  private shareBtn: HTMLElement | null = null;
  private modal: HTMLElement | null = null;
  private modalClose: HTMLElement | null = null;
  private createBtn: HTMLElement | null = null;
  private resultSection: HTMLElement | null = null;
  private urlInput: HTMLInputElement | null = null;
  private copyBtn: HTMLElement | null = null;
  private qrBtn: HTMLElement | null = null;
  private expiryOptions: NodeListOf<HTMLInputElement> | null = null;

  constructor(config: ToolbarConfig) {
    this.config = config;
  }

  /**
   * Bind modal elements
   */
  bindElements(
    shareBtn: HTMLElement,
    modal: HTMLElement,
    modalClose: HTMLElement,
    createBtn: HTMLElement,
    resultSection: HTMLElement,
    urlInput: HTMLInputElement,
    copyBtn: HTMLElement,
    qrBtn: HTMLElement
  ): void {
    this.shareBtn = shareBtn;
    this.modal = modal;
    this.modalClose = modalClose;
    this.createBtn = createBtn;
    this.resultSection = resultSection;
    this.urlInput = urlInput;
    this.copyBtn = copyBtn;
    this.qrBtn = qrBtn;
    this.expiryOptions = document.querySelectorAll(
      'input[name="ttyd-share-expiry"]'
    ) as NodeListOf<HTMLInputElement>;

    this.setupEventListeners();
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Open modal
    this.shareBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      this.show();
    });

    // Close modal
    this.modalClose?.addEventListener('click', (e) => {
      e.preventDefault();
      this.hide();
    });

    // Close on backdrop click
    this.modal?.addEventListener('click', (e) => {
      if (e.target === this.modal) {
        this.hide();
      }
    });

    // Create share link
    this.createBtn?.addEventListener('click', async (e) => {
      e.preventDefault();
      await this.createShare();
    });

    // Copy URL
    this.copyBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      this.copyUrl();
    });

    // Show QR code
    this.qrBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      this.showQR();
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isVisible()) {
        this.hide();
      }
    });
  }

  /**
   * Get session name from URL
   */
  private getSessionName(): string {
    return getSessionNameFromURL(this.config.base_path);
  }

  /**
   * Get selected expiry value
   */
  private getSelectedExpiry(): string {
    if (!this.expiryOptions) {
      return '24h';
    }
    for (const option of this.expiryOptions) {
      if (option.checked) {
        return option.value;
      }
    }
    return '24h';
  }

  /**
   * Check if modal is visible
   */
  isVisible(): boolean {
    return this.modal ? !this.modal.classList.contains('hidden') : false;
  }

  /**
   * Show the share modal
   */
  show(): void {
    if (!this.modal) {
      return;
    }
    this.modal.classList.remove('hidden');
    // Reset to initial state
    this.resultSection?.classList.add('hidden');
    this.createBtn?.classList.remove('hidden');
  }

  /**
   * Hide the share modal
   */
  hide(): void {
    if (!this.modal) {
      return;
    }
    this.modal.classList.add('hidden');
  }

  /**
   * Create a share link via API
   */
  async createShare(): Promise<void> {
    const basePath = this.config.base_path;
    const sessionName = this.getSessionName();
    const expiresIn = this.getSelectedExpiry();

    if (!sessionName) {
      alert('セッション名を取得できませんでした');
      return;
    }

    try {
      // Disable create button
      if (this.createBtn) {
        this.createBtn.textContent = '作成中...';
        (this.createBtn as HTMLButtonElement).disabled = true;
      }

      const response = await fetch(`${basePath}/api/shares`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionName, expiresIn })
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to create share link');
      }

      const share = await response.json();
      const shareUrl = `${window.location.origin}${basePath}/s/${share.token}`;

      this.showResult(shareUrl);
      console.log(`[Toolbar] Share link created: ${shareUrl}`);
    } catch (error) {
      console.error('[Toolbar] Failed to create share link:', error);
      alert(`共有リンクの作成に失敗しました: ${(error as Error).message}`);
    } finally {
      // Re-enable create button
      if (this.createBtn) {
        this.createBtn.textContent = 'リンクを作成';
        (this.createBtn as HTMLButtonElement).disabled = false;
      }
    }
  }

  /**
   * Show the result section with the share URL
   */
  private showResult(url: string): void {
    if (this.urlInput) {
      this.urlInput.value = url;
    }
    this.resultSection?.classList.remove('hidden');
    this.createBtn?.classList.add('hidden');
  }

  /**
   * Copy URL to clipboard
   */
  async copyUrl(): Promise<void> {
    if (!this.urlInput) {
      return;
    }

    try {
      await navigator.clipboard.writeText(this.urlInput.value);
      // Visual feedback
      const originalText = this.copyBtn?.textContent;
      if (this.copyBtn) {
        this.copyBtn.textContent = 'コピー完了!';
        setTimeout(() => {
          if (this.copyBtn) {
            this.copyBtn.textContent = originalText || 'コピー';
          }
        }, 2000);
      }
    } catch {
      // Fallback: select and copy
      this.urlInput.select();
      document.execCommand('copy');
      alert('URLをコピーしました');
    }
  }

  /**
   * Show QR code using qrcode-generator library
   */
  showQR(): void {
    if (!this.urlInput) {
      return;
    }

    const url = this.urlInput.value;

    try {
      // Generate QR code (type 0 = auto, L = low error correction)
      const qr = qrcode(0, 'L');
      qr.addData(url);
      qr.make();

      // Create data URL (4 = cell size, 4 = margin)
      const qrDataUrl = qr.createDataURL(4, 4);

      // Open QR code in a new window
      const qrWindow = window.open('', 'qrcode', 'width=250,height=280');
      if (qrWindow) {
        qrWindow.document.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>QRコード</title>
            <style>
              body {
                font-family: sans-serif;
                text-align: center;
                background: #1e1e1e;
                color: #fff;
                margin: 0;
                padding: 16px;
              }
              img { display: block; margin: 0 auto; }
              p { font-size: 12px; margin-top: 8px; word-break: break-all; }
            </style>
          </head>
          <body>
            <img src="${qrDataUrl}" alt="QR Code" />
            <p>読み取り専用リンク</p>
          </body>
          </html>
        `);
        qrWindow.document.close();
      }
    } catch (error) {
      console.error('[Toolbar] Failed to generate QR code:', error);
      alert('QRコードの生成に失敗しました');
    }
  }
}
