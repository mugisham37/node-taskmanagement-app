import type { Server as SocketIOServer } from "socket.io";
import { BaseService, ServiceContext, ValidationError } from './base.service';
import { userRepository } from '../db/repositories';
import logger from "../utils/logger";
import jwt from 'jsonwebtoken';

// JWT verification function (since auth.service doesn't exist yet)
const verifyToken = async (token: string): Promise<{ userId: string }> => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as any;
    return { userId: decoded.userId };
  } catch (error) {
    throw new Error('Invalid token');
  }
};

export interface WebSocketMetrics {
  activeConnections: number;
  totalConnections: number;
  roomConnections: Record<string, number>;
  messagesSent: number;
  messagesReceived: number;
  errors: number;
}

export interface NotificationData {
  type: string;
  title: string;
  message: string;
  data?: Record<string, any>;
  timestamp: Date;
}

export interface TaskUpdateData {
  taskId: string;
  projectId?: string;
  status?: string;
  assigneeId?: string;
  title?: string;
  updatedBy: string;
  timestamp: Date;
}

export interface ProjectUpdateData {
  projectId: string;
  workspaceId?: string;
  name?: string;
  status?: string;
  updatedBy: string;
  timestamp: Date;
}

export interface WorkspaceUpdateData {
  workspaceId: string;
  teamId?: string;
  name?: string;
  updatedBy: string;
  timestamp: Date;
}

export class WebSocketService extends BaseService {
  private io: SocketIOServer | null = null;
  private metrics: WebSocketMetrics = {
    activeConnections: 0,
    totalConnections: 0,
    roomConnections: {},
    messagesSent: 0,
    messagesReceived: 0,
    errors: 0
  };

  constructor() {
    super('WebSocketService', {
      enableCache: false,
      enableAudit: true,
      enableMetrics: true
    });
  }

  /**
   * Initialize WebSocket server with authentication and event handlers
   */
  setupWebSocketServer(socketIo: SocketIOServer): void {
    this.io = socketIo;

    // Authentication middleware
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token || 
                     socket.handshake.headers.authorization?.split(" ")[1];

        if (!token) {
          this.metrics.errors++;
          return next(new Error("Authentication error: Token missing"));
        }

        const decoded = await verifyToken(token);
        
        // Verify user still exists and is active
        const user = await userRepository.findById(decoded.userId);
        if (!user) {
          this.metrics.errors++;
          return next(new Error("Authentication error: User not found"));
        }

        socket.data.user = {
          id: user.id,
          email: user.email,
          role: user.role,
          firstName: user.firstName,
          lastName: user.lastName
        };

        next();
      } catch (error) {
        this.metrics.errors++;
        logger.error('WebSocket authentication error:', error);
        next(new Error("Authentication error: Invalid token"));
      }
    });

    // Connection handler
    this.io.on("connection", (socket) => {
      this.handleConnection(socket);
    });

    logger.info("WebSocket server initialized successfully");
  }

  /**
   * Handle new socket connection
   */
  private handleConnection(socket: any): void {
    const userId = socket.data.user?.id;
    const userInfo = socket.data.user;

    // Update metrics
    this.metrics.activeConnections++;
    this.metrics.totalConnections++;

    logger.info(`User connected to WebSocket: ${userId} (${userInfo?.email})`);

    // Join user-specific room
    if (userId) {
      socket.join(`user:${userId}`);
      this.updateRoomMetrics(`user:${userId}`, 1);
    }

    // Set up event handlers
    this.setupSocketEventHandlers(socket);

    // Handle disconnect
    socket.on("disconnect", (reason: string) => {
      this.handleDisconnection(socket, reason);
    });

    // Record connection metric
    this.recordMetric('websocket.connection.established', 1, {
      userId: userId || 'anonymous',
      userRole: userInfo?.role || 'unknown'
    });
  }

  /**
   * Set up all socket event handlers
   */
  private setupSocketEventHandlers(socket: any): void {
    const userId = socket.data.user?.id;

    // Task update events
    socket.on("task:update", (data: any) => {
      this.handleTaskUpdate(socket, data);
    });

    // Project room management
    socket.on("project:join", (projectId: string) => {
      this.handleProjectJoin(socket, projectId);
    });

    socket.on("project:leave", (projectId: string) => {
      this.handleProjectLeave(socket, projectId);
    });

    // Workspace room management
    socket.on("workspace:join", (workspaceId: string) => {
      this.handleWorkspaceJoin(socket, workspaceId);
    });

    socket.on("workspace:leave", (workspaceId: string) => {
      this.handleWorkspaceLeave(socket, workspaceId);
    });

    // Team room management
    socket.on("team:join", (teamId: string) => {
      this.handleTeamJoin(socket, teamId);
    });

    socket.on("team:leave", (teamId: string) => {
      this.handleTeamLeave(socket, teamId);
    });

    // Typing indicators
    socket.on("typing:start", (data: any) => {
      this.handleTypingStart(socket, data);
    });

    socket.on("typing:stop", (data: any) => {
      this.handleTypingStop(socket, data);
    });

    // Presence updates
    socket.on("presence:update", (status: string) => {
      this.handlePresenceUpdate(socket, status);
    });

    // Error handling
    socket.on("error", (error: any) => {
      this.metrics.errors++;
      logger.error(`Socket error for user ${userId}:`, error);
    });
  }

  /**
   * Handle task update events
   */
  private handleTaskUpdate(socket: any, data: any): void {
    const userId = socket.data.user?.id;
    
    try {
      this.validateTaskUpdateData(data);
      
      logger.debug(`Task update from ${userId}:`, {
        taskId: data.taskId,
        projectId: data.projectId,
        action: data.action
      });

      // Broadcast to project room if projectId is provided
      if (data.projectId) {
        socket.to(`project:${data.projectId}`).emit("task:updated", {
          ...data,
          updatedBy: userId,
          timestamp: new Date()
        });
      }

      // Broadcast to workspace room if workspaceId is provided
      if (data.workspaceId) {
        socket.to(`workspace:${data.workspaceId}`).emit("task:updated", {
          ...data,
          updatedBy: userId,
          timestamp: new Date()
        });
      }

      this.metrics.messagesReceived++;
      this.recordMetric('websocket.task.update', 1, {
        hasProjectId: data.projectId ? 'true' : 'false',
        hasWorkspaceId: data.workspaceId ? 'true' : 'false'
      });

    } catch (error) {
      this.metrics.errors++;
      logger.error('Error handling task update:', error);
      socket.emit("error", { message: "Invalid task update data" });
    }
  }

  /**
   * Handle project room join
   */
  private async handleProjectJoin(socket: any, projectId: string): Promise<void> {
    const userId = socket.data.user?.id;
    
    try {
      // Validate project access (you might want to add actual validation)
      if (!projectId || typeof projectId !== 'string') {
        throw new ValidationError('Invalid project ID');
      }

      socket.join(`project:${projectId}`);
      this.updateRoomMetrics(`project:${projectId}`, 1);
      
      logger.debug(`User ${userId} joined project room: ${projectId}`);
      
      // Notify other project members
      socket.to(`project:${projectId}`).emit("user:joined", {
        userId,
        userName: `${socket.data.user.firstName} ${socket.data.user.lastName}`,
        projectId,
        timestamp: new Date()
      });

      this.recordMetric('websocket.project.joined', 1);

    } catch (error) {
      this.metrics.errors++;
      logger.error('Error joining project room:', error);
      socket.emit("error", { message: "Failed to join project room" });
    }
  }

  /**
   * Handle project room leave
   */
  private handleProjectLeave(socket: any, projectId: string): void {
    const userId = socket.data.user?.id;
    
    try {
      socket.leave(`project:${projectId}`);
      this.updateRoomMetrics(`project:${projectId}`, -1);
      
      logger.debug(`User ${userId} left project room: ${projectId}`);
      
      // Notify other project members
      socket.to(`project:${projectId}`).emit("user:left", {
        userId,
        userName: `${socket.data.user.firstName} ${socket.data.user.lastName}`,
        projectId,
        timestamp: new Date()
      });

      this.recordMetric('websocket.project.left', 1);

    } catch (error) {
      this.metrics.errors++;
      logger.error('Error leaving project room:', error);
    }
  }

  /**
   * Handle workspace room join
   */
  private handleWorkspaceJoin(socket: any, workspaceId: string): void {
    const userId = socket.data.user?.id;
    
    try {
      if (!workspaceId || typeof workspaceId !== 'string') {
        throw new ValidationError('Invalid workspace ID');
      }

      socket.join(`workspace:${workspaceId}`);
      this.updateRoomMetrics(`workspace:${workspaceId}`, 1);
      
      logger.debug(`User ${userId} joined workspace room: ${workspaceId}`);
      
      this.recordMetric('websocket.workspace.joined', 1);

    } catch (error) {
      this.metrics.errors++;
      logger.error('Error joining workspace room:', error);
      socket.emit("error", { message: "Failed to join workspace room" });
    }
  }

  /**
   * Handle workspace room leave
   */
  private handleWorkspaceLeave(socket: any, workspaceId: string): void {
    const userId = socket.data.user?.id;
    
    try {
      socket.leave(`workspace:${workspaceId}`);
      this.updateRoomMetrics(`workspace:${workspaceId}`, -1);
      
      logger.debug(`User ${userId} left workspace room: ${workspaceId}`);
      
      this.recordMetric('websocket.workspace.left', 1);

    } catch (error) {
      this.metrics.errors++;
      logger.error('Error leaving workspace room:', error);
    }
  }

  /**
   * Handle team room join
   */
  private handleTeamJoin(socket: any, teamId: string): void {
    const userId = socket.data.user?.id;
    
    try {
      if (!teamId || typeof teamId !== 'string') {
        throw new ValidationError('Invalid team ID');
      }

      socket.join(`team:${teamId}`);
      this.updateRoomMetrics(`team:${teamId}`, 1);
      
      logger.debug(`User ${userId} joined team room: ${teamId}`);
      
      this.recordMetric('websocket.team.joined', 1);

    } catch (error) {
      this.metrics.errors++;
      logger.error('Error joining team room:', error);
      socket.emit("error", { message: "Failed to join team room" });
    }
  }

  /**
   * Handle team room leave
   */
  private handleTeamLeave(socket: any, teamId: string): void {
    const userId = socket.data.user?.id;
    
    try {
      socket.leave(`team:${teamId}`);
      this.updateRoomMetrics(`team:${teamId}`, -1);
      
      logger.debug(`User ${userId} left team room: ${teamId}`);
      
      this.recordMetric('websocket.team.left', 1);

    } catch (error) {
      this.metrics.errors++;
      logger.error('Error leaving team room:', error);
    }
  }

  /**
   * Handle typing start
   */
  private handleTypingStart(socket: any, data: any): void {
    const userId = socket.data.user?.id;
    
    try {
      if (data.projectId) {
        socket.to(`project:${data.projectId}`).emit("typing:start", {
          userId,
          userName: `${socket.data.user.firstName} ${socket.data.user.lastName}`,
          context: data.context,
          timestamp: new Date()
        });
      }
    } catch (error) {
      this.metrics.errors++;
      logger.error('Error handling typing start:', error);
    }
  }

  /**
   * Handle typing stop
   */
  private handleTypingStop(socket: any, data: any): void {
    const userId = socket.data.user?.id;
    
    try {
      if (data.projectId) {
        socket.to(`project:${data.projectId}`).emit("typing:stop", {
          userId,
          context: data.context,
          timestamp: new Date()
        });
      }
    } catch (error) {
      this.metrics.errors++;
      logger.error('Error handling typing stop:', error);
    }
  }

  /**
   * Handle presence update
   */
  private handlePresenceUpdate(socket: any, status: string): void {
    const userId = socket.data.user?.id;
    
    try {
      // Broadcast presence to all rooms the user is in
      socket.broadcast.emit("presence:update", {
        userId,
        status,
        timestamp: new Date()
      });
      
      this.recordMetric('websocket.presence.updated', 1, { status });

    } catch (error) {
      this.metrics.errors++;
      logger.error('Error handling presence update:', error);
    }
  }

  /**
   * Handle socket disconnection
   */
  private handleDisconnection(socket: any, reason: string): void {
    const userId = socket.data.user?.id;
    const userInfo = socket.data.user;

    // Update metrics
    this.metrics.activeConnections = Math.max(0, this.metrics.activeConnections - 1);

    // Update room metrics for all rooms the user was in
    const rooms = Array.from(socket.rooms) as string[];
    rooms.forEach((room) => {
      if (room !== socket.id) {
        this.updateRoomMetrics(room, -1);
      }
    });

    logger.info(`User disconnected from WebSocket: ${userId} (${userInfo?.email}) - Reason: ${reason}`);

    this.recordMetric('websocket.connection.disconnected', 1, {
      userId: userId || 'anonymous',
      reason
    });
  }

  /**
   * Send notification to a specific user
   */
  sendUserNotification(userId: string, notification: NotificationData): void {
    if (!this.io) {
      logger.warn("WebSocket server not initialized");
      return;
    }

    try {
      this.io.to(`user:${userId}`).emit("notification", {
        ...notification,
        id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date()
      });

      this.metrics.messagesSent++;
      this.recordMetric('websocket.notification.sent', 1, {
        type: notification.type,
        userId
      });

    } catch (error) {
      this.metrics.errors++;
      logger.error('Error sending user notification:', error);
    }
  }

  /**
   * Send task update to all users in a project
   */
  sendTaskUpdate(projectId: string, taskData: TaskUpdateData): void {
    if (!this.io) {
      logger.warn("WebSocket server not initialized");
      return;
    }

    try {
      this.io.to(`project:${projectId}`).emit("task:updated", {
        ...taskData,
        timestamp: new Date()
      });

      this.metrics.messagesSent++;
      this.recordMetric('websocket.task.broadcast', 1, {
        projectId,
        taskId: taskData.taskId
      });

    } catch (error) {
      this.metrics.errors++;
      logger.error('Error sending task update:', error);
    }
  }

  /**
   * Send project update to all users in a project
   */
  sendProjectUpdate(projectId: string, projectData: ProjectUpdateData): void {
    if (!this.io) {
      logger.warn("WebSocket server not initialized");
      return;
    }

    try {
      this.io.to(`project:${projectId}`).emit("project:updated", {
        ...projectData,
        timestamp: new Date()
      });

      this.metrics.messagesSent++;
      this.recordMetric('websocket.project.broadcast', 1, {
        projectId
      });

    } catch (error) {
      this.metrics.errors++;
      logger.error('Error sending project update:', error);
    }
  }

  /**
   * Send workspace update to all users in a workspace
   */
  sendWorkspaceUpdate(workspaceId: string, workspaceData: WorkspaceUpdateData): void {
    if (!this.io) {
      logger.warn("WebSocket server not initialized");
      return;
    }

    try {
      this.io.to(`workspace:${workspaceId}`).emit("workspace:updated", {
        ...workspaceData,
        timestamp: new Date()
      });

      this.metrics.messagesSent++;
      this.recordMetric('websocket.workspace.broadcast', 1, {
        workspaceId
      });

    } catch (error) {
      this.metrics.errors++;
      logger.error('Error sending workspace update:', error);
    }
  }

  /**
   * Send message to all connected clients
   */
  broadcastToAll(event: string, data: any): void {
    if (!this.io) {
      logger.warn("WebSocket server not initialized");
      return;
    }

    try {
      this.io.emit(event, {
        ...data,
        timestamp: new Date()
      });

      this.metrics.messagesSent++;
      this.recordMetric('websocket.broadcast.all', 1, {
        event
      });

    } catch (error) {
      this.metrics.errors++;
      logger.error('Error broadcasting to all:', error);
    }
  }

  /**
   * Get active connections count
   */
  getActiveConnectionsCount(): number {
    if (!this.io) {
      return 0;
    }

    return this.io.engine.clientsCount;
  }

  /**
   * Get active connections by room
   */
  async getConnectionsByRoom(room: string): Promise<string[]> {
    if (!this.io) {
      return [];
    }

    try {
      const sockets = await this.io.in(room).fetchSockets();
      return sockets.map((socket) => socket.id);
    } catch (error) {
      logger.error('Error getting connections by room:', error);
      return [];
    }
  }

  /**
   * Get WebSocket metrics
   */
  getMetrics(): WebSocketMetrics {
    return {
      ...this.metrics,
      activeConnections: this.getActiveConnectionsCount()
    };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      activeConnections: this.getActiveConnectionsCount(),
      totalConnections: 0,
      roomConnections: {},
      messagesSent: 0,
      messagesReceived: 0,
      errors: 0
    };
  }

  /**
   * Validate task update data
   */
  private validateTaskUpdateData(data: any): void {
    if (!data || typeof data !== 'object') {
      throw new ValidationError('Task update data is required');
    }

    if (!data.taskId || typeof data.taskId !== 'string') {
      throw new ValidationError('Valid task ID is required');
    }

    if (data.projectId && typeof data.projectId !== 'string') {
      throw new ValidationError('Project ID must be a string');
    }

    if (data.workspaceId && typeof data.workspaceId !== 'string') {
      throw new ValidationError('Workspace ID must be a string');
    }
  }

  /**
   * Update room connection metrics
   */
  private updateRoomMetrics(room: string, delta: number): void {
    if (!this.metrics.roomConnections[room]) {
      this.metrics.roomConnections[room] = 0;
    }
    
    this.metrics.roomConnections[room] = Math.max(0, this.metrics.roomConnections[room] + delta);
    
    // Clean up empty rooms
    if (this.metrics.roomConnections[room] === 0) {
      delete this.metrics.roomConnections[room];
    }
  }
}

// Export singleton instance
export const webSocketService = new WebSocketService();

// Export the setup function for easy access
export const setupWebSocketServer = (socketIo: SocketIOServer): void => {
  webSocketService.setupWebSocketServer(socketIo);
};

// Export utility functions
export const sendUserNotification = (userId: string, notification: NotificationData): void => {
  webSocketService.sendUserNotification(userId, notification);
};

export const sendTaskUpdate = (projectId: string, taskData: TaskUpdateData): void => {
  webSocketService.sendTaskUpdate(projectId, taskData);
};

export const sendProjectUpdate = (projectId: string, projectData: ProjectUpdateData): void => {
  webSocketService.sendProjectUpdate(projectId, projectData);
};

export const sendWorkspaceUpdate = (workspaceId: string, workspaceData: WorkspaceUpdateData): void => {
  webSocketService.sendWorkspaceUpdate(workspaceId, workspaceData);
};

export const broadcastToAll = (event: string, data: any): void => {
  webSocketService.broadcastToAll(event, data);
};

export const getActiveConnectionsCount = (): number => {
  return webSocketService.getActiveConnectionsCount();
};

export const getConnectionsByRoom = async (room: string): Promise<string[]> => {
  return webSocketService.getConnectionsByRoom(room);
};
