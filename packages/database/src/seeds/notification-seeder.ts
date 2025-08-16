import {
  Notification,
  NotificationChannel,
  NotificationId,
  NotificationType,
  ProjectId,
  TaskId,
  UserId,
  WorkspaceId,
} from '@taskmanagement/domain';
import { DatabaseConnection } from '../connection';
import { NotificationRepository } from '../repositories/notification-repository';

export class NotificationSeeder {
  private notificationRepository: NotificationRepository;

  constructor(_connection: DatabaseConnection) {
    this.notificationRepository = new NotificationRepository();
  }

  async seed(
    userIds: string[],
    workspaceIds: string[],
    projectIds: string[],
    taskIds: string[],
    count: number = 100
  ): Promise<Notification[]> {
    const notifications: Notification[] = [];

    const notificationTypes = Object.values(NotificationType);
    const channels = Object.values(NotificationChannel);

    const sampleTitles = [
      'Task assigned to you',
      'Project deadline approaching',
      'New comment on your task',
      'Task completed',
      'Meeting reminder',
      'Workspace invitation',
      'Project update',
      'System maintenance',
      'New team member joined',
      'File uploaded',
    ];

    const sampleMessages = [
      'You have been assigned a new task. Please review and start working on it.',
      'The project deadline is approaching in 2 days. Please ensure all tasks are completed.',
      'A new comment has been added to your task. Please check and respond if needed.',
      'Great job! The task has been marked as completed.',
      'You have a meeting scheduled in 30 minutes. Please join on time.',
      'You have been invited to join a new workspace. Accept the invitation to get started.',
      'The project has been updated with new requirements. Please review the changes.',
      'System maintenance is scheduled for tonight. Some features may be unavailable.',
      'A new team member has joined your workspace. Welcome them to the team!',
      'A new file has been uploaded to your project. Check it out when you have time.',
    ];

    for (let i = 0; i < count; i++) {
      const userId = userIds[Math.floor(Math.random() * userIds.length)]!;
      const workspaceId = workspaceIds[Math.floor(Math.random() * workspaceIds.length)]!;
      const type = notificationTypes[Math.floor(Math.random() * notificationTypes.length)]!;
      const title = sampleTitles[Math.floor(Math.random() * sampleTitles.length)]!;
      const message = sampleMessages[Math.floor(Math.random() * sampleMessages.length)]!;

      // Randomly select notification channels
      const shuffledChannels = [...channels].sort(() => 0.5 - Math.random());
      const notificationChannels = shuffledChannels.slice(0, Math.floor(Math.random() * 3) + 1);

      // Randomly assign related entities based on notification type
      let projectId: string | undefined;
      let taskId: string | undefined;

      switch (type) {
        case NotificationType.TASK_ASSIGNED:
        case NotificationType.TASK_COMPLETED:
        case NotificationType.TASK_DUE_SOON:
        case NotificationType.TASK_OVERDUE:
          taskId = taskIds[Math.floor(Math.random() * taskIds.length)];
          projectId = projectIds[Math.floor(Math.random() * projectIds.length)];
          break;
        case NotificationType.PROJECT_CREATED:
        case NotificationType.PROJECT_UPDATED:
          projectId = projectIds[Math.floor(Math.random() * projectIds.length)];
          break;
        case NotificationType.COMMENT_ADDED:
        case NotificationType.MENTION:
          taskId = taskIds[Math.floor(Math.random() * taskIds.length)];
          projectId = projectIds[Math.floor(Math.random() * projectIds.length)];
          break;
      }

      const notification = Notification.create(
        NotificationId.create(crypto.randomUUID()),
        UserId.create(userId),
        type,
        title,
        message,
        notificationChannels,
        workspaceId ? WorkspaceId.create(workspaceId) : undefined,
        projectId ? ProjectId.create(projectId) : undefined,
        taskId ? TaskId.create(taskId) : undefined,
        {
          source: 'seeder',
          category: type,
          timestamp: new Date().toISOString(),
        }
      );

      notifications.push(notification);
    }

    // Save notifications in batches
    const batchSize = 50;
    for (let i = 0; i < notifications.length; i += batchSize) {
      const batch = notifications.slice(i, i + batchSize);
      await Promise.all(
        batch.map((notification) => this.notificationRepository.save(notification))
      );
    }

    console.log(`Seeded ${notifications.length} notifications`);
    return notifications;
  }

  async getExistingNotifications(): Promise<Notification[]> {
    // This would need to be implemented based on your repository's findAll method
    return [];
  }
}
