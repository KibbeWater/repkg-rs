// Steam Workshop Downloader API Client

import {
  QueueItem,
  AuthenticatedUser,
  ProvidersResponse,
  CreateDownloadRequest,
  CreateDownloadResponse,
  QueueInfo,
  S3UrlResponse,
  ApiRequestError,
} from './types';
import { getToken } from '../auth/storage';

const API_BASE = 'https://steamdl.lrlnet.se';

class SteamDLClient {
  private getHeaders(authenticated = true): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (authenticated) {
      const token = getToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    return headers;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    authenticated = true
  ): Promise<T> {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        ...this.getHeaders(authenticated),
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { code: 'UNKNOWN', message: `HTTP ${response.status}` } }));
      throw new ApiRequestError(
        response.status,
        error.error?.code || 'UNKNOWN_ERROR',
        error.error?.message || `HTTP ${response.status}`
      );
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return undefined as T;
    }

    return response.json();
  }

  // ============ Auth Endpoints ============

  async getProviders(): Promise<ProvidersResponse> {
    return this.request('/auth/providers', {}, false);
  }

  getGoogleAuthUrl(redirectUri: string): string {
    const params = new URLSearchParams({
      redirect_uri: redirectUri,
    });
    return `${API_BASE}/auth/google?${params.toString()}`;
  }

  // ============ User Endpoints ============

  async getMe(): Promise<AuthenticatedUser> {
    return this.request('/api/v1/me');
  }

  async getMyDownload(): Promise<QueueItem | null> {
    try {
      return await this.request('/api/v1/me/download');
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 404) {
        return null;
      }
      throw e;
    }
  }

  // ============ Download Endpoints ============

  async queueDownload(request: CreateDownloadRequest): Promise<CreateDownloadResponse> {
    return this.request('/api/v1/downloads', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async getDownload(id: string): Promise<QueueItem> {
    return this.request(`/api/v1/downloads/${id}`);
  }

  async cancelDownload(id: string): Promise<void> {
    return this.request(`/api/v1/downloads/${id}`, {
      method: 'DELETE',
    });
  }

  async downloadFile(id: string): Promise<Blob> {
    const token = getToken();
    const response = await fetch(`${API_BASE}/api/v1/downloads/${id}/file`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    if (!response.ok) {
      throw new ApiRequestError(
        response.status,
        'DOWNLOAD_FAILED',
        'Failed to download file'
      );
    }

    return response.blob();
  }

  async getS3Url(id: string, expiresInSeconds: number): Promise<S3UrlResponse> {
    return this.request(`/api/v1/downloads/${id}/url?expires=${expiresInSeconds}`);
  }

  // ============ Queue Endpoints ============

  async getQueueInfo(): Promise<QueueInfo> {
    return this.request('/api/v1/queue');
  }

  getSSEUrl(): string {
    // Note: EventSource doesn't support custom headers, but this API uses bearer auth
    // We'll handle this differently in the SSE hook using fetch-based SSE
    return `${API_BASE}/api/v1/queue/events`;
  }

  getApiBase(): string {
    return API_BASE;
  }
}

export const apiClient = new SteamDLClient();
export default apiClient;
