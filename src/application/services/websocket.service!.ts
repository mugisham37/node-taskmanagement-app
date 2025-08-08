import type { Server as SocketIOServer } from 'socket.io';
import { BaseService, ServiceContext, ValidationError } from './base.service';
import { userRepository } from '../db/repositories';
import {
  presenceService,
  PresenceInfo,
  ActivityIndicator,
  TypingIndicator,
} from './presence.service';
import logger from '../../shared/utils/logger';
import jwt from 'jsonwebtoken';

// JWT verification function (since auth.service doesn't exist yet)
const verifyToken = async (token: string): Promise<{ userId: string }> => {
  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'your-secret-key'
    ) as any;
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
    errors: 0,
  };

  constructor() {
    super('WebSocketService', {
      enableCache: false,
      enableAudit: true,
      enableMetrics: true,
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
        const token =
          socket.handshake.auth.token ||
          socket.handshake.headers.authorization?.split(' ')[1];

        if (!token) {
          this.metrics.errors++;
          return next(new Error('Authentication error: Token missing'));
        }

        const decoded = await verifyToken(token);

        // Verify user still exists and is active
        const user = await userRepository.findById(decoded.userId);
        if (!user) {
          this.metrics.errors++;
          return next(new Error('Authentication error: User not found'));
        }

        socket.data.user = {
          id: user.id,
          email: user.email,
          role: user.role,
          firstName: user.firstName,
          lastName: user.lastName,
        };

        next();
      } catch (error) {
        this.metrics.errors++;
        logger.error('WebSocket authentication error:', error);
        next(new Error('Authentication error: Invalid token'));
      }
    });

    // Connection handler
    this.io.on('connection', socket => {
      this.handleConnection(socket).catch(error => {
        logger.error('Error handling WebSocket connection:', error);
      });
    });

    logger.info('WebSocket server initialized successfully');
  }

  /**
   * Handle new socket connection
   */
  private async handleConnection(socket: any): Promise<void> {
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

      // Update user presence to online
      const deviceInfo = this.extractDeviceInfo(socket.handshake);
      await presenceService.updatePresence(
        userId,
        'online',
        undefined,
        deviceInfo
      );

      // Broadcast presence update to all rooms the user will join
      socket.broadcast.emit('presence:update', {
        userId,
        status: 'online',
        userName: `${userInfo.firstName} ${userInfo.lastName}`,
        userAvatar: userInfo.profilePicture,
        timestamp: new Date(),
      });
    }

    // Set up event handlers
    this.setupSocketEventHandlers(socket);

    // Handle disconnect
    socket.on('disconnect', (reason: string) => {
      this.handleDisconnection(socket, reason).catch(error => {
        logger.error('Error handling WebSocket disconnection:', error);
      });
    });

    // Record connection metric
    this.recordMetric('websocket.connection.established', 1, {
      userId: userId || 'anonymous',
      userRole: userInfo?.role || 'unknown',
    });
  }

  /**
   * Set up all socket event handlers
   */
  private setupSocketEventHandlers(socket: any): void {
    const userId = socket.data.user?.id;

    // Task update events
    socket.on('task:update', (data: any) => {
      this.handleTaskUpdate(socket, data);
    });

    // Project room management
    socket.on('project:join', (projectId: string) => {
      this.handleProjectJoin(socket, projectId);
    });

    socket.on('project:leave', (projectId: string) => {
      this.handleProjectLeave(socket, projectId);
    });

    // Workspace room management
    socket.on('workspace:join', (workspaceId: string) => {
      this.handleWorkspaceJoin(socket, workspaceId);
    });

    socket.on('workspace:leave', (workspaceId: string) => {
      this.handleWorkspaceLeave(socket, workspaceId);
    });

    // Team room management
    socket.on('team:join', (teamId: string) => {
      this.handleTeamJoin(socket, teamId);
    });

    socket.on('team:leave', (teamId: string) => {
      this.handleTeamLeave(socket, teamId);
    });

    // Typing indicators
    socket.on('typing:start', (data: any) => {
      this.handleTypingStart(socket, data);
    });

    socket.on('typing:stop', (data: any) => {
      this.handleTypingStop(socket, data);
    });

    // Enhanced presence and activity tracking
    socket.on(
      'presence:update',
      (data: { status: string; workspaceId?: string }) => {
        this.handlePresenceUpdate(socket, data);
      }
    );

    socket.on('activity:start', (data: any) => {
      this.handleActivityStart(socket, data);
    });

    socket.on('activity:stop', (data: any) => {
      this.handleActivityStop(socket, data);
    });

    socket.on('activity:heartbeat', (data: any) => {
      this.handleActivityHeartbeat(socket, data);
    });

    // Enhanced typing indicators
    socket.on(
      'typing:start',
      (data: { resourceType: 'task' | 'comment'; resourceId: string }) => {
        this.handleTypingStart(socket, data);
      }
    );

    socket.on('typing:stop', (data: { resourceId: string }) => {
      this.handleTypingStop(socket, data);
    });

    // Presence queries
    socket.on(
      'presence:get',
      (data: { userIds?: string[]; workspaceId?: string }) => {
        this.handlePresenceQuery(socket, data);
      }
    );

    socket.on('activity:get', (data: { resourceId: string }) => {
      this.handleActivityQuery(socket, data);
    });

    socket.on(
      'feed:get',
      (data: { workspaceId: string; limit?: number; offset?: number }) => {
        this.handleActivityFeedQuery(socket, data);
      }
    );

    // Error handling
    socket.on('error', (error: any) => {
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
        action: data.action,
      });

      // Broadcast to project room if projectId is provided
      if (data.projectId) {
        socket.to(`project:${data.projectId}`).emit('task:updated', {
          ...data,
          updatedBy: userId,
          timestamp: new Date(),
        });
      }

      // Broadcast to workspace room if workspaceId is provided
      if (data.workspaceId) {
        socket.to(`workspace:${data.workspaceId}`).emit('task:updated', {
          ...data,
          updatedBy: userId,
          timestamp: new Date(),
        });
      }

      this.metrics.messagesReceived++;
      this.recordMetric('websocket.task.update', 1, {
        hasProjectId: data.projectId ? 'true' : 'false',
        hasWorkspaceId: data.workspaceId ? 'true' : 'false',
      });
    } catch (error) {
      this.metrics.errors++;
      logger.error('Error handling task update:', error);
      socket.emit('error', { message: 'Invalid task update data' });
    }
  }

  /**
   * Handle project room join
   */
  private async handleProjectJoin(
    socket: any,
    projectId: string
  ): Promise<void> {
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
      socket.to(`project:${projectId}`).emit('user:joined', {
        userId,
        userName: `${socket.data.user.firstName} ${socket.data.user.lastName}`,
        projectId,
        timestamp: new Date(),
      });

      this.recordMetric('websocket.project.joined', 1);
    } catch (error) {
      this.metrics.errors++;
      logger.error('Error joining project room:', error);
      socket.emit('error', { message: 'Failed to join project room' });
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
      socket.to(`project:${projectId}`).emit('user:left', {
        userId,
        userName: `${socket.data.user.firstName} ${socket.data.user.lastName}`,
        projectId,
        timestamp: new Date(),
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
      socket.emit('error', { message: 'Failed to join workspace room' });
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
      socket.emit('error', { message: 'Failed to join team room' });
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
  private async handleTypingStart(
    socket: any,
    data: { resourceType: 'task' | 'comment'; resourceId: string }
  ): Promise<void> {
    const userId = socket.data.user?.id;
    const userInfo = socket.data.user;

    try {
      if (!userId || !data.resourceId || !data.resourceType) {
        throw new ValidationError('Invalid typing start data');
      }

      // Update typing indicator in presence service
      await presenceService.startTyping(
        userId,
        data.resourceType,
        data.resourceId
      );

      // Broadcast typing indicator to relevant rooms
      const typingData = {
        userId,
        userName: `${userInfo.firstName} ${userInfo.lastName}`,
        userAvatar: userInfo.profilePicture,
        resourceType: data.resourceType,
        resourceId: data.resourceId,
        timestamp: new Date(),
      };

      // Broadcast to all rooms that might be interested
      socket.broadcast.emit('typing:start', typingData);

      this.recordMetric('websocket.typing.started', 1, {
        userId,
        resourceType: data.resourceType,
      });
    } catch (error) {
      this.metrics.errors++;
      logger.error('Error handling typing start:', error);
    }
  }

  /**
   * Handle typing stop
   */
  private async handleTypingStop(
    socket: any,
    data: { resourceId: string }
  ): Promise<void> {
    const userId = socket.data.user?.id;

    try {
      if (!userId || !data.resourceId) {
        throw new ValidationError('Invalid typing stop data');
      }

      // Remove typing indicator from presence service
      await presenceService.stopTyping(userId, data.resourceId);

      // Broadcast typing stop to relevant rooms
      socket.broadcast.emit('typing:stop', {
        userId,
        resourceId: data.resourceId,
        timestamp: new Date(),
      });

      this.recordMetric('websocket.typing.stopped', 1, { userId });
    } catch (error) {
      this.metrics.errors++;
      logger.error('Error handling typing stop:', error);
    }
  }

  /**
   * Handle presence update
   */
  private async handlePresenceUpdate(
    socket: any,
    data: { status: string; workspaceId?: string }
  ): Promise<void> {
    const userId = socket.data.user?.id;
    const userInfo = socket.data.user;

    try {
      if (!userId || !data.status) {
        throw new ValidationError('Invalid presence update data');
      }

      // Update presence in service
      const deviceInfo = this.extractDeviceInfo(socket.handshake);
      await presenceService.updatePresence(
        userId,
        data.status as any,
        data.workspaceId,
        deviceInfo
      );

      // Broadcast presence to all rooms the user is in
      socket.broadcast.emit('presence:update', {
        userId,
        status: data.status,
        userName: `${userInfo.firstName} ${userInfo.lastName}`,
        userAvatar: userInfo.profilePicture,
        workspaceId: data.workspaceId,
        timestamp: new Date(),
      });

      this.recordMetric('websocket.presence.updated', 1, {
        status: data.status,
        workspaceId: data.workspaceId || 'none',
      });
    } catch (error) {
      this.metrics.errors++;
      logger.error('Error handling presence update:', error);
    }
  }

  /**
   * Handle activity start
   */
  private async handleActivityStart(
    socket: any,
    data: {
      type: 'viewing' | 'editing' | 'commenting';
      resourceType: 'task' | 'project' | 'workspace';
      resourceId: string;
      resourceTitle?: string;
    }
  ): Promise<void> {
    const userId = socket.data.user?.id;
    const userInfo = socket.data.user;

    try {
      if (!userId || !data.type || !data.resourceType || !data.resourceId) {
        throw new ValidationError('Invalid activity start data');
      }

      // Update activity in presence service
      await presenceService.updateActivity(userId, {
        type: data.type,
        resourceType: data.resourceType,
        resourceId: data.resourceId,
        resourceTitle: data.resourceTitle,
      });

      // Broadcast activity start to relevant rooms
      socket.broadcast.emit('activity:start', {
        userId,
        userName: `${userInfo.firstName} ${userInfo.lastName}`,
        userAvatar: userInfo.profilePicture,
        activity: {
          type: data.type,
          resourceType: data.resourceType,
          resourceId: data.resourceId,
          resourceTitle: data.resourceTitle,
        },
        timestamp: new Date(),
      });

      this.recordMetric('websocket.activity.started', 1, {
        userId,
        activityType: data.type,
        resourceType: data.resourceType,
      });
    } catch (error) {
      this.metrics.errors++;
      logger.error('Error handling activity start:', error);
    }
  }

  /**
   * Handle activity stop
   */
  private async handleActivityStop(
    socket: any,
    data: { resourceId?: string }
  ): Promise<void> {
    const userId = socket.data.user?.id;

    try {
      if (!userId) {
        throw new ValidationError('Invalid activity stop data');
      }

      // Clear activity in presence service
      await presenceService.clearActivity(userId, data.resourceId);

      // Broadcast activity stop to relevant rooms
      socket.broadcast.emit('activity:stop', {
        userId,
        resourceId: data.resourceId,
        timestamp: new Date(),
      });

      this.recordMetric('websocket.activity.stopped', 1, { userId });
    } catch (error) {
      this.metrics.errors++;
      logger.error('Error handling activity stop:', error);
    }
  }

  /**
   * Handle activity heartbeat (keep activity alive)
   */
  private async handleActivityHeartbeat(
    socket: any,
    data: { resourceId: string }
  ): Promise<void> {
    const userId = socket.data.user?.id;

    try {
      if (!userId || !data.resourceId) {
        return;
      }

      // Update activity timestamp in presence service
      const presence = presenceService.getPresence(userId);
      if (presence?.currentActivity?.resourceId === data.resourceId) {
        await presenceService.updateActivity(userId, presence.currentActivity);
      }

      this.recordMetric('websocket.activity.heartbeat', 1, { userId });
    } catch (error) {
      this.metrics.errors++;
      logger.error('Error handling activity heartbeat:', error);
    }
  }

  /**
   * Handle presence query
   */
  private async handlePresenceQuery(
    socket: any,
    data: { userIds?: string[]; workspaceId?: string }
  ): Promise<void> {
    const userId = socket.data.user?.id;

    try {
      let presenceData: any;

      if (data.userIds) {
        // Get presence for specific users
        const presenceMap = presenceService.getMultiplePresence(data.userIds);
        presenceData = Object.fromEntries(presenceMap);
      } else if (data.workspaceId) {
        // Get all online users in workspace
        const onlineUsers = presenceService.getOnlineUsersInWorkspace(
          data.workspaceId
        );
        presenceData = onlineUsers.reduce(
          (acc, presence) => {
            acc[presence.userId] = presence;
            return acc;
          },
          {} as Record<string, PresenceInfo>
        );
      } else {
        throw new ValidationError(
          'Either userIds or workspaceId must be provided'
        );
      }

      socket.emit('presence:data', {
        requestId: `req_${Date.now()}`,
        data: presenceData,
        timestamp: new Date(),
      });

      this.recordMetric('websocket.presence.queried', 1, { userId });
    } catch (error) {
      this.metrics.errors++;
      logger.error('Error handling presence query:', error);
      socket.emit('error', { message: 'Failed to get presence data' });
    }
  }

  /**
   * Handle activity query
   */
  private async handleActivityQuery(
    socket: any,
    data: { resourceId: string }
  ): Promise<void> {
    const userId = socket.data.user?.id;

    try {
      if (!data.resourceId) {
        throw new ValidationError('Resource ID is required');
      }

      const activityIndicators = presenceService.getActivityIndicators(
        data.resourceId
      );
      const typingIndicators = presenceService.getTypingIndicators(
        data.resourceId
      );

      socket.emit('activity:data', {
        requestId: `req_${Date.now()}`,
        resourceId: data.resourceId,
        activities: activityIndicators,
        typing: typingIndicators,
        timestamp: new Date(),
      });

      this.recordMetric('websocket.activity.queried', 1, { userId });
    } catch (error) {
      this.metrics.errors++;
      logger.error('Error handling activity query:', error);
      socket.emit('error', { message: 'Failed to get activity data' });
    }
  }

  /**
   * Handle activity feed query
   */
  private async handleActivityFeedQuery(
    socket: any,
    data: {
      workspaceId: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<void> {
    const userId = socket.data.user?.id;

    try {
      if (!data.workspaceId) {
        throw new ValidationError('Workspace ID is required');
      }

      const activities = presenceService.getActivityFeed(
        data.workspaceId,
        data.limit || 50,
        data.offset || 0
      );

      socket.emit('feed:data', {
        requestId: `req_${Date.now()}`,
        workspaceId: data.workspaceId,
        activities,
        timestamp: new Date(),
      });

      this.recordMetric('websocket.feed.queried', 1, { userId });
    } catch (error) {
      this.metrics.errors++;
      logger.error('Error handling activity feed query:', error);
      socket.emit('error', { message: 'Failed to get activity feed' });
    }
  }

  /**
   * Handle socket disconnection
   */
  private async handleDisconnection(
    socket: any,
    reason: string
  ): Promise<void> {
    const userId = socket.data.user?.id;
    const userInfo = socket.data.user;

    // Update metrics
    this.metrics.activeConnections = Math.max(
      0,
      this.metrics.activeConnections - 1
    );

    // Update room metrics for all rooms the user was in
    const rooms = Array.from(socket.rooms) as string[];
    rooms.forEach(room => {
      if (room !== socket.id) {
        this.updateRoomMetrics(room, -1);
      }
    });

    // Update presence to offline and clear activities
    if (userId) {
      try {
        await presenceService.updatePresence(userId, 'offline');
        await presenceService.clearActivity(userId);

        // Broadcast presence update
        socket.broadcast.emit('presence:update', {
          userId,
          status: 'offline',
          userName: `${userInfo.firstName} ${userInfo.lastName}`,
          userAvatar: userInfo.profilePicture,
          timestamp: new Date(),
        });
      } catch (error) {
        logger.error('Error updating presence on disconnect:', error);
      }
    }

    logger.info(
      `User disconnected from WebSocket: ${userId} (${userInfo?.email}) - Reason: ${reason}`
    );

    this.recordMetric('websocket.connection.disconnected', 1, {
      userId: userId || 'anonymous',
      reason,
    });
  }

  /**
   * Send notification to a specific user
   */
  sendUserNotification(userId: string, notification: NotificationData): void {
    if (!this.io) {
      logger.warn('WebSocket server not initialized');
      return;
    }

    try {
      this.io.to(`user:${userId}`).emit('notification', {
        ...notification,
        id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date(),
      });

      this.metrics.messagesSent++;
      this.recordMetric('websocket.notification.sent', 1, {
        type: notification.type,
        userId,
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
      logger.warn('WebSocket server not initialized');
      return;
    }

    try {
      this.io.to(`project:${projectId}`).emit('task:updated', {
        ...taskData,
        timestamp: new Date(),
      });

      this.metrics.messagesSent++;
      this.recordMetric('websocket.task.broadcast', 1, {
        projectId,
        taskId: taskData.taskId,
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
      logger.warn('WebSocket server not initialized');
      return;
    }

    try {
      this.io.to(`project:${projectId}`).emit('project:updated', {
        ...projectData,
        timestamp: new Date(),
      });

      this.metrics.messagesSent++;
      this.recordMetric('websocket.project.broadcast', 1, {
        projectId,
      });
    } catch (error) {
      this.metrics.errors++;
      logger.error('Error sending project update:', error);
    }
  }

  /**
   * Send workspace update to all users in a workspace
   */
  sendWorkspaceUpdate(
    workspaceId: string,
    workspaceData: WorkspaceUpdateData
  ): void {
    if (!this.io) {
      logger.warn('WebSocket server not initialized');
      return;
    }

    try {
      this.io.to(`workspace:${workspaceId}`).emit('workspace:updated', {
        ...workspaceData,
        timestamp: new Date(),
      });

      this.metrics.messagesSent++;
      this.recordMetric('websocket.workspace.broadcast', 1, {
        workspaceId,
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
      logger.warn('WebSocket server not initialized');
      return;
    }

    try {
      this.io.emit(event, {
        ...data,
        timestamp: new Date(),
      });

      this.metrics.messagesSent++;
      this.recordMetric('websocket.broadcast.all', 1, {
        event,
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
      return sockets.map(socket => socket.id);
    } catch (error) {
      logger.error('Error getting connections by room:', error);
      return [];
    }
  }

  /**
   * Broadcast presence update to workspace
   */
  async broadcastPresenceUpdate(
    workspaceId: string,
    presenceInfo: PresenceInfo
  ): Promise<void> {
    if (!this.io) {
      logger.warn('WebSocket server not initialized');
      return;
    }

    try {
      this.io.to(`workspace:${workspaceId}`).emit('presence:update', {
        userId: presenceInfo.userId,
        status: presenceInfo.status,
        lastSeen: presenceInfo.lastSeen,
        currentActivity: presenceInfo.currentActivity,
        location: presenceInfo.location,
        customStatus: presenceInfo.customStatus,
        timestamp: new Date(),
      });

      this.metrics.messagesSent++;
      this.recordMetric('websocket.presence.broadcast', 1, {
        workspaceId,
        userId: presenceInfo.userId,
        status: presenceInfo.status,
      });
    } catch (error) {
      this.metrics.errors++;
      logger.error('Error broadcasting presence update:', error);
    }
  }

  /**
   * Broadcast activity update to relevant rooms
   */
  async broadcastActivityUpdate(
    resourceId: string,
    activityIndicator: ActivityIndicator
  ): Promise<void> {
    if (!this.io) {
      logger.warn('WebSocket server not initialized');
      return;
    }

    try {
      // Broadcast to all rooms that might be interested in this resource
      this.io.emit('activity:update', {
        resourceId,
        userId: activityIndicator.userId,
        userName: activityIndicator.userName,
        userAvatar: activityIndicator.userAvatar,
        activity: activityIndicator.activity,
        presence: activityIndicator.presence,
        timestamp: new Date(),
      });

      this.metrics.messagesSent++;
      this.recordMetric('websocket.activity.broadcast', 1, {
        resourceId,
        userId: activityIndicator.userId,
        activityType: activityIndicator.activity.type,
      });
    } catch (error) {
      this.metrics.errors++;
      logger.error('Error broadcasting activity update:', error);
    }
  }

  /**
   * Get presence statistics for WebSocket connections
   */
  getPresenceStats(): {
    activeConnections: number;
    totalConnections: number;
    roomConnections: Record<string, number>;
    messagesSent: number;
    messagesReceived: number;
    errors: number;
  } {
    return {
      activeConnections: this.getActiveConnectionsCount(),
      totalConnections: this.metrics.totalConnections,
      roomConnections: { ...this.metrics.roomConnections },
      messagesSent: this.metrics.messagesSent,
      messagesReceived: this.metrics.messagesReceived,
      errors: this.metrics.errors,
    };
  }

  /**
   * Get WebSocket metrics
   */
  getMetrics(): WebSocketMetrics {
    return {
      ...this.metrics,
      activeConnections: this.getActiveConnectionsCount(),
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
      errors: 0,
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

    this.metrics.roomConnections[room] = Math.max(
      0,
      this.metrics.roomConnections[room] + delta
    );

    // Clean up empty rooms
    if (this.metrics.roomConnections[room] === 0) {
      delete this.metrics.roomConnections[room];
    }
  }

  /**
   * Extract device information from socket handshake
   */
  private extractDeviceInfo(handshake: any): PresenceInfo['deviceInfo'] {
    const userAgent = handshake.headers['user-agent'] || '';

    let deviceType: 'desktop' | 'mobile' | 'tablet' = 'desktop';
    let browser = 'unknown';
    let os = 'unknown';

    // Simple device detection
    if (/Mobile|Android|iPhone|iPad/.test(userAgent)) {
      deviceType = /iPad/.test(userAgent) ? 'tablet' : 'mobile';
    }

    // Simple browser detection
    if (/Chrome/.test(userAgent)) browser = 'Chrome';
    else if (/Firefox/.test(userAgent)) browser = 'Firefox';
    else if (/Safari/.test(userAgent)) browser = 'Safari';
    else if (/Edge/.test(userAgent)) browser = 'Edge';

    // Simple OS detection
    if (/Windows/.test(userAgent)) os = 'Windows';
    else if (/Mac/.test(userAgent)) os = 'macOS';
    else if (/Linux/.test(userAgent)) os = 'Linux';
    else if (/Android/.test(userAgent)) os = 'Android';
    else if (/iOS/.test(userAgent)) os = 'iOS';

    return {
      type: deviceType,
      browser,
      os,
    };
  }

  /**
   * Broadcast presence update to workspace
   */
  async broadcastPresenceUpdate(
    workspaceId: string,
    presenceInfo: PresenceInfo
  ): Promise<void> {
    if (!this.io) {
      logger.warn('WebSocket server not initialized');
      return;
    }

    try {
      const user = await userRepository.findById(presenceInfo.userId);
      if (!user) return;

      this.io.to(`workspace:${workspaceId}`).emit('presence:update', {
        userId: presenceInfo.userId,
        status: presenceInfo.status,
        userName: `${user.firstName} ${user.lastName}`,
        userAvatar: user.profilePicture,
        workspaceId,
        currentActivity: presenceInfo.currentActivity,
        timestamp: new Date(),
      });

      this.recordMetric('websocket.presence.broadcast', 1, {
        workspaceId,
        status: presenceInfo.status,
      });
    } catch (error) {
      this.metrics.errors++;
      logger.error('Error broadcasting presence update:', error);
    }
  }

  /**
   * Broadcast activity update to relevant rooms
   */
  async broadcastActivityUpdate(
    resourceId: string,
    activityIndicator: ActivityIndicator
  ): Promise<void> {
    if (!this.io) {
      logger.warn('WebSocket server not initialized');
      return;
    }

    try {
      // Broadcast to all rooms that might be interested in this resource
      this.io.emit('activity:update', {
        resourceId,
        userId: activityIndicator.userId,
        userName: activityIndicator.userName,
        userAvatar: activityIndicator.userAvatar,
        activity: activityIndicator.activity,
        presence: activityIndicator.presence,
        timestamp: new Date(),
      });

      this.recordMetric('websocket.activity.broadcast', 1, {
        resourceId,
        activityType: activityIndicator.activity.type,
      });
    } catch (error) {
      this.metrics.errors++;
      logger.error('Error broadcasting activity update:', error);
    }
  }

  /**
   * Get presence statistics
   */
  getPresenceStats(): any {
    return presenceService.getPresenceStats();
  }

  /**
   * Get online users in workspace
   */
  getOnlineUsersInWorkspace(workspaceId: string): PresenceInfo[] {
    return presenceService.getOnlineUsersInWorkspace(workspaceId);
  }

  /**
   * Get activity indicators for resource
   */
  getActivityIndicators(resourceId: string): ActivityIndicator[] {
    return presenceService.getActivityIndicators(resourceId);
  }

  /**
   * Get typing indicators for resource
   */
  getTypingIndicators(resourceId: string): TypingIndicator[] {
    return presenceService.getTypingIndicators(resourceId);
  }
}

// Export singleton instance
export const webSocketService = new WebSocketService();

// Export the setup function for easy access
export const setupWebSocketServer = (socketIo: SocketIOServer): void => {
  webSocketService.setupWebSocketServer(socketIo);
};

// Export utility functions
export const sendUserNotification = (
  userId: string,
  notification: NotificationData
): void => {
  webSocketService.sendUserNotification(userId, notification);
};

export const sendTaskUpdate = (
  projectId: string,
  taskData: TaskUpdateData
): void => {
  webSocketService.sendTaskUpdate(projectId, taskData);
};

export const sendProjectUpdate = (
  projectId: string,
  projectData: ProjectUpdateData
): void => {
  webSocketService.sendProjectUpdate(projectId, projectData);
};

export const sendWorkspaceUpdate = (
  workspaceId: string,
  workspaceData: WorkspaceUpdateData
): void => {
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
