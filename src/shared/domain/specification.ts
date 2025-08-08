/**
 * Specification pattern implementation for complex business rules
 * Allows composable and reusable business logic validation
 */
export abstract class Specification<T> {
  /**
   * Checks if the entity satisfies this specification
   */
  abstract isSatisfiedBy(entity: T): boolean;

  /**
   * Combines this specification with another using AND logic
   */
  and(other: Specification<T>): Specification<T> {
    return new AndSpecification(this, other);
  }

  /**
   * Combines this specification with another using OR logic
   */
  or(other: Specification<T>): Specification<T> {
    return new OrSpecification(this, other);
  }

  /**
   * Negates this specification
   */
  not(): Specification<T> {
    return new NotSpecification(this);
  }
}

/**
 * Composite specification that combines two specifications with AND logic
 */
class AndSpecification<T> extends Specification<T> {
  constructor(
    private readonly left: Specification<T>,
    private readonly right: Specification<T>
  ) {
    super();
  }

  isSatisfiedBy(entity: T): boolean {
    return this.left.isSatisfiedBy(entity) && this.right.isSatisfiedBy(entity);
  }
}

/**
 * Composite specification that combines two specifications with OR logic
 */
class OrSpecification<T> extends Specification<T> {
  constructor(
    private readonly left: Specification<T>,
    private readonly right: Specification<T>
  ) {
    super();
  }

  isSatisfiedBy(entity: T): boolean {
    return this.left.isSatisfiedBy(entity) || this.right.isSatisfiedBy(entity);
  }
}

/**
 * Specification that negates another specification
 */
class NotSpecification<T> extends Specification<T> {
  constructor(private readonly specification: Specification<T>) {
    super();
  }

  isSatisfiedBy(entity: T): boolean {
    return !this.specification.isSatisfiedBy(entity);
  }
}

/**
 * Always true specification - useful for testing and default cases
 */
export class TrueSpecification<T> extends Specification<T> {
  isSatisfiedBy(entity: T): boolean {
    return true;
  }
}

/**
 * Always false specification - useful for testing and default cases
 */
export class FalseSpecification<T> extends Specification<T> {
  isSatisfiedBy(entity: T): boolean {
    return false;
  }
}

/**
 * Specification that checks if a property equals a specific value
 */
export class PropertyEqualsSpecification<T> extends Specification<T> {
  constructor(
    private readonly propertyName: keyof T,
    private readonly expectedValue: any
  ) {
    super();
  }

  isSatisfiedBy(entity: T): boolean {
    return entity[this.propertyName] === this.expectedValue;
  }
}

/**
 * Specification that checks if a property is in a list of values
 */
export class PropertyInSpecification<T> extends Specification<T> {
  constructor(
    private readonly propertyName: keyof T,
    private readonly values: any[]
  ) {
    super();
  }

  isSatisfiedBy(entity: T): boolean {
    return this.values.includes(entity[this.propertyName]);
  }
}

/**
 * Specification that checks if a numeric property is greater than a value
 */
export class PropertyGreaterThanSpecification<T> extends Specification<T> {
  constructor(
    private readonly propertyName: keyof T,
    private readonly threshold: number
  ) {
    super();
  }

  isSatisfiedBy(entity: T): boolean {
    const value = entity[this.propertyName];
    return typeof value === 'number' && value > this.threshold;
  }
}

/**
 * Specification that checks if a numeric property is less than a value
 */
export class PropertyLessThanSpecification<T> extends Specification<T> {
  constructor(
    private readonly propertyName: keyof T,
    private readonly threshold: number
  ) {
    super();
  }

  isSatisfiedBy(entity: T): boolean {
    const value = entity[this.propertyName];
    return typeof value === 'number' && value < this.threshold;
  }
}

/**
 * Specification that checks if a date property is after a specific date
 */
export class DateAfterSpecification<T> extends Specification<T> {
  constructor(
    private readonly propertyName: keyof T,
    private readonly date: Date
  ) {
    super();
  }

  isSatisfiedBy(entity: T): boolean {
    const value = entity[this.propertyName];
    return value instanceof Date && value > this.date;
  }
}

/**
 * Specification that checks if a date property is before a specific date
 */
export class DateBeforeSpecification<T> extends Specification<T> {
  constructor(
    private readonly propertyName: keyof T,
    private readonly date: Date
  ) {
    super();
  }

  isSatisfiedBy(entity: T): boolean {
    const value = entity[this.propertyName];
    return value instanceof Date && value < this.date;
  }
}

/**
 * Specification that uses a custom predicate function
 */
export class PredicateSpecification<T> extends Specification<T> {
  constructor(private readonly predicate: (entity: T) => boolean) {
    super();
  }

  isSatisfiedBy(entity: T): boolean {
    return this.predicate(entity);
  }
}
