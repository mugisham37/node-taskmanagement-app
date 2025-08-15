"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "./auth-provider";
import { RealtimeIntegration, createRealtimeIntegration } from "@/lib/realtime-integration";
import { useRealtimeStore } from "@/store/realtime-store";
import { toast } from "sonner";

interface RealtimeContextValue {
  integration: RealtimeIntegration | null;
  isConnected: boolean;
  connectionStatus: {
    status: 'connected' | 'connecting' | 'disconnected' | 'error';
    quality: 'excellent' | 'good' | 'poor' | 'offline';
    details: string;
  };
  connect: () => Promise<void>;
  disconnect: () => void;
  reconnect: () => void;
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

interface RealtimeProviderProps {
  children: React.ReactNode;
  wsUrl?: string;
  debug?: boolean;
  autoConnect?: boolean;
}

export function RealtimeProvider({ 
  children, 
  wsUrl,
  debug = false,
  autoConnect = true 
}: RealtimeProviderProps) {
  const { isAuthenticated, user, token } = useAuth();
  const [integration, setIntegration] = useState<RealtimeIntegration | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const realtimeStore = useRealtimeStore();

  // Initialize integration when auth state changes
  useEffect(() => {
    if (!isAuthenticated || !user || !token) {
      if (integration) {
        integration.disconnect();
        setIntegration(null);
        setIsConnected(false);
      }
      return;
    }

    const finalWsUrl = wsUrl || process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3001";
    
    const newIntegration = createRealtimeIntegration({
      wsUrl: finalWsUrl,
      token,
      userId: user.id,
      debug,
      autoReconnect: true,
      heartbeatInterval: 30000,
    });

    setIntegration(newIntegration);

    // Set up connection event handlers
    const handleConnectionOpen = () => {
      setIsConnected(true);
      realtimeStore.setConnectionState(true, 'excellent');
      
      if (debug) {
        console.log("[RealtimeProvider] Connected to real-time server");
      }
    };

    const handleConnectionClose = () => {
      setIsConnected(false);
      realtimeStore.setConnectionState(false);
      
      if (debug) {
        console.log("[RealtimeProvider] Disconnected from real-time server");
      }
    };

    const handleConnectionError = (error: Event) => {
      realtimeStore.addSyncError("Connection error occurred");
      
      if (debug) {
        console.error("[RealtimeProvider] Connection error:", error);
      }
    };

    const handleHeartbeat = ({ latency }: { latency: number }) => {
      realtimeStore.updateLatency(latency);
    };

    const handleMaxReconnectAttempts = () => {
      toast.error("Connection Lost", {
        description: "Unable to reconnect to real-time server",
        action: {
          label: "Retry",
          onClick: () => newIntegration.reconnect(),
        },
      });
    };

    // Add event listeners
    newIntegration.addEventListener('connection:open', handleConnectionOpen);
    newIntegration.addEventListener('connection:close', handleConnectionClose);
    newIntegration.addEventListener('connection:error', handleConnectionError);
    newIntegration.addEventListener('heartbeat', handleHeartbeat);
    newIntegration.addEventListener('maxReconnectAttemptsReached', handleMaxReconnectAttempts);

    // Auto-connect if enabled
    if (autoConnect) {
      newIntegration.connect().catch(error => {
        console.error("[RealtimeProvider] Failed to auto-connect:", error);
        toast.error("Real-time Connection Failed", {
          description: "Failed to connect to real-time server",
          action: {
            label: "Retry",
            onClick: () => newIntegration.connect(),
          },
        });
      });
    }

    return () => {
      // Clean up event listeners
      newIntegration.removeEventListener('connection:open', handleConnectionOpen);
      newIntegration.removeEventListener('connection:close', handleConnectionClose);
      newIntegration.removeEventListener('connection:error', handleConnectionError);
      newIntegration.removeEventListener('heartbeat', handleHeartbeat);
      newIntegration.removeEventListener('maxReconnectAttemptsReached', handleMaxReconnectAttempts);
      
      newIntegration.disconnect();
    };
  }, [isAuthenticated, user, token, wsUrl, debug, autoConnect, realtimeStore]);

  // Update current user in realtime store
  useEffect(() => {
    if (user && isConnected) {
      realtimeStore.setCurrentUser({
        id: user.id,
        name: user.name || user.email,
        email: user.email,
        status: 'online',
        lastSeen: new Date(),
      });
    }
  }, [user, isConnected, realtimeStore]);

  const connect = async () => {
    if (integration) {
      try {
        await integration.connect();
        toast.success("Connected to real-time updates");
      } catch (error) {
        console.error("[RealtimeProvider] Connection failed:", error);
        toast.error("Connection Failed", {
          description: "Failed to connect to real-time server",
        });
        throw error;
      }
    }
  };

  const disconnect = () => {
    if (integration) {
      integration.disconnect();
      toast.info("Disconnected from real-time updates");
    }
  };

  const reconnect = () => {
    if (integration) {
      integration.reconnect();
      toast.info("Reconnecting to real-time server...");
    }
  };

  const connectionStatus = realtimeStore.getConnectionStatus();

  const contextValue: RealtimeContextValue = {
    integration,
    isConnected,
    connectionStatus,
    connect,
    disconnect,
    reconnect,
  };

  return (
    <RealtimeContext.Provider value={contextValue}>
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtimeContext(): RealtimeContextValue {
  const context = useContext(RealtimeContext);
  if (!context) {
    throw new Error("useRealtimeContext must be used within a RealtimeProvider");
  }
  return context;
}

// Connection status indicator component
export function RealtimeConnectionStatus() {
  const { connectionStatus, reconnect } = useRealtimeContext();
  const realtimeStore = useRealtimeStore();

  if (connectionStatus.status === 'connected') {
    return (
      <div className="flex items-center gap-2 text-sm text-green-600">
        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
        <span>Real-time connected</span>
        {realtimeStore.latency > 0 && (
          <span className="text-gray-500">({realtimeStore.latency}ms)</span>
        )}
      </div>
    );
  }

  if (connectionStatus.status === 'connecting') {
    return (
      <div className="flex items-center gap-2 text-sm text-yellow-600">
        <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
        <span>Connecting...</span>
      </div>
    );
  }

  if (connectionStatus.status === 'error') {
    return (
      <div className="flex items-center gap-2 text-sm text-red-600">
        <div className="w-2 h-2 bg-red-500 rounded-full" />
        <span>Connection error</span>
        <button
          onClick={reconnect}
          className="text-blue-600 hover:text-blue-800 underline"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-sm text-gray-600">
      <div className="w-2 h-2 bg-gray-400 rounded-full" />
      <span>Disconnected</span>
      <button
        onClick={reconnect}
        className="text-blue-600 hover:text-blue-800 underline"
      >
        Connect
      </button>
    </div>
  );
}

// Presence indicator component
export function PresenceIndicator({ userId }: { userId: string }) {
  const realtimeStore = useRealtimeStore();
  const user = realtimeStore.presenceUsers.get(userId);

  if (!user) {
    return (
      <div className="w-2 h-2 bg-gray-400 rounded-full" title="Offline" />
    );
  }

  const statusColors = {
    online: 'bg-green-500',
    away: 'bg-yellow-500',
    busy: 'bg-red-500',
    offline: 'bg-gray-400',
  };

  return (
    <div 
      className={`w-2 h-2 rounded-full ${statusColors[user.status]}`}
      title={`${user.name} - ${user.status}`}
    />
  );
}

// Typing indicator component
export function TypingIndicator({ channel }: { channel: string }) {
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const { integration } = useRealtimeContext();

  useEffect(() => {
    if (!integration) return;

    const handleTypingStart = (event: any) => {
      if (event.data.channel === channel) {
        setTypingUsers(prev => {
          if (!prev.includes(event.data.userName)) {
            return [...prev, event.data.userName];
          }
          return prev;
        });
      }
    };

    const handleTypingStop = (event: any) => {
      if (event.data.channel === channel) {
        setTypingUsers(prev => prev.filter(name => name !== event.data.userName));
      }
    };

    integration.addEventListener('user_typing', handleTypingStart);
    integration.addEventListener('user_stopped_typing', handleTypingStop);

    return () => {
      integration.removeEventListener('user_typing', handleTypingStart);
      integration.removeEventListener('user_stopped_typing', handleTypingStop);
    };
  }, [integration, channel]);

  if (typingUsers.length === 0) {
    return null;
  }

  const message = typingUsers.length === 1 
    ? `${typingUsers[0]} is typing...`
    : `${typingUsers.slice(0, -1).join(', ')} and ${typingUsers[typingUsers.length - 1]} are typing...`;

  return (
    <div className="text-sm text-gray-500 italic">
      {message}
    </div>
  );
}