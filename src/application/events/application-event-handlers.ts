import { IEventHandler } from './event-bus';
import { LoggingService } from '../../infrastructure/monitoring/logging-service';
import { EmailService } from '../../infrastructure/external-services/email-service';
import { CacheService } from '../../infrastructure/caching/cache-service';
import { IUserRepository } from '../../domain/repositories/user-repository';
import { ITaskRepository } from '../../domain/repositories/task-repository';
import { IProjectRepository } from '../../domain/repositories/project-repository';
import {
  TaskCreatedEvent,
  TaskAssignedEvent,
  TaskCompletedEvent,
  TaskStatusChangedEvent,
} from '../../domain/events/task-events';
import {
  ProjectCreatedEvent,
  ProjectMemberAddedEvent,
} from '../../domain/events/project-events';
import {
  UserRegisteredEvent,
  UserActivatedEvent,
} from '../../domain/events/user-events';

export class TaskCreatedEventHandler
  implements IEventHandler<TaskCreatedEvent>
{
  constructor(
    private readonly taskRepository: ITaskRepository,
    private readonly projectRepository: IProjectRepository,
    private readonly userRepository: IUserRepository,
    private readonly emailService: EmailService,
    private readonly cacheService: CacheService,
    private readonly logger: LoggingService
  ) {}

  async handle(event: TaskCreatedEvent): Promise<void> {
    this.logger.info('Handling TaskCreatedEvent', {
      taskId: event.taskId.value,
    });

    try {
      // Invalidate project task caches
      await this.cacheService.invalidatePattern(
        `tasks:project:${event.projectId.value}:*`
      );
      await this.cacheService.invalidatePattern('task-stats:*');

      // Send notifications to project members
      const project = await this.projectRepository.findById(event.projectId);
      if (project) {
        const members = await this.projectRepository.getProjectMembers(
          event.projectId
        );

        for (const member of members) {
          if (!member.id.equals(event.createdById)) {
            // In a real implementation, this would create in-app notifications
            this.logger.info('Task creation notification queued', {
              taskId: event.taskId.value,
              memberId: member.id.value,
            });
          }
        }
      }

      this.logger.info('TaskCreatedEvent handled successfully', {
        taskId: event.taskId.value,
      });
    } catch (error) {
      this.logger.error('Failed to handle TaskCreatedEvent', error as Error, {
        taskId: event.taskId.value,
      });
      throw error;
    }
  }
}

export class TaskAssignedEventHandler
  implements IEventHandler<TaskAssignedEvent>
{
  constructor(
    private readonly taskRepository: ITaskRepository,
    private readonly userRepository: IUserRepository,
    private readonly emailService: EmailService,
    private readonly cacheService: CacheService,
    private readonly logger: LoggingService
  ) {}

  async handle(event: TaskAssignedEvent): Promise<void> {
    this.logger.info('Handling TaskAssignedEvent', {
      taskId: event.taskId.value,
      assigneeId: event.assigneeId.value,
    });

    try {
      // Invalidate assignee task caches
      await this.cacheService.invalidatePattern(
        `tasks:assignee:${event.assigneeId.value}:*`
      );
      await this.cacheService.invalidatePattern('task-stats:*');

      // Send assignment notification
      const task = await this.taskRepository.findById(event.taskId);
      const assignee = await this.userRepository.findById(event.assigneeId);

      if (task && assignee) {
        await this.emailService.sendTaskAssignmentNotification(task, assignee);
        this.logger.info('Task assignment notification sent', {
          taskId: event.taskId.value,
          assigneeId: event.assigneeId.value,
        });
      }

      this.logger.info('TaskAssignedEvent handled successfully', {
        taskId: event.taskId.value,
        assigneeId: event.assigneeId.value,
      });
    } catch (error) {
      this.logger.error('Failed to handle TaskAssignedEvent', error as Error, {
        taskId: event.taskId.value,
        assigneeId: event.assigneeId.value,
      });
      throw error;
    }
  }
}

export class TaskCompletedEventHandler
  implements IEventHandler<TaskCompletedEvent>
{
  constructor(
    private readonly taskRepository: ITaskRepository,
    private readonly userRepository: IUserRepository,
    private readonly projectRepository: IProjectRepository,
    private readonly emailService: EmailService,
    private readonly cacheService: CacheService,
    private readonly logger: LoggingService
  ) {}

  async handle(event: TaskCompletedEvent): Promise<void> {
    this.logger.info('Handling TaskCompletedEvent', {
      taskId: event.taskId.value,
      completedBy: event.completedBy.value,
    });

    try {
      const task = await this.taskRepository.findById(event.taskId);
      if (!task) return;

      // Invalidate relevant caches
      await this.cacheService.invalidatePattern(`task:${event.taskId.value}`);
      await this.cacheService.invalidatePattern(
        `tasks:project:${task.projectId.value}:*`
      );
      if (task.assigneeId) {
        await this.cacheService.invalidatePattern(
          `tasks:assignee:${task.assigneeId.value}:*`
        );
      }
      await this.cacheService.invalidatePattern('task-stats:*');
      await this.cacheService.invalidatePattern('tasks:overdue:*');

      // Send completion notifications
      const completedByUser = await this.userRepository.findById(
        event.completedBy
      );
      const projectMembers = await this.projectRepository.getProjectMembers(
        task.projectId
      );

      if (completedByUser) {
        for (const member of projectMembers) {
          if (!member.id.equals(event.completedBy)) {
            await this.emailService.sendTaskCompletionNotification(
              task,
              completedByUser
            );
          }
        }
      }

      this.logger.info('TaskCompletedEvent handled successfully', {
        taskId: event.taskId.value,
      });
    } catch (error) {
      this.logger.error('Failed to handle TaskCompletedEvent', error as Error, {
        taskId: event.taskId.value,
      });
      throw error;
    }
  }
}

export class ProjectCreatedEventHandler
  implements IEventHandler<ProjectCreatedEvent>
{
  constructor(
    private readonly projectRepository: IProjectRepository,
    private readonly userRepository: IUserRepository,
    private readonly cacheService: CacheService,
    private readonly logger: LoggingService
  ) {}

  async handle(event: ProjectCreatedEvent): Promise<void> {
    this.logger.info('Handling ProjectCreatedEvent', {
      projectId: event.projectId.value,
    });

    try {
      // Invalidate workspace project caches
      await this.cacheService.invalidatePattern(
        `projects:workspace:${event.workspaceId.value}:*`
      );

      // Additional project creation logic can be added here
      // e.g., creating default project settings, sending welcome emails, etc.

      this.logger.info('ProjectCreatedEvent handled successfully', {
        projectId: event.projectId.value,
      });
    } catch (error) {
      this.logger.error(
        'Failed to handle ProjectCreatedEvent',
        error as Error,
        {
          projectId: event.projectId.value,
        }
      );
      throw error;
    }
  }
}

export class ProjectMemberAddedEventHandler
  implements IEventHandler<ProjectMemberAddedEvent>
{
  constructor(
    private readonly projectRepository: IProjectRepository,
    private readonly userRepository: IUserRepository,
    private readonly emailService: EmailService,
    private readonly cacheService: CacheService,
    private readonly logger: LoggingService
  ) {}

  async handle(event: ProjectMemberAddedEvent): Promise<void> {
    this.logger.info('Handling ProjectMemberAddedEvent', {
      projectId: event.projectId.value,
      memberId: event.memberId.value,
    });

    try {
      // Invalidate project member caches
      await this.cacheService.invalidatePattern(
        `project-members:${event.projectId.value}:*`
      );
      await this.cacheService.invalidatePattern(
        `projects:member:${event.memberId.value}:*`
      );

      // Send welcome email to new member
      const project = await this.projectRepository.findById(event.projectId);
      const newMember = await this.userRepository.findById(event.memberId);

      if (project && newMember) {
        await this.emailService.sendProjectMemberWelcome(
          project,
          newMember,
          event.role
        );
        this.logger.info('Project member welcome email sent', {
          projectId: event.projectId.value,
          memberId: event.memberId.value,
        });
      }

      this.logger.info('ProjectMemberAddedEvent handled successfully', {
        projectId: event.projectId.value,
        memberId: event.memberId.value,
      });
    } catch (error) {
      this.logger.error(
        'Failed to handle ProjectMemberAddedEvent',
        error as Error,
        {
          projectId: event.projectId.value,
          memberId: event.memberId.value,
        }
      );
      throw error;
    }
  }
}

export class UserRegisteredEventHandler
  implements IEventHandler<UserRegisteredEvent>
{
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly emailService: EmailService,
    private readonly logger: LoggingService
  ) {}

  async handle(event: UserRegisteredEvent): Promise<void> {
    this.logger.info('Handling UserRegisteredEvent', {
      userId: event.userId.value,
    });

    try {
      const user = await this.userRepository.findById(event.userId);
      if (user) {
        // Send welcome email
        await this.emailService.sendWelcomeEmail(user);
        this.logger.info('Welcome email sent to new user', {
          userId: event.userId.value,
        });
      }

      this.logger.info('UserRegisteredEvent handled successfully', {
        userId: event.userId.value,
      });
    } catch (error) {
      this.logger.error(
        'Failed to handle UserRegisteredEvent',
        error as Error,
        {
          userId: event.userId.value,
        }
      );
      throw error;
    }
  }
}
