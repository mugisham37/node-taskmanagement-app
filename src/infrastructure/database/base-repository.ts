import { PrismaClient, Prisma } from '@prisma/client';
import { Entity } from '../../domain/shared/base/entity';
import {
  IRepository,
  ISpecification,
  IPaginationOptions,
  IPaginatedResult,
} from '../../domain/shared/repositories/IRepository';
import { prisma } from './prisma-client';
import { IUnitOfWork } from './unit-of-work';
import { logger } from '../logging/logger';

export abstract class BasePrismaRepository<
  TEntity extends Entity<TId>,
  TId,
  TPrismaModel,
  TPrismaDelegate,
> implements IRepository<TEntity, TId>
{
  protected readonly client: PrismaClient;
  protected readonly modelName: string;

  constructor(modelName: string, client: PrismaClient = prisma) {
    this.client = client;
    this.modelName = modelName;
  }

  // Abstract methods that must be implemented by concrete repositories
  protected abstract toDomain(prismaModel: TPrismaModel): TEntity;
  protected abstract toPrisma(entity: TEntity): any;
  protected abstract getDelegate(
    client: PrismaClient | Prisma.TransactionClient
  ): TPrismaDelegate;
  protected abstract buildWhereClause(
    specification: ISpecification<TEntity>
  ): any;

  // Basic CRUD operations
  public async findById(id: TId): Promise<TEntity | null> {
    try {
      const delegate = this.getDelegate(this.client);
      const result = await (delegate as any).findUnique({
        where: { id },
        ...this.getDefaultInclude(),
      });

      if (!result) {
        return null;
      }

      return this.toDomain(result);
    } catch (error) {
      logger.error(`Error finding ${this.modelName} by id`, { id, error });
      throw error;
    }
  }

  public async findByIds(ids: TId[]): Promise<TEntity[]> {
    try {
      const delegate = this.getDelegate(this.client);
      const results = await (delegate as any).findMany({
        where: { id: { in: ids } },
        ...this.getDefaultInclude(),
      });

      return results.map((result: TPrismaModel) => this.toDomain(result));
    } catch (error) {
      logger.error(`Error finding ${this.modelName} by ids`, { ids, error });
      throw error;
    }
  }

  public async findAll(): Promise<TEntity[]> {
    try {
      const delegate = this.getDelegate(this.client);
      const results = await (delegate as any).findMany({
        ...this.getDefaultInclude(),
        orderBy: this.getDefaultOrderBy(),
      });

      return results.map((result: TPrismaModel) => this.toDomain(result));
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
      const delegate = this.getDelegate(this.client);

      const results = await (delegate as any).findMany({
        where: whereClause,
        ...this.getDefaultInclude(),
        orderBy: this.getDefaultOrderBy(),
      });

      return results.map((result: TPrismaModel) => this.toDomain(result));
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
      const delegate = this.getDelegate(this.client);

      const result = await (delegate as any).findFirst({
        where: whereClause,
        ...this.getDefaultInclude(),
      });

      if (!result) {
        return null;
      }

      return this.toDomain(result);
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
      const skip = (page - 1) * limit;

      const whereClause = specification
        ? this.buildWhereClause(specification)
        : {};
      const orderBy = this.buildOrderBy(pagination);

      const delegate = this.getDelegate(this.client);

      // Execute count and data queries in parallel
      const [totalCount, results] = await Promise.all([
        (delegate as any).count({ where: whereClause }),
        (delegate as any).findMany({
          where: whereClause,
          skip,
          take: limit,
          orderBy,
          ...this.getDefaultInclude(),
        }),
      ]);

      const items = results.map((result: TPrismaModel) =>
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
      const data = this.toPrisma(entity);
      const delegate = this.getDelegate(this.client);

      const result = await (delegate as any).create({
        data,
        ...this.getDefaultInclude(),
      });

      return this.toDomain(result);
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
      const data = entities.map(entity => this.toPrisma(entity));
      const delegate = this.getDelegate(this.client);

      // Use transaction for bulk insert
      const results = await this.client.$transaction(
        data.map(item => (delegate as any).create({ data: item }))
      );

      return results.map((result: TPrismaModel) => this.toDomain(result));
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
      const data = this.toPrisma(entity);
      const delegate = this.getDelegate(this.client);

      const result = await (delegate as any).update({
        where: { id: entity.id },
        data,
        ...this.getDefaultInclude(),
      });

      return this.toDomain(result);
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
      const delegate = this.getDelegate(this.client);

      // Use transaction for bulk update
      const results = await this.client.$transaction(
        entities.map(entity => {
          const data = this.toPrisma(entity);
          return (delegate as any).update({
            where: { id: entity.id },
            data,
          });
        })
      );

      return results.map((result: TPrismaModel) => this.toDomain(result));
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
      const delegate = this.getDelegate(this.client);
      await (delegate as any).delete({
        where: { id },
      });
    } catch (error) {
      logger.error(`Error deleting ${this.modelName}`, { id, error });
      throw error;
    }
  }

  public async deleteMany(ids: TId[]): Promise<void> {
    try {
      const delegate = this.getDelegate(this.client);
      await (delegate as any).deleteMany({
        where: { id: { in: ids } },
      });
    } catch (error) {
      logger.error(`Error deleting many ${this.modelName}`, { ids, error });
      throw error;
    }
  }

  public async count(specification?: ISpecification<TEntity>): Promise<number> {
    try {
      const whereClause = specification
        ? this.buildWhereClause(specification)
        : {};
      const delegate = this.getDelegate(this.client);

      return await (delegate as any).count({ where: whereClause });
    } catch (error) {
      logger.error(`Error counting ${this.modelName}`, { error });
      throw error;
    }
  }

  public async exists(id: TId): Promise<boolean> {
    try {
      const delegate = this.getDelegate(this.client);
      const result = await (delegate as any).findUnique({
        where: { id },
        select: { id: true },
      });

      return result !== null;
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
      const delegate = this.getDelegate(this.client);

      const result = await (delegate as any).findFirst({
        where: whereClause,
        select: { id: true },
      });

      return result !== null;
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
      const data = entities.map(entity => this.toPrisma(entity));
      const delegate = this.getDelegate(this.client);

      await (delegate as any).createMany({
        data,
        skipDuplicates: false,
      });
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
      const data = this.toPrisma(updates as TEntity);
      const delegate = this.getDelegate(this.client);

      const result = await (delegate as any).updateMany({
        where: whereClause,
        data,
      });

      return result.count;
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
      const delegate = this.getDelegate(this.client);

      const result = await (delegate as any).deleteMany({
        where: whereClause,
      });

      return result.count;
    } catch (error) {
      logger.error(`Error bulk deleting ${this.modelName}`, { error });
      throw error;
    }
  }

  // Helper methods that can be overridden by concrete repositories
  protected getDefaultInclude(): any {
    return {};
  }

  protected getDefaultOrderBy(): any {
    return { createdAt: 'desc' };
  }

  protected buildOrderBy(pagination?: IPaginationOptions): any {
    if (!pagination?.sortBy) {
      return this.getDefaultOrderBy();
    }

    return {
      [pagination.sortBy]: pagination.sortOrder || 'asc',
    };
  }

  // Transaction support
  protected async executeInTransaction<T>(
    operation: (client: Prisma.TransactionClient) => Promise<T>
  ): Promise<T> {
    return await this.client.$transaction(operation);
  }

  // Unit of Work support
  protected getClientFromUoW(
    uow?: IUnitOfWork
  ): PrismaClient | Prisma.TransactionClient {
    return uow?.getClient() || this.client;
  }
}
