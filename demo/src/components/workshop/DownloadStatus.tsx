// Download Status Component - Shows real-time download progress

import { QueueItem, QueueStatus } from '../../api/types';

interface DownloadStatusProps {
  download: QueueItem;
  queuePosition?: number | null;
  onCancel: () => void;
  onRetry?: () => void;
  onClear?: () => void;
  isSSEConnected?: boolean;
}

const STATUS_CONFIG: Record<
  QueueStatus,
  { label: string; color: string; bgColor: string; icon: string }
> = {
  pending: {
    label: 'Waiting in queue',
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/20',
    icon: 'clock',
  },
  downloading: {
    label: 'Downloading from Steam',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/20',
    icon: 'download',
  },
  processing: {
    label: 'Processing files',
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/20',
    icon: 'cog',
  },
  uploading: {
    label: 'Preparing download',
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/20',
    icon: 'upload',
  },
  completed: {
    label: 'Ready to extract',
    color: 'text-green-400',
    bgColor: 'bg-green-500/20',
    icon: 'check',
  },
  failed: {
    label: 'Download failed',
    color: 'text-red-400',
    bgColor: 'bg-red-500/20',
    icon: 'x',
  },
  cancelled: {
    label: 'Cancelled',
    color: 'text-slate-400',
    bgColor: 'bg-slate-500/20',
    icon: 'x',
  },
};

function StatusIcon({ type }: { type: string }) {
  switch (type) {
    case 'clock':
      return (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case 'download':
      return (
        <svg className="w-5 h-5 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
      );
    case 'cog':
      return (
        <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      );
    case 'upload':
      return (
        <svg className="w-5 h-5 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
      );
    case 'check':
      return (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      );
    case 'x':
      return (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      );
    default:
      return null;
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DownloadStatus({
  download,
  queuePosition,
  onCancel,
  onRetry,
  onClear,
  isSSEConnected,
}: DownloadStatusProps) {
  const { status, progress, error, published_file_id, result } = download;
  const config = STATUS_CONFIG[status];
  
  const isActive = ['pending', 'downloading', 'processing', 'uploading'].includes(status);
  const showProgress = status === 'downloading' && progress.total_bytes;
  const progressPercent = progress.percent ?? (
    progress.total_bytes 
      ? Math.round((progress.bytes_downloaded / progress.total_bytes) * 100)
      : 0
  );

  return (
    <div className="glass-card p-5 w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${config.bgColor}`}>
            <span className={config.color}>
              <StatusIcon type={config.icon} />
            </span>
          </div>
          <div>
            <p className={`font-medium ${config.color}`}>{config.label}</p>
            <p className="text-xs text-slate-500">
              Workshop ID: {published_file_id}
            </p>
          </div>
        </div>

        {/* Connection indicator */}
        {isActive && (
          <div className="flex items-center gap-1.5">
            <div
              className={`w-2 h-2 rounded-full ${
                isSSEConnected ? 'bg-green-500' : 'bg-yellow-500'
              }`}
            />
            <span className="text-xs text-slate-500">
              {isSSEConnected ? 'Live' : 'Polling'}
            </span>
          </div>
        )}
      </div>

      {/* Queue Position */}
      {status === 'pending' && queuePosition != null && queuePosition > 0 && (
        <div className="mb-4 p-3 rounded-lg bg-slate-800/50 border border-white/5">
          <p className="text-sm text-slate-400">
            Position in queue:{' '}
            <span className="text-white font-medium">#{queuePosition}</span>
          </p>
        </div>
      )}

      {/* Progress Bar */}
      {showProgress && (
        <div className="mb-4">
          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-slate-500 mt-1.5">
            <span>{formatBytes(progress.bytes_downloaded)}</span>
            <span>{progressPercent}%</span>
            <span>{formatBytes(progress.total_bytes!)}</span>
          </div>
        </div>
      )}

      {/* Indeterminate Progress */}
      {isActive && !showProgress && (
        <div className="mb-4">
          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full w-1/3 bg-gradient-to-r from-violet-500 to-fuchsia-500 animate-indeterminate" />
          </div>
        </div>
      )}

      {/* Completed Info */}
      {status === 'completed' && result && (
        <div className="mb-4 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
          <p className="text-sm text-green-400">
            File ready: <span className="font-mono">{result.filename}</span>
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Size: {formatBytes(result.file_size)}
          </p>
        </div>
      )}

      {/* Error Message */}
      {status === 'failed' && error && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 flex-wrap">
        {isActive && (
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm rounded-lg
                       bg-red-500/10 text-red-400 border border-red-500/20
                       hover:bg-red-500/20 transition-colors"
          >
            Cancel
          </button>
        )}

        {(status === 'failed' || status === 'cancelled') && onRetry && (
          <button
            onClick={onRetry}
            className="px-4 py-2 text-sm rounded-lg
                       bg-violet-500/10 text-violet-400 border border-violet-500/20
                       hover:bg-violet-500/20 transition-colors"
          >
            Retry
          </button>
        )}

        {(status === 'failed' || status === 'cancelled') && onClear && (
          <button
            onClick={onClear}
            className="px-4 py-2 text-sm rounded-lg
                       bg-slate-500/10 text-slate-400 border border-slate-500/20
                       hover:bg-slate-500/20 transition-colors"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
