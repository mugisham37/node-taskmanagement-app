/**
 * Enhanced Base Drizzle Repository
 * Comprehensive repository base class with advanced features migrated from older version
 */

import { eq, and, or, desc, asc, count, sql, inArray } from 'drizzle-orm';
import { PgDatabase } from 'drizzle-orm/pg-core';
import { Entity } from '../../../domain/base/entity';
import {
  IRepository,
  ISpecification,
  IPaginationOptions,
  IPaginatedResult,
} from '../../../domain/base/repository.interface';
import { db } from '../connection';
import { logger } from '../../monitoring/logging-service';
import { TransactionContext } from '../transaction-manager';

export abstract class BaseDrizzleRepository<
  TEntity extends Entity<TId>,
  TId,
  TDrizzleModel,
  TDrizzleTable,
> implements IRepository<TEntity, TId>
{
  protected readonly database: PgDatabase<any>;
  protected readonly table: TDrizzleTable;
  protected readonly modelName: string;

  constructor(
    table: TDrizzleTable,
    modelName: string,
    database: PgDatabase<any> = db
  ) {
    this.database = database;
    this.table = table;
    this.modelName = modelName;
  }

  // Abstract methods that must be implemented by concrete repositories
  protected abstract toDomain(drizzleModel: TDrizzleModel): TEntity;
  protected abstract toDrizzle(entity: TEntity): Partial<TDrizzleModel>;
  protected abstract buildWhereClause(
    specification: ISpecification<TEntity>
  ): any;

  // Basic CRUD operations
  public async findById(id: TId): Promise<TEntity | null> {
    try {
      const results = await this.database
        .select()
        .from(this.table as any)
        .where(eq((this.table as any).id, id))
        .limit(1);

      if (results.length === 0) {
        return null;
      }

      return this.toDomain(results[0] as TDrizzleModel);
    } catch (error) {
      logger.error(`Error finding ${this.modelName} by id`, { id, error });
      throw error;
    }
  }

  public async findByIds(ids: TId[]): Promise<TEntity[]> {
    try {
      const results = await this.database
        .select()
        .from(this.table as any)
        .where(inArray((this.table as any).id, ids));

      return results.map((result: TDrizzleModel) => this.toDomain(result));
    } catch (error) {
      logger.error(`Error finding ${this.modelName} by ids`, { ids, error });
      throw error;
    }
  }

  public async findAll(): Promise<TEntity[]> {
    try {
      const results = await this.database
        .select()
        .from(this.table as any)
        .orderBy(this.getDefaultOrderBy());

      return results.map((result: TDrizzleModel) => this.toDomain(result));
    } catch (error) {
      logger.error(`Error finding all ${this.modelName}`, { error });
      throw error;
    }
  }

  public async findMany(
    specification: ISpecification<TEntity>
  ): Promise<TEntity[]> {
    try {
      const whereClause = this.buildWhereClause(specification);

      const results = await this.database
        .select()
        .from(this.table as any)
        .where(whereClause)
        .orderBy(this.getDefaultOrderBy());

      return results.map((result: TDrizzleModel) => this.toDomain(result));
    } catch (error) {
      logger.error(`Error finding ${this.modelName} with specification`, {
        error,
      });
      throw error;
    }
  }

  public async findOne(
    specification: ISpecification<TEntity>
  ): Promise<TEntity | null> {
    try {
      const whereClause = this.buildWhereClause(specification);

      const results = await this.database
        .select()
        .from(this.table as any)
        .where(whereClause)
        .limit(1);

      if (results.length === 0) {
        return null;
      }

      return this.toDomain(results[0] as TDrizzleModel);
    } catch (error) {
      logger.error(`Error finding one ${this.modelName} with specification`, {
        error,
      });
      throw error;
    }
  }

  public async findPaginated(
    specification?: ISpecification<TEntity>,
    pagination?: IPaginationOptions
  ): Promise<IPaginatedResult<TEntity>> {
    try {
      const page = pagination?.page || 1;
      const limit = Math.min(pagination?.limit || 10, 100); // Max 100 items per page
      const offset = (page - 1) * limit;

      const whereClause = specification
        ? this.buildWhereClause(specification)
        : undefined;
      const orderBy = this.buildOrderBy(pagination);

      // Execute count and data queries in parallel
      const [totalCountResult, results] = await Promise.all([
        this.database
          .select({ count: count() })
          .from(this.table as any)
          .where(whereClause),
        this.database
          .select()
          .from(this.table as any)
          .where(whereClause)
          .orderBy(orderBy)
          .limit(limit)
          .offset(offset),
      ]);

      const totalCount = totalCountResult[0]?.count || 0;
      const items = results.map((result: TDrizzleModel) =>
        this.toDomain(result)
      );
      const totalPages = Math.ceil(totalCount / limit);

      return {
        items,
        totalCount,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      };
    } catch (error) {
      logger.error(`Error finding paginated ${this.modelName}`, {
        pagination,
        error,
      });
      throw error;
    }
  }

  public async save(entity: TEntity): Promise<TEntity> {
    try {
      const data = this.toDrizzle(entity);

      const results = await this.database
        .insert(this.table as any)
        .values(data)
        .returning();

      return this.toDomain(results[0] as TDrizzleModel);
    } catch (error) {
      logger.error(`Error saving ${this.modelName}`, {
        entityId: entity.id,
        error,
      });
      throw error;
    }
  }

  public async saveMany(entities: TEntity[]): Promise<TEntity[]> {
    try {
      const data = entities.map(entity => this.toDrizzle(entity));

      const results = await this.database
        .insert(this.table as any)
        .values(data)
        .returning();

      return results.map((result: TDrizzleModel) => this.toDomain(result));
    } catch (error) {
      logger.error(`Error saving many ${this.modelName}`, {
        count: entities.length,
        error,
      });
      throw error;
    }
  }

  public async update(entity: TEntity): Promise<TEntity> {
    try {
      const data = this.toDrizzle(entity);

      const results = await this.database
        .update(this.table as any)
        .set(data)
        .where(eq((this.table as any).id, entity.id))
        .returning();

      if (results.length === 0) {
        throw new Error(`${this.modelName} with id ${entity.id} not found`);
      }

      return this.toDomain(results[0] as TDrizzleModel);
    } catch (error) {
      logger.error(`Error updating ${this.modelName}`, {
        entityId: entity.id,
        error,
      });
      throw error;
    }
  }

  public async updateMany(entities: TEntity[]): Promise<TEntity[]> {
    try {
      const results: TEntity[] = [];

      // Use transaction for bulk update
      await this.database.transaction(async tx => {
        for (const entity of entities) {
          const data = this.toDrizzle(entity);
          const updateResults = await tx
            .update(this.table as any)
            .set(data)
            .where(eq((this.table as any).id, entity.id))
            .returning();

          if (updateResults.length > 0) {
            results.push(this.toDomain(updateResults[0] as TDrizzleModel));
          }
        }
      });

      return results;
    } catch (error) {
      logger.error(`Error updating many ${this.modelName}`, {
        count: entities.length,
        error,
      });
      throw error;
    }
  }

  public async delete(id: TId): Promise<void> {
    try {
      await this.database
        .delete(this.table as any)
        .where(eq((this.table as any).id, id));
    } catch (error) {
      logger.error(`Error deleting ${this.modelName}`, { id, error });
      throw error;
    }
  }

  public async deleteMany(ids: TId[]): Promise<void> {
    try {
      await this.database
        .delete(this.table as any)
        .where(inArray((this.table as any).id, ids));
    } catch (error) {
      logger.error(`Error deleting many ${this.modelName}`, { ids, error });
      throw error;
    }
  }

  public async count(specification?: ISpecification<TEntity>): Promise<number> {
    try {
      const whereClause = specification
        ? this.buildWhereClause(specification)
        : undefined;

      const results = await this.database
        .select({ count: count() })
        .from(this.table as any)
        .where(whereClause);

      return results[0]?.count || 0;
    } catch (error) {
      logger.error(`Error counting ${this.modelName}`, { error });
      throw error;
    }
  }

  public async exists(id: TId): Promise<boolean> {
    try {
      const results = await this.database
        .select({ id: (this.table as any).id })
        .from(this.table as any)
        .where(eq((this.table as any).id, id))
        .limit(1);

      return results.length > 0;
    } catch (error) {
      logger.error(`Error checking existence of ${this.modelName}`, {
        id,
        error,
      });
      throw error;
    }
  }

  public async existsWhere(
    specification: ISpecification<TEntity>
  ): Promise<boolean> {
    try {
      const whereClause = this.buildWhereClause(specification);

      const results = await this.database
        .select({ id: (this.table as any).id })
        .from(this.table as any)
        .where(whereClause)
        .limit(1);

      return results.length > 0;
    } catch (error) {
      logger.error(
        `Error checking existence of ${this.modelName} with specification`,
        { error }
      );
      throw error;
    }
  }

  public async bulkInsert(entities: TEntity[]): Promise<void> {
    try {
      const data = entities.map(entity => this.toDrizzle(entity));

      await this.database.insert(this.table as any).values(data);
    } catch (error) {
      logger.error(`Error bulk inserting ${this.modelName}`, {
        count: entities.length,
        error,
      });
      throw error;
    }
  }

  public async bulkUpdate(
    specification: ISpecification<TEntity>,
    updates: Partial<TEntity>
  ): Promise<number> {
    try {
      const whereClause = this.buildWhereClause(specification);
      const data = this.toDrizzle(updates as TEntity);

      const results = await this.database
        .update(this.table as any)
        .set(data)
        .where(whereClause)
        .returning({ id: (this.table as any).id });

      return results.length;
    } catch (error) {
      logger.error(`Error bulk updating ${this.modelName}`, { error });
      throw error;
    }
  }

  public async bulkDelete(
    specification: ISpecification<TEntity>
  ): Promise<number> {
    try {
      const whereClause = this.buildWhereClause(specification);

      const results = await this.database
        .delete(this.table as any)
        .where(whereClause)
        .returning({ id: (this.table as any).id });

      return results.length;
    } catch (error) {
      logger.error(`Error bulk deleting ${this.modelName}`, { error });
      throw error;
    }
  }

  // Helper methods that can be overridden by concrete repositories
  protected getDefaultOrderBy(): any {
    return desc((this.table as any).createdAt);
  }

  protected buildOrderBy(pagination?: IPaginationOptions): any {
    if (!pagination?.sortBy) {
      return this.getDefaultOrderBy();
    }

    const direction = pagination.sortOrder === 'desc' ? desc : asc;
    return direction((this.table as any)[pagination.sortBy]);
  }

  // Transaction support
  protected async executeInTransaction<T>(
    operation: (tx: any) => Promise<T>
  ): Promise<T> {
    return await this.database.transaction(operation);
  }

  // Transaction context support
  protected getDatabaseFromContext(
    context?: TransactionContext
  ): PgDatabase<any> {
    return context?.database || this.database;
  }

  // Advanced query methods
  public async findWithRawQuery(
    query: string,
    params: any[] = []
  ): Promise<TEntity[]> {
    try {
      const results = await this.database.execute(sql.raw(query, params));
      return results.map((result: any) =>
        this.toDomain(result as TDrizzleModel)
      );
    } catch (error) {
      logger.error(`Error executing raw query for ${this.modelName}`, {
        query,
        error,
      });
      throw error;
    }
  }

  public async countWithRawQuery(
    query: string,
    params: any[] = []
  ): Promise<number> {
    try {
      const results = await this.database.execute(sql.raw(query, params));
      return results[0]?.count || 0;
    } catch (error) {
      logger.error(`Error executing raw count query for ${this.modelName}`, {
        query,
        error,
      });
      throw error;
    }
  }

  // Soft delete support
  public async softDelete(id: TId): Promise<void> {
    try {
      await this.database
        .update(this.table as any)
        .set({ deletedAt: new Date() } as any)
        .where(eq((this.table as any).id, id));

      logger.info(`${this.modelName} soft deleted`, { id });
    } catch (error) {
      logger.error(`Error soft deleting ${this.modelName}`, { id, error });
      throw error;
    }
  }

  public async restore(id: TId): Promise<void> {
    try {
      await this.database
        .update(this.table as any)
        .set({ deletedAt: null } as any)
        .where(eq((this.table as any).id, id));

      logger.info(`${this.modelName} restored`, { id });
    } catch (error) {
      logger.error(`Error restoring ${this.modelName}`, { id, error });
      throw error;
    }
  }

  // Audit support
  protected async recordAuditLog(
    action: string,
    entityId: TId,
    changes?: Record<string, any>,
    userId?: string
  ): Promise<void> {
    try {
      // This would integrate with your audit logging system
      logger.info(`${this.modelName} ${action}`, {
        entityId,
        changes,
        userId,
        timestamp: new Date(),
      });
    } catch (error) {
      logger.error('Error recording audit log', { action, entityId, error });
      // Don't throw - audit logging shouldn't break business operations
    }
  }
}
