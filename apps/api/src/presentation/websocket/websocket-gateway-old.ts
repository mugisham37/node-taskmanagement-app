import {
  ProjectCreatedEvent,
  ProjectMemberAddedEvent,
  ProjectUpdatedEvent,
  TaskAssignedEvent,
  TaskCompletedEvent,
  TaskCreatedEvent,
  TaskUpdatedEvent,
  WorkspaceCreatedEvent,
  WorkspaceMemberAddedEvent,
} from '@monorepo/domain';
import { CollaborationService } from '../../infrastructure/external-services/collaboration-service';
import { RealtimeEventService } from '../../infrastructure/external-services/realtime-event-service';
import { LoggingService } from '../../infrastructure/monitoring/logging-service';
import { WebSocketHandler } from './websocket-handler';

/**
 * WebSocket Gateway that bridges domain events with real-time WebSocket communications
 * Handles the integration between domain events and WebSocket broadcasting
 */
export class WebSocketGateway {
  constructor(
    private readonly webSocketHandler: WebSocketHandler,
    private readonly realtimeEventService: RealtimeEventService,
    private readonly collaborationService: CollaborationService,
    private readonly logger: LoggingService
  ) {
    this.setupDomainEventHandlers();
  }

  /**
   * Setup handlers for domain events to broadcast real-time updates
   */
  private setupDomainEventHandlers(): void {
    // Task events
    this.setupTaskEventHandlers();

    // Project events
    this.setupProjectEventHandlers();

    // Workspace events
    this.setupWorkspaceEventHandlers();

    this.logger.info('WebSocket Gateway domain event handlers setup completed');
  }

  private setupTaskEventHandlers(): void {
    // Task created
    this.realtimeEventService.on(
      'domain:TaskCreatedEvent',
      async (event: TaskCreatedEvent) => {
        await this.handleTaskCreated(event);
      }
    );

    // Task assigned
    this.realtimeEventService.on(
      'domain:TaskAssignedEvent',
      async (event: TaskAssignedEvent) => {
        await this.handleTaskAssigned(event);
      }
    );

    // Task completed
    this.realtimeEventService.on(
      'domain:TaskCompletedEvent',
      async (event: TaskCompletedEvent) => {
        await this.handleTaskCompleted(event);
      }
    );

    // Task updated
    this.realtimeEventService.on(
      'domain:TaskUpdatedEvent',
      async (event: TaskUpdatedEvent) => {
        await this.handleTaskUpdated(event);
      }
    );
  }

  private setupProjectEventHandlers(): void {
    // Project created
    this.realtimeEventService.on(
      'domain:ProjectCreatedEvent',
      async (event: ProjectCreatedEvent) => {
        await this.handleProjectCreated(event);
      }
    );

    // Project member added
    this.realtimeEventService.on(
      'domain:ProjectMemberAddedEvent',
      async (event: ProjectMemberAddedEvent) => {
        await this.handleProjectMemberAdded(event);
      }
    );

    // Project updated
    this.realtimeEventService.on(
      'domain:ProjectUpdatedEvent',
      async (event: ProjectUpdatedEvent) => {
        await this.handleProjectUpdated(event);
      }
    );
  }

  private setupWorkspaceEventHandlers(): void {
    // Workspace created
    this.realtimeEventService.on(
      'domain:WorkspaceCreatedEvent',
      async (event: WorkspaceCreatedEvent) => {
        await this.handleWorkspaceCreated(event);
      }
    );

    // Workspace member added
    this.realtimeEventService.on(
      'domain:WorkspaceMemberAddedEvent',
      async (event: WorkspaceMemberAddedEvent) => {
        await this.handleWorkspaceMemberAdded(event);
      }
    );
  }

  // Task event handlers
  private async handleTaskCreated(event: TaskCreatedEvent): Promise<void> {
    try {
      await this.realtimeEventService.publishTaskCreated(
        event.taskId.value,
        event.createdById.value,
        event.projectId.value,
        event.workspaceId?.value || '',
        {
          title: event.title,
          description: event.description,
          priority: event.priority?.value,
          dueDate: event.dueDate,
          createdAt: event.occurredOn,
        }
      );

      // Create collaborative document for the task
      await this.collaborationService.createDocument(
        `task:${event.taskId.value}`,
        'task',
        event.taskId.value,
        {
          title: event.title,
          description: event.description,
        },
        event.createdById.value
      );

      this.logger.info('Task created event broadcasted', {
        taskId: event.taskId.value,
        projectId: event.projectId.value,
        createdBy: event.createdById.value,
      });
    } catch (error) {
      this.logger.error('Failed to handle task created event', error as Error, {
        taskId: event.taskId.value,
        eventId: event.eventId,
      });
    }
  }

  private async handleTaskAssigned(event: TaskAssignedEvent): Promise<void> {
    try {
      await this.realtimeEventService.publishTaskAssigned(
        event.taskId.value,
        event.assigneeId.value,
        event.assignedById.value,
        event.projectId.value,
        event.workspaceId?.value || '',
        {
          title: event.taskTitle,
          assignedAt: event.occurredOn,
        }
      );

      // Add assignee as collaborator to task document
      await this.collaborationService.addCollaborator(
        `task:${event.taskId.value}`,
        event.assigneeId.value
      );

      this.logger.info('Task assigned event broadcasted', {
        taskId: event.taskId.value,
        assigneeId: event.assigneeId.value,
        assignedBy: event.assignedById.value,
      });
    } catch (error) {
      this.logger.error(
        'Failed to handle task assigned event',
        error as Error,
        {
          taskId: event.taskId.value,
          eventId: event.eventId,
        }
      );
    }
  }

  private async handleTaskCompleted(event: TaskCompletedEvent): Promise<void> {
    try {
      await this.realtimeEventService.publishTaskCompleted(
        event.taskId.value,
        event.completedById.value,
        event.projectId.value,
        event.workspaceId?.value || '',
        {
          title: event.taskTitle,
          completedAt: event.occurredOn,
          actualHours: event.actualHours,
        }
      );

      this.logger.info('Task completed event broadcasted', {
        taskId: event.taskId.value,
        completedBy: event.completedById.value,
        projectId: event.projectId.value,
      });
    } catch (error) {
      this.logger.error(
        'Failed to handle task completed event',
        error as Error,
        {
          taskId: event.taskId.value,
          eventId: event.eventId,
        }
      );
    }
  }

  private async handleTaskUpdated(event: TaskUpdatedEvent): Promise<void> {
    try {
      await this.realtimeEventService.publishTaskUpdated(
        event.taskId.value,
        event.updatedById.value,
        event.projectId.value,
        event.workspaceId?.value || '',
        event.changes
      );

      this.logger.info('Task updated event broadcasted', {
        taskId: event.taskId.value,
        updatedBy: event.updatedById.value,
        changes: Object.keys(event.changes),
      });
    } catch (error) {
      this.logger.error('Failed to handle task updated event', error as Error, {
        taskId: event.taskId.value,
        eventId: event.eventId,
      });
    }
  }

  // Project event handlers
  private async handleProjectCreated(
    event: ProjectCreatedEvent
  ): Promise<void> {
    try {
      await this.realtimeEventService.publishProjectCreated(
        event.projectId.value,
        event.managerId.value,
        event.workspaceId.value,
        {
          name: event.name,
          description: event.description,
          createdAt: event.occurredOn,
        }
      );

      // Create collaborative document for the project
      await this.collaborationService.createDocument(
        `project:${event.projectId.value}`,
        'project',
        event.projectId.value,
        {
          name: event.name,
          description: event.description,
        },
        event.managerId.value
      );

      this.logger.info('Project created event broadcasted', {
        projectId: event.projectId.value,
        managerId: event.managerId.value,
        workspaceId: event.workspaceId.value,
      });
    } catch (error) {
      this.logger.error(
        'Failed to handle project created event',
        error as Error,
        {
          projectId: event.projectId.value,
          eventId: event.eventId,
        }
      );
    }
  }

  private async handleProjectMemberAdded(
    event: ProjectMemberAddedEvent
  ): Promise<void> {
    try {
      await this.realtimeEventService.publishProjectMemberAdded(
        event.projectId.value,
        event.memberId.value,
        event.addedById.value,
        event.workspaceId.value,
        {
          projectName: event.projectName,
          role: event.role.value,
          addedAt: event.occurredOn,
        }
      );

      // Add member as collaborator to project document
      await this.collaborationService.addCollaborator(
        `project:${event.projectId.value}`,
        event.memberId.value
      );

      this.logger.info('Project member added event broadcasted', {
        projectId: event.projectId.value,
        memberId: event.memberId.value,
        addedBy: event.addedById.value,
      });
    } catch (error) {
      this.logger.error(
        'Failed to handle project member added event',
        error as Error,
        {
          projectId: event.projectId.value,
          eventId: event.eventId,
        }
      );
    }
  }

  private async handleProjectUpdated(
    event: ProjectUpdatedEvent
  ): Promise<void> {
    try {
      await this.realtimeEventService.publishEvent({
        id: event.eventId,
        type: 'project_updated',
        entityType: 'project',
        entityId: event.projectId.value,
        userId: event.updatedById.value,
        action: 'updated',
        payload: event.changes,
        timestamp: event.occurredOn,
        workspaceId: event.workspaceId.value,
        projectId: event.projectId.value,
      });

      this.logger.info('Project updated event broadcasted', {
        projectId: event.projectId.value,
        updatedBy: event.updatedById.value,
        changes: Object.keys(event.changes),
      });
    } catch (error) {
      this.logger.error(
        'Failed to handle project updated event',
        error as Error,
        {
          projectId: event.projectId.value,
          eventId: event.eventId,
        }
      );
    }
  }

  // Workspace event handlers
  private async handleWorkspaceCreated(
    event: WorkspaceCreatedEvent
  ): Promise<void> {
    try {
      await this.realtimeEventService.publishEvent({
        id: event.eventId,
        type: 'workspace_created',
        entityType: 'workspace',
        entityId: event.workspaceId.value,
        userId: event.ownerId.value,
        action: 'created',
        payload: {
          name: event.name,
          description: event.description,
          createdAt: event.occurredOn,
        },
        timestamp: event.occurredOn,
        workspaceId: event.workspaceId.value,
      });

      this.logger.info('Workspace created event broadcasted', {
        workspaceId: event.workspaceId.value,
        ownerId: event.ownerId.value,
      });
    } catch (error) {
      this.logger.error(
        'Failed to handle workspace created event',
        error as Error,
        {
          workspaceId: event.workspaceId.value,
          eventId: event.eventId,
        }
      );
    }
  }

  private async handleWorkspaceMemberAdded(
    event: WorkspaceMemberAddedEvent
  ): Promise<void> {
    try {
      await this.realtimeEventService.publishEvent({
        id: event.eventId,
        type: 'workspace_member_added',
        entityType: 'workspace',
        entityId: event.workspaceId.value,
        userId: event.addedById.value,
        action: 'updated',
        payload: {
          memberId: event.memberId.value,
          role: event.role,
          addedAt: event.occurredOn,
        },
        timestamp: event.occurredOn,
        workspaceId: event.workspaceId.value,
      });

      this.logger.info('Workspace member added event broadcasted', {
        workspaceId: event.workspaceId.value,
        memberId: event.memberId.value,
        addedBy: event.addedById.value,
      });
    } catch (error) {
      this.logger.error(
        'Failed to handle workspace member added event',
        error as Error,
        {
          workspaceId: event.workspaceId.value,
          eventId: event.eventId,
        }
      );
    }
  }

  /**
   * Public methods for manual broadcasting (for use by controllers)
   */
  async broadcastTaskUpdate(taskId: string, updateData: any): Promise<void> {
    const message = {
      type: 'task_update',
      payload: {
        taskId,
        ...updateData,
      },
      timestamp: new Date().toISOString(),
      messageId: `manual_${Date.now()}`,
    };

    this.webSocketHandler.broadcastToChannel(`task:${taskId}`, message);
    this.webSocketHandler.broadcastToChannel(
      `project:${updateData.projectId}`,
      message
    );
  }

  async broadcastProjectUpdate(
    projectId: string,
    updateData: any
  ): Promise<void> {
    const message = {
      type: 'project_update',
      payload: {
        projectId,
        ...updateData,
      },
      timestamp: new Date().toISOString(),
      messageId: `manual_${Date.now()}`,
    };

    this.webSocketHandler.broadcastToChannel(`project:${projectId}`, message);
    this.webSocketHandler.broadcastToChannel(
      `workspace:${updateData.workspaceId}`,
      message
    );
  }

  async broadcastUserPresence(
    userId: string,
    status: string,
    metadata?: any
  ): Promise<void> {
    await this.realtimeEventService.publishUserPresenceUpdate(
      userId,
      status,
      metadata
    );
  }

  async notifyUser(userId: string, notification: any): Promise<void> {
    const message = {
      type: 'notification',
      payload: notification,
      timestamp: new Date().toISOString(),
      messageId: `notification_${Date.now()}`,
    };

    this.webSocketHandler.broadcastToUser(userId, message);
  }

  /**
   * Get WebSocket statistics and connection info
   */
  getConnectionStats() {
    return this.webSocketHandler.getConnectionStats();
  }

  getConnectedUsers(): string[] {
    return this.webSocketHandler.getConnectedUsers();
  }

  isUserConnected(userId: string): boolean {
    return this.webSocketHandler.isUserConnected(userId);
  }
}
