import { TransactionManager } from '@taskmanagement/database';
import { DomainEventPublisher } from '../../domain/events/domain-event-publisher';
import { IProjectRepository } from '../../domain/repositories/project-repository';
import { IUserRepository } from '../../domain/repositories/user-repository';
import { IWorkspaceRepository } from '../../domain/repositories/workspace-repository';
import { ProjectDomainService } from '../../domain/services/project-domain-service';
import { ProjectId } from '../../domain/value-objects/project-id';
import { LoggingService } from '../../infrastructure/monitoring/logging-service';
import { AuthorizationError } from '../../shared/errors/authorization-error';
import { NotFoundError } from '../../shared/errors/not-found-error';
import {
  AddProjectMemberCommand,
  ArchiveProjectCommand,
  CreateProjectCommand,
  RemoveProjectMemberCommand,
  RestoreProjectCommand,
  UpdateProjectCommand,
  UpdateProjectMemberRoleCommand,
  UpdateProjectStatusCommand,
} from '../commands/project-commands';
import { BaseHandler, ICommandHandler } from './base-handler';

export class CreateProjectCommandHandler
  extends BaseHandler
  implements ICommandHandler<CreateProjectCommand, ProjectId>
{
  constructor(
    eventPublisher: DomainEventPublisher,
    logger: LoggingService,
    private readonly projectRepository: IProjectRepository,
    private readonly workspaceRepository: IWorkspaceRepository,
    private readonly projectDomainService: ProjectDomainService,
    private readonly transactionManager: TransactionManager
  ) {
    super(eventPublisher, logger);
  }

  async handle(command: CreateProjectCommand): Promise<ProjectId> {
    this.logInfo('Creating project', { command });

    return await this.transactionManager.executeInTransaction(async () => {
      try {
        // Verify workspace exists and user has permission
        const workspace = await this.workspaceRepository.findById(command.workspaceId);
        if (!workspace) {
          throw new NotFoundError(`Workspace with ID ${command.workspaceId.value} not found`);
        }

        if (!workspace.canUserCreateProject(command.userId)) {
          throw new AuthorizationError(
            'User does not have permission to create projects in this workspace'
          );
        }

        // Create project through domain service
        const project = await this.projectDomainService.createProject({
          name: command.name,
          description: command.description,
          workspaceId: command.workspaceId,
          managerId: command.managerId,
          ...(command.startDate && { startDate: command.startDate }),
          ...(command.endDate && { endDate: command.endDate }),
        });

        await this.projectRepository.save(project);
        await this.publishEvents();

        this.logInfo('Project created successfully', {
          projectId: project.id.value,
        });
        return project.id;
      } catch (error) {
        this.logError('Failed to create project', error as Error, { command });
        throw error;
      }
    });
  }
}

export class UpdateProjectCommandHandler
  extends BaseHandler
  implements ICommandHandler<UpdateProjectCommand, void>
{
  constructor(
    eventPublisher: DomainEventPublisher,
    logger: LoggingService,
    private readonly projectRepository: IProjectRepository,
    private readonly projectDomainService: ProjectDomainService,
    private readonly transactionManager: TransactionManager
  ) {
    super(eventPublisher, logger);
  }

  async handle(command: UpdateProjectCommand): Promise<void> {
    this.logInfo('Updating project', { command });

    return await this.transactionManager.executeInTransaction(async () => {
      try {
        const project = await this.projectRepository.findById(command.projectId);
        if (!project) {
          throw new NotFoundError(`Project with ID ${command.projectId.value} not found`);
        }

        if (!this.projectDomainService.canUserUpdateProject(project, command.userId)) {
          throw new AuthorizationError('User does not have permission to update this project');
        }

        // Update project properties
        if (command.name !== undefined) {
          project.updateName(command.name);
        }
        if (command.description !== undefined) {
          project.updateDescription(command.description);
        }
        if (command.startDate !== undefined) {
          project.updateStartDate(command.startDate);
        }
        if (command.endDate !== undefined) {
          project.updateEndDate(command.endDate);
        }

        await this.projectRepository.save(project);
        await this.publishEvents();

        this.logInfo('Project updated successfully', {
          projectId: project.id.value,
        });
      } catch (error) {
        this.logError('Failed to update project', error as Error, { command });
        throw error;
      }
    });
  }
}

export class AddProjectMemberCommandHandler
  extends BaseHandler
  implements ICommandHandler<AddProjectMemberCommand, void>
{
  constructor(
    eventPublisher: DomainEventPublisher,
    logger: LoggingService,
    private readonly projectRepository: IProjectRepository,
    private readonly userRepository: IUserRepository,
    private readonly projectDomainService: ProjectDomainService,
    private readonly transactionManager: TransactionManager
  ) {
    super(eventPublisher, logger);
  }

  async handle(command: AddProjectMemberCommand): Promise<void> {
    this.logInfo('Adding project member', { command });

    return await this.transactionManager.executeInTransaction(async () => {
      try {
        const project = await this.projectRepository.findById(command.projectId);
        if (!project) {
          throw new NotFoundError(`Project with ID ${command.projectId.value} not found`);
        }

        const member = await this.userRepository.findById(command.memberId);
        if (!member) {
          throw new NotFoundError(`User with ID ${command.memberId.value} not found`);
        }

        // Add member through domain service
        await this.projectDomainService.addProjectMember(
          project,
          command.addedBy,
          command.memberId,
          command.role
        );

        await this.projectRepository.save(project);
        await this.publishEvents();

        this.logInfo('Project member added successfully', {
          projectId: project.id.value,
          memberId: command.memberId.value,
          role: command.role,
        });
      } catch (error) {
        this.logError('Failed to add project member', error as Error, {
          command,
        });
        throw error;
      }
    });
  }
}

export class RemoveProjectMemberCommandHandler
  extends BaseHandler
  implements ICommandHandler<RemoveProjectMemberCommand, void>
{
  constructor(
    eventPublisher: DomainEventPublisher,
    logger: LoggingService,
    private readonly projectRepository: IProjectRepository,
    private readonly projectDomainService: ProjectDomainService,
    private readonly transactionManager: TransactionManager
  ) {
    super(eventPublisher, logger);
  }

  async handle(command: RemoveProjectMemberCommand): Promise<void> {
    this.logInfo('Removing project member', { command });

    return await this.transactionManager.executeInTransaction(async () => {
      try {
        const project = await this.projectRepository.findById(command.projectId);
        if (!project) {
          throw new NotFoundError(`Project with ID ${command.projectId.value} not found`);
        }

        // Remove member through domain service
        await this.projectDomainService.removeProjectMember(
          project,
          command.removedBy,
          command.memberId
        );

        await this.projectRepository.save(project);
        await this.publishEvents();

        this.logInfo('Project member removed successfully', {
          projectId: project.id.value,
          memberId: command.memberId.value,
        });
      } catch (error) {
        this.logError('Failed to remove project member', error as Error, {
          command,
        });
        throw error;
      }
    });
  }
}

export class UpdateProjectMemberRoleCommandHandler
  extends BaseHandler
  implements ICommandHandler<UpdateProjectMemberRoleCommand, void>
{
  constructor(
    eventPublisher: DomainEventPublisher,
    logger: LoggingService,
    private readonly projectRepository: IProjectRepository,
    private readonly projectDomainService: ProjectDomainService,
    private readonly transactionManager: TransactionManager
  ) {
    super(eventPublisher, logger);
  }

  async handle(command: UpdateProjectMemberRoleCommand): Promise<void> {
    this.logInfo('Updating project member role', { command });

    return await this.transactionManager.executeInTransaction(async () => {
      try {
        const project = await this.projectRepository.findById(command.projectId);
        if (!project) {
          throw new NotFoundError(`Project with ID ${command.projectId.value} not found`);
        }

        // Update member role through domain service
        await this.projectDomainService.updateProjectMemberRole(
          project,
          command.updatedBy,
          command.memberId,
          command.newRole
        );

        await this.projectRepository.save(project);
        await this.publishEvents();

        this.logInfo('Project member role updated successfully', {
          projectId: project.id.value,
          memberId: command.memberId.value,
          newRole: command.newRole,
        });
      } catch (error) {
        this.logError('Failed to update project member role', error as Error, {
          command,
        });
        throw error;
      }
    });
  }
}

export class ArchiveProjectCommandHandler
  extends BaseHandler
  implements ICommandHandler<ArchiveProjectCommand, void>
{
  constructor(
    eventPublisher: DomainEventPublisher,
    logger: LoggingService,
    private readonly projectRepository: IProjectRepository,
    private readonly projectDomainService: ProjectDomainService,
    private readonly transactionManager: TransactionManager
  ) {
    super(eventPublisher, logger);
  }

  async handle(command: ArchiveProjectCommand): Promise<void> {
    this.logInfo('Archiving project', { command });

    return await this.transactionManager.executeInTransaction(async () => {
      try {
        const project = await this.projectRepository.findById(command.projectId);
        if (!project) {
          throw new NotFoundError(`Project with ID ${command.projectId.value} not found`);
        }

        // Archive project through domain service
        await this.projectDomainService.archiveProject(project, command.archivedBy);

        await this.projectRepository.save(project);
        await this.publishEvents();

        this.logInfo('Project archived successfully', {
          projectId: project.id.value,
        });
      } catch (error) {
        this.logError('Failed to archive project', error as Error, { command });
        throw error;
      }
    });
  }
}

export class RestoreProjectCommandHandler
  extends BaseHandler
  implements ICommandHandler<RestoreProjectCommand, void>
{
  constructor(
    eventPublisher: DomainEventPublisher,
    logger: LoggingService,
    private readonly projectRepository: IProjectRepository,
    private readonly projectDomainService: ProjectDomainService,
    private readonly transactionManager: TransactionManager
  ) {
    super(eventPublisher, logger);
  }

  async handle(command: RestoreProjectCommand): Promise<void> {
    this.logInfo('Restoring project', { command });

    return await this.transactionManager.executeInTransaction(async () => {
      try {
        const project = await this.projectRepository.findById(command.projectId);
        if (!project) {
          throw new NotFoundError(`Project with ID ${command.projectId.value} not found`);
        }

        // Restore project through domain service
        await this.projectDomainService.restoreProject(project, command.restoredBy);

        await this.projectRepository.save(project);
        await this.publishEvents();

        this.logInfo('Project restored successfully', {
          projectId: project.id.value,
        });
      } catch (error) {
        this.logError('Failed to restore project', error as Error, { command });
        throw error;
      }
    });
  }
}

export class UpdateProjectStatusCommandHandler
  extends BaseHandler
  implements ICommandHandler<UpdateProjectStatusCommand, void>
{
  constructor(
    eventPublisher: DomainEventPublisher,
    logger: LoggingService,
    private readonly projectRepository: IProjectRepository,
    private readonly projectDomainService: ProjectDomainService,
    private readonly transactionManager: TransactionManager
  ) {
    super(eventPublisher, logger);
  }

  async handle(command: UpdateProjectStatusCommand): Promise<void> {
    this.logInfo('Updating project status', { command });

    return await this.transactionManager.executeInTransaction(async () => {
      try {
        const project = await this.projectRepository.findById(command.projectId);
        if (!project) {
          throw new NotFoundError(`Project with ID ${command.projectId.value} not found`);
        }

        // Update status through domain service
        await this.projectDomainService.updateProjectStatus(
          project,
          command.updatedBy,
          command.status
        );

        await this.projectRepository.save(project);
        await this.publishEvents();

        this.logInfo('Project status updated successfully', {
          projectId: project.id.value,
          newStatus: command.status,
        });
      } catch (error) {
        this.logError('Failed to update project status', error as Error, {
          command,
        });
        throw error;
      }
    });
  }
}

// Export aliases for backward compatibility
export const CreateProjectHandler = CreateProjectCommandHandler;
export const UpdateProjectHandler = UpdateProjectCommandHandler;
export const AddProjectMemberHandler = AddProjectMemberCommandHandler;
export const RemoveProjectMemberHandler = RemoveProjectMemberCommandHandler;
