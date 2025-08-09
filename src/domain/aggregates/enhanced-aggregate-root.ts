import { DomainEvent } from '../events/domain-event';
import { AggregateRoot } from './aggregate-root';

/**
 * Enhanced Aggregate Root
 *
 * Provides comprehensive aggregate root functionality with integrated
 * event publishing, transaction management, and domain event handling.
 */
export abstract class EnhancedAggregateRoot extends AggregateRoot {
  private uncommittedEvents: DomainEvent[] = [];
  private version: number = 0;
  private isDeleted: boolean = false;
  private lastModified: Date = new Date();

  /**
   * Add a domain event to be published
   */
  protected addDomainEvent(event: DomainEvent): void {
    this.uncommittedEvents.push(event);
    this.lastModified = new Date();
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
    this.version++;
  }

  /**
   * Get the current version of the aggregate
   */
  getVersion(): number {
    return this.version;
  }

  /**
   * Set the version (used when loading from persistence)
   */
  setVersion(version: number): void {
    this.version = version;
  }

  /**
   * Check if the aggregate has uncommitted changes
   */
  hasUncommittedChanges(): boolean {
    return this.uncommittedEvents.length > 0;
  }

  /**
   * Mark the aggregate as deleted
   */
  protected markAsDeleted(): void {
    this.isDeleted = true;
    this.lastModified = new Date();
  }

  /**
   * Check if the aggregate is deleted
   */
  isAggregateDeleted(): boolean {
    return this.isDeleted;
  }

  /**
   * Get the last modified timestamp
   */
  getLastModified(): Date {
    return this.lastModified;
  }

  /**
   * Apply an event to the aggregate (for event sourcing)
   */
  protected applyEvent(event: DomainEvent): void {
    const handler = this.getEventHandler(event.eventName);
    if (handler) {
      handler.call(this, event);
      this.version++;
      this.lastModified = new Date();
    }
  }

  /**
   * Replay events to rebuild aggregate state (for event sourcing)
   */
  replayEvents(events: DomainEvent[]): void {
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
  createSnapshot(): AggregateSnapshot {
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
  restoreFromSnapshot(snapshot: AggregateSnapshot): void {
    this.id = snapshot.aggregateId;
    this.version = snapshot.version;
    this.isDeleted = snapshot.isDeleted;
    this.lastModified = snapshot.lastModified;
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
