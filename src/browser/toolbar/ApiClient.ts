/**
 * ToolbarApiClient
 *
 * Centralized HTTP client for toolbar API calls.
 * Provides unified error handling and request management.
 */

import { z } from 'zod';
import {
  type FileInfo,
  FileInfoSchema,
  ListFilesResponseSchema,
  type ShareLink,
  ShareLinkSchema,
  SubscribeResponseSchema,
  UploadFileResponseSchema,
  UploadImagesResponseSchema,
  VapidKeyResponseSchema
} from './api-schemas.js';

/**
 * Options for fetchJSON
 */
export interface FetchOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
}

/**
 * Fetch JSON with unified error handling.
 * Returns the parsed JSON data or null if the request fails.
 *
 * @example
 * const data = await fetchJSON<{ items: Item[] }>('/api/items');
 * if (data) {
 *   console.log(data.items);
 * }
 */
export async function fetchJSON<T>(url: string, options?: FetchOptions): Promise<T | null> {
  try {
    const { body, ...rest } = options ?? {};
    const init: RequestInit = {
      ...rest,
      headers: {
        'Content-Type': 'application/json',
        ...rest.headers
      }
    };
    if (body !== undefined) {
      init.body = JSON.stringify(body);
    }
    const response = await fetch(url, init);
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

/**
 * Fetch JSON or throw an ApiError on failure.
 *
 * @example
 * try {
 *   const data = await fetchJSONOrThrow<{ items: Item[] }>('/api/items');
 *   console.log(data.items);
 * } catch (error) {
 *   if (error instanceof ApiError) {
 *     console.error(error.message, error.status);
 *   }
 * }
 */
export async function fetchJSONOrThrow<T>(url: string, options?: FetchOptions): Promise<T> {
  try {
    const { body, ...rest } = options ?? {};
    const init: RequestInit = {
      ...rest,
      headers: {
        'Content-Type': 'application/json',
        ...rest.headers
      }
    };
    if (body !== undefined) {
      init.body = JSON.stringify(body);
    }
    const response = await fetch(url, init);
    if (!response.ok) {
      let message = `Request failed with status ${response.status}`;
      try {
        const errorData = await response.json();
        if (errorData.error) {
          message = errorData.error;
        }
      } catch {
        // Ignore JSON parse error
      }
      throw new ApiError(message, response.status);
    }
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(error instanceof Error ? error.message : 'Unknown error', 0);
  }
}

/**
 * Image data for clipboard upload
 */
export interface ImageData {
  data: string;
  mimeType: string;
  name: string;
}

// Re-export types from api-schemas
export type { FileInfo, ShareLink } from './api-schemas.js';

/**
 * Push notification subscription data
 */
export interface SubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  sessionName?: string;
}

/**
 * API error with status code
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number = 0
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * ApiClient configuration
 */
export interface ApiClientConfig {
  basePath: string;
  fetch?: typeof fetch;
  signal?: AbortSignal;
}

/**
 * ToolbarApiClient interface
 */
export interface ToolbarApiClient {
  // Clipboard
  uploadImages(session: string, images: ImageData[]): Promise<string[]>;

  // File Transfer
  listFiles(session: string, path: string): Promise<FileInfo[]>;
  downloadFile(session: string, path: string): Promise<Blob>;
  uploadFile(session: string, path: string, file: File): Promise<string>;

  // Notifications
  getVapidKey(): Promise<string>;
  subscribe(subscription: SubscriptionData): Promise<string>;
  unsubscribe(id: string): Promise<void>;

  // Share
  createShare(session: string, expiresIn: string): Promise<ShareLink>;
}

/**
 * Create a new ToolbarApiClient instance
 */
export function createApiClient(config: ApiClientConfig): ToolbarApiClient {
  const { basePath, fetch: customFetch, signal } = config;
  const fetchFn = customFetch ?? globalThis.fetch;

  /**
   * Make an API request with error handling
   */
  const request = async <T>(url: string, init?: RequestInit): Promise<T> => {
    try {
      const response = await fetchFn(url, {
        ...init,
        signal: init?.signal ?? signal
      });

      if (!response.ok) {
        let message = `Request failed with status ${response.status}`;
        try {
          const errorData = await response.json();
          if (errorData.error) {
            message = errorData.error;
          }
        } catch {
          // Ignore JSON parse error
        }
        throw new ApiError(message, response.status);
      }

      return response as T;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(error instanceof Error ? error.message : 'Unknown error', 0);
    }
  };

  /**
   * Make a JSON API request with schema validation
   */
  const requestJson = async <T>(
    url: string,
    init: RequestInit | undefined,
    schema: z.ZodSchema<T>
  ): Promise<T> => {
    const response = await request<Response>(url, init);
    const data: unknown = await response.json();
    const result = schema.safeParse(data);
    if (result.success) {
      return result.data;
    }
    throw new ApiError(`Invalid response: ${result.error.issues[0]?.message ?? 'validation failed'}`, 0);
  };

  // Clipboard
  const uploadImages = async (session: string, images: ImageData[]): Promise<string[]> => {
    const url = `${basePath}/api/clipboard-image?session=${encodeURIComponent(session)}`;
    const result = await requestJson(
      url,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images })
      },
      UploadImagesResponseSchema
    );
    return result.paths;
  };

  // File Transfer
  const listFiles = async (session: string, path: string): Promise<FileInfo[]> => {
    const url = `${basePath}/api/files/list?session=${encodeURIComponent(session)}&path=${encodeURIComponent(path)}`;
    const result = await requestJson(url, undefined, ListFilesResponseSchema);
    return result.files;
  };

  const downloadFile = async (session: string, path: string): Promise<Blob> => {
    const url = `${basePath}/api/files/download?session=${encodeURIComponent(session)}&path=${encodeURIComponent(path)}`;
    const response = await request<Response>(url);
    return response.blob();
  };

  const uploadFile = async (session: string, destPath: string, file: File): Promise<string> => {
    const url = `${basePath}/api/files/upload?session=${encodeURIComponent(session)}&path=${encodeURIComponent(destPath)}`;
    const formData = new FormData();
    formData.append('file', file);

    const result = await requestJson(
      url,
      {
        method: 'POST',
        body: formData
      },
      UploadFileResponseSchema
    );
    return result.path;
  };

  // Notifications
  const getVapidKey = async (): Promise<string> => {
    const url = `${basePath}/api/notifications/vapid-key`;
    const result = await requestJson(url, undefined, VapidKeyResponseSchema);
    return result.publicKey;
  };

  const subscribe = async (subscription: SubscriptionData): Promise<string> => {
    const url = `${basePath}/api/notifications/subscribe`;
    const result = await requestJson(
      url,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription)
      },
      SubscribeResponseSchema
    );
    return result.id;
  };

  const unsubscribe = async (id: string): Promise<void> => {
    const url = `${basePath}/api/notifications/subscribe/${encodeURIComponent(id)}`;
    await request(url, { method: 'DELETE' });
  };

  // Share
  const createShare = async (sessionName: string, expiresIn: string): Promise<ShareLink> => {
    const url = `${basePath}/api/shares`;
    return requestJson(
      url,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionName, expiresIn })
      },
      ShareLinkSchema
    );
  };

  return {
    uploadImages,
    listFiles,
    downloadFile,
    uploadFile,
    getVapidKey,
    subscribe,
    unsubscribe,
    createShare
  };
}
