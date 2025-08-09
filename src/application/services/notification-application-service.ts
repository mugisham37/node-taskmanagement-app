import { DomainEventPublisher } from '../../domain/events/domain-event-publisher';
import { LoggingService } from '../../infrastructure/monitoring/logging-service';
import { EmailService } from '../../infrastructure/external-services/email-service';
import { CacheService } from '../../infrastructure/caching/cache-service';
import { ITaskRepository } from '../../domain/repositories/task-repository';
import { IUserRepository } from '../../domain/repositories/user-repository';
import { IProjectRepository } from '../../domain/repositories/project-repository';
import { TaskId } from '../../domain/value-objects/task-id';
import { ProjectId } from '../../domain/value-objects/project-id';
import { UserId } from '../../domain/value-objects/user-id';
import { WorkspaceId } from '../../domain/value-objects/workspace-id';
import {
  TaskCreatedEvent,
  TaskAssignedEvent,
  TaskCompletedEvent,
  TaskStatusChangedEvent,
} from '../../domain/events/task-events';
import {
  ProjectCreatedEvent,
  ProjectMemberAddedEvent,
  ProjectMemberRemovedEvent,
} from '../../domain/events/project-events';
import {
  WorkspaceCreatedEvent,
  UserInvitedToWorkspaceEvent,
} from '../../domain/events/workspace-events';

export interface NotificationPreferences {
  emailNotifications: boolean;
  taskAssignments: boolean;
  taskCompletions: boolean;
  projectUpdates: boolean;
  workspaceInvitations: boolean;
  dailyDigest: boolean;
  weeklyReport: boolean;
}

export interface NotificationDto {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: Date;
  data?: Record<string, any>;
}

export class NotificationApplicationService {
  constructor(
    private readonly taskRepository: ITaskRepository,
    private readonly userRepository: IUserRepository,
    private readonly projectRepository: IProjectRepository,
    private readonly emailService: EmailService,
    private readonly cacheService: CacheService,
    private readonly eventPublisher: DomainEventPublisher,
    private readonly logger: LoggingService
  ) {
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Task event handlers
    this.eventPublisher.subscribe(
      TaskCreatedEvent,
      this.handleTaskCreated.bind(this)
    );
    this.eventPublisher.subscribe(
      TaskAssignedEvent,
      this.handleTaskAssigned.bind(this)
    );
    this.eventPublisher.subscribe(
      TaskCompletedEvent,
      this.handleTaskCompleted.bind(this)
    );
    this.eventPublisher.subscribe(
      TaskStatusChangedEvent,
      this.handleTaskStatusChanged.bind(this)
    );

    // Project event handlers
    this.eventPublisher.subscribe(
      ProjectCreatedEvent,
      this.handleProjectCreated.bind(this)
    );
    this.eventPublisher.subscribe(
      ProjectMemberAddedEvent,
      this.handleProjectMemberAdded.bind(this)
    );
    this.eventPublisher.subscribe(
      ProjectMemberRemovedEvent,
      this.handleProjectMemberRemoved.bind(this)
    );

    // Workspace event handlers
    this.eventPublisher.subscribe(
      WorkspaceCreatedEvent,
      this.handleWorkspaceCreated.bind(this)
    );
    this.eventPublisher.subscribe(
      UserInvitedToWorkspaceEvent,
      this.handleUserInvitedToWorkspace.bind(this)
    );
  }

  // Event handlers
  private async handleTaskCreated(event: TaskCreatedEvent): Promise<void> {
    try {
      const task = await this.taskRepository.findById(event.taskId);
      const project = await this.projectRepository.findById(event.projectId);

      if (!task || !project) return;

      // Notify project members about new task
      const projectMembers = await this.projectRepository.getProjectMembers(
        event.projectId
      );

      for (const member of projectMembers) {
        if (!member.id.equals(event.createdById)) {
          await this.createNotification({
            userId: member.id,
            type: 'TASK_CREATED',
            title: 'New Task Created',
            message: `A new task "${task.title}" was created in project "${project.name}"`,
            data: {
              taskId: event.taskId.value,
              projectId: event.projectId.value,
              createdById: event.createdById.value,
            },
          });
        }
      }

      this.logger.info('Task created notifications sent', {
        taskId: event.taskId.value,
      });
    } catch (error) {
      this.logger.error('Failed to handle task created event', error as Error, {
        event,
      });
    }
  }

  private async handleTaskAssigned(event: TaskAssignedEvent): Promise<void> {
    try {
      const task = await this.taskRepository.findById(event.taskId);
      const assignee = await this.userRepository.findById(event.assigneeId);
      const assigner = await this.userRepository.findById(event.assignedBy);

      if (!task || !assignee || !assigner) return;

      // Create in-app notification
      await this.createNotification({
        userId: event.assigneeId,
        type: 'TASK_ASSIGNED',
        title: 'Task Assigned to You',
        message: `You have been assigned to task "${task.title}" by ${assigner.name}`,
        data: {
          taskId: event.taskId.value,
          assignedBy: event.assignedBy.value,
        },
      });

      // Send email notification if user preferences allow
      const preferences = await this.getUserNotificationPreferences(
        event.assigneeId
      );
      if (preferences.emailNotifications && preferences.taskAssignments) {
        await this.emailService.sendTaskAssignmentNotification(task, assignee);
      }

      this.logger.info('Task assignment notifications sent', {
        taskId: event.taskId.value,
        assigneeId: event.assigneeId.value,
      });
    } catch (error) {
      this.logger.error(
        'Failed to handle task assigned event',
        error as Error,
        { event }
      );
    }
  }

  private async handleTaskCompleted(event: TaskCompletedEvent): Promise<void> {
    try {
      const task = await this.taskRepository.findById(event.taskId);
      const completedByUser = await this.userRepository.findById(
        event.completedBy
      );
      const project = await this.projectRepository.findById(task?.projectId!);

      if (!task || !completedByUser || !project) return;

      // Notify project manager and members
      const projectMembers = await this.projectRepository.getProjectMembers(
        task.projectId
      );

      for (const member of projectMembers) {
        if (!member.id.equals(event.completedBy)) {
          await this.createNotification({
            userId: member.id,
            type: 'TASK_COMPLETED',
            title: 'Task Completed',
            message: `Task "${task.title}" was completed by ${completedByUser.name}`,
            data: {
              taskId: event.taskId.value,
              completedBy: event.completedBy.value,
              completedAt: event.completedAt.toISOString(),
            },
          });

          // Send email notification if preferences allow
          const preferences = await this.getUserNotificationPreferences(
            member.id
          );
          if (preferences.emailNotifications && preferences.taskCompletions) {
            await this.emailService.sendTaskCompletionNotification(
              task,
              completedByUser
            );
          }
        }
      }

      this.logger.info('Task completion notifications sent', {
        taskId: event.taskId.value,
      });
    } catch (error) {
      this.logger.error(
        'Failed to handle task completed event',
        error as Error,
        { event }
      );
    }
  }

  private async handleTaskStatusChanged(
    event: TaskStatusChangedEvent
  ): Promise<void> {
    try {
      const task = await this.taskRepository.findById(event.taskId);
      if (!task) return;

      // Notify assignee if task status changed
      if (task.assigneeId && !task.assigneeId.equals(event.changedBy)) {
        await this.createNotification({
          userId: task.assigneeId,
          type: 'TASK_STATUS_CHANGED',
          title: 'Task Status Updated',
          message: `Status of task "${task.title}" changed to ${event.newStatus.value}`,
          data: {
            taskId: event.taskId.value,
            oldStatus: event.oldStatus.value,
            newStatus: event.newStatus.value,
            changedBy: event.changedBy.value,
          },
        });
      }

      this.logger.info('Task status change notification sent', {
        taskId: event.taskId.value,
      });
    } catch (error) {
      this.logger.error(
        'Failed to handle task status changed event',
        error as Error,
        { event }
      );
    }
  }

  private async handleProjectCreated(
    event: ProjectCreatedEvent
  ): Promise<void> {
    try {
      const project = await this.projectRepository.findById(event.projectId);
      if (!project) return;

      // Notify workspace members about new project
      // This would require workspace member lookup in a real implementation

      this.logger.info('Project created notification handled', {
        projectId: event.projectId.value,
      });
    } catch (error) {
      this.logger.error(
        'Failed to handle project created event',
        error as Error,
        { event }
      );
    }
  }

  private async handleProjectMemberAdded(
    event: ProjectMemberAddedEvent
  ): Promise<void> {
    try {
      const project = await this.projectRepository.findById(event.projectId);
      const newMember = await this.userRepository.findById(event.memberId);

      if (!project || !newMember) return;

      // Welcome notification for new member
      await this.createNotification({
        userId: event.memberId,
        type: 'PROJECT_MEMBER_ADDED',
        title: 'Added to Project',
        message: `You have been added to project "${project.name}" with role ${event.role.value}`,
        data: {
          projectId: event.projectId.value,
          role: event.role.value,
          addedBy: event.addedBy.value,
        },
      });

      this.logger.info('Project member added notification sent', {
        projectId: event.projectId.value,
        memberId: event.memberId.value,
      });
    } catch (error) {
      this.logger.error(
        'Failed to handle project member added event',
        error as Error,
        { event }
      );
    }
  }

  private async handleProjectMemberRemoved(
    event: ProjectMemberRemovedEvent
  ): Promise<void> {
    try {
      // Handle member removal notification if needed
      this.logger.info('Project member removed notification handled', {
        projectId: event.projectId.value,
        memberId: event.memberId.value,
      });
    } catch (error) {
      this.logger.error(
        'Failed to handle project member removed event',
        error as Error,
        { event }
      );
    }
  }

  private async handleWorkspaceCreated(
    event: WorkspaceCreatedEvent
  ): Promise<void> {
    try {
      // Handle workspace creation notification if needed
      this.logger.info('Workspace created notification handled', {
        workspaceId: event.workspaceId.value,
      });
    } catch (error) {
      this.logger.error(
        'Failed to handle workspace created event',
        error as Error,
        { event }
      );
    }
  }

  private async handleUserInvitedToWorkspace(
    event: UserInvitedToWorkspaceEvent
  ): Promise<void> {
    try {
      // Send workspace invitation email
      await this.emailService.sendWorkspaceInvitation({
        recipientEmail: event.inviteeEmail,
        workspaceName: 'Workspace', // Would be fetched from workspace repository
        inviterName: 'User', // Would be fetched from user repository
        invitationLink: `${process.env.APP_URL}/workspaces/${event.workspaceId.value}/join`,
      });

      this.logger.info('Workspace invitation sent', {
        workspaceId: event.workspaceId.value,
        inviteeEmail: event.inviteeEmail,
      });
    } catch (error) {
      this.logger.error(
        'Failed to handle user invited to workspace event',
        error as Error,
        { event }
      );
    }
  }

  // Notification management
  private async createNotification(
    notification: Omit<NotificationDto, 'id' | 'isRead' | 'createdAt'>
  ): Promise<void> {
    const notificationData: NotificationDto = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      isRead: false,
      createdAt: new Date(),
      ...notification,
    };

    // In a real implementation, this would save to a notifications table
    // For now, we'll cache it
    const cacheKey = `notifications:${notification.userId}`;
    const existingNotifications =
      (await this.cacheService.get<NotificationDto[]>(cacheKey)) || [];
    existingNotifications.unshift(notificationData);

    // Keep only the latest 100 notifications
    const limitedNotifications = existingNotifications.slice(0, 100);
    await this.cacheService.set(cacheKey, limitedNotifications, 86400); // 24 hours
  }

  async getUserNotifications(
    userId: UserId,
    limit: number = 20
  ): Promise<NotificationDto[]> {
    const cacheKey = `notifications:${userId.value}`;
    const notifications =
      (await this.cacheService.get<NotificationDto[]>(cacheKey)) || [];
    return notifications.slice(0, limit);
  }

  async markNotificationAsRead(
    userId: UserId,
    notificationId: string
  ): Promise<void> {
    const cacheKey = `notifications:${userId.value}`;
    const notifications =
      (await this.cacheService.get<NotificationDto[]>(cacheKey)) || [];

    const notification = notifications.find(n => n.id === notificationId);
    if (notification) {
      notification.isRead = true;
      await this.cacheService.set(cacheKey, notifications, 86400);
    }
  }

  async getUserNotificationPreferences(
    userId: UserId
  ): Promise<NotificationPreferences> {
    const cacheKey = `notification-preferences:${userId.value}`;
    const preferences =
      await this.cacheService.get<NotificationPreferences>(cacheKey);

    if (preferences) {
      return preferences;
    }

    // Default preferences
    const defaultPreferences: NotificationPreferences = {
      emailNotifications: true,
      taskAssignments: true,
      taskCompletions: true,
      projectUpdates: true,
      workspaceInvitations: true,
      dailyDigest: false,
      weeklyReport: false,
    };

    await this.cacheService.set(cacheKey, defaultPreferences, 86400);
    return defaultPreferences;
  }

  async updateUserNotificationPreferences(
    userId: UserId,
    preferences: Partial<NotificationPreferences>
  ): Promise<void> {
    const cacheKey = `notification-preferences:${userId.value}`;
    const currentPreferences =
      await this.getUserNotificationPreferences(userId);

    const updatedPreferences = { ...currentPreferences, ...preferences };
    await this.cacheService.set(cacheKey, updatedPreferences, 86400);

    this.logger.info('User notification preferences updated', {
      userId: userId.value,
    });
  }

  // Digest notifications
  async sendDailyDigest(userId: UserId): Promise<void> {
    try {
      const preferences = await this.getUserNotificationPreferences(userId);
      if (!preferences.dailyDigest || !preferences.emailNotifications) {
        return;
      }

      const user = await this.userRepository.findById(userId);
      if (!user) return;

      // Get today's notifications
      const notifications = await this.getUserNotifications(userId, 50);
      const todayNotifications = notifications.filter(
        n => n.createdAt >= new Date(Date.now() - 24 * 60 * 60 * 1000)
      );

      if (todayNotifications.length > 0) {
        await this.emailService.sendDailyDigest(user, todayNotifications);
        this.logger.info('Daily digest sent', { userId: userId.value });
      }
    } catch (error) {
      this.logger.error('Failed to send daily digest', error as Error, {
        userId: userId.value,
      });
    }
  }
}
