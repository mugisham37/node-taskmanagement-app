import { Entity } from '../base/entity';
import {
  IRepository,
  ISpecification,
  IPaginationOptions,
  IPaginatedResult,
} from './IRepository';

export abstract class BaseRepository<T extends Entity<any>, TId>
  implements IRepository<T, TId>
{
  // Abstract methods that must be implemented by concrete repositories
  public abstract findById(id: TId): Promise<T | null>;
  public abstract findByIds(ids: TId[]): Promise<T[]>;
  public abstract findAll(): Promise<T[]>;
  public abstract save(entity: T): Promise<T>;
  public abstract update(entity: T): Promise<T>;
  public abstract delete(id: TId): Promise<void>;

  // Default implementations using specifications
  public async findMany(specification: ISpecification<T>): Promise<T[]> {
    const allEntities = await this.findAll();
    return allEntities.filter(entity => specification.isSatisfiedBy(entity));
  }

  public async findOne(specification: ISpecification<T>): Promise<T | null> {
    const entities = await this.findMany(specification);
    return entities.length > 0 ? entities[0] : null;
  }

  public async findPaginated(
    specification?: ISpecification<T>,
    pagination?: IPaginationOptions
  ): Promise<IPaginatedResult<T>> {
    let entities = specification
      ? await this.findMany(specification)
      : await this.findAll();

    // Apply sorting
    if (pagination?.sortBy) {
      entities = this.applySorting(
        entities,
        pagination.sortBy,
        pagination.sortOrder || 'asc'
      );
    }

    const totalCount = entities.length;
    const page = pagination?.page || 1;
    const limit = pagination?.limit || 10;
    const totalPages = Math.ceil(totalCount / limit);

    // Apply pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedEntities = entities.slice(startIndex, endIndex);

    return {
      items: paginatedEntities,
      totalCount,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    };
  }

  public async saveMany(entities: T[]): Promise<T[]> {
    const savedEntities: T[] = [];
    for (const entity of entities) {
      savedEntities.push(await this.save(entity));
    }
    return savedEntities;
  }

  public async updateMany(entities: T[]): Promise<T[]> {
    const updatedEntities: T[] = [];
    for (const entity of entities) {
      updatedEntities.push(await this.update(entity));
    }
    return updatedEntities;
  }

  public async deleteMany(ids: TId[]): Promise<void> {
    for (const id of ids) {
      await this.delete(id);
    }
  }

  public async count(specification?: ISpecification<T>): Promise<number> {
    const entities = specification
      ? await this.findMany(specification)
      : await this.findAll();
    return entities.length;
  }

  public async exists(id: TId): Promise<boolean> {
    const entity = await this.findById(id);
    return entity !== null;
  }

  public async existsWhere(specification: ISpecification<T>): Promise<boolean> {
    const entity = await this.findOne(specification);
    return entity !== null;
  }

  // Bulk operations - default implementations
  public async bulkInsert(entities: T[]): Promise<void> {
    await this.saveMany(entities);
  }

  public async bulkUpdate(
    specification: ISpecification<T>,
    updates: Partial<T>
  ): Promise<number> {
    const entities = await this.findMany(specification);
    let updateCount = 0;

    for (const entity of entities) {
      // Apply updates to entity
      Object.assign(entity, updates);
      await this.update(entity);
      updateCount++;
    }

    return updateCount;
  }

  public async bulkDelete(specification: ISpecification<T>): Promise<number> {
    const entities = await this.findMany(specification);
    const ids = entities.map(entity => this.extractId(entity));

    await this.deleteMany(ids);
    return entities.length;
  }

  // Helper methods
  protected abstract extractId(entity: T): TId;

  protected applySorting(
    entities: T[],
    sortBy: string,
    sortOrder: 'asc' | 'desc'
  ): T[] {
    return entities.sort((a, b) => {
      const aValue = this.getPropertyValue(a, sortBy);
      const bValue = this.getPropertyValue(b, sortBy);

      if (aValue === bValue) return 0;

      const comparison = aValue < bValue ? -1 : 1;
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }

  protected getPropertyValue(entity: T, propertyPath: string): any {
    const properties = propertyPath.split('.');
    let value: any = entity;

    for (const property of properties) {
      if (value && typeof value === 'object' && property in value) {
        value = value[property];
      } else {
        return undefined;
      }
    }

    return value;
  }

  // Template methods for common operations
  protected async beforeSave(entity: T): Promise<void> {
    // Override in derived classes for pre-save logic
  }

  protected async afterSave(entity: T): Promise<void> {
    // Override in derived classes for post-save logic
  }

  protected async beforeUpdate(entity: T): Promise<void> {
    // Override in derived classes for pre-update logic
  }

  protected async afterUpdate(entity: T): Promise<void> {
    // Override in derived classes for post-update logic
  }

  protected async beforeDelete(id: TId): Promise<void> {
    // Override in derived classes for pre-delete logic
  }

  protected async afterDelete(id: TId): Promise<void> {
    // Override in derived classes for post-delete logic
  }

  // Validation helpers
  protected validateEntity(entity: T): void {
    if (!entity) {
      throw new Error('Entity cannot be null or undefined');
    }
  }

  protected validateId(id: TId): void {
    if (!id) {
      throw new Error('ID cannot be null or undefined');
    }
  }

  protected validateIds(ids: TId[]): void {
    if (!ids || ids.length === 0) {
      throw new Error('IDs array cannot be null, undefined, or empty');
    }

    for (const id of ids) {
      this.validateId(id);
    }
  }

  // Error handling helpers
  protected handleRepositoryError(error: Error, operation: string): never {
    console.error(`Repository error during ${operation}:`, error);
    throw new Error(
      `Repository operation failed: ${operation}. ${error.message}`
    );
  }

  // Caching helpers (can be overridden for specific caching strategies)
  protected getCacheKey(operation: string, ...params: any[]): string {
    return `${this.constructor.name}:${operation}:${JSON.stringify(params)}`;
  }

  protected async getFromCache<TResult>(key: string): Promise<TResult | null> {
    // Override in derived classes to implement caching
    return null;
  }

  protected async setCache<TResult>(
    key: string,
    value: TResult,
    ttl?: number
  ): Promise<void> {
    // Override in derived classes to implement caching
  }

  protected async invalidateCache(pattern: string): Promise<void> {
    // Override in derived classes to implement cache invalidation
  }
}
