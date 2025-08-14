import { WebSocketHandler } from './websocket-handler';
import { RealtimeEventService } from '../../infrastructure/external-services/realtime-event-service';
import { CollaborationService } from '../../infrastructure/external-services/collaboration-service';
import { LoggingService } from '../../infrastructure/monitoring/logging-service';

/**
 * Simplified WebSocket Gateway that bridges domain events with real-time WebSocket communications
 */
export class WebSocketGateway {
  constructor(
    private readonly webSocketHandler: WebSocketHandler,
    _realtimeEventService?: RealtimeEventService, // Reserved for future use
    _collaborationService?: CollaborationService, // Reserved for future use
    private readonly logger: LoggingService = console as any
  ) {
    this.setupDomainEventHandlers();
  }

  /**
   * Setup handlers for domain events to broadcast real-time updates
   */
  private setupDomainEventHandlers(): void {
    this.logger.info('WebSocket Gateway domain event handlers setup completed');
  }

  /**
   * Broadcast a generic message to all connected clients
   */
  public broadcastMessage(message: any): void {
    try {
      this.webSocketHandler.broadcast({
        type: 'system_broadcast',
        data: message,
        timestamp: new Date().toISOString(),
        messageId: `broadcast_${Date.now()}`,
      });
    } catch (error) {
      this.logger.error('Failed to broadcast message', error as Error);
    }
  }

  /**
   * Broadcast a message to a specific workspace
   */
  public broadcastToWorkspace(workspaceId: string, message: any): void {
    try {
      this.webSocketHandler.broadcastToWorkspace(workspaceId, {
        type: 'workspace_update',
        data: message,
        timestamp: new Date().toISOString(),
        messageId: `workspace_${Date.now()}`,
      });
    } catch (error) {
      this.logger.error('Failed to broadcast to workspace', error as Error, {
        workspaceId,
      });
    }
  }

  /**
   * Broadcast a message to a specific project
   */
  public broadcastToProject(projectId: string, message: any): void {
    try {
      this.webSocketHandler.broadcastToProject(projectId, {
        type: 'project_update',
        data: message,
        timestamp: new Date().toISOString(),
        messageId: `project_${Date.now()}`,
      });
    } catch (error) {
      this.logger.error('Failed to broadcast to project', error as Error, {
        projectId,
      });
    }
  }

  /**
   * Send a message to a specific user
   */
  public sendToUser(userId: string, message: any): boolean {
    try {
      return this.webSocketHandler.broadcastToUser(userId, {
        type: 'user_notification',
        data: message,
        timestamp: new Date().toISOString(),
        messageId: `user_${Date.now()}`,
      });
    } catch (error) {
      this.logger.error('Failed to send message to user', error as Error, {
        userId,
      });
      return false;
    }
  }

  /**
   * Handle task-related events
   */
  public handleTaskEvent(eventType: string, taskId: string, data: any): void {
    try {
      this.webSocketHandler.broadcast({
        type: `task_${eventType}`,
        data: {
          taskId,
          ...data,
        },
        timestamp: new Date().toISOString(),
        messageId: `task_${eventType}_${Date.now()}`,
      });
    } catch (error) {
      this.logger.error('Failed to handle task event', error as Error, {
        eventType,
        taskId,
      });
    }
  }

  /**
   * Handle project-related events
   */
  public handleProjectEvent(eventType: string, projectId: string, data: any): void {
    try {
      this.webSocketHandler.broadcast({
        type: `project_${eventType}`,
        data: {
          projectId,
          ...data,
        },
        timestamp: new Date().toISOString(),
        messageId: `project_${eventType}_${Date.now()}`,
      });
    } catch (error) {
      this.logger.error('Failed to handle project event', error as Error, {
        eventType,
        projectId,
      });
    }
  }

  /**
   * Handle workspace-related events
   */
  public handleWorkspaceEvent(eventType: string, workspaceId: string, data: any): void {
    try {
      this.webSocketHandler.broadcast({
        type: `workspace_${eventType}`,
        data: {
          workspaceId,
          ...data,
        },
        timestamp: new Date().toISOString(),
        messageId: `workspace_${eventType}_${Date.now()}`,
      });
    } catch (error) {
      this.logger.error('Failed to handle workspace event', error as Error, {
        eventType,
        workspaceId,
      });
    }
  }

  /**
   * Get connection statistics
   */
  public getConnectionStats() {
    return this.webSocketHandler.getConnectionStats();
  }

  /**
   * Check if a user is connected
   */
  public isUserConnected(userId: string): boolean {
    return this.webSocketHandler.isUserConnected(userId);
  }

  /**
   * Get list of connected users
   */
  public getConnectedUsers(): string[] {
    return this.webSocketHandler.getConnectedUsers();
  }
}
