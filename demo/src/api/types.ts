// Steam Workshop Downloader API Types
// Based on OpenAPI spec from https://steamdl.lrlnet.se/openapi.json

// ============ Enums ============

export type QueueStatus =
  | 'pending'
  | 'downloading'
  | 'processing'
  | 'uploading'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type DeliveryMethod = 'direct' | 's3' | 'both';

// ============ API Response Types ============

export interface DownloadProgress {
  bytes_downloaded: number;
  total_bytes?: number | null;
  percent?: number | null;
}

export interface DownloadResult {
  download_url?: string | null;
  s3_url?: string | null;
  file_size: number;
  filename: string;
}

export interface QueueItem {
  id: string;
  user_id: string;
  published_file_id: number;
  app_id?: number | null;
  status: QueueStatus;
  progress: DownloadProgress;
  delivery: DeliveryMethod;
  result?: DownloadResult | null;
  error?: string | null;
  created_at: string;
  started_at?: string | null;
  completed_at?: string | null;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  name?: string | null;
  provider: string;
}

export interface AuthResponse {
  token: string;
  token_type: string;
  expires_in: number;
  user: AuthenticatedUser;
}

export interface ProviderInfo {
  name: string;
  auth_url: string;
}

export interface ProvidersResponse {
  providers: ProviderInfo[];
}

export interface QueueInfo {
  pending_count: number;
  current?: QueueItem | null;
  recent_completed: QueueItem[];
}

export interface CreateDownloadRequest {
  published_file_id: number;
  delivery?: DeliveryMethod;
}

export interface CreateDownloadResponse {
  id: string;
  status: string;
  position: number;
}

export interface S3UrlResponse {
  url: string;
  expires_in: number;
}

export interface HealthResponse {
  status: string;
}

export interface ReadinessResponse {
  ready: boolean;
  steam_status: string;
  s3_available: boolean;
}

// ============ Error Types ============

export interface ErrorBody {
  code: string;
  message: string;
}

export interface ErrorResponse {
  error: ErrorBody;
}

export class ApiRequestError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

// ============ SSE Event Types ============

export interface SSEQueueEvent {
  type: 'status_change' | 'progress_update' | 'completed' | 'failed';
  download: QueueItem;
}
