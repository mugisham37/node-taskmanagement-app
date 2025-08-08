import { eq, and, or, ilike, isNull, isNotNull, desc, asc, inArray, lte } from 'drizzle-orm';
import { BaseRepository } from './base/base.repository';
import { 
  calendarIntegrations, 
  CalendarIntegration, 
  NewCalendarIntegration 
} from '../schema/calendar-integrations';
import { PaginationOptions, PaginatedResult, SearchOptions } from './base/interfaces';
import { RepositoryException } from './base/types';

export class CalendarIntegrationRepository extends BaseRepository<CalendarIntegration, NewCalendarIntegration> {
  protected table = calendarIntegrations;
  protected primaryKey = 'id';

  constructor() {
    super(
      { enabled: true, ttl: 300, keyPrefix: 'calendar_integration' }, // Enable caching for calendar integrations
      { enabled: true, trackChanges: true } // Enable audit logging
    );
  }

  // Calendar Integration specific methods
  async findByUser(userId: string, options: PaginationOptions = {}): Promise<PaginatedResult<CalendarIntegration>> {
    try {
      return await this.findMany({
        where: eq(calendarIntegrations.userId, userId),
        ...options,
        sortBy: 'createdAt',
        sortOrder: 'desc'
      });
    } catch (error) {
      throw this.handleError(error, 'findByUser');
    }
  }

  async findByProvider(provider: string, options: PaginationOptions = {}): Promise<PaginatedResult<CalendarIntegration>> {
    try {
      return await this.findMany({
        where: eq(calendarIntegrations.provider, provider),
        ...options,
        sortBy: 'createdAt',
        sortOrder: 'desc'
      });
    } catch (error) {
      throw this.handleError(error, 'findByProvider');
    }
  }

  async findByUserAndProvider(userId: string, provider: string, options: PaginationOptions = {}): Promise<PaginatedResult<CalendarIntegration>> {
    try {
      return await this.findMany({
        where: and(
          eq(calendarIntegrations.userId, userId),
          eq(calendarIntegrations.provider, provider)
        ),
        ...options,
        sortBy: 'createdAt',
        sortOrder: 'desc'
      });
    } catch (error) {
      throw this.handleError(error, 'findByUserAndProvider');
    }
  }

  async findByProviderAccount(provider: string, providerAccountId: string): Promise<CalendarIntegration | null> {
    try {
      const result = await this.findMany({
        where: and(
          eq(calendarIntegrations.provider, provider),
          eq(calendarIntegrations.providerAccountId, providerAccountId)
        ),
        limit: 1
      });
      return result.data[0] || null;
    } catch (error) {
      throw this.handleError(error, 'findByProviderAccount');
    }
  }

  async findByCalendarId(provider: string, calendarId: string): Promise<CalendarIntegration | null> {
    try {
      const result = await this.findMany({
        where: and(
          eq(calendarIntegrations.provider, provider),
          eq(calendarIntegrations.calendarId, calendarId)
        ),
        limit: 1
      });
      return result.data[0] || null;
    } catch (error) {
      throw this.handleError(error, 'findByCalendarId');
    }
  }

  async findEnabledIntegrations(options: PaginationOptions = {}): Promise<PaginatedResult<CalendarIntegration>> {
    try {
      return await this.findMany({
        where: eq(calendarIntegrations.syncEnabled, true),
        ...options,
        sortBy: 'lastSyncedAt',
        sortOrder: 'asc'
      });
    } catch (error) {
      throw this.handleError(error, 'findEnabledIntegrations');
    }
  }

  async findIntegrationsNeedingSync(hoursAgo: number = 1, options: PaginationOptions = {}): Promise<PaginatedResult<CalendarIntegration>> {
    try {
      const cutoffTime = new Date();
      cutoffTime.setHours(cutoffTime.getHours() - hoursAgo);

      return await this.findMany({
        where: and(
          eq(calendarIntegrations.syncEnabled, true),
          or(
            isNull(calendarIntegrations.lastSyncedAt),
            lte(calendarIntegrations.lastSyncedAt, cutoffTime)
          )
        ),
        ...options,
        sortBy: 'lastSyncedAt',
        sortOrder: 'asc'
      });
    } catch (error) {
      throw this.handleError(error, 'findIntegrationsNeedingSync');
    }
  }

  async findExpiredTokens(options: PaginationOptions = {}): Promise<PaginatedResult<CalendarIntegration>> {
    try {
      const now = new Date();
      return await this.findMany({
        where: and(
          isNotNull(calendarIntegrations.tokenExpiry),
          lte(calendarIntegrations.tokenExpiry, now)
        ),
        ...options,
        sortBy: 'tokenExpiry',
        sortOrder: 'asc'
      });
    } catch (error) {
      throw this.handleError(error, 'findExpiredTokens');
    }
  }

  async enableSync(integrationId: string): Promise<CalendarIntegration | null> {
    try {
      return await this.update(integrationId, {
        syncEnabled: true
      } as any);
    } catch (error) {
      throw this.handleError(error, 'enableSync');
    }
  }

  async disableSync(integrationId: string): Promise<CalendarIntegration | null> {
    try {
      return await this.update(integrationId, {
        syncEnabled: false
      } as any);
    } catch (error) {
      throw this.handleError(error, 'disableSync');
    }
  }

  async updateTokens(integrationId: string, accessToken: string, refreshToken?: string, tokenExpiry?: Date): Promise<CalendarIntegration | null> {
    try {
      const updateData: any = {
        accessToken,
        updatedAt: new Date()
      };

      if (refreshToken) {
        updateData.refreshToken = refreshToken;
      }

      if (tokenExpiry) {
        updateData.tokenExpiry = tokenExpiry;
      }

      return await this.update(integrationId, updateData);
    } catch (error) {
      throw this.handleError(error, 'updateTokens');
    }
  }

  async updateLastSynced(integrationId: string, syncErrors?: any[]): Promise<CalendarIntegration | null> {
    try {
      const updateData: any = {
        lastSyncedAt: new Date(),
        updatedAt: new Date()
      };

      if (syncErrors) {
        updateData.syncErrors = syncErrors;
      }

      return await this.update(integrationId, updateData);
    } catch (error) {
      throw this.handleError(error, 'updateLastSynced');
    }
  }

  async updateSettings(integrationId: string, settings: Record<string, any>): Promise<CalendarIntegration | null> {
    try {
      return await this.update(integrationId, {
        settings,
        updatedAt: new Date()
      } as any);
    } catch (error) {
      throw this.handleError(error, 'updateSettings');
    }
  }

  async addSyncError(integrationId: string, error: any): Promise<CalendarIntegration | null> {
    try {
      const integration = await this.findById(integrationId);
      if (!integration) return null;

      const existingErrors = (integration.syncErrors as any[]) || [];
      const newErrors = [...existingErrors, {
        timestamp: new Date(),
        error: error
      }].slice(-10); // Keep only last 10 errors

      return await this.update(integrationId, {
        syncErrors: newErrors,
        updatedAt: new Date()
      } as any);
    } catch (error) {
      throw this.handleError(error, 'addSyncError');
    }
  }

  async clearSyncErrors(integrationId: string): Promise<CalendarIntegration | null> {
    try {
      return await this.update(integrationId, {
        syncErrors: [],
        updatedAt: new Date()
      } as any);
    } catch (error) {
      throw this.handleError(error, 'clearSyncErrors');
    }
  }

  async getIntegrationStats(userId?: string): Promise<{
    total: number;
    enabled: number;
    disabled: number;
    byProvider: Record<string, number>;
    withErrors: number;
    expiredTokens: number;
  }> {
    try {
      const baseWhere = userId ? eq(calendarIntegrations.userId, userId) : undefined;
      const now = new Date();

      const [
        total,
        enabled,
        disabled,
        withErrors,
        expiredTokens
      ] = await Promise.all([
        this.count({ where: baseWhere }),
        this.count({ 
          where: baseWhere ? 
            and(baseWhere, eq(calendarIntegrations.syncEnabled, true)) :
            eq(calendarIntegrations.syncEnabled, true)
        }),
        this.count({ 
          where: baseWhere ? 
            and(baseWhere, eq(calendarIntegrations.syncEnabled, false)) :
            eq(calendarIntegrations.syncEnabled, false)
        }),
        this.count({ 
          where: baseWhere ? 
            and(baseWhere, isNotNull(calendarIntegrations.syncErrors)) :
            isNotNull(calendarIntegrations.syncErrors)
        }),
        this.count({ 
          where: baseWhere ? 
            and(baseWhere, isNotNull(calendarIntegrations.tokenExpiry), lte(calendarIntegrations.tokenExpiry, now)) :
            and(isNotNull(calendarIntegrations.tokenExpiry), lte(calendarIntegrations.tokenExpiry, now))
        })
      ]);

      // For byProvider stats, we'd need to group by provider
      const byProvider: Record<string, number> = {}; // Placeholder

      return {
        total,
        enabled,
        disabled,
        byProvider,
        withErrors,
        expiredTokens
      };
    } catch (error) {
      throw this.handleError(error, 'getIntegrationStats');
    }
  }

  async bulkDisableByUser(userId: string): Promise<{ success: boolean; count: number }> {
    try {
      const userIntegrations = await this.findByUser(userId, { limit: 1000 });
      const integrationIds = userIntegrations.data.map(integration => integration.id);
      
      if (integrationIds.length === 0) {
        return { success: true, count: 0 };
      }

      return await this.updateMany(integrationIds, { 
        syncEnabled: false,
        updatedAt: new Date()
      } as any);
    } catch (error) {
      throw this.handleError(error, 'bulkDisableByUser');
    }
  }

  async bulkDeleteByUser(userId: string): Promise<{ success: boolean; count: number }> {
    try {
      const userIntegrations = await this.findByUser(userId, { limit: 1000 });
      const integrationIds = userIntegrations.data.map(integration => integration.id);
      
      if (integrationIds.length === 0) {
        return { success: true, count: 0 };
      }

      return await this.deleteMany(integrationIds);
    } catch (error) {
      throw this.handleError(error, 'bulkDeleteByUser');
    }
  }

  async search(options: SearchOptions): Promise<PaginatedResult<CalendarIntegration>> {
    try {
      const { query, page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = options;
      const searchPattern = `%${query}%`;

      const whereCondition = or(
        ilike(calendarIntegrations.calendarName, searchPattern),
        ilike(calendarIntegrations.provider, searchPattern)
      );

      return await this.findMany({
        where: whereCondition,
        page,
        limit,
        sortBy,
        sortOrder
      });
    } catch (error) {
      throw this.handleError(error, 'search');
    }
  }

  // Override create to add validation
  async create(data: NewCalendarIntegration): Promise<CalendarIntegration> {
    try {
      // Add any calendar integration-specific validation here
      if (!data.provider || data.provider.trim().length === 0) {
        throw new RepositoryException('VALIDATION_ERROR', 'Calendar provider cannot be empty');
      }

      if (!data.providerAccountId || data.providerAccountId.trim().length === 0) {
        throw new RepositoryException('VALIDATION_ERROR', 'Provider account ID cannot be empty');
      }

      if (!data.calendarId || data.calendarId.trim().length === 0) {
        throw new RepositoryException('VALIDATION_ERROR', 'Calendar ID cannot be empty');
      }

      if (!data.accessToken || data.accessToken.trim().length === 0) {
        throw new RepositoryException('VALIDATION_ERROR', 'Access token cannot be empty');
      }

      // Check for duplicate integration
      const existing = await this.findByProviderAccount(data.provider, data.providerAccountId);
      if (existing) {
        throw new RepositoryException('DUPLICATE_KEY', 'Calendar integration already exists for this provider account');
      }

      return await super.create(data);
    } catch (error) {
      if (error instanceof RepositoryException) {
        throw error;
      }
      throw this.handleError(error, 'create');
    }
  }
}

// Export singleton instance
export const calendarIntegrationRepository = new CalendarIntegrationRepository();
