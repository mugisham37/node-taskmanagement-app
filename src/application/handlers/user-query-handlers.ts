/**
 * User Query Handlers
 *
 * Handles queries for users and user preferences
 */

import { BaseHandler, IQueryHandler } from './base-handler';
import { DomainEventPublisher } from '../../domain/events/domain-event-publisher';
import { LoggingService } from '../../infrastructure/monitoring/logging-service';
import { IUserRepository } from '../../domain/repositories/user-repository';
import { CacheService } from '../../infrastructure/caching/cache-service';
import { PaginatedResult, PaginationOptions } from '../queries/base-query';
import { UserId } from '../../domain/value-objects/user-id';
import { Email } from '../../domain/value-objects/email';
import { NotFoundError } from '../../shared/errors/not-found-error';
import { AuthorizationError } from '../../shared/errors/authorization-error';

// Query interfaces
export interface GetUserByIdQuery {
  userId: UserId;
  requestingUserId: UserId;
}

export interface GetUserByEmailQuery {
  email: Email;
  requestingUserId: UserId;
}

export interface GetUsersQuery {
  requestingUserId: UserId;
  filters?: UserFilters;
  pagination?: PaginationOptions;
}

export interface SearchUsersQuery {
  searchTerm: string;
  requestingUserId: UserId;
  workspaceId?: string;
  pagination?: PaginationOptions;
}

export interface GetUserPreferencesQuery {
  userId: UserId;
  requestingUserId: UserId;
}

export interface GetUserStatisticsQuery {
  userId?: UserId;
  requestingUserId: UserId;
  dateFrom?: Date;
  dateTo?: Date;
}

export interface GetUserActivityQuery {
  userId: UserId;
  requestingUserId: UserId;
  dateFrom?: Date;
  dateTo?: Date;
  pagination?: PaginationOptions;
}

// Filter interfaces
export interface UserFilters {
  isActive?: boolean;
  isEmailVerified?: boolean;
  role?: string[];
  createdFrom?: Date;
  createdTo?: Date;
  lastActiveFrom?: Date;
  lastActiveTo?: Date;
}

// DTO interfaces
export interface UserDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  avatar?: string;
  isActive: boolean;
  isEmailVerified: boolean;
  lastActiveAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  profile?: UserProfileDto;
}

export interface UserProfileDto {
  bio?: string;
  title?: string;
  department?: string;
  location?: string;
  timezone: string;
  language: string;
  phoneNumber?: string;
  socialLinks?: {
    linkedin?: string;
    twitter?: string;
    github?: string;
  };
}

export interface UserPreferencesDto {
  userId: string;
  theme: 'light' | 'dark' | 'system';
  language: string;
  timezone: string;
  dateFormat: string;
  timeFormat: '12h' | '24h';
  weekStartsOn: number;
  notifications: {
    email: boolean;
    push: boolean;
    desktop: boolean;
    mobile: boolean;
  };
  privacy: {
    profileVisibility: 'public' | 'workspace' | 'private';
    showEmail: boolean;
    showLastActive: boolean;
  };
  updatedAt: Date;
}

export interface UserStatisticsDto {
  totalUsers: number;
  activeUsers: number;
  newUsersThisMonth: number;
  verifiedUsers: number;
  usersByRole: Record<string, number>;
  usersByTimezone: Record<string, number>;
  userRegistrationTrend: { month: string; count: number }[];
  averageSessionDuration: number;
  mostActiveUsers: {
    userId: string;
    firstName: string;
    lastName: string;
    activityScore: number;
  }[];
}

export interface UserActivityDto {
  id: string;
  userId: string;
  type: string;
  description: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

/**
 * Get user by ID
 */
export class GetUserByIdQueryHandler
  extends BaseHandler
  implements IQueryHandler<GetUserByIdQuery, UserDto>
{
  constructor(
    eventPublisher: DomainEventPublisher,
    logger: LoggingService,
    private readonly userRepository: IUserRepository,
    private readonly cacheService: CacheService
  ) {
    super(eventPublisher, logger);
  }

  async handle(query: GetUserByIdQuery): Promise<UserDto> {
    this.logInfo('Getting user by ID', {
      userId: query.userId.value,
      requestingUserId: query.requestingUserId.value,
    });

    try {
      // Try cache first
      const cacheKey = `user:${query.userId.value}`;
      const cachedUser = await this.cacheService.get<UserDto>(cacheKey);
      if (cachedUser) {
        // Check if requesting user can view this user
        const canView = await this.canUserViewUser(
          query.requestingUserId,
          query.userId
        );
        if (canView) {
          this.logInfo('User found in cache', { userId: query.userId.value });
          return this.filterUserData(
            cachedUser,
            query.requestingUserId,
            query.userId
          );
        }
      }

      const user = await this.userRepository.findById(query.userId);
      if (!user) {
        throw new NotFoundError(`User with ID ${query.userId.value} not found`);
      }

      // Check if requesting user can view this user
      if (!(await this.canUserViewUser(query.requestingUserId, query.userId))) {
        throw new AuthorizationError(
          'User does not have permission to view this user'
        );
      }

      const userDto = await this.mapUserToDto(user);

      // Cache the result
      await this.cacheService.set(cacheKey, userDto, 600); // 10 minutes

      this.logInfo('User retrieved successfully', {
        userId: query.userId.value,
      });

      return this.filterUserData(userDto, query.requestingUserId, query.userId);
    } catch (error) {
      this.logError('Failed to get user by ID', error as Error, {
        userId: query.userId.value,
      });
      throw error;
    }
  }

  private async canUserViewUser(
    requestingUserId: UserId,
    targetUserId: UserId
  ): Promise<boolean> {
    // Users can always view themselves
    if (requestingUserId.equals(targetUserId)) {
      return true;
    }

    // Check if users are in the same workspace/organization
    // For now, allow all users to view each other (simplified)
    return true;
  }

  private filterUserData(
    userDto: UserDto,
    requestingUserId: UserId,
    targetUserId: UserId
  ): UserDto {
    // If viewing own profile, return all data
    if (requestingUserId.equals(targetUserId)) {
      return userDto;
    }

    // Filter sensitive data for other users
    const filteredUser = { ...userDto };

    // Remove sensitive profile information based on privacy settings
    if (filteredUser.profile) {
      // This would check user privacy preferences
      // For now, keep all data visible
    }

    return filteredUser;
  }

  private async mapUserToDto(user: any): Promise<UserDto> {
    return {
      id: user.id.value,
      email: user.email.value,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: `${user.firstName} ${user.lastName}`,
      avatar: user.avatar,
      isActive: user.isActive,
      isEmailVerified: user.isEmailVerified,
      lastActiveAt: user.lastActiveAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      profile: user.profile
        ? {
            bio: user.profile.bio,
            title: user.profile.title,
            department: user.profile.department,
            location: user.profile.location,
            timezone: user.profile.timezone,
            language: user.profile.language,
            phoneNumber: user.profile.phoneNumber,
            socialLinks: user.profile.socialLinks,
          }
        : undefined,
    };
  }
}

/**
 * Get user by email
 */
export class GetUserByEmailQueryHandler
  extends BaseHandler
  implements IQueryHandler<GetUserByEmailQuery, UserDto>
{
  constructor(
    eventPublisher: DomainEventPublisher,
    logger: LoggingService,
    private readonly userRepository: IUserRepository,
    private readonly cacheService: CacheService
  ) {
    super(eventPublisher, logger);
  }

  async handle(query: GetUserByEmailQuery): Promise<UserDto> {
    this.logInfo('Getting user by email', {
      email: query.email.value,
      requestingUserId: query.requestingUserId.value,
    });

    try {
      const user = await this.userRepository.findByEmail(query.email);
      if (!user) {
        throw new NotFoundError(
          `User with email ${query.email.value} not found`
        );
      }

      // Check if requesting user can view this user
      if (!(await this.canUserViewUser(query.requestingUserId, user.id))) {
        throw new AuthorizationError(
          'User does not have permission to view this user'
        );
      }

      const userDto = await this.mapUserToDto(user);

      this.logInfo('User retrieved successfully by email', {
        userId: user.id.value,
      });

      return this.filterUserData(userDto, query.requestingUserId, user.id);
    } catch (error) {
      this.logError('Failed to get user by email', error as Error, {
        email: query.email.value,
      });
      throw error;
    }
  }

  private async canUserViewUser(
    requestingUserId: UserId,
    targetUserId: UserId
  ): Promise<boolean> {
    if (requestingUserId.equals(targetUserId)) {
      return true;
    }
    return true; // Simplified
  }

  private filterUserData(
    userDto: UserDto,
    requestingUserId: UserId,
    targetUserId: UserId
  ): UserDto {
    if (requestingUserId.equals(targetUserId)) {
      return userDto;
    }
    return userDto; // Simplified
  }

  private async mapUserToDto(user: any): Promise<UserDto> {
    return {
      id: user.id.value,
      email: user.email.value,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: `${user.firstName} ${user.lastName}`,
      avatar: user.avatar,
      isActive: user.isActive,
      isEmailVerified: user.isEmailVerified,
      lastActiveAt: user.lastActiveAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}

/**
 * Get users with filters and pagination
 */
export class GetUsersQueryHandler
  extends BaseHandler
  implements IQueryHandler<GetUsersQuery, PaginatedResult<UserDto>>
{
  constructor(
    eventPublisher: DomainEventPublisher,
    logger: LoggingService,
    private readonly userRepository: IUserRepository,
    private readonly cacheService: CacheService
  ) {
    super(eventPublisher, logger);
  }

  async handle(query: GetUsersQuery): Promise<PaginatedResult<UserDto>> {
    this.logInfo('Getting users with filters', {
      requestingUserId: query.requestingUserId.value,
      filters: query.filters,
    });

    try {
      // Generate cache key
      const cacheKey = `users:${JSON.stringify(query.filters)}:${JSON.stringify(query.pagination)}`;
      const cachedResult =
        await this.cacheService.get<PaginatedResult<UserDto>>(cacheKey);
      if (cachedResult) {
        return cachedResult;
      }

      const users = await this.userRepository.findUsers(query.filters);
      const userDtos: UserDto[] = [];

      for (const user of users) {
        const canView = await this.canUserViewUser(
          query.requestingUserId,
          user.id
        );
        if (canView) {
          const dto = await this.mapUserToDto(user);
          const filteredDto = this.filterUserData(
            dto,
            query.requestingUserId,
            user.id
          );
          userDtos.push(filteredDto);
        }
      }

      // Apply pagination
      const paginatedResult = this.applyPagination(userDtos, query.pagination);

      // Cache the result
      await this.cacheService.set(cacheKey, paginatedResult, 300); // 5 minutes

      this.logInfo('Users retrieved successfully', {
        count: paginatedResult.data.length,
        total: paginatedResult.total,
      });

      return paginatedResult;
    } catch (error) {
      this.logError('Failed to get users', error as Error);
      throw error;
    }
  }

  private async canUserViewUser(
    requestingUserId: UserId,
    targetUserId: UserId
  ): Promise<boolean> {
    return true; // Simplified
  }

  private filterUserData(
    userDto: UserDto,
    requestingUserId: UserId,
    targetUserId: UserId
  ): UserDto {
    return userDto; // Simplified
  }

  private async mapUserToDto(user: any): Promise<UserDto> {
    return {
      id: user.id.value,
      email: user.email.value,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: `${user.firstName} ${user.lastName}`,
      avatar: user.avatar,
      isActive: user.isActive,
      isEmailVerified: user.isEmailVerified,
      lastActiveAt: user.lastActiveAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private applyPagination<T>(
    data: T[],
    pagination?: PaginationOptions
  ): PaginatedResult<T> {
    if (!pagination) {
      return {
        data,
        total: data.length,
        page: 1,
        limit: data.length,
        totalPages: 1,
      };
    }

    const { page = 1, limit = 20 } = pagination;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedData = data.slice(startIndex, endIndex);

    return {
      data: paginatedData,
      total: data.length,
      page,
      limit,
      totalPages: Math.ceil(data.length / limit),
    };
  }
}

/**
 * Search users
 */
export class SearchUsersQueryHandler
  extends BaseHandler
  implements IQueryHandler<SearchUsersQuery, PaginatedResult<UserDto>>
{
  constructor(
    eventPublisher: DomainEventPublisher,
    logger: LoggingService,
    private readonly userRepository: IUserRepository,
    private readonly cacheService: CacheService
  ) {
    super(eventPublisher, logger);
  }

  async handle(query: SearchUsersQuery): Promise<PaginatedResult<UserDto>> {
    this.logInfo('Searching users', {
      searchTerm: query.searchTerm,
      requestingUserId: query.requestingUserId.value,
    });

    try {
      // Generate cache key
      const cacheKey = `user-search:${query.searchTerm}:${query.workspaceId || 'all'}:${JSON.stringify(query.pagination)}`;
      const cachedResult =
        await this.cacheService.get<PaginatedResult<UserDto>>(cacheKey);
      if (cachedResult) {
        return cachedResult;
      }

      const users = await this.userRepository.searchUsers(
        query.searchTerm,
        query.workspaceId
      );

      const userDtos: UserDto[] = [];
      for (const user of users) {
        const canView = await this.canUserViewUser(
          query.requestingUserId,
          user.id
        );
        if (canView) {
          const dto = await this.mapUserToDto(user);
          const filteredDto = this.filterUserData(
            dto,
            query.requestingUserId,
            user.id
          );
          userDtos.push(filteredDto);
        }
      }

      // Apply pagination
      const paginatedResult = this.applyPagination(userDtos, query.pagination);

      // Cache the result for 2 minutes (search results change frequently)
      await this.cacheService.set(cacheKey, paginatedResult, 120);

      this.logInfo('User search completed successfully', {
        searchTerm: query.searchTerm,
        count: paginatedResult.data.length,
      });

      return paginatedResult;
    } catch (error) {
      this.logError('Failed to search users', error as Error, {
        searchTerm: query.searchTerm,
      });
      throw error;
    }
  }

  private async canUserViewUser(
    requestingUserId: UserId,
    targetUserId: UserId
  ): Promise<boolean> {
    return true; // Simplified
  }

  private filterUserData(
    userDto: UserDto,
    requestingUserId: UserId,
    targetUserId: UserId
  ): UserDto {
    return userDto; // Simplified
  }

  private async mapUserToDto(user: any): Promise<UserDto> {
    return {
      id: user.id.value,
      email: user.email.value,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: `${user.firstName} ${user.lastName}`,
      avatar: user.avatar,
      isActive: user.isActive,
      isEmailVerified: user.isEmailVerified,
      lastActiveAt: user.lastActiveAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private applyPagination<T>(
    data: T[],
    pagination?: PaginationOptions
  ): PaginatedResult<T> {
    if (!pagination) {
      return {
        data,
        total: data.length,
        page: 1,
        limit: data.length,
        totalPages: 1,
      };
    }

    const { page = 1, limit = 20 } = pagination;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedData = data.slice(startIndex, endIndex);

    return {
      data: paginatedData,
      total: data.length,
      page,
      limit,
      totalPages: Math.ceil(data.length / limit),
    };
  }
}

/**
 * Get user preferences
 */
export class GetUserPreferencesQueryHandler
  extends BaseHandler
  implements IQueryHandler<GetUserPreferencesQuery, UserPreferencesDto>
{
  constructor(
    eventPublisher: DomainEventPublisher,
    logger: LoggingService,
    private readonly userRepository: IUserRepository,
    private readonly cacheService: CacheService
  ) {
    super(eventPublisher, logger);
  }

  async handle(query: GetUserPreferencesQuery): Promise<UserPreferencesDto> {
    this.logInfo('Getting user preferences', {
      userId: query.userId.value,
      requestingUserId: query.requestingUserId.value,
    });

    try {
      // Only allow users to view their own preferences
      if (!query.requestingUserId.equals(query.userId)) {
        throw new AuthorizationError(
          'User can only view their own preferences'
        );
      }

      // Try cache first
      const cacheKey = `user-preferences:${query.userId.value}`;
      const cachedPreferences =
        await this.cacheService.get<UserPreferencesDto>(cacheKey);
      if (cachedPreferences) {
        return cachedPreferences;
      }

      const preferences = await this.userRepository.getUserPreferences(
        query.userId
      );
      if (!preferences) {
        // Return default preferences
        const defaultPreferences: UserPreferencesDto = {
          userId: query.userId.value,
          theme: 'system',
          language: 'en',
          timezone: 'UTC',
          dateFormat: 'MM/DD/YYYY',
          timeFormat: '12h',
          weekStartsOn: 0, // Sunday
          notifications: {
            email: true,
            push: true,
            desktop: true,
            mobile: true,
          },
          privacy: {
            profileVisibility: 'workspace',
            showEmail: false,
            showLastActive: true,
          },
          updatedAt: new Date(),
        };

        // Cache default preferences
        await this.cacheService.set(cacheKey, defaultPreferences, 3600); // 1 hour

        return defaultPreferences;
      }

      const preferencesDto = this.mapPreferencesToDto(preferences);

      // Cache the result
      await this.cacheService.set(cacheKey, preferencesDto, 3600); // 1 hour

      this.logInfo('User preferences retrieved successfully', {
        userId: query.userId.value,
      });

      return preferencesDto;
    } catch (error) {
      this.logError('Failed to get user preferences', error as Error, {
        userId: query.userId.value,
      });
      throw error;
    }
  }

  private mapPreferencesToDto(preferences: any): UserPreferencesDto {
    return {
      userId: preferences.userId.value,
      theme: preferences.theme,
      language: preferences.language,
      timezone: preferences.timezone,
      dateFormat: preferences.dateFormat,
      timeFormat: preferences.timeFormat,
      weekStartsOn: preferences.weekStartsOn,
      notifications: preferences.notifications,
      privacy: preferences.privacy,
      updatedAt: preferences.updatedAt,
    };
  }
}

/**
 * Get user statistics
 */
export class GetUserStatisticsQueryHandler
  extends BaseHandler
  implements IQueryHandler<GetUserStatisticsQuery, UserStatisticsDto>
{
  constructor(
    eventPublisher: DomainEventPublisher,
    logger: LoggingService,
    private readonly userRepository: IUserRepository,
    private readonly cacheService: CacheService
  ) {
    super(eventPublisher, logger);
  }

  async handle(query: GetUserStatisticsQuery): Promise<UserStatisticsDto> {
    this.logInfo('Getting user statistics', {
      userId: query.userId?.value,
      requestingUserId: query.requestingUserId.value,
    });

    try {
      // Generate cache key
      const cacheKey = `user-stats:${query.userId?.value || 'all'}:${query.dateFrom?.toISOString() || 'all'}:${query.dateTo?.toISOString() || 'all'}`;
      const cachedStats =
        await this.cacheService.get<UserStatisticsDto>(cacheKey);
      if (cachedStats) {
        return cachedStats;
      }

      const statistics = await this.userRepository.getUserStatistics(
        query.userId,
        query.dateFrom,
        query.dateTo
      );

      // Cache the result for 10 minutes
      await this.cacheService.set(cacheKey, statistics, 600);

      this.logInfo('User statistics retrieved successfully');

      return statistics;
    } catch (error) {
      this.logError('Failed to get user statistics', error as Error);
      throw error;
    }
  }
}

// Export aliases for backward compatibility
export const GetUserHandler = GetUserByIdQueryHandler;
export const ListUsersHandler = GetUsersQueryHandler;
export const GetUserPreferencesHandler = GetUserPreferencesQueryHandler;
