import { TransactionManager } from '@taskmanagement/database';
import { DomainEventPublisher } from '../../domain/events/domain-event-publisher';
import { IUserRepository } from '../../domain/repositories/user-repository';
import { IWorkspaceRepository } from '../../domain/repositories/workspace-repository';
import { WorkspaceDomainService } from '../../domain/services/workspace-domain-service';
import { WorkspaceId } from '../../domain/value-objects/workspace-id';
import { EmailService } from '../../infrastructure/external-services/email-service';
import { LoggingService } from '../../infrastructure/monitoring/logging-service';
import { AuthorizationError } from '../../shared/errors/authorization-error';
import { NotFoundError } from '../../shared/errors/not-found-error';
import {
  ArchiveWorkspaceCommand,
  CreateWorkspaceCommand,
  InviteUserToWorkspaceCommand,
  RemoveUserFromWorkspaceCommand,
  TransferWorkspaceOwnershipCommand,
  UpdateWorkspaceCommand,
} from '../commands/workspace-commands';
import { BaseHandler, ICommandHandler } from './base-handler';

export class CreateWorkspaceCommandHandler
  extends BaseHandler
  implements ICommandHandler<CreateWorkspaceCommand, WorkspaceId>
{
  constructor(
    eventPublisher: DomainEventPublisher,
    logger: LoggingService,
    private readonly workspaceRepository: IWorkspaceRepository,
    private readonly workspaceDomainService: WorkspaceDomainService,
    private readonly transactionManager: TransactionManager
  ) {
    super(eventPublisher, logger);
  }

  async handle(command: CreateWorkspaceCommand): Promise<WorkspaceId> {
    this.logInfo('Creating workspace', { command });

    return await this.transactionManager.executeInTransaction(async () => {
      try {
        // Create workspace through domain service
        const workspace = await this.workspaceDomainService.createWorkspace({
          name: command.name,
          description: command.description,
          ownerId: command.ownerId,
        });

        await this.workspaceRepository.save(workspace);
        await this.publishEvents();

        this.logInfo('Workspace created successfully', {
          workspaceId: workspace.id.value,
        });
        return workspace.id;
      } catch (error) {
        this.logError('Failed to create workspace', error as Error, {
          command,
        });
        throw error;
      }
    });
  }
}

export class UpdateWorkspaceCommandHandler
  extends BaseHandler
  implements ICommandHandler<UpdateWorkspaceCommand, void>
{
  constructor(
    eventPublisher: DomainEventPublisher,
    logger: LoggingService,
    private readonly workspaceRepository: IWorkspaceRepository,
    private readonly workspaceDomainService: WorkspaceDomainService,
    private readonly transactionManager: TransactionManager
  ) {
    super(eventPublisher, logger);
  }

  async handle(command: UpdateWorkspaceCommand): Promise<void> {
    this.logInfo('Updating workspace', { command });

    return await this.transactionManager.executeInTransaction(async () => {
      try {
        const workspace = await this.workspaceRepository.findById(command.workspaceId);
        if (!workspace) {
          throw new NotFoundError(`Workspace with ID ${command.workspaceId.value} not found`);
        }

        if (!this.workspaceDomainService.canUserUpdateWorkspace(workspace, command.userId)) {
          throw new AuthorizationError('User does not have permission to update this workspace');
        }

        // Update workspace properties
        if (command.name !== undefined) {
          workspace.updateName(command.name, command.userId);
        }
        if (command.description !== undefined) {
          workspace.updateDescription(command.description, command.userId);
        }

        await this.workspaceRepository.save(workspace);
        await this.publishEvents();

        this.logInfo('Workspace updated successfully', {
          workspaceId: workspace.id.value,
        });
      } catch (error) {
        this.logError('Failed to update workspace', error as Error, {
          command,
        });
        throw error;
      }
    });
  }
}

export class InviteUserToWorkspaceCommandHandler
  extends BaseHandler
  implements ICommandHandler<InviteUserToWorkspaceCommand, void>
{
  constructor(
    eventPublisher: DomainEventPublisher,
    logger: LoggingService,
    private readonly workspaceRepository: IWorkspaceRepository,
    private readonly workspaceDomainService: WorkspaceDomainService,
    private readonly emailService: EmailService,
    private readonly transactionManager: TransactionManager
  ) {
    super(eventPublisher, logger);
  }

  async handle(command: InviteUserToWorkspaceCommand): Promise<void> {
    this.logInfo('Inviting user to workspace', { command });

    return await this.transactionManager.executeInTransaction(async () => {
      try {
        const workspace = await this.workspaceRepository.findById(command.workspaceId);
        if (!workspace) {
          throw new NotFoundError(`Workspace with ID ${command.workspaceId.value} not found`);
        }

        // Invite user through domain service
        await this.workspaceDomainService.inviteUserToWorkspace(
          workspace,
          command.inviteeEmail,
          command.invitedBy
        );

        // Send invitation email
        await this.emailService.sendWorkspaceInvitation({
          recipientEmail: command.inviteeEmail,
          workspaceName: workspace.name,
          inviterName: 'User', // This would be fetched from user repository in real implementation
          invitationLink: `${process.env['APP_URL'] || 'http://localhost:3000'}/workspaces/${workspace.id.value}/join`,
        });

        await this.workspaceRepository.save(workspace);
        await this.publishEvents();

        this.logInfo('User invited to workspace successfully', {
          workspaceId: workspace.id.value,
          inviteeEmail: command.inviteeEmail,
        });
      } catch (error) {
        this.logError('Failed to invite user to workspace', error as Error, {
          command,
        });
        throw error;
      }
    });
  }
}

export class RemoveUserFromWorkspaceCommandHandler
  extends BaseHandler
  implements ICommandHandler<RemoveUserFromWorkspaceCommand, void>
{
  constructor(
    eventPublisher: DomainEventPublisher,
    logger: LoggingService,
    private readonly workspaceRepository: IWorkspaceRepository,
    private readonly workspaceDomainService: WorkspaceDomainService,
    private readonly transactionManager: TransactionManager
  ) {
    super(eventPublisher, logger);
  }

  async handle(command: RemoveUserFromWorkspaceCommand): Promise<void> {
    this.logInfo('Removing user from workspace', { command });

    return await this.transactionManager.executeInTransaction(async () => {
      try {
        const workspace = await this.workspaceRepository.findById(command.workspaceId);
        if (!workspace) {
          throw new NotFoundError(`Workspace with ID ${command.workspaceId.value} not found`);
        }

        // Remove user through domain service
        await this.workspaceDomainService.removeUserFromWorkspace(
          workspace,
          command.userToRemove,
          command.removedBy
        );

        await this.workspaceRepository.save(workspace);
        await this.publishEvents();

        this.logInfo('User removed from workspace successfully', {
          workspaceId: workspace.id.value,
          removedUserId: command.userToRemove.value,
        });
      } catch (error) {
        this.logError('Failed to remove user from workspace', error as Error, {
          command,
        });
        throw error;
      }
    });
  }
}

export class TransferWorkspaceOwnershipCommandHandler
  extends BaseHandler
  implements ICommandHandler<TransferWorkspaceOwnershipCommand, void>
{
  constructor(
    eventPublisher: DomainEventPublisher,
    logger: LoggingService,
    private readonly workspaceRepository: IWorkspaceRepository,
    private readonly userRepository: IUserRepository,
    private readonly workspaceDomainService: WorkspaceDomainService,
    private readonly transactionManager: TransactionManager
  ) {
    super(eventPublisher, logger);
  }

  async handle(command: TransferWorkspaceOwnershipCommand): Promise<void> {
    this.logInfo('Transferring workspace ownership', { command });

    return await this.transactionManager.executeInTransaction(async () => {
      try {
        const workspace = await this.workspaceRepository.findById(command.workspaceId);
        if (!workspace) {
          throw new NotFoundError(`Workspace with ID ${command.workspaceId.value} not found`);
        }

        const newOwner = await this.userRepository.findById(command.newOwnerId);
        if (!newOwner) {
          throw new NotFoundError(`User with ID ${command.newOwnerId.value} not found`);
        }

        // Transfer ownership through domain service
        await this.workspaceDomainService.transferOwnership(
          workspace,
          command.newOwnerId,
          command.currentOwnerId
        );

        await this.workspaceRepository.save(workspace);
        await this.publishEvents();

        this.logInfo('Workspace ownership transferred successfully', {
          workspaceId: workspace.id.value,
          newOwnerId: command.newOwnerId.value,
        });
      } catch (error) {
        this.logError('Failed to transfer workspace ownership', error as Error, { command });
        throw error;
      }
    });
  }
}

export class ArchiveWorkspaceCommandHandler
  extends BaseHandler
  implements ICommandHandler<ArchiveWorkspaceCommand, void>
{
  constructor(
    eventPublisher: DomainEventPublisher,
    logger: LoggingService,
    private readonly workspaceRepository: IWorkspaceRepository,
    private readonly workspaceDomainService: WorkspaceDomainService,
    private readonly transactionManager: TransactionManager
  ) {
    super(eventPublisher, logger);
  }

  async handle(command: ArchiveWorkspaceCommand): Promise<void> {
    this.logInfo('Archiving workspace', { command });

    return await this.transactionManager.executeInTransaction(async () => {
      try {
        const workspace = await this.workspaceRepository.findById(command.workspaceId);
        if (!workspace) {
          throw new NotFoundError(`Workspace with ID ${command.workspaceId.value} not found`);
        }

        // Archive workspace through domain service
        await this.workspaceDomainService.archiveWorkspace(workspace, command.archivedBy);

        await this.workspaceRepository.save(workspace);
        await this.publishEvents();

        this.logInfo('Workspace archived successfully', {
          workspaceId: workspace.id.value,
        });
      } catch (error) {
        this.logError('Failed to archive workspace', error as Error, {
          command,
        });
        throw error;
      }
    });
  }
}

// Export aliases for backward compatibility
export const CreateWorkspaceHandler = CreateWorkspaceCommandHandler;
export const InviteUserHandler = InviteUserToWorkspaceCommandHandler;
