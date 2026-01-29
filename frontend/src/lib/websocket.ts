'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';

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
  const socket = useRef<Socket | null>(null);
  const retryCount = useRef(0);
  const reconnectTimeout = useRef<NodeJS.Timeout | null>(null);
  const isDisconnectingRef = useRef(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  
  // Store callbacks in refs to avoid recreating connect/disconnect
  const callbacksRef = useRef({ onMessage, onOpen, onClose, onError });
  const optionsRef = useRef({ reconnect, reconnectInterval, maxRetries });
  
  // Update refs when callbacks/options change
  useEffect(() => {
    callbacksRef.current = { onMessage, onOpen, onClose, onError };
    optionsRef.current = { reconnect, reconnectInterval, maxRetries };
  }, [onMessage, onOpen, onClose, onError, reconnect, reconnectInterval, maxRetries]);

  const connect = useCallback(() => {
    // Prevent multiple simultaneous connection attempts
    if (socket.current?.connected || isConnecting || isDisconnectingRef.current) {
      return;
    }

    setIsConnecting(true);

    try {
      // Get JWT token for authentication
      const getToken = () => {
        if (typeof window === 'undefined') return null;
        // Try localStorage first
        const localToken = localStorage.getItem('accessToken');
        if (localToken) return localToken;
        // Try cookie (if not HttpOnly)
        const cookieMatch = document.cookie.match(/accessToken=([^;]+)/);
        if (cookieMatch) return cookieMatch[1];
        return null;
      };

      const token = getToken();
      
      if (!token) {
        console.warn('No JWT token available for WebSocket connection');
        setIsConnecting(false);
        callbacksRef.current.onError?.(new Event('no-token') as any);
        return;
      }

      // Socket.IO connection options
      // Extract base URL - strip any path/namespace to connect to root namespace
      // Socket.IO treats paths in the URL as namespaces, so we need just the base URL
      const urlObj = new URL(url.replace(/^ws:\/\//, 'http://').replace(/^wss:\/\//, 'https://'));
      const baseUrl = `${urlObj.protocol}//${urlObj.host}`;
      
      // Disconnect existing socket if any
      if (socket.current) {
        socket.current.removeAllListeners();
        socket.current.disconnect();
        socket.current = null;
      }
      
      // Connect to root namespace (AlertsGateway is on root namespace)
      socket.current = io(baseUrl, {
        auth: { token },
        query: { token },
        transports: ['websocket', 'polling'],
        reconnection: optionsRef.current.reconnect,
        reconnectionDelay: optionsRef.current.reconnectInterval,
        reconnectionAttempts: optionsRef.current.maxRetries,
        autoConnect: true,
      });

      socket.current.on('connect', () => {
        setIsConnected(true);
        setIsConnecting(false);
        retryCount.current = 0;
        callbacksRef.current.onOpen?.();
      });

      socket.current.on('disconnect', (reason) => {
        setIsConnected(false);
        setIsConnecting(false);
        callbacksRef.current.onClose?.();
        
        // Only attempt manual reconnection if not intentionally disconnected
        if (
          !isDisconnectingRef.current &&
          optionsRef.current.reconnect &&
          reason !== 'io client disconnect' &&
          retryCount.current < optionsRef.current.maxRetries
        ) {
          retryCount.current += 1;
          reconnectTimeout.current = setTimeout(() => {
            if (!isDisconnectingRef.current) {
              connect();
            }
          }, optionsRef.current.reconnectInterval);
        }
      });

      socket.current.on('connect_error', (error) => {
        setIsConnecting(false);
        // Only log errors that aren't "Invalid namespace" to reduce noise
        if (error.message !== 'Invalid namespace') {
          console.error('WebSocket connection error:', error);
        }
        callbacksRef.current.onError?.(error as any);
      });

      // Listen for alert events (backend emits 'alert' with { event: 'alert', data: {...} })
      socket.current.on('alert', (data: { event?: string; data?: unknown }) => {
        if (callbacksRef.current.onMessage && data.data) {
          callbacksRef.current.onMessage({
            type: 'alert',
            payload: data.data,
          });
        }
      });

      // Listen for anomaly events
      socket.current.on('anomaly', (data: { event?: string; data?: unknown }) => {
        if (callbacksRef.current.onMessage && data.data) {
          callbacksRef.current.onMessage({
            type: 'anomaly',
            payload: data.data,
          });
        }
      });

      // Generic message handler for other event types
      socket.current.onAny((eventName, ...args) => {
        if (callbacksRef.current.onMessage && args.length > 0) {
          const payload = args[0];
          if (typeof payload === 'object' && payload !== null) {
            callbacksRef.current.onMessage({
              type: eventName,
              payload: 'data' in payload ? payload.data : payload,
            });
          }
        }
      });

    } catch (error) {
      setIsConnecting(false);
      console.error('Failed to connect WebSocket:', error);
      callbacksRef.current.onError?.(error as any);
    }
  }, [url, isConnecting]);

  const disconnect = useCallback(() => {
    isDisconnectingRef.current = true;
    
    if (reconnectTimeout.current) {
      clearTimeout(reconnectTimeout.current);
      reconnectTimeout.current = null;
    }
    
    if (socket.current) {
      // Remove all listeners to prevent errors during disconnect
      socket.current.removeAllListeners();
      
      // Only disconnect if socket is actually connected or connecting
      if (socket.current.connected || socket.current.connecting) {
        socket.current.disconnect();
      }
      
      socket.current = null;
    }
    
    setIsConnected(false);
    setIsConnecting(false);
    
    // Reset flag after a short delay to allow cleanup
    setTimeout(() => {
      isDisconnectingRef.current = false;
    }, 100);
  }, []);

  const send = useCallback((data: WebSocketMessage) => {
    if (socket.current?.connected) {
      socket.current.emit(data.type, data.payload);
    } else {
      console.warn('WebSocket is not connected');
    }
  }, []);

  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]); // Only depend on url, not connect/disconnect

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
