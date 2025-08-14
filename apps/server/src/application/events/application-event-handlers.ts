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
  TaskStartedEvent,
} from '../../domain/events/task-events';
import {
  ProjectCreatedEvent,
  ProjectMemberAddedEvent,
} from '../../domain/events/project-events';
import {
  UserCreatedEvent,
  UserActivatedEvent,
} from '../../domain/events/user-events';

export class TaskCreatedEventHandler
  implements IEventHandler<TaskCreatedEvent>
{
  constructor(
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

        const creator = await this.userRepository.findById(event.createdById);

        for (const member of members) {
          if (!member.id.equals(event.createdById)) {
            const memberUser = await this.userRepository.findById(member.userId);
            if (memberUser && creator) {
              await this.emailService.sendTaskCreationNotification(
                memberUser.email.value,
                memberUser.name,
                event.title,
                event.description,
                project.name,
                creator.name,
                event.dueDate
              );
            }
            // In a real implementation, this would create in-app notifications
            this.logger.info('Task creation notification sent', {
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
    private readonly projectRepository: IProjectRepository,
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
        // Get the project to have context for the notification
        const project = await this.projectRepository.findById(event.projectId);
        const assignedBy = await this.userRepository.findById(event.assignedBy);
        
        await this.emailService.sendTaskAssignmentNotification(
          assignee.email.value,
          assignee.name,
          task.title,
          task.description,
          project?.name || 'Unknown Project',
          assignedBy ? assignedBy.name : 'System',
          task.dueDate || undefined
        );
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
            const memberUser = await this.userRepository.findById(member.userId);
            const project = await this.projectRepository.findById(task.projectId);
            
            if (memberUser) {
              await this.emailService.sendTaskCompletionNotification(
                memberUser.email.value,
                memberUser.name,
                task.title,
                project?.name || 'Unknown Project',
                completedByUser.name,
                event.occurredAt
              );
            }
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
      const addedByUser = await this.userRepository.findById(event.addedBy);

      if (project && newMember) {
        await this.emailService.sendProjectMemberWelcome(
          newMember.email.value,
          newMember.name,
          project.name,
          project.description,
          addedByUser ? addedByUser.name : 'System',
          event.role.toString()
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
  implements IEventHandler<UserCreatedEvent>
{
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly emailService: EmailService,
    private readonly logger: LoggingService
  ) {}

  async handle(event: UserCreatedEvent): Promise<void> {
    this.logger.info('Handling UserRegisteredEvent', {
      userId: event.userId.value,
    });

    try {
      const user = await this.userRepository.findById(event.userId);
      if (user) {
        // Send welcome email
        await this.emailService.sendWelcomeEmail(
          user.email.value,
          user.name
        );
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

export class TaskStartedEventHandler
  implements IEventHandler<TaskStartedEvent>
{
  constructor(
    private readonly taskRepository: ITaskRepository,
    private readonly projectRepository: IProjectRepository,
    private readonly userRepository: IUserRepository,
    private readonly emailService: EmailService,
    private readonly cacheService: CacheService,
    private readonly logger: LoggingService
  ) {}

  async handle(event: TaskStartedEvent): Promise<void> {
    this.logger.info('Handling TaskStartedEvent', {
      taskId: event.taskId.value,
      startedBy: event.startedBy.value,
    });

    try {
      // Invalidate task caches
      await this.cacheService.invalidatePattern(`task:${event.taskId.value}`);
      await this.cacheService.invalidatePattern(
        `tasks:project:${event.projectId.value}:*`
      );
      await this.cacheService.invalidatePattern(
        `tasks:assignee:${event.startedBy.value}:*`
      );
      await this.cacheService.invalidatePattern('task-stats:*');

      // Send notifications to project members
      const task = await this.taskRepository.findById(event.taskId);
      const startedByUser = await this.userRepository.findById(event.startedBy);
      const project = await this.projectRepository.findById(event.projectId);

      if (task && startedByUser && project) {
        const projectMembers = await this.projectRepository.getProjectMembers(
          event.projectId
        );

        for (const member of projectMembers) {
          if (!member.id.equals(event.startedBy)) {
            const memberUser = await this.userRepository.findById(member.userId);
            if (memberUser) {
              await this.emailService.sendTaskStartNotification(
                memberUser.email.value,
                memberUser.name,
                task.title,
                project.name,
                startedByUser.name,
                event.occurredAt
              );
            }
          }
        }
      }

      this.logger.info('TaskStartedEvent handled successfully', {
        taskId: event.taskId.value,
      });
    } catch (error) {
      this.logger.error('Failed to handle TaskStartedEvent', error as Error, {
        taskId: event.taskId.value,
      });
      throw error;
    }
  }
}

export class UserActivatedEventHandler
  implements IEventHandler<UserActivatedEvent>
{
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly emailService: EmailService,
    private readonly cacheService: CacheService,
    private readonly logger: LoggingService
  ) {}

  async handle(event: UserActivatedEvent): Promise<void> {
    this.logger.info('Handling UserActivatedEvent', {
      userId: event.userId.value,
    });

    try {
      // Invalidate user caches
      await this.cacheService.invalidatePattern(`user:${event.userId.value}`);
      await this.cacheService.invalidatePattern('user-stats:*');

      // Send activation confirmation email
      const user = await this.userRepository.findById(event.userId);
      if (user) {
        await this.emailService.sendUserActivationConfirmation(
          user.email.value,
          user.name
        );
        
        this.logger.info('User activation confirmation email sent', {
          userId: event.userId.value,
        });
      }

      this.logger.info('UserActivatedEvent handled successfully', {
        userId: event.userId.value,
      });
    } catch (error) {
      this.logger.error('Failed to handle UserActivatedEvent', error as Error, {
        userId: event.userId.value,
      });
      throw error;
    }
  }
}

/**
 * Application Event Handlers orchestrator service
 * This service registers and manages all application event handlers
 */
export class ApplicationEventHandlers {
  constructor(
    private readonly domainEventBus: any,
    private readonly notificationApplicationService: any,
    private readonly auditLogRepository: any
  ) {
    this.registerHandlers();
  }

  private registerHandlers(): void {
    // Register all event handlers with the domain event bus
    // This is where you would register the actual handlers
    // For now, this is a placeholder implementation
    
    // Example of how to use the services:
    if (this.domainEventBus) {
      // Register handlers with the event bus
    }
    
    if (this.notificationApplicationService) {
      // Setup notification handlers
    }
    
    if (this.auditLogRepository) {
      // Setup audit logging
    }
  }

  public initialize(): void {
    // Initialize event handlers
    this.registerHandlers();
  }
}
