// SSE (Server-Sent Events) Hook for real-time queue updates

import { useEffect, useRef, useCallback, useState } from 'react';
import { SSEQueueEvent } from '../api/types';
import { apiClient } from '../api/client';
import { getToken } from '../auth/storage';

interface UseSSEOptions {
  onEvent: (event: SSEQueueEvent) => void;
  onError?: (error: Error) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  enabled?: boolean;
}

interface UseSSEReturn {
  isConnected: boolean;
  disconnect: () => void;
  reconnect: () => void;
}

const MAX_RETRIES = 5;
const BASE_DELAY = 1000; // 1 second
const MAX_DELAY = 30000; // 30 seconds

export function useSSE({
  onEvent,
  onError,
  onConnect,
  onDisconnect,
  enabled = true,
}: UseSSEOptions): UseSSEReturn {
  const [isConnected, setIsConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<number>();
  const retryCountRef = useRef(0);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = undefined;
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsConnected(false);
    retryCountRef.current = 0;
  }, []);

  const connect = useCallback(() => {
    const token = getToken();
    if (!token || !enabled) {
      return;
    }

    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    // Note: Standard EventSource doesn't support custom headers
    // The API might need to accept token via query param or we need to use fetch-based SSE
    // For now, we'll use a fetch-based approach for better header support
    const url = apiClient.getSSEUrl();

    const connectWithFetch = async () => {
      try {
        const response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'text/event-stream',
          },
        });

        if (!response.ok) {
          throw new Error(`SSE connection failed: ${response.status}`);
        }

        if (!response.body) {
          throw new Error('Response body is null');
        }

        setIsConnected(true);
        retryCountRef.current = 0;
        onConnect?.();

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        const processEvents = async () => {
          try {
            while (true) {
              const { done, value } = await reader.read();
              
              if (done) {
                setIsConnected(false);
                onDisconnect?.();
                scheduleReconnect();
                break;
              }

              buffer += decoder.decode(value, { stream: true });
              
              // Process complete events
              const lines = buffer.split('\n');
              buffer = lines.pop() || ''; // Keep incomplete line in buffer

              let eventData = '';
              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  eventData += line.slice(6);
                } else if (line === '' && eventData) {
                  // End of event
                  try {
                    const event = JSON.parse(eventData) as SSEQueueEvent;
                    onEvent(event);
                  } catch (e) {
                    console.error('Failed to parse SSE event:', e, eventData);
                  }
                  eventData = '';
                }
              }
            }
          } catch (e) {
            if (e instanceof Error && e.name !== 'AbortError') {
              console.error('SSE read error:', e);
              setIsConnected(false);
              onDisconnect?.();
              scheduleReconnect();
            }
          }
        };

        processEvents();
      } catch (e) {
        console.error('SSE connection error:', e);
        setIsConnected(false);
        onError?.(e instanceof Error ? e : new Error('Unknown SSE error'));
        scheduleReconnect();
      }
    };

    const scheduleReconnect = () => {
      if (retryCountRef.current >= MAX_RETRIES) {
        onError?.(new Error('Max reconnection attempts reached'));
        return;
      }

      const delay = Math.min(
        BASE_DELAY * Math.pow(2, retryCountRef.current),
        MAX_DELAY
      );

      retryCountRef.current++;

      reconnectTimeoutRef.current = window.setTimeout(() => {
        if (enabled) {
          connectWithFetch();
        }
      }, delay);
    };

    connectWithFetch();
  }, [enabled, onEvent, onError, onConnect, onDisconnect]);

  const reconnect = useCallback(() => {
    retryCountRef.current = 0;
    disconnect();
    connect();
  }, [connect, disconnect]);

  useEffect(() => {
    if (enabled) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [enabled, connect, disconnect]);

  return {
    isConnected,
    disconnect,
    reconnect,
  };
}
