import { DomainEvent } from '../events/domain-event';
import { AggregateRoot, AggregateProps } from './aggregate-root';

/**
 * Enhanced Aggregate Props interface
 */
export interface EnhancedAggregateProps extends AggregateProps {
  isDeleted?: boolean;
  lastModified?: Date;
}

/**
 * Enhanced Aggregate Root
 *
 * Provides comprehensive aggregate root functionality with integrated
 * event publishing, transaction management, and domain event handling.
 */
export abstract class EnhancedAggregateRoot<TProps extends EnhancedAggregateProps> extends AggregateRoot<TProps> {
  private uncommittedEvents: DomainEvent[] = [];
  private _isDeleted: boolean = false;

  constructor(props: TProps) {
    super(props);
    this._isDeleted = props.isDeleted || false;
  }

  /**
   * Get if the aggregate is deleted
   */
  get isDeleted(): boolean {
    return this._isDeleted;
  }

  /**
   * Get last modified date
   */
  get lastModified(): Date {
    return this.props.lastModified || this.updatedAt;
  }

  /**
   * Add a domain event to be published
   */
  protected override addDomainEvent(event: DomainEvent): void {
    super.addDomainEvent(event);
    this.uncommittedEvents.push(event);
    this.props.lastModified = new Date();
  }

  /**
   * Get all uncommitted domain events
   */
  getUncommittedEvents(): DomainEvent[] {
    return [...this.uncommittedEvents];
  }

  /**
   * Mark events as committed (called after successful persistence)
   */
  markEventsAsCommitted(): void {
    this.uncommittedEvents = [];
    this.clearDomainEvents();
  }

  /**
   * Check if aggregate has uncommitted changes
   */
  override hasUncommittedChanges(): boolean {
    return this.uncommittedEvents.length > 0;
  }

  /**
   * Delete the aggregate (soft delete)
   */
  delete(): void {
    this._isDeleted = true;
    this.markAsUpdated();
  }

  /**
   * Restore the aggregate (undo soft delete)
   */
  restore(): void {
    this._isDeleted = false;
    this.markAsUpdated();
  }

  /**
   * Apply an event to the aggregate (for event sourcing)
   */
  protected override applyEvent(event: DomainEvent): void {
    const handler = this.getEventHandler(event.getEventName());
    if (handler) {
      handler.call(this, event);
      this.props.lastModified = new Date();
    }
  }

  /**
   * Replay events to rebuild aggregate state (for event sourcing)
   */
  override replayEvents(events: DomainEvent[]): void {
    events.forEach(event => {
      this.applyEvent(event);
    });
    this.uncommittedEvents = [];
  }

  /**
   * Get event handler method for a specific event type
   */
  private getEventHandler(eventName: string): Function | null {
    const handlerName = `on${eventName}`;
    const handler = (this as any)[handlerName];
    return typeof handler === 'function' ? handler : null;
  }

  /**
   * Validate aggregate invariants
   */
  protected abstract validateInvariants(): void;

  /**
   * Execute a domain operation with invariant validation
   */
  protected executeOperation(operation: () => void): void {
    operation();
    this.validateInvariants();
  }

  /**
   * Create a snapshot of the aggregate state
   */
  override createSnapshot(): AggregateSnapshot {
    return {
      aggregateId: this.id,
      aggregateType: this.constructor.name,
      version: this.version,
      isDeleted: this.isDeleted,
      lastModified: this.lastModified,
      state: this.getSnapshotData(),
    };
  }

  /**
   * Restore aggregate from snapshot
   */
  override restoreFromSnapshot(snapshot: AggregateSnapshot): void {
    // Note: We can't modify the id since it's readonly, so we assume it's already correct
    this._isDeleted = snapshot.isDeleted;
    this.props.lastModified = snapshot.lastModified;
    this.restoreSnapshotData(snapshot.state);
    this.uncommittedEvents = [];
  }

  /**
   * Get aggregate-specific data for snapshot
   */
  protected abstract getSnapshotData(): Record<string, any>;

  /**
   * Restore aggregate-specific data from snapshot
   */
  protected abstract restoreSnapshotData(data: Record<string, any>): void;

  /**
   * Check if aggregate can be modified
   */
  protected ensureNotDeleted(): void {
    if (this.isDeleted) {
      throw new Error(`Cannot modify deleted aggregate: ${this.id}`);
    }
  }

  /**
   * Check optimistic concurrency
   */
  checkConcurrency(expectedVersion: number): void {
    if (this.version !== expectedVersion) {
      throw new ConcurrencyError(
        `Concurrency conflict. Expected version ${expectedVersion}, but current version is ${this.version}`
      );
    }
  }

  /**
   * Get aggregate metadata
   */
  getMetadata(): AggregateMetadata {
    return {
      id: this.id,
      type: this.constructor.name,
      version: this.version,
      isDeleted: this.isDeleted,
      lastModified: this.lastModified,
      hasUncommittedChanges: this.hasUncommittedChanges(),
      uncommittedEventCount: this.uncommittedEvents.length,
    };
  }

  /**
   * Implementation of abstract method from base class
   */
  protected checkInvariants(): void {
    this.validateInvariants();
  }

  /**
   * Implementation of abstract method from base class
   */
  override getValidationErrors(): string[] {
    const errors: string[] = [];
    try {
      this.validateInvariants();
    } catch (error) {
      if (error instanceof Error) {
        errors.push(error.message);
      }
    }
    return errors;
  }
}

/**
 * Concurrency Error for optimistic locking
 */
export class ConcurrencyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConcurrencyError';
  }
}

/**
 * Aggregate Snapshot interface
 */
export interface AggregateSnapshot {
  aggregateId: string;
  aggregateType: string;
  version: number;
  isDeleted: boolean;
  lastModified: Date;
  state: Record<string, any>;
}

/**
 * Aggregate Metadata interface
 */
export interface AggregateMetadata {
  id: string;
  type: string;
  version: number;
  isDeleted: boolean;
  lastModified: Date;
  hasUncommittedChanges: boolean;
  uncommittedEventCount: number;
}
