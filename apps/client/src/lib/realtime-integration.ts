import { WebSocketClient, createWebSocketClient } from './websocket-client';
import { useRealtimeStore } from '@/store/realtime-store';
import { useTaskStore } from '@/store/task-store';
import { useProjectStore } from '@/store/project-store';
import { toast } from 'sonner';

interface RealtimeIntegrationOptions {
  wsUrl: string;
  token?: string;
  userId?: string;
  debug?: boolean;
  autoReconnect?: boolean;
  heartbeatInterval?: number;
}

interface RealtimeEvent {
  type: string;
  data: any;
  timestamp: string;
  messageId?: string;
  userId?: string;
}

export class RealtimeIntegration {
  private wsClient: WebSocketClient;
  private isInitialized = false;
  private currentRooms = new Set<string>();
  private eventHandlers = new Map<string, ((event: RealtimeEvent) => void)[]>();

  constructor(private options: RealtimeIntegrationOptions) {
    this.wsClient = createWebSocketClient({
      url: this.options.wsUrl,
      reconnectAttempts: 10,
      reconnectInterval: 3000,
      heartbeatInterval: this.options.heartbeatInterval || 30000,
      debug: this.options.debug || false,
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Connection events
    this.wsClient.on('open', () => {
      this.handleConnectionOpen();
    });

    this.wsClient.on('close', () => {
      this.handleConnectionClose();
    });

    this.wsClient.on('error', (error) => {
      this.handleConnectionError(error);
    });

    this.wsClient.on('message', (message) => {
      this.handleMessage(message);
    });

    this.wsClient.on('heartbeat', ({ latency }) => {
      this.handleHeartbeat(latency);
    });

    this.wsClient.on('maxReconnectAttemptsReached', () => {
      this.handleMaxReconnectAttempts();
    });
  }

  private handleConnectionOpen(): void {
    const realtimeStore = useRealtimeStore.getState();
    
    realtimeStore.setConnectionState(true, 'excellent');
    
    // Authenticate if token is available
    if (this.options.token && this.options.userId) {
      this.wsClient.send('auth', {
        token: this.options.token,
        userId: this.options.userId,
      });
    }

    // Rejoin rooms
    this.currentRooms.forEach(roomId => {
      this.wsClient.joinRoom(roomId);
    });

    if (this.options.debug) {
      console.log('[RealtimeIntegration] Connected to real-time server');
    }
  }

  private handleConnectionClose(): void {
    const realtimeStore = useRealtimeStore.getState();
    realtimeStore.setConnectionState(false);
    
    if (this.options.debug) {
      console.log('[RealtimeIntegration] Disconnected from real-time server');
    }
  }

  private handleConnectionError(error: Event): void {
    const realtimeStore = useRealtimeStore.getState();
    realtimeStore.addSyncError('Connection error occurred');
    
    console.error('[RealtimeIntegration] Connection error:', error);
  }

  private handleMessage(message: any): void {
    try {
      const event: RealtimeEvent = message;
      
      // Handle system messages
      if (this.handleSystemMessage(event)) {
        return;
      }

      // Route to specific handlers
      this.routeEvent(event);
      
      // Trigger custom event handlers
      const handlers = this.eventHandlers.get(event.type) || [];
      handlers.forEach(handler => {
        try {
          handler(event);
        } catch (error) {
          console.error('[RealtimeIntegration] Event handler error:', error);
        }
      });

    } catch (error) {
      console.error('[RealtimeIntegration] Message handling error:', error);
    }
  }

  private handleSystemMessage(event: RealtimeEvent): boolean {
    switch (event.type) {
      case 'welcome':
        this.handleWelcome(event);
        return true;
      
      case 'pong':
        // Handled by WebSocketClient
        return true;
      
      case 'subscribed':
      case 'unsubscribed':
      case 'project_joined':
      case 'project_left':
        // Acknowledgment messages
        return true;
      
      case 'error':
        this.handleServerError(event);
        return true;
      
      default:
        return false;
    }
  }

  private handleWelcome(event: RealtimeEvent): void {
    const { connectionId, user } = event.data;
    const realtimeStore = useRealtimeStore.getState();
    
    realtimeStore.setCurrentUser({
      id: user.id,
      name: user.name,
      email: user.email || '',
      status: 'online',
      lastSeen: new Date(),
    });

    if (this.options.debug) {
      console.log('[RealtimeIntegration] Welcome received:', { connectionId, user });
    }
  }

  private handleServerError(event: RealtimeEvent): void {
    const { message, code } = event.data;
    const realtimeStore = useRealtimeStore.getState();
    
    realtimeStore.addSyncError(`Server error: ${message} (${code})`);
    toast.error('Real-time Error', { description: message });
  }

  private handleHeartbeat(latency: number): void {
    const realtimeStore = useRealtimeStore.getState();
    realtimeStore.updateLatency(latency);
  }

  private handleMaxReconnectAttempts(): void {
    const realtimeStore = useRealtimeStore.getState();
    realtimeStore.addSyncError('Max reconnection attempts reached');
    toast.error('Connection Lost', {
      description: 'Unable to reconnect to real-time server',
      action: {
        label: 'Retry',
        onClick: () => this.reconnect(),
      },
    });
  }

  private routeEvent(event: RealtimeEvent): void {
    // Task events
    if (event.type.startsWith('task:')) {
      this.handleTaskEvent(event);
      return;
    }

    // Project events
    if (event.type.startsWith('project:')) {
      this.handleProjectEvent(event);
      return;
    }

    // User events
    if (event.type.startsWith('user:')) {
      this.handleUserEvent(event);
      return;
    }

    // Presence events
    if (event.type.includes('presence')) {
      this.handlePresenceEvent(event);
      return;
    }

    // Collaboration events
    if (event.type.includes('collaboration') || event.type.includes('typing')) {
      this.handleCollaborationEvent(event);
      return;
    }

    // Notification events
    if (event.type.includes('notification')) {
      this.handleNotificationEvent(event);
      return;
    }
  }

  private handleTaskEvent(event: RealtimeEvent): void {
    const taskStore = useTaskStore.getState();
    
    switch (event.type) {
      case 'task:created':
        taskStore.addTask(event.data);
        toast.success('Task Created', {
          description: `"${event.data.title}" was created`,
        });
        break;
      
      case 'task:updated':
        const { taskId, updates } = event.data;
        taskStore.updateTask(taskId, updates);
        
        // Show notification if update was from another user
        if (event.userId && event.userId !== this.options.userId) {
          toast.info('Task Updated', {
            description: `"${updates.title || 'Task'}" was updated by another user`,
          });
        }
        break;
      
      case 'task:deleted':
        taskStore.removeTask(event.data.taskId);
        toast.info('Task Deleted', {
          description: 'A task was deleted by another user',
        });
        break;
      
      case 'task:completed':
        taskStore.updateTask(event.data.taskId, { status: 'done' });
        toast.success('Task Completed', {
          description: `"${event.data.title}" was completed`,
        });
        break;
    }
  }

  private handleProjectEvent(event: RealtimeEvent): void {
    const projectStore = useProjectStore.getState();
    
    switch (event.type) {
      case 'project:created':
        projectStore.addProject(event.data);
        toast.success('Project Created', {
          description: `"${event.data.name}" was created`,
        });
        break;
      
      case 'project:updated':
        const { projectId, updates } = event.data;
        projectStore.updateProject(projectId, updates);
        
        if (event.userId && event.userId !== this.options.userId) {
          toast.info('Project Updated', {
            description: `"${updates.name || 'Project'}" was updated by another user`,
          });
        }
        break;
      
      case 'project:deleted':
        projectStore.removeProject(event.data.projectId);
        toast.info('Project Deleted', {
          description: 'A project was deleted by another user',
        });
        break;
    }
  }

  private handleUserEvent(event: RealtimeEvent): void {
    const realtimeStore = useRealtimeStore.getState();
    
    switch (event.type) {
      case 'user:joined':
        const { user, roomId } = event.data;
        realtimeStore.updatePresence(user.id, {
          ...user,
          status: 'online',
          currentRoom: roomId,
          lastSeen: new Date(),
        });
        
        toast.info('User Joined', {
          description: `${user.name} joined the workspace`,
        });
        break;
      
      case 'user:left':
        realtimeStore.updatePresence(event.data.user.id, {
          status: 'offline',
          lastSeen: new Date(),
        });
        
        toast.info('User Left', {
          description: `${event.data.user.name} left the workspace`,
        });
        break;
      
      case 'user:online':
        realtimeStore.updatePresence(event.data.userId, {
          status: 'online',
          lastSeen: new Date(),
        });
        break;
      
      case 'user:offline':
        realtimeStore.updatePresence(event.data.userId, {
          status: 'offline',
          lastSeen: new Date(),
        });
        break;
    }
  }

  private handlePresenceEvent(event: RealtimeEvent): void {
    const realtimeStore = useRealtimeStore.getState();
    
    switch (event.type) {
      case 'presence_update':
        const { userId, presence } = event.data;
        realtimeStore.updatePresence(userId, presence);
        break;
    }
  }

  private handleCollaborationEvent(event: RealtimeEvent): void {
    const realtimeStore = useRealtimeStore.getState();
    
    switch (event.type) {
      case 'user_typing':
        // Handle typing indicators
        break;
      
      case 'user_stopped_typing':
        // Handle stop typing
        break;
      
      case 'document_edit':
        // Handle collaborative editing
        break;
      
      case 'collaboration:started':
        const { sessionId, entityType, entityId, participants } = event.data;
        realtimeStore.startCollaboration({
          id: sessionId,
          entityType,
          entityId,
          participants,
          startedAt: new Date(),
          lastActivity: new Date(),
        });
        break;
      
      case 'collaboration:ended':
        realtimeStore.endCollaboration(event.data.sessionId);
        break;
    }
  }

  private handleNotificationEvent(event: RealtimeEvent): void {
    switch (event.type) {
      case 'notification_received':
        const { title, message, type = 'info' } = event.data;
        
        switch (type) {
          case 'success':
            toast.success(title, { description: message });
            break;
          case 'error':
            toast.error(title, { description: message });
            break;
          case 'warning':
            toast.warning(title, { description: message });
            break;
          default:
            toast.info(title, { description: message });
        }
        break;
    }
  }

  // Public API methods
  public async connect(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      await this.wsClient.connect();
      this.isInitialized = true;
    } catch (error) {
      console.error('[RealtimeIntegration] Failed to connect:', error);
      throw error;
    }
  }

  public disconnect(): void {
    this.wsClient.disconnect();
    this.isInitialized = false;
    this.currentRooms.clear();
  }

  public reconnect(): void {
    this.disconnect();
    setTimeout(() => {
      this.connect().catch(error => {
        console.error('[RealtimeIntegration] Reconnection failed:', error);
      });
    }, 1000);
  }

  public joinRoom(roomId: string): boolean {
    this.currentRooms.add(roomId);
    return this.wsClient.joinRoom(roomId);
  }

  public leaveRoom(roomId: string): boolean {
    this.currentRooms.delete(roomId);
    return this.wsClient.leaveRoom(roomId);
  }

  public joinProject(projectId: string): boolean {
    return this.joinRoom(`project:${projectId}`);
  }

  public leaveProject(projectId: string): boolean {
    return this.leaveRoom(`project:${projectId}`);
  }

  public joinTask(taskId: string): boolean {
    return this.joinRoom(`task:${taskId}`);
  }

  public leaveTask(taskId: string): boolean {
    return this.leaveRoom(`task:${taskId}`);
  }

  public updatePresence(presence: any): boolean {
    return this.wsClient.updatePresence(presence);
  }

  public sendTaskUpdate(taskId: string, updates: any): boolean {
    const realtimeStore = useRealtimeStore.getState();
    realtimeStore.incrementPendingChanges();
    
    const success = this.wsClient.send('task:update', { taskId, updates });
    
    if (success) {
      // Set timeout to decrement pending changes if no confirmation
      setTimeout(() => {
        realtimeStore.decrementPendingChanges();
      }, 5000);
    } else {
      realtimeStore.decrementPendingChanges();
    }
    
    return success;
  }

  public sendProjectUpdate(projectId: string, updates: any): boolean {
    const realtimeStore = useRealtimeStore.getState();
    realtimeStore.incrementPendingChanges();
    
    const success = this.wsClient.send('project:update', { projectId, updates });
    
    if (success) {
      setTimeout(() => {
        realtimeStore.decrementPendingChanges();
      }, 5000);
    } else {
      realtimeStore.decrementPendingChanges();
    }
    
    return success;
  }

  public startTyping(channel: string): boolean {
    return this.wsClient.send('typing_start', { channel });
  }

  public stopTyping(channel: string): boolean {
    return this.wsClient.send('typing_stop', { channel });
  }

  public addEventListener(eventType: string, handler: (event: RealtimeEvent) => void): void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, []);
    }
    this.eventHandlers.get(eventType)!.push(handler);
  }

  public removeEventListener(eventType: string, handler: (event: RealtimeEvent) => void): void {
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  public getConnectionStats() {
    return this.wsClient.getStats();
  }

  public isConnected(): boolean {
    return this.wsClient.isConnected();
  }

  public getQueuedMessageCount(): number {
    return this.wsClient.getQueuedMessageCount();
  }
}

// Singleton instance
let globalRealtimeIntegration: RealtimeIntegration | null = null;

export function createRealtimeIntegration(options: RealtimeIntegrationOptions): RealtimeIntegration {
  if (globalRealtimeIntegration) {
    globalRealtimeIntegration.disconnect();
  }
  
  globalRealtimeIntegration = new RealtimeIntegration(options);
  return globalRealtimeIntegration;
}

export function getRealtimeIntegration(): RealtimeIntegration | null {
  return globalRealtimeIntegration;
}