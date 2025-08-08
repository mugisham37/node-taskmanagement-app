import { eq, and, or, desc, asc, count, inArray, like, ilike, gte, lte, gt, lt, ne, between, isNull, isNotNull, SQL } from 'drizzle-orm';
import { PgTable, PgColumn } from 'drizzle-orm/pg-core';
import { db } from '../../connection';
import { 
  PaginationOptions, 
  PaginatedResult, 
  FilterOptions, 
  BulkOperationResult,
  BaseRepository as IBaseRepository
} from './interfaces';
import { 
  RepositoryException, 
  RepositoryError, 
  CacheConfig, 
  AuditConfig
} from './types';

export abstract class BaseRepository<TSelect, TInsert> implements IBaseRepository<TSelect, TInsert> {
  protected abstract table: PgTable;
  protected abstract primaryKey: string;
  protected cacheConfig: CacheConfig;
  protected auditConfig: AuditConfig;

  constructor(
    cacheConfig?: Partial<CacheConfig>,
    auditConfig?: Partial<AuditConfig>
  ) {
    this.cacheConfig = {
      enabled: false,
      ttl: 300, // 5 minutes default
      keyPrefix: this.constructor.name.toLowerCase(),
      ...cacheConfig
    };
    
    this.auditConfig = {
      enabled: false,
      trackChanges: false,
      ...auditConfig
    };
  }

  // Basic CRUD Operations
  async findById(id: string): Promise<TSelect | null> {
    try {
      const primaryKeyColumn = (this.table as any)[this.primaryKey];
      const result = await db
        .select()
        .from(this.table)
        .where(eq(primaryKeyColumn, id))
        .limit(1);
      
      return (result[0] as TSelect) || null;
    } catch (error) {
      throw this.handleError(error, 'findById');
    }
  }

  async findMany(options: PaginationOptions & FilterOptions = {}): Promise<PaginatedResult<TSelect>> {
    try {
      const {
        page = 1,
        limit = 10,
        sortBy,
        sortOrder = 'desc',
        where,
        orderBy
      } = options;

      const offset = (page - 1) * limit;

      // Build query for count
      let countQuery = db.select({ count: count() }).from(this.table);
      if (where) {
        countQuery = countQuery.where(where) as any;
      }

      // Build query for data
      let dataQuery = db.select().from(this.table);
      if (where) {
        dataQuery = dataQuery.where(where) as any;
      }

      // Apply ordering
      if (orderBy && orderBy.length > 0) {
        dataQuery = dataQuery.orderBy(...orderBy) as any;
      } else if (sortBy && (this.table as any)[sortBy]) {
        const orderFn = sortOrder === 'asc' ? asc : desc;
        const column = (this.table as any)[sortBy];
        dataQuery = dataQuery.orderBy(orderFn(column)) as any;
      }

      // Apply pagination
      dataQuery = dataQuery.limit(limit).offset(offset) as any;

      // Execute queries
      const [totalResult, data] = await Promise.all([
        countQuery,
        dataQuery
      ]);

      const total = totalResult[0]?.count || 0;
      const totalPages = Math.ceil(total / limit);

      return {
        data: data as TSelect[],
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };
    } catch (error) {
      throw this.handleError(error, 'findMany');
    }
  }

  async create(data: TInsert): Promise<TSelect> {
    try {
      const result = await db
        .insert(this.table)
        .values(data as any)
        .returning();
      
      const created = result[0] as TSelect;
      
      if (this.auditConfig.enabled) {
        await this.logAudit('CREATE', created);
      }
      
      return created;
    } catch (error) {
      throw this.handleError(error, 'create');
    }
  }

  async update(id: string, data: Partial<TInsert>, expectedVersion?: number): Promise<TSelect | null> {
    try {
      const updateData = {
        ...data,
        updatedAt: new Date()
      } as any;

      // Handle optimistic locking
      if (expectedVersion !== undefined && (this.table as any).version) {
        updateData.version = expectedVersion + 1;
      }

      const primaryKeyColumn = (this.table as any)[this.primaryKey];
      let whereCondition: SQL = eq(primaryKeyColumn, id);

      // Add version check for optimistic locking
      if (expectedVersion !== undefined && (this.table as any).version) {
        const versionColumn = (this.table as any).version;
        whereCondition = and(whereCondition, eq(versionColumn, expectedVersion)) as SQL;
      }

      const result = await db
        .update(this.table)
        .set(updateData)
        .where(whereCondition)
        .returning();
      
      const updated = (result[0] as TSelect) || null;
      
      if (!updated && expectedVersion !== undefined) {
        throw new RepositoryException('VALIDATION_ERROR', 'Optimistic locking failed - record was modified by another user');
      }
      
      if (updated && this.auditConfig.enabled) {
        await this.logAudit('UPDATE', updated, data);
      }
      
      return updated;
    } catch (error) {
      throw this.handleError(error, 'update');
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const primaryKeyColumn = (this.table as any)[this.primaryKey];
      const result = await db
        .delete(this.table)
        .where(eq(primaryKeyColumn, id));
      
      const deleted = (result.rowCount || 0) > 0;
      
      if (deleted && this.auditConfig.enabled) {
        await this.logAudit('DELETE', { id } as any);
      }
      
      return deleted;
    } catch (error) {
      throw this.handleError(error, 'delete');
    }
  }

  // Bulk Operations
  async createMany(data: TInsert[]): Promise<TSelect[]> {
    try {
      if (data.length === 0) return [];
      
      const result = await db
        .insert(this.table)
        .values(data as any)
        .returning();
      
      const created = result as TSelect[];
      
      if (this.auditConfig.enabled) {
        for (const item of created) {
          await this.logAudit('CREATE', item);
        }
      }
      
      return created;
    } catch (error) {
      throw this.handleError(error, 'createMany');
    }
  }

  async updateMany(ids: string[], data: Partial<TInsert>): Promise<BulkOperationResult> {
    try {
      if (ids.length === 0) {
        return { success: true, count: 0 };
      }

      const updateData = {
        ...data,
        updatedAt: new Date()
      } as any;

      const primaryKeyColumn = (this.table as any)[this.primaryKey];
      const result = await db
        .update(this.table)
        .set(updateData)
        .where(inArray(primaryKeyColumn, ids))
        .returning();
      
      const count = result.length;
      
      if (this.auditConfig.enabled) {
        for (const item of result) {
          await this.logAudit('UPDATE', item as TSelect, data);
        }
      }
      
      return { success: true, count };
    } catch (error) {
      return { 
        success: false, 
        count: 0, 
        errors: [this.handleError(error, 'updateMany')] 
      };
    }
  }

  async deleteMany(ids: string[]): Promise<BulkOperationResult> {
    try {
      if (ids.length === 0) {
        return { success: true, count: 0 };
      }

      const primaryKeyColumn = (this.table as any)[this.primaryKey];
      const result = await db
        .delete(this.table)
        .where(inArray(primaryKeyColumn, ids));
      
      const count = result.rowCount || 0;
      
      if (this.auditConfig.enabled) {
        for (const id of ids) {
          await this.logAudit('DELETE', { id } as any);
        }
      }
      
      return { success: true, count };
    } catch (error) {
      return { 
        success: false, 
        count: 0, 
        errors: [this.handleError(error, 'deleteMany')] 
      };
    }
  }

  // Utility Methods
  async exists(id: string): Promise<boolean> {
    try {
      const primaryKeyColumn = (this.table as any)[this.primaryKey];
      const result = await db
        .select({ id: primaryKeyColumn })
        .from(this.table)
        .where(eq(primaryKeyColumn, id))
        .limit(1);
      
      return result.length > 0;
    } catch (error) {
      throw this.handleError(error, 'exists');
    }
  }

  async count(options: FilterOptions = {}): Promise<number> {
    try {
      let query = db.select({ count: count() }).from(this.table);
      
      if (options.where) {
        query = query.where(options.where) as any;
      }
      
      const result = await query;
      return result[0]?.count || 0;
    } catch (error) {
      throw this.handleError(error, 'count');
    }
  }

  // Transaction Support
  async withTransaction<T>(callback: (tx: any) => Promise<T>): Promise<T> {
    try {
      return await db.transaction(callback);
    } catch (error) {
      throw this.handleError(error, 'withTransaction');
    }
  }

  // Error Handling
  protected handleError(error: any, operation: string): RepositoryException {
    let type: RepositoryError = 'UNKNOWN_ERROR';
    let message = `Error in ${operation}: ${error.message}`;

    if (error.code === '23505') {
      type = 'DUPLICATE_KEY';
      message = 'Duplicate key violation';
    } else if (error.code === '23503') {
      type = 'FOREIGN_KEY_VIOLATION';
      message = 'Foreign key constraint violation';
    } else if (error.code === '23514') {
      type = 'VALIDATION_ERROR';
      message = 'Check constraint violation';
    }

    return new RepositoryException(type, message, error);
  }

  // Audit Logging
  protected async logAudit(action: string, record: TSelect, changes?: any): Promise<void> {
    if (!this.auditConfig.enabled) return;

    // This would integrate with your activity logging system
    // For now, we'll just log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`[AUDIT] ${action} on ${this.constructor.name}:`, {
        record,
        changes,
        timestamp: new Date().toISOString(),
        userId: this.auditConfig.userId
      });
    }
  }

  // Soft Delete Support (for repositories that need it)
  async softDelete(id: string): Promise<TSelect | null> {
    return this.update(id, { deletedAt: new Date() } as any);
  }

  async restore(id: string): Promise<TSelect | null> {
    return this.update(id, { deletedAt: null } as any);
  }

  async findWithDeleted(options: PaginationOptions & FilterOptions = {}): Promise<PaginatedResult<TSelect>> {
    // This would include soft-deleted records
    return this.findMany(options);
  }

  async findDeleted(options: PaginationOptions & FilterOptions = {}): Promise<PaginatedResult<TSelect>> {
    const deletedAtColumn = (this.table as any)['deletedAt'];
    if (!deletedAtColumn) {
      throw new RepositoryException('VALIDATION_ERROR', 'Table does not support soft delete');
    }
    
    const whereCondition = isNotNull(deletedAtColumn);
    const combinedOptions = {
      ...options,
      where: options.where ? and(options.where, whereCondition) : whereCondition
    };
    return this.findMany(combinedOptions);
  }
}
