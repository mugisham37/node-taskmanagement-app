import { UserId } from '../../domain/value-objects/user-id';
import { User } from '../../domain/entities/user';
import { IUserRepository } from '../../domain/repositories/user-repository';
import { LoggingService } from '../../infrastructure/monitoring/logging-service';
import { ValidationError } from '../../shared/errors/validation-error';
import { NotFoundError } from '../../shared/errors/not-found-error';
import { AuthorizationError } from '../../shared/errors/authorization-error';
import { UserDto } from './auth-application-service';

export interface UpdateUserRequest {
  firstName?: string;
  lastName?: string;
  avatar?: string;
  settings?: Record<string, any>;
}

export interface UserQuery {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
  isActive?: boolean;
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
    private readonly logger: LoggingService
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
        this.logger.info('User accessed another user profile', { currentUserId, targetUserId: userId });
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

      // Check authorization - users can only update their own profile
      if (currentUserId !== userId) {
        throw new AuthorizationError('Cannot update another user\'s profile');
      }

      const user = await this.userRepository.findById(targetUserIdObj);
      if (!user) {
        throw new NotFoundError('User not found');
      }

      // Update user properties
      if (updateData.firstName !== undefined) {
        user.updateFirstName(updateData.firstName);
      }
      if (updateData.lastName !== undefined) {
        user.updateLastName(updateData.lastName);
      }
      if (updateData.avatar !== undefined) {
        user.updateAvatar(updateData.avatar);
      }
      if (updateData.settings !== undefined) {
        user.updateSettings(updateData.settings);
      }

      await this.userRepository.save(user);

      this.logger.info('User updated successfully', { userId });

      return this.mapUserToDto(user);
    } catch (error) {
      this.logger.error('Error updating user', error as Error, { currentUserId, userId });
      throw error;
    }
  }

  async getUsers(query: UserQuery): Promise<PaginatedResult<UserDto>> {
    try {
      const page = query.page || 1;
      const limit = query.limit || 20;
      const offset = (page - 1) * limit;

      const filters: {
        search?: string;
        role?: string;
        isActive?: boolean;
      } = {};
      
      if (query.search !== undefined) {
        filters.search = query.search;
      }
      if (query.role !== undefined) {
        filters.role = query.role;
      }
      if (query.isActive !== undefined) {
        filters.isActive = query.isActive;
      }

      const { users, total } = await this.userRepository.findWithFilters(
        filters,
        { offset, limit }
      );

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
