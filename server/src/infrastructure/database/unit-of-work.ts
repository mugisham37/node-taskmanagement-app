import { EnhancedAggregateRoot } from '../../domain/aggregates/enhanced-aggregate-root';
import { DomainEvent } from '../../domain/events/domain-event';
import { TransactionManager } from './transaction-manager';
import { EventIntegrationService } from '../events/event-integration-service';
import { LoggingService } from '../monitoring/logging-service';
import { MetricsService } from '../monitoring/metrics-service';

/**
 * Unit of Work
 *
 * Implements the Unit of Work pattern to manage aggregate changes,
 * transaction boundaries, and event publishing in a coordinated manner.
 */
export class UnitOfWork {
  private aggregates = new Map<string, AggregateRegistration>();
  private isCommitted = false;
  private isRolledBack = false;
  private readonly id: string;
  private readonly startTime: Date;

  constructor(
    private readonly transactionManager: TransactionManager,
    private readonly eventIntegrationService: EventIntegrationService,
    private readonly logger: LoggingService,
    private readonly metrics: MetricsService
  ) {
    this.id = this.generateUnitOfWorkId();
    this.startTime = new Date();
  }

  /**
   * Register an aggregate for tracking
   */
  registerNew<T extends EnhancedAggregateRoot>(
    aggregate: T,
    repository: AggregateRepository<T>
  ): void {
    this.ensureNotFinalized();

    if (this.aggregates.has(aggregate.id)) {
      throw new Error(`Aggregate ${aggregate.id} is already registered`);
    }

    this.aggregates.set(aggregate.id, {
      aggregate,
      repository,
      state: 'new',
      originalVersion: aggregate.getVersion(),
    });

    this.logger.debug('Aggregate registered as new', {
      unitOfWorkId: this.id,
      aggregateId: aggregate.id,
      aggregateType: aggregate.constructor.name,
    });
  }

  /**
   * Register an existing aggregate for tracking
   */
  registerDirty<T extends EnhancedAggregateRoot>(
    aggregate: T,
    repository: AggregateRepository<T>
  ): void {
    this.ensureNotFinalized();

    const existing = this.aggregates.get(aggregate.id);
    if (existing) {
      existing.state = 'dirty';
      return;
    }

    this.aggregates.set(aggregate.id, {
      aggregate,
      repository,
      state: 'dirty',
      originalVersion: aggregate.getVersion(),
    });

    this.logger.debug('Aggregate registered as dirty', {
      unitOfWorkId: this.id,
      aggregateId: aggregate.id,
      aggregateType: aggregate.constructor.name,
    });
  }

  /**
   * Register an aggregate for deletion
   */
  registerDeleted<T extends EnhancedAggregateRoot>(
    aggregate: T,
    repository: AggregateRepository<T>
  ): void {
    this.ensureNotFinalized();

    const existing = this.aggregates.get(aggregate.id);
    if (existing) {
      existing.state = 'deleted';
      return;
    }

    this.aggregates.set(aggregate.id, {
      aggregate,
      repository,
      state: 'deleted',
      originalVersion: aggregate.getVersion(),
    });

    this.logger.debug('Aggregate registered for deletion', {
      unitOfWorkId: this.id,
      aggregateId: aggregate.id,
      aggregateType: aggregate.constructor.name,
    });
  }

  /**
   * Commit all changes within a transaction
   */
  async commit(): Promise<void> {
    this.ensureNotFinalized();

    const timer = this.metrics.startTimer('unit_of_work_commit_duration');

    try {
      this.logger.info('Starting unit of work commit', {
        unitOfWorkId: this.id,
        aggregateCount: this.aggregates.size,
      });

      await this.transactionManager.executeInTransaction(async () => {
        // Collect all events before persistence
        const allEvents = this.collectAllEvents();

        // Persist all aggregates
        await this.persistAggregates();

        // Publish events after successful persistence
        if (allEvents.length > 0) {
          await this.eventIntegrationService.publishDomainEvents(allEvents);
        }

        // Mark events as committed
        this.markEventsAsCommitted();
      });

      this.isCommitted = true;
      const duration = timer.end();

      this.metrics.incrementCounter('unit_of_work_commits_total');
      this.metrics.recordHistogram('unit_of_work_commit_duration', duration);

      this.logger.info('Unit of work committed successfully', {
        unitOfWorkId: this.id,
        aggregateCount: this.aggregates.size,
        duration,
      });
    } catch (error) {
      timer.end();
      this.metrics.incrementCounter('unit_of_work_commit_errors_total');

      this.logger.error('Unit of work commit failed', error as Error, {
        unitOfWorkId: this.id,
        aggregateCount: this.aggregates.size,
      });

      throw error;
    }
  }

  /**
   * Rollback all changes
   */
  async rollback(): Promise<void> {
    if (this.isCommitted || this.isRolledBack) {
      return;
    }

    try {
      this.logger.info('Rolling back unit of work', {
        unitOfWorkId: this.id,
        aggregateCount: this.aggregates.size,
      });

      // Clear uncommitted events from all aggregates
      for (const registration of this.aggregates.values()) {
        registration.aggregate.markEventsAsCommitted(); // This clears uncommitted events
      }

      this.isRolledBack = true;
      this.metrics.incrementCounter('unit_of_work_rollbacks_total');

      this.logger.info('Unit of work rolled back successfully', {
        unitOfWorkId: this.id,
      });
    } catch (error) {
      this.logger.error('Unit of work rollback failed', error as Error, {
        unitOfWorkId: this.id,
      });

      throw error;
    }
  }

  /**
   * Get unit of work statistics
   */
  getStatistics(): UnitOfWorkStatistics {
    const aggregatesByState = new Map<AggregateState, number>();
    const aggregatesByType = new Map<string, number>();
    let totalEvents = 0;

    for (const registration of this.aggregates.values()) {
      // Count by state
      const currentCount = aggregatesByState.get(registration.state) || 0;
      aggregatesByState.set(registration.state, currentCount + 1);

      // Count by type
      const typeName = registration.aggregate.constructor.name;
      const typeCount = aggregatesByType.get(typeName) || 0;
      aggregatesByType.set(typeName, typeCount + 1);

      // Count events
      totalEvents += registration.aggregate.getUncommittedEvents().length;
    }

    return {
      id: this.id,
      startTime: this.startTime,
      aggregateCount: this.aggregates.size,
      totalEvents,
      isCommitted: this.isCommitted,
      isRolledBack: this.isRolledBack,
      aggregatesByState: Object.fromEntries(aggregatesByState),
      aggregatesByType: Object.fromEntries(aggregatesByType),
    };
  }

  /**
   * Check if unit of work has changes
   */
  hasChanges(): boolean {
    return this.aggregates.size > 0;
  }

  /**
   * Get all registered aggregates
   */
  getAggregates(): EnhancedAggregateRoot[] {
    return Array.from(this.aggregates.values()).map(reg => reg.aggregate);
  }

  /**
   * Collect all domain events from registered aggregates
   */
  private collectAllEvents(): DomainEvent[] {
    const allEvents: DomainEvent[] = [];

    for (const registration of this.aggregates.values()) {
      const events = registration.aggregate.getUncommittedEvents();
      allEvents.push(...events);
    }

    return allEvents;
  }

  /**
   * Persist all registered aggregates
   */
  private async persistAggregates(): Promise<void> {
    const persistencePromises: Promise<void>[] = [];

    for (const registration of this.aggregates.values()) {
      const promise = this.persistAggregate(registration);
      persistencePromises.push(promise);
    }

    await Promise.all(persistencePromises);
  }

  /**
   * Persist a single aggregate based on its state
   */
  private async persistAggregate(
    registration: AggregateRegistration
  ): Promise<void> {
    const { aggregate, repository, state } = registration;

    try {
      switch (state) {
        case 'new':
          await repository.save(aggregate);
          break;

        case 'dirty':
          await repository.save(aggregate);
          break;

        case 'deleted':
          await repository.delete(aggregate.id);
          break;
      }

      this.logger.debug('Aggregate persisted successfully', {
        unitOfWorkId: this.id,
        aggregateId: aggregate.id,
        aggregateType: aggregate.constructor.name,
        state,
      });
    } catch (error) {
      this.logger.error('Failed to persist aggregate', error as Error, {
        unitOfWorkId: this.id,
        aggregateId: aggregate.id,
        aggregateType: aggregate.constructor.name,
        state,
      });

      throw error;
    }
  }

  /**
   * Mark all events as committed
   */
  private markEventsAsCommitted(): void {
    for (const registration of this.aggregates.values()) {
      registration.aggregate.markEventsAsCommitted();
    }
  }

  /**
   * Ensure unit of work is not finalized
   */
  private ensureNotFinalized(): void {
    if (this.isCommitted) {
      throw new Error('Unit of work has already been committed');
    }
    if (this.isRolledBack) {
      throw new Error('Unit of work has already been rolled back');
    }
  }

  /**
   * Generate unique unit of work ID
   */
  private generateUnitOfWorkId(): string {
    return `uow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Unit of Work Factory
 */
export class UnitOfWorkFactory {
  constructor(
    private readonly transactionManager: TransactionManager,
    private readonly eventIntegrationService: EventIntegrationService,
    private readonly logger: LoggingService,
    private readonly metrics: MetricsService
  ) {}

  /**
   * Create a new unit of work
   */
  create(): UnitOfWork {
    return new UnitOfWork(
      this.transactionManager,
      this.eventIntegrationService,
      this.logger,
      this.metrics
    );
  }
}

// Types and interfaces
type AggregateState = 'new' | 'dirty' | 'deleted';

interface AggregateRegistration {
  aggregate: EnhancedAggregateRoot;
  repository: AggregateRepository<any>;
  state: AggregateState;
  originalVersion: number;
}

interface AggregateRepository<T extends EnhancedAggregateRoot> {
  save(aggregate: T): Promise<void>;
  delete(id: string): Promise<void>;
}

interface UnitOfWorkStatistics {
  id: string;
  startTime: Date;
  aggregateCount: number;
  totalEvents: number;
  isCommitted: boolean;
  isRolledBack: boolean;
  aggregatesByState: Record<AggregateState, number>;
  aggregatesByType: Record<string, number>;
}
