"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useAuth } from "@/components/providers/auth-provider";

interface WebSocketMessage {
  type: string;
  payload: any;
  timestamp: number;
  messageId?: string;
}

interface UseWebSocketOptions {
  onMessage?: (message: WebSocketMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
  onReconnect?: (attempt: number) => void;
  reconnectAttempts?: number;
  reconnectInterval?: number;
  heartbeatInterval?: number;
  autoReconnect?: boolean;
}

interface ConnectionStats {
  connectedAt?: Date;
  reconnectCount: number;
  lastHeartbeat?: Date;
  latency?: number;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const {
    onMessage,
    onConnect,
    onDisconnect,
    onError,
    onReconnect,
    reconnectAttempts = 10,
    reconnectInterval = 3000,
    heartbeatInterval = 30000,
    autoReconnect = true,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] = useState<
    "connecting" | "connected" | "disconnected" | "error" | "reconnecting"
  >("disconnected");
  const [connectionStats, setConnectionStats] = useState<ConnectionStats>({
    reconnectCount: 0,
  });
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectCountRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const heartbeatTimeoutRef = useRef<NodeJS.Timeout>();
  const heartbeatIntervalRef = useRef<NodeJS.Timeout>();
  const messageQueueRef = useRef<WebSocketMessage[]>([]);
  const joinedRoomsRef = useRef<Set<string>>(new Set());
  
  const { isAuthenticated, user, token } = useAuth();

  const generateMessageId = useCallback(() => {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  const startHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
    }

    heartbeatIntervalRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        const pingTime = Date.now();
        wsRef.current.send(JSON.stringify({
          type: "ping",
          payload: { timestamp: pingTime },
          timestamp: pingTime,
          messageId: generateMessageId(),
        }));

        // Set timeout for pong response
        heartbeatTimeoutRef.current = setTimeout(() => {
          console.warn("WebSocket heartbeat timeout - reconnecting");
          wsRef.current?.close();
        }, 10000);
      }
    }, heartbeatInterval);
  }, [heartbeatInterval, generateMessageId]);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = undefined;
    }
    if (heartbeatTimeoutRef.current) {
      clearTimeout(heartbeatTimeoutRef.current);
      heartbeatTimeoutRef.current = undefined;
    }
  }, []);

  const processMessageQueue = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN && messageQueueRef.current.length > 0) {
      const messages = [...messageQueueRef.current];
      messageQueueRef.current = [];
      
      messages.forEach(message => {
        wsRef.current?.send(JSON.stringify(message));
      });
    }
  }, []);

  const rejoinRooms = useCallback(() => {
    joinedRoomsRef.current.forEach(roomId => {
      sendMessage("room:join", { roomId });
    });
  }, []);

  const connect = useCallback(() => {
    if (!isAuthenticated || wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    if (reconnectCountRef.current > 0) {
      setConnectionState("reconnecting");
    } else {
      setConnectionState("connecting");
    }
    
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3001";
    const fullUrl = `${wsUrl}/ws${token ? `?token=${encodeURIComponent(token)}` : ''}`;
    
    try {
      const ws = new WebSocket(fullUrl);
      
      ws.onopen = () => {
        setIsConnected(true);
        setConnectionState("connected");
        
        const connectedAt = new Date();
        setConnectionStats(prev => ({
          ...prev,
          connectedAt,
          reconnectCount: reconnectCountRef.current,
        }));

        // Send authentication message if token is available
        if (user && token) {
          ws.send(JSON.stringify({
            type: "auth",
            payload: { 
              userId: user.id,
              token: token,
            },
            timestamp: Date.now(),
            messageId: generateMessageId(),
          }));
        }

        // Process queued messages
        processMessageQueue();
        
        // Rejoin rooms
        rejoinRooms();
        
        // Start heartbeat
        startHeartbeat();
        
        if (reconnectCountRef.current > 0) {
          onReconnect?.(reconnectCountRef.current);
        }
        
        reconnectCountRef.current = 0;
        onConnect?.();
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          
          // Handle pong response
          if (message.type === "pong") {
            if (heartbeatTimeoutRef.current) {
              clearTimeout(heartbeatTimeoutRef.current);
            }
            
            const latency = Date.now() - (message.payload?.timestamp || 0);
            setConnectionStats(prev => ({
              ...prev,
              lastHeartbeat: new Date(),
              latency,
            }));
            return;
          }

          // Handle connection established
          if (message.type === "connection:established") {
            console.log("WebSocket connection established:", message.payload);
            return;
          }

          // Handle room join/leave confirmations
          if (message.type === "room:joined") {
            joinedRoomsRef.current.add(message.payload.roomId);
            return;
          }

          if (message.type === "room:left") {
            joinedRoomsRef.current.delete(message.payload.roomId);
            return;
          }

          onMessage?.(message);
        } catch (error) {
          console.error("Failed to parse WebSocket message:", error);
        }
      };

      ws.onclose = (event) => {
        setIsConnected(false);
        setConnectionState("disconnected");
        stopHeartbeat();
        onDisconnect?.();
        
        // Attempt to reconnect if enabled and not a clean close
        if (autoReconnect && event.code !== 1000 && reconnectCountRef.current < reconnectAttempts) {
          reconnectCountRef.current++;
          const delay = Math.min(reconnectInterval * Math.pow(1.5, reconnectCountRef.current - 1), 30000);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        }
      };

      ws.onerror = (error) => {
        setConnectionState("error");
        stopHeartbeat();
        onError?.(error);
      };

      wsRef.current = ws;
    } catch (error) {
      console.error("Failed to create WebSocket connection:", error);
      setConnectionState("error");
    }
  }, [
    isAuthenticated, 
    user, 
    token, 
    autoReconnect, 
    reconnectAttempts, 
    reconnectInterval,
    onConnect,
    onDisconnect,
    onError,
    onReconnect,
    onMessage,
    generateMessageId,
    processMessageQueue,
    rejoinRooms,
    startHeartbeat,
    stopHeartbeat
  ]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    stopHeartbeat();
    
    if (wsRef.current) {
      wsRef.current.close(1000, "Client disconnect");
      wsRef.current = null;
    }
    
    setIsConnected(false);
    setConnectionState("disconnected");
    reconnectCountRef.current = 0;
    joinedRoomsRef.current.clear();
    messageQueueRef.current = [];
  }, [stopHeartbeat]);

  const sendMessage = useCallback((type: string, payload: any) => {
    const message: WebSocketMessage = {
      type,
      payload,
      timestamp: Date.now(),
      messageId: generateMessageId(),
    };

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
      return true;
    } else {
      // Queue message for when connection is restored
      messageQueueRef.current.push(message);
      console.warn("WebSocket is not connected, message queued");
      return false;
    }
  }, [generateMessageId]);

  const joinRoom = useCallback((roomId: string) => {
    return sendMessage("room:join", { roomId });
  }, [sendMessage]);

  const leaveRoom = useCallback((roomId: string) => {
    const success = sendMessage("room:leave", { roomId });
    if (success) {
      joinedRoomsRef.current.delete(roomId);
    }
    return success;
  }, [sendMessage]);

  const forceReconnect = useCallback(() => {
    disconnect();
    setTimeout(() => {
      reconnectCountRef.current = 0;
      connect();
    }, 1000);
  }, [disconnect, connect]);

  useEffect(() => {
    if (isAuthenticated) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [isAuthenticated, connect, disconnect]);

  return {
    isConnected,
    connectionState,
    connectionStats,
    connect,
    disconnect,
    sendMessage,
    joinRoom,
    leaveRoom,
    forceReconnect,
    joinedRooms: Array.from(joinedRoomsRef.current),
    queuedMessages: messageQueueRef.current.length,
  };
}