import { LoggingService, MetricsService } from '@taskmanagement/core';
import { DomainEvent } from '@taskmanagement/domain';

/**
 * Event Middleware Interface
 */
export interface IEventMiddleware {
  process(event: DomainEvent, next: EventMiddlewareNext): Promise<void>;
  getName(): string;
  getPriority(): number;
}

/**
 * Event Middleware Next Function
 */
export type EventMiddlewareNext = (event?: DomainEvent) => Promise<void>;

/**
 * Event Middleware Context
 */
export interface EventMiddlewareContext {
  event: DomainEvent;
  metadata: Record<string, any>;
  startTime: number;
  correlationId?: string;
}

/**
 * Event Middleware Pipeline
 * 
 * Manages and executes a chain of middleware for event processing
 */
export class EventMiddlewarePipeline {
  private middlewares: IEventMiddleware[] = [];

  constructor(
    private readonly logger: LoggingService,
    private readonly metrics: MetricsService
  ) {}

  /**
   * Add middleware to the pipeline
   */
  use(middleware: IEventMiddleware): void {
    this.middlewares.push(middleware);
    
    // Sort by priority (higher priority first)
    this.middlewares.sort((a, b) => b.getPriority() - a.getPriority());

    this.logger.debug('Middleware added to pipeline', {
      middlewareName: middleware.getName(),
      priority: middleware.getPriority(),
      totalMiddlewares: this.middlewares.length,
    });
  }

  /**
   * Remove middleware from the pipeline
   */
  remove(middlewareName: string): boolean {
    const index = this.middlewares.findIndex(m => m.getName() === middlewareName);
    if (index > -1) {
      this.middlewares.splice(index, 1);
      this.logger.debug('Middleware removed from pipeline', {
        middlewareName,
        remainingMiddlewares: this.middlewares.length,
      });
      return true;
    }
    return false;
  }

  /**
   * Execute the middleware pipeline for an event
   */
  async execute(event: DomainEvent): Promise<DomainEvent> {
    if (this.middlewares.length === 0) {
      return event;
    }

    const startTime = Date.now();
    let currentEvent = event;
    let currentIndex = 0;

    const next: EventMiddlewareNext = async (modifiedEvent?: DomainEvent) => {
      if (modifiedEvent) {
        currentEvent = modifiedEvent;
      }

      if (currentIndex < this.middlewares.length) {
        const middleware = this.middlewares[currentIndex++];
        
        try {
          await middleware.process(currentEvent, next);
        } catch (error) {
          this.logger.error('Middleware execution failed', error as Error, {
            middlewareName: middleware.getName(),
            eventId: currentEvent.getEventId(),
            eventType: currentEvent.getEventName(),
          });

          this.metrics.incrementCounter('event_middleware_errors_total', {
            middlewareName: middleware.getName(),
            eventType: currentEvent.getEventName(),
          });

          throw error;
        }
      }
    };

    try {
      await next();

      const duration = Date.now() - startTime;
      this.metrics.recordHistogram('event_middleware_pipeline_duration', duration);
      this.metrics.incrementCounter('event_middleware_pipeline_success_total');

      return currentEvent;
    } catch (error) {
      this.metrics.incrementCounter('event_middleware_pipeline_errors_total');
      throw error;
    }
  }

  /**
   * Get pipeline information
   */
  getInfo(): {
    middlewareCount: number;
    middlewares: Array<{ name: string; priority: number }>;
  } {
    return {
      middlewareCount: this.middlewares.length,
      middlewares: this.middlewares.map(m => ({
        name: m.getName(),
        priority: m.getPriority(),
      })),
    };
  }

  /**
   * Clear all middleware
   */
  clear(): void {
    this.middlewares = [];
    this.logger.info('Event middleware pipeline cleared');
  }
}

/**
 * Base Event Middleware
 */
export abstract class BaseEventMiddleware implements IEventMiddleware {
  constructor(
    protected readonly name: string,
    protected readonly priority: number = 0,
    protected readonly logger: LoggingService
  ) {}

  abstract process(event: DomainEvent, next: EventMiddlewareNext): Promise<void>;

  getName(): string {
    return this.name;
  }

  getPriority(): number {
    return this.priority;
  }
}

/**
 * Logging Middleware
 * 
 * Logs event processing information
 */
export class LoggingMiddleware extends BaseEventMiddleware {
  constructor(logger: LoggingService, priority: number = 100) {
    super('LoggingMiddleware', priority, logger);
  }

  async process(event: DomainEvent, next: EventMiddlewareNext): Promise<void> {
    const startTime = Date.now();

    this.logger.info('Event processing started', {
      eventId: event.getEventId(),
      eventType: event.getEventName(),
      aggregateId: event.getAggregateId(),
      occurredAt: event.getOccurredOn(),
    });

    try {
      await next();

      const duration = Date.now() - startTime;
      this.logger.info('Event processing completed', {
        eventId: event.getEventId(),
        eventType: event.getEventName(),
        duration,
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error('Event processing failed', error as Error, {
        eventId: event.getEventId(),
        eventType: event.getEventName(),
        duration,
      });
      throw error;
    }
  }
}

/**
 * Metrics Middleware
 * 
 * Collects metrics about event processing
 */
export class MetricsMiddleware extends BaseEventMiddleware {
  constructor(
    logger: LoggingService,
    private readonly metrics: MetricsService,
    priority: number = 90
  ) {
    super('MetricsMiddleware', priority, logger);
  }

  async process(event: DomainEvent, next: EventMiddlewareNext): Promise<void> {
    const startTime = Date.now();
    const eventType = event.getEventName();

    this.metrics.incrementCounter('events_processed_total', { eventType });

    try {
      await next();

      const duration = Date.now() - startTime;
      this.metrics.recordHistogram('event_processing_duration', duration, { eventType });
      this.metrics.incrementCounter('events_processed_success_total', { eventType });
    } catch (error) {
      const duration = Date.now() - startTime;
      this.metrics.recordHistogram('event_processing_duration', duration, { eventType });
      this.metrics.incrementCounter('events_processed_error_total', { eventType });
      throw error;
    }
  }
}

/**
 * Validation Middleware
 * 
 * Validates events before processing
 */
export class ValidationMiddleware extends BaseEventMiddleware {
  constructor(
    logger: LoggingService,
    private readonly validators: Map<string, (event: DomainEvent) => boolean> = new Map(),
    priority: number = 80
  ) {
    super('ValidationMiddleware', priority, logger);
  }

  /**
   * Add validator for specific event type
   */
  addValidator(eventType: string, validator: (event: DomainEvent) => boolean): void {
    this.validators.set(eventType, validator);
  }

  /**
   * Remove validator for event type
   */
  removeValidator(eventType: string): void {
    this.validators.delete(eventType);
  }

  async process(event: DomainEvent, next: EventMiddlewareNext): Promise<void> {
    const eventType = event.getEventName();
    const validator = this.validators.get(eventType);

    if (validator) {
      const isValid = validator(event);
      if (!isValid) {
        const error = new Error(`Event validation failed for ${eventType}`);
        this.logger.error('Event validation failed', error, {
          eventId: event.getEventId(),
          eventType,
        });
        throw error;
      }

      this.logger.debug('Event validation passed', {
        eventId: event.getEventId(),
        eventType,
      });
    }

    await next();
  }
}

/**
 * Enrichment Middleware
 * 
 * Enriches events with additional data
 */
export class EnrichmentMiddleware extends BaseEventMiddleware {
  constructor(
    logger: LoggingService,
    private readonly enrichers: Map<string, (event: DomainEvent) => Promise<DomainEvent>> = new Map(),
    priority: number = 70
  ) {
    super('EnrichmentMiddleware', priority, logger);
  }

  /**
   * Add enricher for specific event type
   */
  addEnricher(eventType: string, enricher: (event: DomainEvent) => Promise<DomainEvent>): void {
    this.enrichers.set(eventType, enricher);
  }

  /**
   * Remove enricher for event type
   */
  removeEnricher(eventType: string): void {
    this.enrichers.delete(eventType);
  }

  async process(event: DomainEvent, next: EventMiddlewareNext): Promise<void> {
    const eventType = event.getEventName();
    const enricher = this.enrichers.get(eventType);

    if (enricher) {
      try {
        const enrichedEvent = await enricher(event);
        this.logger.debug('Event enriched', {
          eventId: event.getEventId(),
          eventType,
        });
        await next(enrichedEvent);
        return;
      } catch (error) {
        this.logger.error('Event enrichment failed', error as Error, {
          eventId: event.getEventId(),
          eventType,
        });
        throw error;
      }
    }

    await next();
  }
}

/**
 * Rate Limiting Middleware
 * 
 * Limits the rate of event processing
 */
export class RateLimitingMiddleware extends BaseEventMiddleware {
  private eventCounts = new Map<string, { count: number; resetTime: number }>();

  constructor(
    logger: LoggingService,
    private readonly limits: Map<string, { maxEvents: number; windowMs: number }> = new Map(),
    priority: number = 60
  ) {
    super('RateLimitingMiddleware', priority, logger);
  }

  /**
   * Add rate limit for specific event type
   */
  addRateLimit(eventType: string, maxEvents: number, windowMs: number): void {
    this.limits.set(eventType, { maxEvents, windowMs });
  }

  /**
   * Remove rate limit for event type
   */
  removeRateLimit(eventType: string): void {
    this.limits.delete(eventType);
    this.eventCounts.delete(eventType);
  }

  async process(event: DomainEvent, next: EventMiddlewareNext): Promise<void> {
    const eventType = event.getEventName();
    const limit = this.limits.get(eventType);

    if (limit) {
      const now = Date.now();
      const eventCount = this.eventCounts.get(eventType);

      if (!eventCount || now > eventCount.resetTime) {
        // Reset or initialize counter
        this.eventCounts.set(eventType, {
          count: 1,
          resetTime: now + limit.windowMs,
        });
      } else {
        // Increment counter
        eventCount.count++;

        if (eventCount.count > limit.maxEvents) {
          const error = new Error(`Rate limit exceeded for ${eventType}`);
          this.logger.warn('Event rate limit exceeded', {
            eventId: event.getEventId(),
            eventType,
            currentCount: eventCount.count,
            maxEvents: limit.maxEvents,
          });
          throw error;
        }
      }
    }

    await next();
  }
}

/**
 * Circuit Breaker Middleware
 * 
 * Implements circuit breaker pattern for event processing
 */
export class CircuitBreakerMiddleware extends BaseEventMiddleware {
  private circuitStates = new Map<string, {
    state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
    failureCount: number;
    lastFailureTime: number;
    nextAttemptTime: number;
  }>();

  constructor(
    logger: LoggingService,
    private readonly config: {
      failureThreshold: number;
      recoveryTimeMs: number;
      monitorWindowMs: number;
    } = {
      failureThreshold: 5,
      recoveryTimeMs: 60000, // 1 minute
      monitorWindowMs: 300000, // 5 minutes
    },
    priority: number = 50
  ) {
    super('CircuitBreakerMiddleware', priority, logger);
  }

  async process(event: DomainEvent, next: EventMiddlewareNext): Promise<void> {
    const eventType = event.getEventName();
    const circuitState = this.getCircuitState(eventType);

    if (circuitState.state === 'OPEN') {
      const now = Date.now();
      if (now < circuitState.nextAttemptTime) {
        const error = new Error(`Circuit breaker is OPEN for ${eventType}`);
        this.logger.warn('Circuit breaker blocked event', {
          eventId: event.getEventId(),
          eventType,
          state: circuitState.state,
        });
        throw error;
      } else {
        // Transition to HALF_OPEN
        circuitState.state = 'HALF_OPEN';
        this.logger.info('Circuit breaker transitioning to HALF_OPEN', {
          eventType,
        });
      }
    }

    try {
      await next();

      // Success - reset or keep circuit closed
      if (circuitState.state === 'HALF_OPEN') {
        circuitState.state = 'CLOSED';
        circuitState.failureCount = 0;
        this.logger.info('Circuit breaker reset to CLOSED', {
          eventType,
        });
      }
    } catch (error) {
      // Failure - increment counter and potentially open circuit
      circuitState.failureCount++;
      circuitState.lastFailureTime = Date.now();

      if (circuitState.failureCount >= this.config.failureThreshold) {
        circuitState.state = 'OPEN';
        circuitState.nextAttemptTime = Date.now() + this.config.recoveryTimeMs;
        
        this.logger.error('Circuit breaker opened', error as Error, {
          eventType,
          failureCount: circuitState.failureCount,
          threshold: this.config.failureThreshold,
        });
      }

      throw error;
    }
  }

  private getCircuitState(eventType: string) {
    if (!this.circuitStates.has(eventType)) {
      this.circuitStates.set(eventType, {
        state: 'CLOSED',
        failureCount: 0,
        lastFailureTime: 0,
        nextAttemptTime: 0,
      });
    }
    return this.circuitStates.get(eventType)!;
  }

  /**
   * Get circuit breaker status
   */
  getStatus(): Record<string, any> {
    const status: Record<string, any> = {};
    for (const [eventType, state] of this.circuitStates) {
      status[eventType] = {
        state: state.state,
        failureCount: state.failureCount,
        lastFailureTime: state.lastFailureTime,
        nextAttemptTime: state.nextAttemptTime,
      };
    }
    return status;
  }
}