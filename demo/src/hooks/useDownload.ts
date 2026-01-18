// Download state management hook

import { useState, useCallback, useEffect, useRef } from 'react';
import { QueueItem, SSEQueueEvent, ApiRequestError } from '../api/types';
import { apiClient } from '../api/client';
import { useSSE } from './useSSE';
import { useAuth } from '../auth/AuthContext';

interface UseDownloadReturn {
  currentDownload: QueueItem | null;
  queuePosition: number | null;
  isLoading: boolean;
  error: string | null;
  isSSEConnected: boolean;
  queueDownload: (workshopId: number) => Promise<QueueItem | null>;
  cancelDownload: () => Promise<void>;
  downloadFile: () => Promise<Blob | null>;
  clearDownload: () => void;
  clearError: () => void;
  refreshDownload: () => Promise<void>;
}

export function useDownload(): UseDownloadReturn {
  const { isAuthenticated } = useAuth();
  const [currentDownload, setCurrentDownload] = useState<QueueItem | null>(null);
  const [queuePosition, setQueuePosition] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Track if we've fetched the initial download
  const initialFetchDone = useRef(false);

  // Fetch existing download on mount/auth change
  useEffect(() => {
    if (!isAuthenticated) {
      setCurrentDownload(null);
      setQueuePosition(null);
      initialFetchDone.current = false;
      return;
    }

    if (initialFetchDone.current) return;

    const fetchExisting = async () => {
      try {
        const download = await apiClient.getMyDownload();
        if (download) {
          setCurrentDownload(download);
        }
        initialFetchDone.current = true;
      } catch (e) {
        console.error('Failed to fetch existing download:', e);
        initialFetchDone.current = true;
      }
    };

    fetchExisting();
  }, [isAuthenticated]);

  // Handle SSE events
  const handleSSEEvent = useCallback((event: SSEQueueEvent) => {
    console.log('[SSE] Event received:', event.type, event.download?.id);
    
    // Only process events for our current download
    if (currentDownload && event.download?.id === currentDownload.id) {
      setCurrentDownload(event.download);
    } else if (!currentDownload && event.download) {
      // We might have just queued a download
      setCurrentDownload(event.download);
    }
  }, [currentDownload]);

  const handleSSEError = useCallback((err: Error) => {
    console.error('[SSE] Connection error:', err);
  }, []);

  // Connect to SSE when authenticated and have an active download
  const shouldConnectSSE = isAuthenticated && 
    currentDownload !== null && 
    ['pending', 'downloading', 'processing', 'uploading'].includes(currentDownload.status);

  const { isConnected: isSSEConnected } = useSSE({
    onEvent: handleSSEEvent,
    onError: handleSSEError,
    enabled: shouldConnectSSE,
  });

  // Queue a new download
  const queueDownload = useCallback(async (workshopId: number): Promise<QueueItem | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await apiClient.queueDownload({
        published_file_id: workshopId,
        delivery: 'direct',
      });

      setQueuePosition(response.position);

      // Fetch the full download details
      const download = await apiClient.getDownload(response.id);
      setCurrentDownload(download);
      
      return download;
    } catch (e) {
      let message = 'Failed to queue download';
      
      if (e instanceof ApiRequestError) {
        if (e.status === 409) {
          message = 'You already have a download in the queue';
          // Try to fetch the existing download
          try {
            const existing = await apiClient.getMyDownload();
            if (existing) {
              setCurrentDownload(existing);
            }
          } catch {
            // Ignore
          }
        } else if (e.status === 401) {
          message = 'Please sign in to download';
        } else {
          message = e.message;
        }
      } else if (e instanceof Error) {
        message = e.message;
      }
      
      setError(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Cancel the current download
  const cancelDownload = useCallback(async (): Promise<void> => {
    if (!currentDownload) return;

    try {
      await apiClient.cancelDownload(currentDownload.id);
      setCurrentDownload((prev) =>
        prev ? { ...prev, status: 'cancelled' } : null
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to cancel download';
      setError(message);
    }
  }, [currentDownload]);

  // Download the completed file
  const downloadFile = useCallback(async (): Promise<Blob | null> => {
    if (!currentDownload || currentDownload.status !== 'completed') {
      return null;
    }

    try {
      setIsLoading(true);
      return await apiClient.downloadFile(currentDownload.id);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Download failed';
      setError(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [currentDownload]);

  // Clear download state
  const clearDownload = useCallback(() => {
    setCurrentDownload(null);
    setQueuePosition(null);
    setError(null);
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Refresh download status
  const refreshDownload = useCallback(async () => {
    if (!currentDownload) return;

    try {
      const download = await apiClient.getDownload(currentDownload.id);
      setCurrentDownload(download);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 404) {
        setCurrentDownload(null);
      }
    }
  }, [currentDownload]);

  // Poll for updates if SSE is not connected
  useEffect(() => {
    if (isSSEConnected || !currentDownload) return;
    if (!['pending', 'downloading', 'processing', 'uploading'].includes(currentDownload.status)) return;

    const pollInterval = setInterval(async () => {
      try {
        const download = await apiClient.getDownload(currentDownload.id);
        setCurrentDownload(download);
      } catch {
        // Ignore polling errors
      }
    }, 3000);

    return () => clearInterval(pollInterval);
  }, [isSSEConnected, currentDownload]);

  return {
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
    refreshDownload,
  };
}
