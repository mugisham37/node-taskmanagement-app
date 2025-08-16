import { UserQuery } from '@taskmanagement/types/dto';
import { ValidationError } from '@taskmanagement/validation';
import { User } from '../../domain/entities/user';
import { IUserRepository } from '../../domain/repositories/user-repository';
import { UserId } from '../../domain/value-objects/user-id';
import { LoggingService } from '../../infrastructure/monitoring/logging-service';
import { AuthorizationError } from '../../shared/errors/authorization-error';
import { NotFoundError } from '../../shared/errors/not-found-error';
import {
  ActivateUserCommand,
  DeactivateUserCommand,
  UpdateUserProfileCommand,
} from '../commands/user-commands';
import { ICommandBus } from '../cqrs/command';
import { UserDto } from './auth-application-service';

export interface UpdateUserRequest {
  firstName?: string;
  lastName?: string;
  avatar?: string;
  settings?: Record<string, any>;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export class UserApplicationService {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly logger: LoggingService,
    private readonly commandBus: ICommandBus
  ) {}

  async getUser(currentUserId: string, userId: string): Promise<UserDto> {
    try {
      const targetUserIdObj = new UserId(userId);

      const user = await this.userRepository.findById(targetUserIdObj);
      if (!user) {
        throw new NotFoundError('User not found');
      }

      // Check if current user can view this user's details
      if (currentUserId !== userId) {
        // You might want to add permission checks here
        this.logger.info('User accessed another user profile', {
          currentUserId,
          targetUserId: userId,
        });
      }

      return this.mapUserToDto(user);
    } catch (error) {
      this.logger.error('Error getting user', error as Error, { currentUserId, userId });
      throw error;
    }
  }

  async updateUser(
    currentUserId: string,
    userId: string,
    updateData: UpdateUserRequest
  ): Promise<UserDto> {
    try {
      const targetUserIdObj = new UserId(userId);
      const currentUserIdObj = new UserId(currentUserId);

      // Check authorization - users can only update their own profile
      if (currentUserId !== userId) {
        throw new AuthorizationError("Cannot update another user's profile");
      }

      // Use command pattern for user profile update
      const command = new UpdateUserProfileCommand(
        targetUserIdObj,
        currentUserIdObj,
        updateData.firstName || updateData.lastName
          ? `${updateData.firstName || ''} ${updateData.lastName || ''}`.trim()
          : undefined,
        undefined // email not updated in this method
      );

      await this.commandBus.send(command);

      // Get updated user
      const user = await this.userRepository.findById(targetUserIdObj);
      if (!user) {
        throw new NotFoundError('User not found');
      }

      this.logger.info('User updated successfully', { userId });

      return this.mapUserToDto(user);
    } catch (error) {
      this.logger.error('Error updating user', error as Error, { currentUserId, userId });
      throw error;
    }
  }

  async getUsers(currentUserId: string, query: UserQuery): Promise<PaginatedResult<UserDto>> {
    void currentUserId; // Mark as intentionally unused for now
    try {
      const page = query.page ?? 1;
      const limit = query.limit ?? 20;
      const offset = (page - 1) * limit;

      const filters: {
        search?: string;
        isActive?: boolean;
      } = {};

      if (query.search !== undefined) {
        filters.search = query.search;
      }
      if (query.isActive !== undefined) {
        filters.isActive = query.isActive;
      }

      const { users, total } = await this.userRepository.findWithFilters(filters, {
        offset,
        limit,
      });

      const userDtos = users.map((user: User) => this.mapUserToDto(user));

      return {
        data: userDtos,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrevious: page > 1,
      };
    } catch (error) {
      this.logger.error('Error getting users', error as Error, { query });
      throw error;
    }
  }

  async deleteUser(currentUserId: string, userId: string): Promise<void> {
    try {
      const targetUserIdObj = new UserId(userId);

      // Check authorization - implement your business rules here
      if (currentUserId === userId) {
        throw new ValidationError([], 'Cannot delete your own account');
      }

      const user = await this.userRepository.findById(targetUserIdObj);
      if (!user) {
        throw new NotFoundError('User not found');
      }

      // Soft delete by deactivating
      user.deactivate();
      await this.userRepository.save(user);

      this.logger.info('User deactivated successfully', { userId, deactivatedBy: currentUserId });
    } catch (error) {
      this.logger.error('Error deleting user', error as Error, { currentUserId, userId });
      throw error;
    }
  }

  async deactivateUser(currentUserId: string, userId: string): Promise<void> {
    try {
      const targetUserIdObj = new UserId(userId);
      const currentUserIdObj = new UserId(currentUserId);

      // Check authorization - implement your business rules here
      if (currentUserId === userId) {
        throw new ValidationError([], 'Cannot deactivate your own account');
      }

      // Use command pattern for user deactivation
      const command = new DeactivateUserCommand(
        targetUserIdObj,
        currentUserIdObj,
        currentUserIdObj
      );

      await this.commandBus.send(command);

      this.logger.info('User deactivated successfully', { userId, deactivatedBy: currentUserId });
    } catch (error) {
      this.logger.error('Error deactivating user', error as Error, { currentUserId, userId });
      throw error;
    }
  }

  async activateUser(currentUserId: string, userId: string): Promise<void> {
    try {
      const targetUserIdObj = new UserId(userId);
      const currentUserIdObj = new UserId(currentUserId);

      // Use command pattern for user activation
      const command = new ActivateUserCommand(targetUserIdObj, currentUserIdObj, currentUserIdObj);

      await this.commandBus.send(command);

      this.logger.info('User activated successfully', { userId, activatedBy: currentUserId });
    } catch (error) {
      this.logger.error('Error activating user', error as Error, { currentUserId, userId });
      throw error;
    }
  }

  async searchUsers(currentUserId: string, query: UserQuery): Promise<PaginatedResult<UserDto>> {
    try {
      const page = query.page ?? 1;
      const limit = query.limit ?? 20;
      const offset = (page - 1) * limit;

      const filters: {
        search?: string;
        isActive?: boolean;
      } = {};

      if (query.search !== undefined) {
        filters.search = query.search;
      }
      if (query.isActive !== undefined) {
        filters.isActive = query.isActive;
      }

      const { users, total } = await this.userRepository.findWithFilters(filters, {
        offset,
        limit,
      });

      const userDtos = users.map((user: User) => this.mapUserToDto(user));

      return {
        data: userDtos,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrevious: page > 1,
      };
    } catch (error) {
      this.logger.error('Error searching users', error as Error, { currentUserId, query });
      throw error;
    }
  }

  async getUserStats(currentUserId: string, userId: string): Promise<any> {
    try {
      const targetUserIdObj = new UserId(userId);

      const user = await this.userRepository.findById(targetUserIdObj);
      if (!user) {
        throw new NotFoundError('User not found');
      }

      // Check if current user can view this user's stats
      if (currentUserId !== userId) {
        // You might want to add permission checks here
        this.logger.info('User accessed another user stats', {
          currentUserId,
          targetUserId: userId,
        });
      }

      // Return basic user stats (you can extend this based on your requirements)
      return {
        id: user.id.value,
        tasksCreated: 0, // You can implement actual counts from task repository
        tasksAssigned: 0,
        tasksCompleted: 0,
        joinedDate: user.createdAt,
        lastActivity: user.updatedAt,
        isActive: user.isActive(),
      };
    } catch (error) {
      this.logger.error('Error getting user stats', error as Error, { currentUserId, userId });
      throw error;
    }
  }

  async getMyStats(userId: string): Promise<any> {
    return this.getUserStats(userId, userId);
  }

  private mapUserToDto(user: User): UserDto {
    return {
      id: user.id.value,
      email: user.email.value,
      username: user.name, // using name as username
      firstName: user.firstName,
      lastName: user.lastName,
      ...(user.avatar && { avatar: user.avatar }),
      isActive: user.isActive(),
      role: 'user', // default role - can be extended based on your domain model
      ...(user.lastLoginAt && { lastLoginAt: user.lastLoginAt }),
      isEmailVerified: user.isEmailVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
