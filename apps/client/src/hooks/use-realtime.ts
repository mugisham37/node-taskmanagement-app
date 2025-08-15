"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { RealtimeIntegration, createRealtimeIntegration, getRealtimeIntegration } from "@/lib/realtime-integration";
import { useRealtimeStore } from "@/store/realtime-store";

interface UseRealtimeOptions {
  autoConnect?: boolean;
  debug?: boolean;
}

export function useRealtime(options: UseRealtimeOptions = {}) {
  const { autoConnect = true, debug = false } = options;
  const { isAuthenticated, user, token } = useAuth();
  const [integration, setIntegration] = useState<RealtimeIntegration | null>(null);
  const initializationRef = useRef(false);
  
  const realtimeStore = useRealtimeStore();

  // Initialize real-time integration
  useEffect(() => {
    if (!isAuthenticated || !user || !token || initializationRef.current) {
      return;
    }

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3001";
    
    const realtimeIntegration = createRealtimeIntegration({
      wsUrl,
      token,
      userId: user.id,
      debug,
      autoReconnect: true,
      heartbeatInterval: 30000,
    });

    setIntegration(realtimeIntegration);
    initializationRef.current = true;

    if (autoConnect) {
      realtimeIntegration.connect().catch(error => {
        console.error("Failed to connect to real-time server:", error);
      });
    }

    return () => {
      realtimeIntegration.disconnect();
      initializationRef.current = false;
    };
  }, [isAuthenticated, user, token, autoConnect, debug]);

  // Connection management
  const connect = useCallback(async () => {
    if (integration) {
      await integration.connect();
    }
  }, [integration]);

  const disconnect = useCallback(() => {
    if (integration) {
      integration.disconnect();
    }
  }, [integration]);

  const reconnect = useCallback(() => {
    if (integration) {
      integration.reconnect();
    }
  }, [integration]);

  // Room management
  const joinRoom = useCallback((roomId: string) => {
    return integration?.joinRoom(roomId) || false;
  }, [integration]);

  const leaveRoom = useCallback((roomId: string) => {
    return integration?.leaveRoom(roomId) || false;
  }, [integration]);

  const joinProject = useCallback((projectId: string) => {
    return integration?.joinProject(projectId) || false;
  }, [integration]);

  const leaveProject = useCallback((projectId: string) => {
    return integration?.leaveProject(projectId) || false;
  }, [integration]);

  const joinTask = useCallback((taskId: string) => {
    return integration?.joinTask(taskId) || false;
  }, [integration]);

  const leaveTask = useCallback((taskId: string) => {
    return integration?.leaveTask(taskId) || false;
  }, [integration]);

  // Presence management
  const updatePresence = useCallback((presence: any) => {
    return integration?.updatePresence(presence) || false;
  }, [integration]);

  const setStatus = useCallback((status: 'online' | 'away' | 'busy' | 'offline') => {
    return updatePresence({ status });
  }, [updatePresence]);

  const setCurrentRoom = useCallback((roomId: string | undefined) => {
    return updatePresence({ currentRoom: roomId });
  }, [updatePresence]);

  const updateCursor = useCallback((cursor: { x: number; y: number; elementId?: string }) => {
    return updatePresence({ cursor });
  }, [updatePresence]);

  // Optimistic updates
  const optimisticTaskUpdate = useCallback((taskId: string, updates: any) => {
    // Apply optimistic update to local store
    const taskStore = useRealtimeStore.getState();
    // taskStore.setOptimisticUpdate(taskId, updates); // This would need to be implemented
    
    // Send to server
    return integration?.sendTaskUpdate(taskId, updates) || false;
  }, [integration]);

  const optimisticProjectUpdate = useCallback((projectId: string, updates: any) => {
    // Apply optimistic update to local store
    const projectStore = useRealtimeStore.getState();
    // projectStore.setOptimisticUpdate(projectId, updates); // This would need to be implemented
    
    // Send to server
    return integration?.sendProjectUpdate(projectId, updates) || false;
  }, [integration]);

  // Collaboration features
  const startTyping = useCallback((channel: string) => {
    return integration?.startTyping(channel) || false;
  }, [integration]);

  const stopTyping = useCallback((channel: string) => {
    return integration?.stopTyping(channel) || false;
  }, [integration]);

  // Event listeners
  const addEventListener = useCallback((eventType: string, handler: (event: any) => void) => {
    if (integration) {
      integration.addEventListener(eventType, handler);
    }
  }, [integration]);

  const removeEventListener = useCallback((eventType: string, handler: (event: any) => void) => {
    if (integration) {
      integration.removeEventListener(eventType, handler);
    }
  }, [integration]);

  // Status and stats
  const isConnected = integration?.isConnected() || false;
  const connectionStats = integration?.getConnectionStats();
  const queuedMessages = integration?.getQueuedMessageCount() || 0;
  const connectionStatus = realtimeStore.getConnectionStatus();

  // Presence data
  const currentUser = realtimeStore.currentUser;
  const presenceUsers = Array.from(realtimeStore.presenceUsers.values());
  const activeSessions = Array.from(realtimeStore.activeSessions.values());

  // Helper functions
  const getPresenceInRoom = useCallback((roomId: string) => {
    return realtimeStore.getPresenceInRoom(roomId);
  }, [realtimeStore]);

  const getActiveCollaborators = useCallback((entityType: string, entityId: string) => {
    return realtimeStore.getActiveCollaborators(entityType, entityId);
  }, [realtimeStore]);

  const isUserOnline = useCallback((userId: string) => {
    return realtimeStore.isUserOnline(userId);
  }, [realtimeStore]);

  // Conflict resolution
  const setConflictResolutionStrategy = useCallback((strategy: 'server-wins' | 'client-wins' | 'merge' | 'prompt-user') => {
    // This would be implemented based on your conflict resolution needs
    console.log("Setting conflict resolution strategy:", strategy);
  }, []);

  return {
    // Connection management
    connect,
    disconnect,
    reconnect,
    isConnected,
    connectionStats,
    connectionStatus,
    queuedMessages,

    // Room management
    joinRoom,
    leaveRoom,
    joinProject,
    leaveProject,
    joinTask,
    leaveTask,

    // Presence management
    updatePresence,
    setStatus,
    setCurrentRoom,
    updateCursor,
    currentUser,
    presenceUsers,
    getPresenceInRoom,
    isUserOnline,

    // Collaboration
    startTyping,
    stopTyping,
    activeSessions,
    getActiveCollaborators,

    // Optimistic updates
    optimisticTaskUpdate,
    optimisticProjectUpdate,

    // Event handling
    addEventListener,
    removeEventListener,

    // Conflict resolution
    setConflictResolutionStrategy,

    // Integration instance (for advanced usage)
    integration,
  };
}