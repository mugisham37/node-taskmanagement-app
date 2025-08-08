import { WebSocketServer } from '@/infrastructure/websocket';
import { logger } from '@/infrastructure/logging/logger';

export interface WebSocketBroadcastService {
  broadcastToWorkspace(
    workspaceId: string,
    event: string,
    data: any,
    excludeUserId?: string
  ): Promise<void>;
  broadcastToProject(
    projectId: string,
    event: string,
    data: any,
    excludeUserId?: string
  ): Promise<void>;
  sendToUser(userId: string, event: string, data: any): Promise<boolean>;
  getConnectionStats(): any;
}

class WebSocketBroadcastServiceImpl implements WebSocketBroadcastService {
  private wsServer: WebSocketServer | null = null;

  /**
   * Initialize with WebSocket server instance
   */
  initialize(wsServer: WebSocketServer): void {
    this.wsServer = wsServer;
    logger.info('WebSocket broadcast service initialized');
  }

  /**
   * Broadcast message to all connections in a workspace
   */
  async broadcastToWorkspace(
    workspaceId: string,
    event: string,
    data: any,
    excludeUserId?: string
  ): Promise<void> {
    if (!this.wsServer) {
      logger.warn(
        'WebSocket server not initialized, cannot broadcast to workspace'
      );
      return;
    }

    try {
      // Find connection ID to exclude if userId provided
      let excludeConnectionId: string | undefined;
      if (excludeUserId) {
        // This would need to be implemented in the connection manager
        // For now, we'll pass undefined
        excludeConnectionId = undefined;
      }

      await this.wsServer.broadcastToWorkspace(
        workspaceId,
        event,
        data,
        excludeConnectionId
      );

      logger.debug('Broadcast to workspace completed', {
        workspaceId,
        event,
        excludeUserId,
      });
    } catch (error) {
      logger.error('Error broadcasting to workspace', {
        error: error instanceof Error ? error.message : String(error),
        workspaceId,
        event,
      });
      throw error;
    }
  }

  /**
   * Broadcast message to all connections in a project
   */
  async broadcastToProject(
    projectId: string,
    event: string,
    data: any,
    excludeUserId?: string
  ): Promise<void> {
    if (!this.wsServer) {
      logger.warn(
        'WebSocket server not initialized, cannot broadcast to project'
      );
      return;
    }

    try {
      // Find connection ID to exclude if userId provided
      let excludeConnectionId: string | undefined;
      if (excludeUserId) {
        // This would need to be implemented in the connection manager
        // For now, we'll pass undefined
        excludeConnectionId = undefined;
      }

      await this.wsServer.broadcastToProject(
        projectId,
        event,
        data,
        excludeConnectionId
      );

      logger.debug('Broadcast to project completed', {
        projectId,
        event,
        excludeUserId,
      });
    } catch (error) {
      logger.error('Error broadcasting to project', {
        error: error instanceof Error ? error.message : String(error),
        projectId,
        event,
      });
      throw error;
    }
  }

  /**
   * Send message to specific user
   */
  async sendToUser(userId: string, event: string, data: any): Promise<boolean> {
    if (!this.wsServer) {
      logger.warn('WebSocket server not initialized, cannot send to user');
      return false;
    }

    try {
      const success = await this.wsServer.sendToUser(userId, event, data);

      logger.debug('Send to user completed', {
        userId,
        event,
        success,
      });

      return success;
    } catch (error) {
      logger.error('Error sending to user', {
        error: error instanceof Error ? error.message : String(error),
        userId,
        event,
      });
      return false;
    }
  }

  /**
   * Get connection statistics
   */
  getConnectionStats(): any {
    if (!this.wsServer) {
      return {
        error: 'WebSocket server not initialized',
      };
    }

    return this.wsServer.getStats();
  }

  /**
   * Check if WebSocket server is initialized
   */
  isInitialized(): boolean {
    return this.wsServer !== null;
  }
}

// Export singleton instance
export const webSocketBroadcastService = new WebSocketBroadcastServiceImpl();

// Convenience functions for common operations
export const broadcastTaskUpdate = async (taskData: {
  taskId: string;
  projectId: string;
  workspaceId: string;
  action: 'created' | 'updated' | 'deleted' | 'assigned' | 'completed';
  task: any;
  userId: string;
}): Promise<void> => {
  if (!webSocketBroadcastService.isInitialized()) {
    logger.warn(
      'WebSocket service not initialized, cannot broadcast task update'
    );
    return;
  }

  try {
    const wsServer = (webSocketBroadcastService as any).wsServer;
    if (wsServer) {
      const eventBroadcaster = wsServer.getEventBroadcaster();
      await eventBroadcaster.broadcastTaskUpdate(taskData);
    } else {
      // Fallback to direct broadcast
      await webSocketBroadcastService.broadcastToProject(
        taskData.projectId,
        'task.updated',
        {
          taskId: taskData.taskId,
          action: taskData.action,
          task: taskData.task,
          timestamp: Date.now(),
        },
        taskData.userId
      );
    }
  } catch (error) {
    logger.error('Error broadcasting task update', {
      error: error instanceof Error ? error.message : String(error),
      taskData,
    });
  }
};

export const broadcastCommentAdded = async (commentData: {
  commentId: string;
  taskId: string;
  projectId: string;
  workspaceId: string;
  comment: any;
  userId: string;
}): Promise<void> => {
  if (!webSocketBroadcastService.isInitialized()) {
    logger.warn(
      'WebSocket service not initialized, cannot broadcast comment added'
    );
    return;
  }

  try {
    const wsServer = (webSocketBroadcastService as any).wsServer;
    if (wsServer) {
      const eventBroadcaster = wsServer.getEventBroadcaster();
      await eventBroadcaster.broadcastCommentAdded(commentData);
    } else {
      // Fallback to direct broadcast
      await webSocketBroadcastService.broadcastToProject(
        commentData.projectId,
        'comment.added',
        {
          commentId: commentData.commentId,
          taskId: commentData.taskId,
          comment: commentData.comment,
          timestamp: Date.now(),
        },
        commentData.userId
      );
    }
  } catch (error) {
    logger.error('Error broadcasting comment added', {
      error: error instanceof Error ? error.message : String(error),
      commentData,
    });
  }
};

export const broadcastProjectUpdate = async (projectData: {
  projectId: string;
  workspaceId: string;
  action: 'created' | 'updated' | 'deleted' | 'archived';
  project: any;
  userId: string;
}): Promise<void> => {
  if (!webSocketBroadcastService.isInitialized()) {
    logger.warn(
      'WebSocket service not initialized, cannot broadcast project update'
    );
    return;
  }

  try {
    const wsServer = (webSocketBroadcastService as any).wsServer;
    if (wsServer) {
      const eventBroadcaster = wsServer.getEventBroadcaster();
      await eventBroadcaster.broadcastWorkspaceEvent({
        workspaceId: projectData.workspaceId,
        event: 'project.updated',
        data: {
          projectId: projectData.projectId,
          action: projectData.action,
          project: projectData.project,
        },
        userId: projectData.userId,
        priority: 'normal',
      });
    } else {
      // Fallback to direct broadcast
      await webSocketBroadcastService.broadcastToWorkspace(
        projectData.workspaceId,
        'project.updated',
        {
          projectId: projectData.projectId,
          action: projectData.action,
          project: projectData.project,
          timestamp: Date.now(),
        },
        projectData.userId
      );
    }
  } catch (error) {
    logger.error('Error broadcasting project update', {
      error: error instanceof Error ? error.message : String(error),
      projectData,
    });
  }
};

export const sendNotificationToUser = async (
  userId: string,
  notification: {
    id: string;
    type: string;
    title: string;
    message: string;
    data?: any;
  }
): Promise<boolean> => {
  return await webSocketBroadcastService.sendToUser(
    userId,
    'notification.received',
    {
      ...notification,
      timestamp: Date.now(),
    }
  );
};

export const broadcastPresenceUpdate = async (
  workspaceId: string,
  presenceData: {
    userId: string;
    status: 'online' | 'away' | 'busy' | 'offline';
    location?: string;
    excludeUserId?: string;
  }
): Promise<void> => {
  await webSocketBroadcastService.broadcastToWorkspace(
    workspaceId,
    'presence.updated',
    {
      userId: presenceData.userId,
      status: presenceData.status,
      location: presenceData.location,
      timestamp: Date.now(),
    },
    presenceData.excludeUserId
  );
};
