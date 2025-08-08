import { WebSocketConnection, WebSocketMessage } from './websocket-connection';
import { WebSocketConnectionManager } from './websocket-connection-manager';
import { WebSocketAuthenticator } from './websocket-authenticator';
import { EventBroadcaster } from './event-broadcaster';
import { EventAggregator } from './event-aggregator';
import { PresenceTracker } from './presence-tracker';
import { logger } from '@/infrastructure/logging/logger';

export interface MessageHandler {
  handle(
    connection: WebSocketConnection,
    message: WebSocketMessage
  ): Promise<void>;
}

export class WebSocketMessageHandler {
  private handlers: Map<string, MessageHandler> = new Map();
  private connectionManager: WebSocketConnectionManager;
  private authenticator: WebSocketAuthenticator;
  private eventBroadcaster: EventBroadcaster;
  private eventAggregator: EventAggregator;
  private presenceTracker: PresenceTracker;

  constructor(connectionManager: WebSocketConnectionManager) {
    this.connectionManager = connectionManager;
    this.authenticator = new WebSocketAuthenticator();
    this.eventBroadcaster = new EventBroadcaster(
      connectionManager,
      this.authenticator
    );
    this.eventAggregator = new EventAggregator();
    this.presenceTracker = new PresenceTracker(
      connectionManager,
      this.eventBroadcaster
    );
    this.eventAggregator = new EventAggregator();

    this.registerDefaultHandlers();
    logger.info('WebSocket message handler initialized');
  }

  /**
   * Register default message handlers
   */
  private registerDefaultHandlers(): void {
    // Connection management handlers
    this.registerHandler('ping', new PingHandler());
    this.registerHandler(
      'subscribe',
      new SubscribeHandler(this.connectionManager)
    );
    this.registerHandler(
      'unsubscribe',
      new UnsubscribeHandler(this.connectionManager)
    );

    // Project management handlers
    this.registerHandler(
      'project.join',
      new ProjectJoinHandler(this.connectionManager, this.authenticator)
    );
    this.registerHandler(
      'project.leave',
      new ProjectLeaveHandler(this.connectionManager)
    );

    // Presence handlers
    this.registerHandler(
      'presence.update',
      new PresenceUpdateHandler(this.connectionManager)
    );
    this.registerHandler(
      'presence.get',
      new PresenceGetHandler(this.connectionManager)
    );

    // Task collaboration handlers
    this.registerHandler(
      'task.edit.start',
      new TaskEditStartHandler(this.connectionManager)
    );
    this.registerHandler(
      'task.edit.end',
      new TaskEditEndHandler(this.connectionManager)
    );
    this.registerHandler(
      'task.edit.operation',
      new TaskEditOperationHandler(this.connectionManager)
    );

    // Typing indicators
    this.registerHandler(
      'typing.start',
      new TypingStartHandler(this.connectionManager)
    );
    this.registerHandler(
      'typing.stop',
      new TypingStopHandler(this.connectionManager)
    );
  }

  /**
   * Register a message handler
   */
  registerHandler(messageType: string, handler: MessageHandler): void {
    this.handlers.set(messageType, handler);
    logger.debug('Message handler registered', { messageType });
  }

  /**
   * Get event broadcaster instance
   */
  getEventBroadcaster(): EventBroadcaster {
    return this.eventBroadcaster;
  }

  /**
   * Get event aggregator instance
   */
  getEventAggregator(): EventAggregator {
    return this.eventAggregator;
  }

  /**
   * Get presence tracker instance
   */
  getPresenceTracker(): PresenceTracker {
    return this.presenceTracker;
  }

  /**
   * Handle incoming message
   */
  async handleMessage(
    connection: WebSocketConnection,
    message: WebSocketMessage
  ): Promise<void> {
    const startTime = Date.now();

    try {
      logger.debug('Handling WebSocket message', {
        connectionId: connection.getId(),
        userId: connection.getUser().id,
        event: message.event,
        messageId: message.messageId,
      });

      // Find handler for message type
      const handler = this.handlers.get(message.event);
      if (!handler) {
        logger.warn('No handler found for message type', {
          event: message.event,
          connectionId: connection.getId(),
        });

        await connection.send('error', {
          messageId: message.messageId,
          error: 'Unknown message type',
          code: 'UNKNOWN_MESSAGE_TYPE',
        });
        return;
      }

      // Execute handler
      await handler.handle(connection, message);

      logger.debug('Message handled successfully', {
        connectionId: connection.getId(),
        event: message.event,
        messageId: message.messageId,
        duration: Date.now() - startTime,
      });
    } catch (error) {
      logger.error('Error handling WebSocket message', {
        error: error instanceof Error ? error.message : String(error),
        connectionId: connection.getId(),
        event: message.event,
        messageId: message.messageId,
        duration: Date.now() - startTime,
      });

      // Send error response to client
      await connection.send('error', {
        messageId: message.messageId,
        error: 'Message handling failed',
        code: 'MESSAGE_HANDLER_ERROR',
      });
    }
  }
}

// Default message handlers

class PingHandler implements MessageHandler {
  async handle(
    connection: WebSocketConnection,
    message: WebSocketMessage
  ): Promise<void> {
    await connection.send('pong', {
      messageId: message.messageId,
      timestamp: Date.now(),
    });
  }
}

class SubscribeHandler implements MessageHandler {
  constructor(private connectionManager: WebSocketConnectionManager) {}

  async handle(
    connection: WebSocketConnection,
    message: WebSocketMessage
  ): Promise<void> {
    const { channel } = message.data;

    if (!channel || typeof channel !== 'string') {
      throw new Error('Invalid channel parameter');
    }

    // Validate subscription permission
    if (!(await this.validateSubscriptionPermission(connection, channel))) {
      throw new Error('Permission denied for channel subscription');
    }

    connection.subscribe(channel);

    await connection.send('subscribed', {
      messageId: message.messageId,
      channel,
    });
  }

  private async validateSubscriptionPermission(
    connection: WebSocketConnection,
    channel: string
  ): Promise<boolean> {
    const user = connection.getUser();

    // Allow subscription to user's own channel
    if (channel === `user:${user.id}`) {
      return true;
    }

    // Allow subscription to user's workspace
    if (user.workspaceId && channel === `workspace:${user.workspaceId}`) {
      return true;
    }

    // Allow subscription to projects (will be validated separately)
    if (channel.startsWith('project:')) {
      return true;
    }

    // Allow subscription to role-based channels if user has the role
    if (channel.startsWith('role:')) {
      const role = channel.substring(5);
      return user.roles.includes(role);
    }

    return false;
  }
}

class UnsubscribeHandler implements MessageHandler {
  constructor(private connectionManager: WebSocketConnectionManager) {}

  async handle(
    connection: WebSocketConnection,
    message: WebSocketMessage
  ): Promise<void> {
    const { channel } = message.data;

    if (!channel || typeof channel !== 'string') {
      throw new Error('Invalid channel parameter');
    }

    connection.unsubscribe(channel);

    await connection.send('unsubscribed', {
      messageId: message.messageId,
      channel,
    });
  }
}

class ProjectJoinHandler implements MessageHandler {
  constructor(
    private connectionManager: WebSocketConnectionManager,
    private authenticator: WebSocketAuthenticator
  ) {}

  async handle(
    connection: WebSocketConnection,
    message: WebSocketMessage
  ): Promise<void> {
    const { projectId } = message.data;

    if (!projectId || typeof projectId !== 'string') {
      throw new Error('Invalid projectId parameter');
    }

    // Validate project access permission
    const hasPermission = await this.authenticator.validateActionPermission(
      connection.getUser(),
      'read',
      `project:${projectId}`
    );

    if (!hasPermission) {
      throw new Error('Permission denied for project access');
    }

    // Subscribe to project
    this.connectionManager.subscribeToProject(connection.getId(), projectId);

    await connection.send('project.joined', {
      messageId: message.messageId,
      projectId,
    });
  }
}

class ProjectLeaveHandler implements MessageHandler {
  constructor(private connectionManager: WebSocketConnectionManager) {}

  async handle(
    connection: WebSocketConnection,
    message: WebSocketMessage
  ): Promise<void> {
    const { projectId } = message.data;

    if (!projectId || typeof projectId !== 'string') {
      throw new Error('Invalid projectId parameter');
    }

    this.connectionManager.unsubscribeFromProject(
      connection.getId(),
      projectId
    );

    await connection.send('project.left', {
      messageId: message.messageId,
      projectId,
    });
  }
}

class PresenceUpdateHandler implements MessageHandler {
  constructor(private connectionManager: WebSocketConnectionManager) {}

  async handle(
    connection: WebSocketConnection,
    message: WebSocketMessage
  ): Promise<void> {
    const { status, location } = message.data;
    const user = connection.getUser();

    // Broadcast presence update to workspace
    if (user.workspaceId) {
      const workspaceConnections =
        this.connectionManager.getConnectionsByWorkspace(user.workspaceId);

      const presenceData = {
        userId: user.id,
        status,
        location,
        timestamp: Date.now(),
      };

      const promises = workspaceConnections
        .filter(conn => conn.getId() !== connection.getId())
        .map(conn => conn.send('presence.updated', presenceData));

      await Promise.allSettled(promises);
    }

    await connection.send('presence.update.ack', {
      messageId: message.messageId,
      status,
      location,
    });
  }
}

class PresenceGetHandler implements MessageHandler {
  constructor(private connectionManager: WebSocketConnectionManager) {}

  async handle(
    connection: WebSocketConnection,
    message: WebSocketMessage
  ): Promise<void> {
    const { scope } = message.data;
    const user = connection.getUser();

    let presenceData: any[] = [];

    if (scope === 'workspace' && user.workspaceId) {
      const workspaceConnections =
        this.connectionManager.getConnectionsByWorkspace(user.workspaceId);
      presenceData = workspaceConnections.map(conn => ({
        userId: conn.getUser().id,
        status: 'online', // This would come from a presence store
        lastSeen: Date.now(),
      }));
    }

    await connection.send('presence.data', {
      messageId: message.messageId,
      scope,
      presence: presenceData,
    });
  }
}

class TaskEditStartHandler implements MessageHandler {
  constructor(private connectionManager: WebSocketConnectionManager) {}

  async handle(
    connection: WebSocketConnection,
    message: WebSocketMessage
  ): Promise<void> {
    const { taskId, projectId } = message.data;
    const user = connection.getUser();

    // Broadcast edit start to project members
    if (projectId) {
      const projectConnections =
        this.connectionManager.getConnectionsByProject(projectId);

      const editData = {
        taskId,
        userId: user.id,
        userEmail: user.email,
        action: 'edit_start',
        timestamp: Date.now(),
      };

      const promises = projectConnections
        .filter(conn => conn.getId() !== connection.getId())
        .map(conn => conn.send('task.edit.started', editData));

      await Promise.allSettled(promises);
    }

    await connection.send('task.edit.start.ack', {
      messageId: message.messageId,
      taskId,
    });
  }
}

class TaskEditEndHandler implements MessageHandler {
  constructor(private connectionManager: WebSocketConnectionManager) {}

  async handle(
    connection: WebSocketConnection,
    message: WebSocketMessage
  ): Promise<void> {
    const { taskId, projectId } = message.data;
    const user = connection.getUser();

    // Broadcast edit end to project members
    if (projectId) {
      const projectConnections =
        this.connectionManager.getConnectionsByProject(projectId);

      const editData = {
        taskId,
        userId: user.id,
        userEmail: user.email,
        action: 'edit_end',
        timestamp: Date.now(),
      };

      const promises = projectConnections
        .filter(conn => conn.getId() !== connection.getId())
        .map(conn => conn.send('task.edit.ended', editData));

      await Promise.allSettled(promises);
    }

    await connection.send('task.edit.end.ack', {
      messageId: message.messageId,
      taskId,
    });
  }
}

class TaskEditOperationHandler implements MessageHandler {
  constructor(private connectionManager: WebSocketConnectionManager) {}

  async handle(
    connection: WebSocketConnection,
    message: WebSocketMessage
  ): Promise<void> {
    const { taskId, projectId, operation } = message.data;
    const user = connection.getUser();

    // Broadcast operation to project members
    if (projectId) {
      const projectConnections =
        this.connectionManager.getConnectionsByProject(projectId);

      const operationData = {
        taskId,
        userId: user.id,
        operation,
        timestamp: Date.now(),
      };

      const promises = projectConnections
        .filter(conn => conn.getId() !== connection.getId())
        .map(conn => conn.send('task.edit.operation', operationData));

      await Promise.allSettled(promises);
    }

    await connection.send('task.edit.operation.ack', {
      messageId: message.messageId,
      taskId,
      operation,
    });
  }
}

class TypingStartHandler implements MessageHandler {
  constructor(private connectionManager: WebSocketConnectionManager) {}

  async handle(
    connection: WebSocketConnection,
    message: WebSocketMessage
  ): Promise<void> {
    const { taskId, projectId } = message.data;
    const user = connection.getUser();

    // Broadcast typing indicator to project members
    if (projectId) {
      const projectConnections =
        this.connectionManager.getConnectionsByProject(projectId);

      const typingData = {
        taskId,
        userId: user.id,
        userEmail: user.email,
        action: 'typing_start',
        timestamp: Date.now(),
      };

      const promises = projectConnections
        .filter(conn => conn.getId() !== connection.getId())
        .map(conn => conn.send('typing.started', typingData));

      await Promise.allSettled(promises);
    }

    await connection.send('typing.start.ack', {
      messageId: message.messageId,
      taskId,
    });
  }
}

class TypingStopHandler implements MessageHandler {
  constructor(private connectionManager: WebSocketConnectionManager) {}

  async handle(
    connection: WebSocketConnection,
    message: WebSocketMessage
  ): Promise<void> {
    const { taskId, projectId } = message.data;
    const user = connection.getUser();

    // Broadcast typing stop to project members
    if (projectId) {
      const projectConnections =
        this.connectionManager.getConnectionsByProject(projectId);

      const typingData = {
        taskId,
        userId: user.id,
        userEmail: user.email,
        action: 'typing_stop',
        timestamp: Date.now(),
      };

      const promises = projectConnections
        .filter(conn => conn.getId() !== connection.getId())
        .map(conn => conn.send('typing.stopped', typingData));

      await Promise.allSettled(promises);
    }

    await connection.send('typing.stop.ack', {
      messageId: message.messageId,
      taskId,
    });
  }
}
