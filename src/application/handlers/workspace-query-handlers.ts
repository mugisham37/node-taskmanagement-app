/**
 * Workspace Query Handlers
 *
 * Handles queries for workspaces and workspace statistics
 */

import { BaseHandler, IQueryHandler } from './base-handler';
import { DomainEventPublisher } from '../../domain/events/domain-event-publisher';
import { LoggingService } from '../../infrastructure/monitoring/logging-service';
import { IWorkspaceRepository } from '../../domain/repositories/workspace-repository';
import { IUserRepository } from '../../domain/repositories/user-repository';
import { CacheService } from '../../infrastructure/caching/cache-service';
import { PaginatedResult, PaginationOptions } from '../queries/base-query';
import { WorkspaceId } from '../../domain/value-objects/workspace-id';
import { UserId } from '../../domain/value-objects/user-id';
import { NotFoundError } from '../../shared/errors/not-found-error';
import { AuthorizationError } from '../../shared/errors/authorization-error';

// Query interfaces
export interface GetWorkspaceByIdQuery {
  workspaceId: WorkspaceId;
  userId: UserId;
}

export interface GetWorkspaceBySlugQuery {
  slug: string;
  userId: UserId;
}

export interface GetUserWorkspacesQuery {
  userId: UserId;
  pagination?: PaginationOptions;
}

export interface GetWorkspaceMembersQuery {
  workspaceId: WorkspaceId;
  userId: UserId;
  pagination?: PaginationOptions;
}

export interface GetWorkspaceStatisticsQuery {
  workspaceId: WorkspaceId;
  userId: UserId;
  dateFrom?: Date;
  dateTo?: Date;
}

export interface GetWorkspaceUsageQuery {
  workspaceId: WorkspaceId;
  userId: UserId;
}

export interface SearchWorkspacesQuery {
  searchTerm: string;
  userId: UserId;
  pagination?: PaginationOptions;
}

// DTO interfaces
export interface WorkspaceDto {
  id: string;
  name: string;
  slug: string;
  description?: string;
  ownerId: string;
  plan: string;
  settings: WorkspaceSettingsDto;
  memberCount: number;
  projectCount: number;
  storageUsedGB: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  owner: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  userRole?: string;
  userPermissions?: string[];
}

export interface WorkspaceSettingsDto {
  allowPublicProjects: boolean;
  requireApprovalForMembers: boolean;
  maxProjects: number;
  maxMembers: number;
  maxStorageGB: number;
  enableIntegrations: boolean;
  enableCustomFields: boolean;
  enableTimeTracking: boolean;
  enableReporting: boolean;
  defaultProjectVisibility: 'private' | 'internal' | 'public';
  allowedEmailDomains: string[];
  ssoEnabled: boolean;
  ssoProvider?: string;
  customBranding: {
    logoUrl?: string;
    primaryColor?: string;
    secondaryColor?: string;
  };
}

export interface WorkspaceMemberDto {
  id: string;
  workspaceId: string;
  userId: string;
  role: string;
  permissions: string[];
  joinedAt: Date;
  lastActiveAt?: Date;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    avatar?: string;
  };
}

export interface WorkspaceStatisticsDto {
  totalMembers: number;
  activeMembers: number;
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  totalTasks: number;
  completedTasks: number;
  overdueTasks: number;
  storageUsed: number;
  storageLimit: number;
  membersByRole: Record<string, number>;
  projectsByStatus: Record<string, number>;
  activityTrend: { date: string; count: number }[];
  topContributors: {
    userId: string;
    firstName: string;
    lastName: string;
    contributionScore: number;
  }[];
}

export interface WorkspaceUsageDto {
  projects: {
    current: number;
    limit: number;
    percentage: number;
  };
  members: {
    current: number;
    limit: number;
    percentage: number;
  };
  storage: {
    currentGB: number;
    limitGB: number;
    percentage: number;
  };
  apiCalls: {
    currentMonth: number;
    limit: number;
    percentage: number;
  };
}

/**
 * Get workspace by ID
 */
export class GetWorkspaceByIdQueryHandler
  extends BaseHandler
  implements IQueryHandler<GetWorkspaceByIdQuery, WorkspaceDto>
{
  constructor(
    eventPublisher: DomainEventPublisher,
    logger: LoggingService,
    private readonly workspaceRepository: IWorkspaceRepository,
    private readonly userRepository: IUserRepository,
    private readonly cacheService: CacheService
  ) {
    super(eventPublisher, logger);
  }

  async handle(query: GetWorkspaceByIdQuery): Promise<WorkspaceDto> {
    this.logInfo('Getting workspace by ID', {
      workspaceId: query.workspaceId.value,
      userId: query.userId.value,
    });

    try {
      // Try cache first
      const cacheKey = `workspace:${query.workspaceId.value}`;
      const cachedWorkspace =
        await this.cacheService.get<WorkspaceDto>(cacheKey);
      if (cachedWorkspace) {
        // Verify user still has access
        const hasAccess = await this.canUserAccessWorkspace(
          query.userId,
          query.workspaceId
        );
        if (hasAccess) {
          this.logInfo('Workspace found in cache', {
            workspaceId: query.workspaceId.value,
          });
          return await this.enrichWorkspaceWithUserContext(
            cachedWorkspace,
            query.userId
          );
        }
      }

      const workspace = await this.workspaceRepository.findById(
        query.workspaceId
      );
      if (!workspace) {
        throw new NotFoundError(
          `Workspace with ID ${query.workspaceId.value} not found`
        );
      }

      // Check if user has access to this workspace
      if (
        !(await this.canUserAccessWorkspace(query.userId, query.workspaceId))
      ) {
        throw new AuthorizationError(
          'User does not have permission to access this workspace'
        );
      }

      const workspaceDto = await this.mapWorkspaceToDto(workspace);

      // Cache the result
      await this.cacheService.set(cacheKey, workspaceDto, 600); // 10 minutes

      this.logInfo('Workspace retrieved successfully', {
        workspaceId: query.workspaceId.value,
      });

      return await this.enrichWorkspaceWithUserContext(
        workspaceDto,
        query.userId
      );
    } catch (error) {
      this.logError('Failed to get workspace by ID', error as Error, {
        workspaceId: query.workspaceId.value,
      });
      throw error;
    }
  }

  private async canUserAccessWorkspace(
    userId: UserId,
    workspaceId: WorkspaceId
  ): Promise<boolean> {
    const member = await this.workspaceRepository.findMember(
      workspaceId,
      userId
    );
    return member !== null;
  }

  private async enrichWorkspaceWithUserContext(
    workspaceDto: WorkspaceDto,
    userId: UserId
  ): Promise<WorkspaceDto> {
    const member = await this.workspaceRepository.findMember(
      new WorkspaceId(workspaceDto.id),
      userId
    );

    return {
      ...workspaceDto,
      userRole: member?.role.value,
      userPermissions: member?.getPermissions(),
    };
  }

  private async mapWorkspaceToDto(workspace: any): Promise<WorkspaceDto> {
    const owner = await this.userRepository.findById(workspace.ownerId);
    const memberCount = await this.workspaceRepository.getMemberCount(
      workspace.id
    );
    const projectCount = await this.workspaceRepository.getProjectCount(
      workspace.id
    );
    const storageUsed = await this.workspaceRepository.getStorageUsed(
      workspace.id
    );

    return {
      id: workspace.id.value,
      name: workspace.name,
      slug: workspace.slug,
      description: workspace.description,
      ownerId: workspace.ownerId.value,
      plan: workspace.plan.value,
      settings: workspace.settings,
      memberCount,
      projectCount,
      storageUsedGB: storageUsed,
      isActive: workspace.isActive,
      createdAt: workspace.createdAt,
      updatedAt: workspace.updatedAt,
      owner: owner
        ? {
            id: owner.id.value,
            firstName: owner.firstName,
            lastName: owner.lastName,
            email: owner.email.value,
          }
        : {
            id: '',
            firstName: 'Unknown',
            lastName: 'User',
            email: '',
          },
    };
  }
}

/**
 * Get workspace by slug
 */
export class GetWorkspaceBySlugQueryHandler
  extends BaseHandler
  implements IQueryHandler<GetWorkspaceBySlugQuery, WorkspaceDto>
{
  constructor(
    eventPublisher: DomainEventPublisher,
    logger: LoggingService,
    private readonly workspaceRepository: IWorkspaceRepository,
    private readonly userRepository: IUserRepository,
    private readonly cacheService: CacheService
  ) {
    super(eventPublisher, logger);
  }

  async handle(query: GetWorkspaceBySlugQuery): Promise<WorkspaceDto> {
    this.logInfo('Getting workspace by slug', {
      slug: query.slug,
      userId: query.userId.value,
    });

    try {
      const workspace = await this.workspaceRepository.findBySlug(query.slug);
      if (!workspace) {
        throw new NotFoundError(`Workspace with slug ${query.slug} not found`);
      }

      // Check if user has access to this workspace
      if (!(await this.canUserAccessWorkspace(query.userId, workspace.id))) {
        throw new AuthorizationError(
          'User does not have permission to access this workspace'
        );
      }

      const workspaceDto = await this.mapWorkspaceToDto(workspace);

      this.logInfo('Workspace retrieved successfully by slug', {
        slug: query.slug,
        workspaceId: workspace.id.value,
      });

      return await this.enrichWorkspaceWithUserContext(
        workspaceDto,
        query.userId
      );
    } catch (error) {
      this.logError('Failed to get workspace by slug', error as Error, {
        slug: query.slug,
      });
      throw error;
    }
  }

  private async canUserAccessWorkspace(
    userId: UserId,
    workspaceId: WorkspaceId
  ): Promise<boolean> {
    const member = await this.workspaceRepository.findMember(
      workspaceId,
      userId
    );
    return member !== null;
  }

  private async enrichWorkspaceWithUserContext(
    workspaceDto: WorkspaceDto,
    userId: UserId
  ): Promise<WorkspaceDto> {
    const member = await this.workspaceRepository.findMember(
      new WorkspaceId(workspaceDto.id),
      userId
    );

    return {
      ...workspaceDto,
      userRole: member?.role.value,
      userPermissions: member?.getPermissions(),
    };
  }

  private async mapWorkspaceToDto(workspace: any): Promise<WorkspaceDto> {
    const owner = await this.userRepository.findById(workspace.ownerId);
    const memberCount = await this.workspaceRepository.getMemberCount(
      workspace.id
    );
    const projectCount = await this.workspaceRepository.getProjectCount(
      workspace.id
    );
    const storageUsed = await this.workspaceRepository.getStorageUsed(
      workspace.id
    );

    return {
      id: workspace.id.value,
      name: workspace.name,
      slug: workspace.slug,
      description: workspace.description,
      ownerId: workspace.ownerId.value,
      plan: workspace.plan.value,
      settings: workspace.settings,
      memberCount,
      projectCount,
      storageUsedGB: storageUsed,
      isActive: workspace.isActive,
      createdAt: workspace.createdAt,
      updatedAt: workspace.updatedAt,
      owner: owner
        ? {
            id: owner.id.value,
            firstName: owner.firstName,
            lastName: owner.lastName,
            email: owner.email.value,
          }
        : {
            id: '',
            firstName: 'Unknown',
            lastName: 'User',
            email: '',
          },
    };
  }
}

/**
 * Get user workspaces
 */
export class GetUserWorkspacesQueryHandler
  extends BaseHandler
  implements
    IQueryHandler<GetUserWorkspacesQuery, PaginatedResult<WorkspaceDto>>
{
  constructor(
    eventPublisher: DomainEventPublisher,
    logger: LoggingService,
    private readonly workspaceRepository: IWorkspaceRepository,
    private readonly userRepository: IUserRepository,
    private readonly cacheService: CacheService
  ) {
    super(eventPublisher, logger);
  }

  async handle(
    query: GetUserWorkspacesQuery
  ): Promise<PaginatedResult<WorkspaceDto>> {
    this.logInfo('Getting user workspaces', {
      userId: query.userId.value,
    });

    try {
      // Generate cache key
      const cacheKey = `user-workspaces:${query.userId.value}:${JSON.stringify(query.pagination)}`;
      const cachedResult =
        await this.cacheService.get<PaginatedResult<WorkspaceDto>>(cacheKey);
      if (cachedResult) {
        return cachedResult;
      }

      const workspaces = await this.workspaceRepository.findByUserId(
        query.userId
      );
      const workspaceDtos: WorkspaceDto[] = [];

      for (const workspace of workspaces) {
        const dto = await this.mapWorkspaceToDto(workspace);
        const enrichedDto = await this.enrichWorkspaceWithUserContext(
          dto,
          query.userId
        );
        workspaceDtos.push(enrichedDto);
      }

      // Apply pagination
      const paginatedResult = this.applyPagination(
        workspaceDtos,
        query.pagination
      );

      // Cache the result
      await this.cacheService.set(cacheKey, paginatedResult, 300); // 5 minutes

      this.logInfo('User workspaces retrieved successfully', {
        userId: query.userId.value,
        count: paginatedResult.data.length,
      });

      return paginatedResult;
    } catch (error) {
      this.logError('Failed to get user workspaces', error as Error, {
        userId: query.userId.value,
      });
      throw error;
    }
  }

  private async enrichWorkspaceWithUserContext(
    workspaceDto: WorkspaceDto,
    userId: UserId
  ): Promise<WorkspaceDto> {
    const member = await this.workspaceRepository.findMember(
      new WorkspaceId(workspaceDto.id),
      userId
    );

    return {
      ...workspaceDto,
      userRole: member?.role.value,
      userPermissions: member?.getPermissions(),
    };
  }

  private async mapWorkspaceToDto(workspace: any): Promise<WorkspaceDto> {
    const owner = await this.userRepository.findById(workspace.ownerId);
    const memberCount = await this.workspaceRepository.getMemberCount(
      workspace.id
    );
    const projectCount = await this.workspaceRepository.getProjectCount(
      workspace.id
    );
    const storageUsed = await this.workspaceRepository.getStorageUsed(
      workspace.id
    );

    return {
      id: workspace.id.value,
      name: workspace.name,
      slug: workspace.slug,
      description: workspace.description,
      ownerId: workspace.ownerId.value,
      plan: workspace.plan.value,
      settings: workspace.settings,
      memberCount,
      projectCount,
      storageUsedGB: storageUsed,
      isActive: workspace.isActive,
      createdAt: workspace.createdAt,
      updatedAt: workspace.updatedAt,
      owner: owner
        ? {
            id: owner.id.value,
            firstName: owner.firstName,
            lastName: owner.lastName,
            email: owner.email.value,
          }
        : {
            id: '',
            firstName: 'Unknown',
            lastName: 'User',
            email: '',
          },
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

    const { page = 1, limit = 10 } = pagination;
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
 * Get workspace members
 */
export class GetWorkspaceMembersQueryHandler
  extends BaseHandler
  implements
    IQueryHandler<GetWorkspaceMembersQuery, PaginatedResult<WorkspaceMemberDto>>
{
  constructor(
    eventPublisher: DomainEventPublisher,
    logger: LoggingService,
    private readonly workspaceRepository: IWorkspaceRepository,
    private readonly userRepository: IUserRepository,
    private readonly cacheService: CacheService
  ) {
    super(eventPublisher, logger);
  }

  async handle(
    query: GetWorkspaceMembersQuery
  ): Promise<PaginatedResult<WorkspaceMemberDto>> {
    this.logInfo('Getting workspace members', {
      workspaceId: query.workspaceId.value,
      userId: query.userId.value,
    });

    try {
      // Check if user can view workspace members
      const canView = await this.canUserAccessWorkspace(
        query.userId,
        query.workspaceId
      );
      if (!canView) {
        throw new AuthorizationError(
          'User does not have permission to view workspace members'
        );
      }

      // Try cache first
      const cacheKey = `workspace-members:${query.workspaceId.value}:${JSON.stringify(query.pagination)}`;
      const cachedResult =
        await this.cacheService.get<PaginatedResult<WorkspaceMemberDto>>(
          cacheKey
        );
      if (cachedResult) {
        return cachedResult;
      }

      const members = await this.workspaceRepository.getWorkspaceMembers(
        query.workspaceId
      );
      const memberDtos: WorkspaceMemberDto[] = [];

      for (const member of members) {
        const user = await this.userRepository.findById(member.userId);
        if (user) {
          memberDtos.push({
            id: member.id.value,
            workspaceId: member.workspaceId.value,
            userId: member.userId.value,
            role: member.role.value,
            permissions: member.getPermissions(),
            joinedAt: member.joinedAt,
            lastActiveAt: member.lastActiveAt,
            user: {
              id: user.id.value,
              firstName: user.firstName,
              lastName: user.lastName,
              email: user.email.value,
              avatar: user.avatar,
            },
          });
        }
      }

      // Apply pagination
      const paginatedResult = this.applyPagination(
        memberDtos,
        query.pagination
      );

      // Cache the result
      await this.cacheService.set(cacheKey, paginatedResult, 600); // 10 minutes

      this.logInfo('Workspace members retrieved successfully', {
        workspaceId: query.workspaceId.value,
        count: paginatedResult.data.length,
      });

      return paginatedResult;
    } catch (error) {
      this.logError('Failed to get workspace members', error as Error, {
        workspaceId: query.workspaceId.value,
      });
      throw error;
    }
  }

  private async canUserAccessWorkspace(
    userId: UserId,
    workspaceId: WorkspaceId
  ): Promise<boolean> {
    const member = await this.workspaceRepository.findMember(
      workspaceId,
      userId
    );
    return member !== null;
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
 * Get workspace statistics
 */
export class GetWorkspaceStatisticsQueryHandler
  extends BaseHandler
  implements IQueryHandler<GetWorkspaceStatisticsQuery, WorkspaceStatisticsDto>
{
  constructor(
    eventPublisher: DomainEventPublisher,
    logger: LoggingService,
    private readonly workspaceRepository: IWorkspaceRepository,
    private readonly cacheService: CacheService
  ) {
    super(eventPublisher, logger);
  }

  async handle(
    query: GetWorkspaceStatisticsQuery
  ): Promise<WorkspaceStatisticsDto> {
    this.logInfo('Getting workspace statistics', {
      workspaceId: query.workspaceId.value,
      userId: query.userId.value,
    });

    try {
      // Check permissions
      const hasAccess = await this.canUserAccessWorkspace(
        query.userId,
        query.workspaceId
      );
      if (!hasAccess) {
        throw new AuthorizationError(
          'User does not have permission to view workspace statistics'
        );
      }

      // Generate cache key
      const cacheKey = `workspace-stats:${query.workspaceId.value}:${query.dateFrom?.toISOString() || 'all'}:${query.dateTo?.toISOString() || 'all'}`;
      const cachedStats =
        await this.cacheService.get<WorkspaceStatisticsDto>(cacheKey);
      if (cachedStats) {
        return cachedStats;
      }

      const statistics = await this.workspaceRepository.getWorkspaceStatistics(
        query.workspaceId,
        query.dateFrom,
        query.dateTo
      );

      // Cache the result for 5 minutes
      await this.cacheService.set(cacheKey, statistics, 300);

      this.logInfo('Workspace statistics retrieved successfully', {
        workspaceId: query.workspaceId.value,
      });

      return statistics;
    } catch (error) {
      this.logError('Failed to get workspace statistics', error as Error, {
        workspaceId: query.workspaceId.value,
      });
      throw error;
    }
  }

  private async canUserAccessWorkspace(
    userId: UserId,
    workspaceId: WorkspaceId
  ): Promise<boolean> {
    const member = await this.workspaceRepository.findMember(
      workspaceId,
      userId
    );
    return member !== null;
  }
}

/**
 * Get workspace usage
 */
export class GetWorkspaceUsageQueryHandler
  extends BaseHandler
  implements IQueryHandler<GetWorkspaceUsageQuery, WorkspaceUsageDto>
{
  constructor(
    eventPublisher: DomainEventPublisher,
    logger: LoggingService,
    private readonly workspaceRepository: IWorkspaceRepository,
    private readonly cacheService: CacheService
  ) {
    super(eventPublisher, logger);
  }

  async handle(query: GetWorkspaceUsageQuery): Promise<WorkspaceUsageDto> {
    this.logInfo('Getting workspace usage', {
      workspaceId: query.workspaceId.value,
      userId: query.userId.value,
    });

    try {
      // Check permissions
      const hasAccess = await this.canUserAccessWorkspace(
        query.userId,
        query.workspaceId
      );
      if (!hasAccess) {
        throw new AuthorizationError(
          'User does not have permission to view workspace usage'
        );
      }

      // Generate cache key
      const cacheKey = `workspace-usage:${query.workspaceId.value}`;
      const cachedUsage =
        await this.cacheService.get<WorkspaceUsageDto>(cacheKey);
      if (cachedUsage) {
        return cachedUsage;
      }

      const usage = await this.workspaceRepository.getUsageStatistics(
        query.workspaceId
      );

      // Cache the result for 5 minutes
      await this.cacheService.set(cacheKey, usage, 300);

      this.logInfo('Workspace usage retrieved successfully', {
        workspaceId: query.workspaceId.value,
      });

      return usage;
    } catch (error) {
      this.logError('Failed to get workspace usage', error as Error, {
        workspaceId: query.workspaceId.value,
      });
      throw error;
    }
  }

  private async canUserAccessWorkspace(
    userId: UserId,
    workspaceId: WorkspaceId
  ): Promise<boolean> {
    const member = await this.workspaceRepository.findMember(
      workspaceId,
      userId
    );
    return member !== null;
  }
}

// Export aliases for backward compatibility
export const GetWorkspaceHandler = GetWorkspaceByIdQueryHandler;
export const ListWorkspacesHandler = GetUserWorkspacesQueryHandler;
export const GetWorkspaceStatsHandler = GetWorkspaceStatisticsQueryHandler;
