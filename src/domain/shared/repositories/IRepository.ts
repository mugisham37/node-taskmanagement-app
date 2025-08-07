import { Entity } from '../base/entity';

export interface ISpecification<T> {
  isSatisfiedBy(entity: T): boolean;
  and(other: ISpecification<T>): ISpecification<T>;
  or(other: ISpecification<T>): ISpecification<T>;
  not(): ISpecification<T>;
}

export interface IPaginationOptions {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface IPaginatedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface IRepository<T extends Entity<any>, TId> {
  // Basic CRUD operations
  findById(id: TId): Promise<T | null>;
  findByIds(ids: TId[]): Promise<T[]>;
  findAll(): Promise<T[]>;
  findMany(specification: ISpecification<T>): Promise<T[]>;
  findOne(specification: ISpecification<T>): Promise<T | null>;

  // Paginated queries
  findPaginated(
    specification?: ISpecification<T>,
    pagination?: IPaginationOptions
  ): Promise<IPaginatedResult<T>>;

  // Persistence operations
  save(entity: T): Promise<T>;
  saveMany(entities: T[]): Promise<T[]>;
  update(entity: T): Promise<T>;
  updateMany(entities: T[]): Promise<T[]>;
  delete(id: TId): Promise<void>;
  deleteMany(ids: TId[]): Promise<void>;

  // Query operations
  count(specification?: ISpecification<T>): Promise<number>;
  exists(id: TId): Promise<boolean>;
  existsWhere(specification: ISpecification<T>): Promise<boolean>;

  // Bulk operations
  bulkInsert(entities: T[]): Promise<void>;
  bulkUpdate(
    specification: ISpecification<T>,
    updates: Partial<T>
  ): Promise<number>;
  bulkDelete(specification: ISpecification<T>): Promise<number>;
}

// Base specification implementation
export abstract class BaseSpecification<T> implements ISpecification<T> {
  public abstract isSatisfiedBy(entity: T): boolean;

  public and(other: ISpecification<T>): ISpecification<T> {
    return new AndSpecification(this, other);
  }

  public or(other: ISpecification<T>): ISpecification<T> {
    return new OrSpecification(this, other);
  }

  public not(): ISpecification<T> {
    return new NotSpecification(this);
  }
}

// Composite specifications
export class AndSpecification<T> extends BaseSpecification<T> {
  constructor(
    private left: ISpecification<T>,
    private right: ISpecification<T>
  ) {
    super();
  }

  public isSatisfiedBy(entity: T): boolean {
    return this.left.isSatisfiedBy(entity) && this.right.isSatisfiedBy(entity);
  }
}

export class OrSpecification<T> extends BaseSpecification<T> {
  constructor(
    private left: ISpecification<T>,
    private right: ISpecification<T>
  ) {
    super();
  }

  public isSatisfiedBy(entity: T): boolean {
    return this.left.isSatisfiedBy(entity) || this.right.isSatisfiedBy(entity);
  }
}

export class NotSpecification<T> extends BaseSpecification<T> {
  constructor(private specification: ISpecification<T>) {
    super();
  }

  public isSatisfiedBy(entity: T): boolean {
    return !this.specification.isSatisfiedBy(entity);
  }
}

// Common specifications
export class TrueSpecification<T> extends BaseSpecification<T> {
  public isSatisfiedBy(entity: T): boolean {
    return true;
  }
}

export class FalseSpecification<T> extends BaseSpecification<T> {
  public isSatisfiedBy(entity: T): boolean {
    return false;
  }
}
