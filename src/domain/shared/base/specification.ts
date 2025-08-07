/**
 * Specification pattern for complex queries
 * Allows building complex query conditions in a composable way
 */
export abstract class Specification<T> {
  abstract isSatisfiedBy(entity: T): boolean;
  abstract toQuery(): QueryExpression;

  and(other: Specification<T>): Specification<T> {
    return new AndSpecification(this, other);
  }

  or(other: Specification<T>): Specification<T> {
    return new OrSpecification(this, other);
  }

  not(): Specification<T> {
    return new NotSpecification(this);
  }
}

export interface QueryExpression {
  where?: Record<string, any>;
  include?: Record<string, any>;
  orderBy?: Record<string, 'asc' | 'desc'>;
  take?: number;
  skip?: number;
}

class AndSpecification<T> extends Specification<T> {
  constructor(
    private left: Specification<T>,
    private right: Specification<T>
  ) {
    super();
  }

  isSatisfiedBy(entity: T): boolean {
    return this.left.isSatisfiedBy(entity) && this.right.isSatisfiedBy(entity);
  }

  toQuery(): QueryExpression {
    const leftQuery = this.left.toQuery();
    const rightQuery = this.right.toQuery();

    return {
      where: {
        AND: [leftQuery.where, rightQuery.where].filter(Boolean),
      },
      include: { ...leftQuery.include, ...rightQuery.include },
      orderBy: rightQuery.orderBy || leftQuery.orderBy,
      take: rightQuery.take || leftQuery.take,
      skip: rightQuery.skip || leftQuery.skip,
    };
  }
}

class OrSpecification<T> extends Specification<T> {
  constructor(
    private left: Specification<T>,
    private right: Specification<T>
  ) {
    super();
  }

  isSatisfiedBy(entity: T): boolean {
    return this.left.isSatisfiedBy(entity) || this.right.isSatisfiedBy(entity);
  }

  toQuery(): QueryExpression {
    const leftQuery = this.left.toQuery();
    const rightQuery = this.right.toQuery();

    return {
      where: {
        OR: [leftQuery.where, rightQuery.where].filter(Boolean),
      },
      include: { ...leftQuery.include, ...rightQuery.include },
      orderBy: rightQuery.orderBy || leftQuery.orderBy,
      take: rightQuery.take || leftQuery.take,
      skip: rightQuery.skip || leftQuery.skip,
    };
  }
}

class NotSpecification<T> extends Specification<T> {
  constructor(private spec: Specification<T>) {
    super();
  }

  isSatisfiedBy(entity: T): boolean {
    return !this.spec.isSatisfiedBy(entity);
  }

  toQuery(): QueryExpression {
    const query = this.spec.toQuery();
    return {
      where: {
        NOT: query.where,
      },
      include: query.include,
      orderBy: query.orderBy,
      take: query.take,
      skip: query.skip,
    };
  }
}
