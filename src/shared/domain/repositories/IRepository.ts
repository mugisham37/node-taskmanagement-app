import {
  Repository,
  ExtendedRepository,
  PaginatedResult,
  Specification,
  SpecificationRepository,
} from '../repository';

/**
 * Re-export repository interfaces for backward compatibility
 */
export interface IRepository<T, ID> extends Repository<T, ID> {}

export interface IExtendedRepository<T, ID> extends ExtendedRepository<T, ID> {}

export interface IPaginatedResult<T> extends PaginatedResult<T> {}

export interface ISpecification<T> extends Specification<T> {}

export interface ISpecificationRepository<T, ID>
  extends SpecificationRepository<T, ID> {}

/**
 * Base specification class for backward compatibility
 */
export abstract class BaseSpecification<T> implements ISpecification<T> {
  abstract isSatisfiedBy(entity: T): boolean;

  and(other: ISpecification<T>): ISpecification<T> {
    return new AndSpecification(this, other);
  }

  or(other: ISpecification<T>): ISpecification<T> {
    return new OrSpecification(this, other);
  }

  not(): ISpecification<T> {
    return new NotSpecification(this);
  }
}

class AndSpecification<T> implements ISpecification<T> {
  constructor(
    private readonly left: ISpecification<T>,
    private readonly right: ISpecification<T>
  ) {}

  isSatisfiedBy(entity: T): boolean {
    return this.left.isSatisfiedBy(entity) && this.right.isSatisfiedBy(entity);
  }

  and(other: ISpecification<T>): ISpecification<T> {
    return new AndSpecification(this, other);
  }

  or(other: ISpecification<T>): ISpecification<T> {
    return new OrSpecification(this, other);
  }

  not(): ISpecification<T> {
    return new NotSpecification(this);
  }
}

class OrSpecification<T> implements ISpecification<T> {
  constructor(
    private readonly left: ISpecification<T>,
    private readonly right: ISpecification<T>
  ) {}

  isSatisfiedBy(entity: T): boolean {
    return this.left.isSatisfiedBy(entity) || this.right.isSatisfiedBy(entity);
  }

  and(other: ISpecification<T>): ISpecification<T> {
    return new AndSpecification(this, other);
  }

  or(other: ISpecification<T>): ISpecification<T> {
    return new OrSpecification(this, other);
  }

  not(): ISpecification<T> {
    return new NotSpecification(this);
  }
}

class NotSpecification<T> implements ISpecification<T> {
  constructor(private readonly specification: ISpecification<T>) {}

  isSatisfiedBy(entity: T): boolean {
    return !this.specification.isSatisfiedBy(entity);
  }

  and(other: ISpecification<T>): ISpecification<T> {
    return new AndSpecification(this, other);
  }

  or(other: ISpecification<T>): ISpecification<T> {
    return new OrSpecification(this, other);
  }

  not(): ISpecification<T> {
    return new NotSpecification(this);
  }
}

/**
 * Pagination options interface
 */
export interface IPaginationOptions {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}
