import { create } from "zustand";
import { devtools } from "zustand/middleware";

interface PresenceUser {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  status: 'online' | 'away' | 'busy' | 'offline';
  lastSeen: Date;
  currentRoom?: string;
  cursor?: {
    x: number;
    y: number;
    elementId?: string;
  };
}

interface CollaborationSession {
  id: string;
  entityType: 'task' | 'project';
  entityId: string;
  participants: PresenceUser[];
  startedAt: Date;
  lastActivity: Date;
}

interface SyncStatus {
  isOnline: boolean;
  lastSync: Date | null;
  pendingChanges: number;
  syncErrors: string[];
}

interface RealtimeState {
  // Presence
  currentUser: PresenceUser | null;
  presenceUsers: Map<string, PresenceUser>;
  
  // Collaboration
  activeSessions: Map<string, CollaborationSession>;
  currentSession: CollaborationSession | null;
  
  // Sync status
  syncStatus: SyncStatus;
  
  // Connection state
  isConnected: boolean;
  connectionQuality: 'excellent' | 'good' | 'poor' | 'offline';
  latency: number;

  // Actions
  setCurrentUser: (user: PresenceUser) => void;
  updatePresence: (userId: string, presence: Partial<PresenceUser>) => void;
  removePresence: (userId: string) => void;
  clearPresence: () => void;
  
  // Collaboration
  startCollaboration: (session: CollaborationSession) => void;
  endCollaboration: (sessionId: string) => void;
  joinCollaboration: (sessionId: string, user: PresenceUser) => void;
  leaveCollaboration: (sessionId: string, userId: string) => void;
  updateCollaborationActivity: (sessionId: string) => void;
  
  // Sync management
  setSyncStatus: (status: Partial<SyncStatus>) => void;
  addSyncError: (error: string) => void;
  clearSyncErrors: () => void;
  incrementPendingChanges: () => void;
  decrementPendingChanges: () => void;
  
  // Connection management
  setConnectionState: (isConnected: boolean, quality?: RealtimeState['connectionQuality']) => void;
  updateLatency: (latency: number) => void;
  
  // Computed
  getPresenceInRoom: (roomId: string) => PresenceUser[];
  getActiveCollaborators: (entityType: string, entityId: string) => PresenceUser[];
  isUserOnline: (userId: string) => boolean;
  getConnectionStatus: () => {
    status: 'connected' | 'connecting' | 'disconnected' | 'error';
    quality: RealtimeState['connectionQuality'];
    details: string;
  };
}

export const useRealtimeStore = create<RealtimeState>()(
  devtools(
    (set, get) => ({
      // Initial state
      currentUser: null,
      presenceUsers: new Map(),
      activeSessions: new Map(),
      currentSession: null,
      syncStatus: {
        isOnline: false,
        lastSync: null,
        pendingChanges: 0,
        syncErrors: [],
      },
      isConnected: false,
      connectionQuality: 'offline',
      latency: 0,

      // Presence actions
      setCurrentUser: (user) => set({ currentUser: user }),

      updatePresence: (userId, presence) =>
        set((state) => {
          const newPresenceUsers = new Map(state.presenceUsers);
          const existingUser = newPresenceUsers.get(userId);
          
          if (existingUser) {
            newPresenceUsers.set(userId, { ...existingUser, ...presence });
          } else {
            newPresenceUsers.set(userId, presence as PresenceUser);
          }
          
          return { presenceUsers: newPresenceUsers };
        }),

      removePresence: (userId) =>
        set((state) => {
          const newPresenceUsers = new Map(state.presenceUsers);
          newPresenceUsers.delete(userId);
          return { presenceUsers: newPresenceUsers };
        }),

      clearPresence: () => set({ presenceUsers: new Map() }),

      // Collaboration actions
      startCollaboration: (session) =>
        set((state) => {
          const newActiveSessions = new Map(state.activeSessions);
          newActiveSessions.set(session.id, session);
          return { 
            activeSessions: newActiveSessions,
            currentSession: session,
          };
        }),

      endCollaboration: (sessionId) =>
        set((state) => {
          const newActiveSessions = new Map(state.activeSessions);
          newActiveSessions.delete(sessionId);
          return { 
            activeSessions: newActiveSessions,
            currentSession: state.currentSession?.id === sessionId ? null : state.currentSession,
          };
        }),

      joinCollaboration: (sessionId, user) =>
        set((state) => {
          const newActiveSessions = new Map(state.activeSessions);
          const session = newActiveSessions.get(sessionId);
          
          if (session) {
            const updatedSession = {
              ...session,
              participants: [...session.participants.filter(p => p.id !== user.id), user],
              lastActivity: new Date(),
            };
            newActiveSessions.set(sessionId, updatedSession);
          }
          
          return { activeSessions: newActiveSessions };
        }),

      leaveCollaboration: (sessionId, userId) =>
        set((state) => {
          const newActiveSessions = new Map(state.activeSessions);
          const session = newActiveSessions.get(sessionId);
          
          if (session) {
            const updatedSession = {
              ...session,
              participants: session.participants.filter(p => p.id !== userId),
              lastActivity: new Date(),
            };
            newActiveSessions.set(sessionId, updatedSession);
          }
          
          return { activeSessions: newActiveSessions };
        }),

      updateCollaborationActivity: (sessionId) =>
        set((state) => {
          const newActiveSessions = new Map(state.activeSessions);
          const session = newActiveSessions.get(sessionId);
          
          if (session) {
            newActiveSessions.set(sessionId, {
              ...session,
              lastActivity: new Date(),
            });
          }
          
          return { activeSessions: newActiveSessions };
        }),

      // Sync management
      setSyncStatus: (status) =>
        set((state) => ({
          syncStatus: { ...state.syncStatus, ...status },
        })),

      addSyncError: (error) =>
        set((state) => ({
          syncStatus: {
            ...state.syncStatus,
            syncErrors: [...state.syncStatus.syncErrors, error],
          },
        })),

      clearSyncErrors: () =>
        set((state) => ({
          syncStatus: {
            ...state.syncStatus,
            syncErrors: [],
          },
        })),

      incrementPendingChanges: () =>
        set((state) => ({
          syncStatus: {
            ...state.syncStatus,
            pendingChanges: state.syncStatus.pendingChanges + 1,
          },
        })),

      decrementPendingChanges: () =>
        set((state) => ({
          syncStatus: {
            ...state.syncStatus,
            pendingChanges: Math.max(0, state.syncStatus.pendingChanges - 1),
          },
        })),

      // Connection management
      setConnectionState: (isConnected, quality = 'offline') =>
        set({ 
          isConnected, 
          connectionQuality: isConnected ? quality : 'offline',
          syncStatus: (state) => ({
            ...state.syncStatus,
            isOnline: isConnected,
          }),
        }),

      updateLatency: (latency) => {
        set({ latency });
        
        // Update connection quality based on latency
        let quality: RealtimeState['connectionQuality'] = 'excellent';
        if (latency > 1000) quality = 'poor';
        else if (latency > 500) quality = 'good';
        
        set({ connectionQuality: quality });
      },

      // Computed getters
      getPresenceInRoom: (roomId) => {
        const { presenceUsers } = get();
        return Array.from(presenceUsers.values()).filter(
          user => user.currentRoom === roomId && user.status !== 'offline'
        );
      },

      getActiveCollaborators: (entityType, entityId) => {
        const { activeSessions } = get();
        const sessionKey = `${entityType}:${entityId}`;
        const session = activeSessions.get(sessionKey);
        return session ? session.participants : [];
      },

      isUserOnline: (userId) => {
        const { presenceUsers } = get();
        const user = presenceUsers.get(userId);
        return user ? user.status !== 'offline' : false;
      },

      getConnectionStatus: () => {
        const { isConnected, connectionQuality, latency, syncStatus } = get();
        
        if (!isConnected) {
          return {
            status: 'disconnected' as const,
            quality: 'offline' as const,
            details: 'Not connected to real-time server',
          };
        }
        
        if (syncStatus.syncErrors.length > 0) {
          return {
            status: 'error' as const,
            quality: connectionQuality,
            details: `Sync errors: ${syncStatus.syncErrors.length}`,
          };
        }
        
        if (syncStatus.pendingChanges > 0) {
          return {
            status: 'connecting' as const,
            quality: connectionQuality,
            details: `Syncing ${syncStatus.pendingChanges} changes`,
          };
        }
        
        return {
          status: 'connected' as const,
          quality: connectionQuality,
          details: `Connected (${latency}ms)`,
        };
      },
    }),
    {
      name: 'realtime-store',
    }
  )
);