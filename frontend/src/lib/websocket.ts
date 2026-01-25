'use client';

import { useEffect, useRef, useCallback, useState } from 'react';

type WebSocketMessage = {
  type: string;
  payload: unknown;
};

interface UseWebSocketOptions {
  url: string;
  onMessage?: (message: WebSocketMessage) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (error: Event) => void;
  reconnect?: boolean;
  reconnectInterval?: number;
  maxRetries?: number;
}

export function useWebSocket({
  url,
  onMessage,
  onOpen,
  onClose,
  onError,
  reconnect = true,
  reconnectInterval = 5000,
  maxRetries = 5,
}: UseWebSocketOptions) {
  const ws = useRef<WebSocket | null>(null);
  const retryCount = useRef(0);
  const reconnectTimeout = useRef<NodeJS.Timeout | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  const connect = useCallback(() => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      return;
    }

    setIsConnecting(true);

    try {
      ws.current = new WebSocket(url);

      ws.current.onopen = () => {
        setIsConnected(true);
        setIsConnecting(false);
        retryCount.current = 0;
        onOpen?.();
      };

      ws.current.onclose = () => {
        setIsConnected(false);
        setIsConnecting(false);
        onClose?.();

        // Attempt reconnection
        if (reconnect && retryCount.current < maxRetries) {
          retryCount.current += 1;
          reconnectTimeout.current = setTimeout(() => {
            connect();
          }, reconnectInterval);
        }
      };

      ws.current.onerror = (error) => {
        setIsConnecting(false);
        onError?.(error);
      };

      ws.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as WebSocketMessage;
          onMessage?.(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };
    } catch (error) {
      setIsConnecting(false);
      console.error('Failed to connect WebSocket:', error);
    }
  }, [url, onMessage, onOpen, onClose, onError, reconnect, reconnectInterval, maxRetries]);

  const disconnect = useCallback(() => {
    if (reconnectTimeout.current) {
      clearTimeout(reconnectTimeout.current);
    }
    if (ws.current) {
      ws.current.close();
      ws.current = null;
    }
    setIsConnected(false);
  }, []);

  const send = useCallback((data: WebSocketMessage) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(data));
    } else {
      console.warn('WebSocket is not connected');
    }
  }, []);

  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    isConnected,
    isConnecting,
    connect,
    disconnect,
    send,
  };
}

// WebSocket event types
export const WS_EVENTS = {
  // Alerts
  ALERT_CREATED: 'alert:created',
  ALERT_UPDATED: 'alert:updated',
  ALERT_RESOLVED: 'alert:resolved',
  
  // Metrics
  METRICS_UPDATE: 'metrics:update',
  
  // Logs
  LOG_ENTRY: 'log:entry',
  
  // AI
  ANOMALY_DETECTED: 'ai:anomaly_detected',
  PREDICTION_UPDATE: 'ai:prediction_update',
  
  // Executor
  ACTION_STARTED: 'executor:action_started',
  ACTION_COMPLETED: 'executor:action_completed',
  ACTION_FAILED: 'executor:action_failed',
} as const;
