// Main Workshop Downloader Component

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { useDownload } from '../../hooks/useDownload';
import { LoginButton } from '../auth/LoginButton';
import { WorkshopInput } from './WorkshopInput';
import { DownloadStatus } from './DownloadStatus';
import { extractPkgFromZip } from '../../download';

interface WorkshopDownloaderProps {
  onFileReady: (data: Uint8Array, filename: string) => void;
  onError: (message: string) => void;
  onProgress?: (message: string, percent: number) => void;
}

export function WorkshopDownloader({ onFileReady, onError, onProgress }: WorkshopDownloaderProps) {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [isExtracting, setIsExtracting] = useState(false);
  const {
    currentDownload,
    queuePosition,
    isLoading,
    error,
    isSSEConnected,
    queueDownload,
    cancelDownload,
    downloadFile,
    clearDownload,
    clearError,
  } = useDownload();

  // Handle download completion - download ZIP and extract PKG
  useEffect(() => {
    if (currentDownload?.status === 'completed' && !isExtracting) {
      const processDownload = async () => {
        setIsExtracting(true);
        try {
          onProgress?.('Downloading file...', 10);
          const blob = await downloadFile();
          
          if (!blob) {
            throw new Error('Failed to download file');
          }

          // Extract PKG from the ZIP archive
          const { data, filename } = await extractPkgFromZip(blob, onProgress);
          
          onProgress?.('Done!', 100);
          clearDownload();
          onFileReady(data, filename);
        } catch (err) {
          onError(err instanceof Error ? err.message : 'Failed to process download');
          clearDownload();
        } finally {
          setIsExtracting(false);
        }
      };
      processDownload();
    }
  }, [currentDownload?.status, isExtracting, downloadFile, clearDownload, onFileReady, onError, onProgress]);

  // Propagate errors
  useEffect(() => {
    if (error) {
      onError(error);
      clearError();
    }
  }, [error, onError, clearError]);

  const handleSubmit = useCallback(async (workshopId: number) => {
    await queueDownload(workshopId);
  }, [queueDownload]);

  const handleRetry = useCallback(() => {
    if (currentDownload) {
      clearDownload();
      queueDownload(currentDownload.published_file_id);
    }
  }, [currentDownload, clearDownload, queueDownload]);

  // Show loading state while checking auth
  if (authLoading) {
    return (
      <div className="glass-card p-8 text-center">
        <div className="animate-pulse">
          <div className="h-8 w-48 bg-slate-700 rounded-lg mx-auto mb-4" />
          <div className="h-4 w-64 bg-slate-700/50 rounded mx-auto" />
        </div>
      </div>
    );
  }

  // Show login prompt if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="glass-card p-8">
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-violet-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-white mb-2">
            Sign in to Download
          </h3>
          <p className="text-sm text-slate-400 max-w-xs mx-auto">
            Connect with Google to download Steam Workshop items directly
          </p>
        </div>
        <div className="flex justify-center">
          <LoginButton />
        </div>
      </div>
    );
  }

  // Show extracting state
  if (isExtracting) {
    return (
      <div className="glass-card p-6">
        <div className="flex items-center justify-center gap-3">
          <svg className="w-5 h-5 animate-spin text-violet-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-white">Extracting PKG from archive...</span>
        </div>
      </div>
    );
  }

  // Show current download status
  if (currentDownload) {
    return (
      <DownloadStatus
        download={currentDownload}
        queuePosition={queuePosition}
        onCancel={cancelDownload}
        onRetry={handleRetry}
        onClear={clearDownload}
        isSSEConnected={isSSEConnected}
      />
    );
  }

  // Show input form
  return (
    <div className="glass-card p-6">
      <div className="text-center mb-6">
        <h3 className="text-lg font-medium text-white mb-2">
          Download from Steam Workshop
        </h3>
        <p className="text-sm text-slate-400">
          Enter a Wallpaper Engine workshop item ID to download and extract
        </p>
      </div>
      <WorkshopInput
        onSubmit={handleSubmit}
        isLoading={isLoading}
      />
    </div>
  );
}
