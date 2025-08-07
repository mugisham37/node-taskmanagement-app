import { BaseEntity } from '../entities/BaseEntity';
import { DomainEvent } from '../events/DomainEvent';

export abstract class AggregateRoot<T> extends BaseEntity<T> {
  private _version: number = 0;

  constructor(props: T) {
    super(props);
  }

  get version(): number {
    return this._version;
  }

  protected incrementVersion(): void {
    this._version++;
  }

  protected override addDomainEvent(event: DomainEvent): void {
    super.addDomainEvent(event);
    this.incrementVersion();
  }

  public markEventsAsCommitted(): void {
    this.clearDomainEvents();
  }

  // Template method for validation
  protected abstract validate(): void;

  // Template method for business rules
  protected abstract applyBusinessRules(): void;

  // Method to apply changes and validate
  protected applyChange(event: DomainEvent): void {
    this.addDomainEvent(event);
    this.validate();
    this.applyBusinessRules();
  }
}
