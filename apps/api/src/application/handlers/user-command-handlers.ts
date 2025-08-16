import { ValidationError } from '@taskmanagement/validation';
import { nanoid } from 'nanoid';
import { User } from '../../domain/entities/user';
import { DomainEventPublisher } from '../../domain/events/domain-event-publisher';
import { IUserRepository } from '../../domain/repositories/user-repository';
import { UserId } from '../../domain/value-objects/user-id';
import { TransactionManager } from '../../infrastructure/database/transaction-manager';
import { LoggingService } from '../../infrastructure/monitoring/logging-service';
import { PasswordService } from '../../infrastructure/security/password-service';
import { AuthorizationError } from '../../shared/errors/authorization-error';
import { NotFoundError } from '../../shared/errors/not-found-error';
import {
  ActivateUserCommand,
  ChangePasswordCommand,
  DeactivateUserCommand,
  RegisterUserCommand,
  UpdateUserProfileCommand,
} from '../commands/user-commands';
import { BaseHandler, ICommandHandler } from './base-handler';

export class RegisterUserCommandHandler
  extends BaseHandler
  implements ICommandHandler<RegisterUserCommand, UserId>
{
  constructor(
    eventPublisher: DomainEventPublisher,
    logger: LoggingService,
    private readonly userRepository: IUserRepository,
    private readonly passwordService: PasswordService,
    private readonly transactionManager: TransactionManager
  ) {
    super(eventPublisher, logger);
  }

  async handle(command: RegisterUserCommand): Promise<UserId> {
    this.logInfo('Registering user', { email: command.email.value });

    return await this.transactionManager.executeInTransaction(async () => {
      try {
        // Check if user already exists
        const existingUser = await this.userRepository.findByEmail(command.email);
        if (existingUser) {
          throw ValidationError.forField(
            'email',
            `User with email ${command.email.value} already exists`,
            command.email.value
          );
        }

        // Hash password
        const hashedPassword = await this.passwordService.hashPassword(command.password);

        // Create user
        const user = User.create(
          UserId.create(nanoid()),
          command.email,
          command.name,
          hashedPassword
        );

        await this.userRepository.save(user);
        await this.publishEvents();

        this.logInfo('User registered successfully', { userId: user.id.value });
        return user.id;
      } catch (error) {
        this.logError('Failed to register user', error as Error, {
          email: command.email.value,
        });
        throw error;
      }
    });
  }
}

export class UpdateUserProfileCommandHandler
  extends BaseHandler
  implements ICommandHandler<UpdateUserProfileCommand, void>
{
  constructor(
    eventPublisher: DomainEventPublisher,
    logger: LoggingService,
    private readonly userRepository: IUserRepository,
    private readonly transactionManager: TransactionManager
  ) {
    super(eventPublisher, logger);
  }

  async handle(command: UpdateUserProfileCommand): Promise<void> {
    this.logInfo('Updating user profile', { command });

    return await this.transactionManager.executeInTransaction(async () => {
      try {
        const user = await this.userRepository.findById(command.targetUserId);
        if (!user) {
          throw new NotFoundError(`User with ID ${command.targetUserId.value} not found`);
        }

        // Check if user can update this profile (self or admin)
        if (!command.targetUserId.equals(command.userId)) {
          // In a real implementation, you'd check if the requesting user is an admin
          throw new AuthorizationError('User can only update their own profile');
        }

        // Check if email is already taken by another user
        if (command.email) {
          const existingUser = await this.userRepository.findByEmail(command.email);
          if (existingUser && !existingUser.id.equals(command.targetUserId)) {
            throw ValidationError.forField(
              'email',
              `Email ${command.email.value} is already taken`,
              command.email.value
            );
          }
        }

        // Update profile
        if (command.name !== undefined || command.email !== undefined) {
          user.updateProfile(command.name || user.name, command.email || user.email);
        }

        await this.userRepository.save(user);
        await this.publishEvents();

        this.logInfo('User profile updated successfully', {
          userId: user.id.value,
        });
      } catch (error) {
        this.logError('Failed to update user profile', error as Error, {
          command,
        });
        throw error;
      }
    });
  }
}

export class ChangePasswordCommandHandler
  extends BaseHandler
  implements ICommandHandler<ChangePasswordCommand, void>
{
  constructor(
    eventPublisher: DomainEventPublisher,
    logger: LoggingService,
    private readonly userRepository: IUserRepository,
    private readonly passwordService: PasswordService,
    private readonly transactionManager: TransactionManager
  ) {
    super(eventPublisher, logger);
  }

  async handle(command: ChangePasswordCommand): Promise<void> {
    this.logInfo('Changing user password', {
      userId: command.targetUserId.value,
    });

    return await this.transactionManager.executeInTransaction(async () => {
      try {
        const user = await this.userRepository.findById(command.targetUserId);
        if (!user) {
          throw new NotFoundError(`User with ID ${command.targetUserId.value} not found`);
        }

        // Check if user can change this password (self only)
        if (!command.targetUserId.equals(command.userId)) {
          throw new AuthorizationError('User can only change their own password');
        }

        // Verify current password
        const isCurrentPasswordValid = await this.passwordService.verifyPassword(
          command.currentPassword,
          user.hashedPassword
        );
        if (!isCurrentPasswordValid) {
          throw ValidationError.forField('currentPassword', 'Current password is incorrect');
        }

        // Hash new password
        const newHashedPassword = await this.passwordService.hashPassword(command.newPassword);

        // Update password
        user.changePassword(newHashedPassword);

        await this.userRepository.save(user);
        await this.publishEvents();

        this.logInfo('User password changed successfully', {
          userId: user.id.value,
        });
      } catch (error) {
        this.logError('Failed to change user password', error as Error, {
          userId: command.targetUserId.value,
        });
        throw error;
      }
    });
  }
}

export class ActivateUserCommandHandler
  extends BaseHandler
  implements ICommandHandler<ActivateUserCommand, void>
{
  constructor(
    eventPublisher: DomainEventPublisher,
    logger: LoggingService,
    private readonly userRepository: IUserRepository,
    private readonly transactionManager: TransactionManager
  ) {
    super(eventPublisher, logger);
  }

  async handle(command: ActivateUserCommand): Promise<void> {
    this.logInfo('Activating user', { command });

    return await this.transactionManager.executeInTransaction(async () => {
      try {
        const user = await this.userRepository.findById(command.targetUserId);
        if (!user) {
          throw new NotFoundError(`User with ID ${command.targetUserId.value} not found`);
        }

        // In a real implementation, you'd check if the activating user has admin permissions
        // For now, we'll allow self-activation or assume the user has permission

        user.activate();

        await this.userRepository.save(user);
        await this.publishEvents();

        this.logInfo('User activated successfully', { userId: user.id.value });
      } catch (error) {
        this.logError('Failed to activate user', error as Error, { command });
        throw error;
      }
    });
  }
}

export class DeactivateUserCommandHandler
  extends BaseHandler
  implements ICommandHandler<DeactivateUserCommand, void>
{
  constructor(
    eventPublisher: DomainEventPublisher,
    logger: LoggingService,
    private readonly userRepository: IUserRepository,
    private readonly transactionManager: TransactionManager
  ) {
    super(eventPublisher, logger);
  }

  async handle(command: DeactivateUserCommand): Promise<void> {
    this.logInfo('Deactivating user', { command });

    return await this.transactionManager.executeInTransaction(async () => {
      try {
        const user = await this.userRepository.findById(command.targetUserId);
        if (!user) {
          throw new NotFoundError(`User with ID ${command.targetUserId.value} not found`);
        }

        // In a real implementation, you'd check if the deactivating user has admin permissions
        // For now, we'll allow self-deactivation or assume the user has permission

        user.deactivate();

        await this.userRepository.save(user);
        await this.publishEvents();

        this.logInfo('User deactivated successfully', {
          userId: user.id.value,
        });
      } catch (error) {
        this.logError('Failed to deactivate user', error as Error, { command });
        throw error;
      }
    });
  }
}

// Export aliases for backward compatibility
export const RegisterUserHandler = RegisterUserCommandHandler;
export const UpdateUserProfileHandler = UpdateUserProfileCommandHandler;
