import { DomainService } from '../../../shared/domain/domain-service';
import { WebhookEvent } from '../value-objects/webhook-event';
import { WorkspaceId } from '../../task-management/value-objects/workspace-id';
import { UserId } from '../../authentication/value-objects/user-id';
import {
  WebhookDeliveryService,
  BulkDeliveryResult,
} from './webhook-delivery.service';
import { WebhookManagementService } from './webhook-management.service';
import { DomainEvent } from '../../../shared/domain/events/domain-event';

export interface EventPayloadBuilder {
  buildPayload(
    event: DomainEvent,
    context: EventContext
  ): Promise<Record<string, any>>;
}

export interface EventContext {
  workspaceId: WorkspaceId;
  userId?: UserId;
  timestamp: Date;
  correlationId?: string;
  metadata?: Record<string, any>;
}

export interface DispatchOptions {
  priority?: 'low' | 'normal' | 'high';
  delay?: number; // milliseconds
  scheduledFor?: Date;
  retryPolicy?: {
    maxRetries?: number;
    retryDelay?: number;
    backoffMultiplier?: number;
  };
  filterWebhooks?: (webhookId: string) => boolean;
  metadata?: Record<string, any>;
}

export interface DispatchResult {
  eventType: WebhookEvent;
  workspaceId: WorkspaceId;
  webhooksTriggered: number;
  deliveryResults: BulkDeliveryResult;
  processingTime: number;
  errors: string[];
}

export interface EventSubscription {
  id: string;
  eventType: WebhookEvent;
  workspaceId: WorkspaceId;
  webhookId: string;
  isActive: boolean;
  createdAt: Date;
  lastTriggered?: Date;
  triggerCount: number;
}

export interface WebhookEventDispatcherService extends DomainService {
  // Core event dispatching
  dispatchEvent(
    eventType: WebhookEvent,
    payload: Record<string, any>,
    context: EventContext,
    options?: DispatchOptions
  ): Promise<DispatchResult>;

  dispatchDomainEvent(
    domainEvent: DomainEvent,
    context: EventContext,
    options?: DispatchOptions
  ): Promise<DispatchResult>;

  dispatchMultipleEvents(
    events: Array<{
      eventType: WebhookEvent;
      payload: Record<string, any>;
      context: EventContext;
      options?: DispatchOptions;
    }>
  ): Promise<DispatchResult[]>;

  // Batch event processing
  processBatchEvents(
    events: Array<{
      eventType: WebhookEvent;
      payload: Record<string, any>;
      context: EventContext;
    }>,
    batchOptions?: {
      batchSize?: number;
      maxConcurrency?: number;
      delayBetweenBatches?: number;
    }
  ): Promise<{
    totalEvents: number;
    successfulDispatches: number;
    failedDispatches: number;
    results: DispatchResult[];
    processingTime: number;
  }>;

  // Event filtering and routing
  getWebhooksForEvent(
    eventType: WebhookEvent,
    workspaceId: WorkspaceId,
    filters?: {
      isActive?: boolean;
      hasRecentFailures?: boolean;
      minSuccessRate?: number;
    }
  ): Promise<
    Array<{
      webhookId: string;
      name: string;
      url: string;
      isHealthy: boolean;
      lastDeliveryAt?: Date;
    }>
  >;

  shouldDispatchToWebhook(
    webhookId: string,
    eventType: WebhookEvent,
    context: EventContext
  ): Promise<{
    shouldDispatch: boolean;
    reason?: string;
    skipReasons?: string[];
  }>;

  // Event payload building
  registerPayloadBuilder(
    eventType: WebhookEvent,
    builder: EventPayloadBuilder
  ): void;

  buildEventPayload(
    eventType: WebhookEvent,
    data: Record<string, any>,
    context: EventContext
  ): Promise<Record<string, any>>;

  // Event subscriptions and management
  getEventSubscriptions(
    workspaceId: WorkspaceId,
    eventType?: WebhookEvent
  ): Promise<EventSubscription[]>;

  getActiveSubscriptions(
    eventType: WebhookEvent,
    workspaceId: WorkspaceId
  ): Promise<EventSubscription[]>;

  updateSubscriptionStatus(
    subscriptionId: string,
    isActive: boolean
  ): Promise<void>;

  // Event history and analytics
  getEventDispatchHistory(
    workspaceId: WorkspaceId,
    options?: {
      eventType?: WebhookEvent;
      dateRange?: { from: Date; to: Date };
      limit?: number;
      offset?: number;
    }
  ): Promise<{
    events: Array<{
      id: string;
      eventType: WebhookEvent;
      timestamp: Date;
      webhooksTriggered: number;
      successfulDeliveries: number;
      failedDeliveries: number;
      processingTime: number;
    }>;
    total: number;
  }>;

  getEventStats(
    workspaceId: WorkspaceId,
    dateRange?: { from: Date; to: Date }
  ): Promise<{
    totalEvents: number;
    eventsByType: Record<string, number>;
    totalWebhooksTriggered: number;
    averageProcessingTime: number;
    successRate: number;
    topEvents: Array<{
      eventType: WebhookEvent;
      count: number;
      successRate: number;
    }>;
  }>;

  // Event debugging and testing
  simulateEventDispatch(
    eventType: WebhookEvent,
    payload: Record<string, any>,
    context: EventContext
  ): Promise<{
    webhooksToTrigger: Array<{
      webhookId: string;
      name: string;
      url: string;
      wouldSucceed: boolean;
      estimatedDeliveryTime: number;
      potentialIssues: string[];
    }>;
    totalWebhooks: number;
    estimatedTotalTime: number;
    recommendations: string[];
  }>;

  traceEventDispatch(eventId: string): Promise<{
    event: {
      id: string;
      eventType: WebhookEvent;
      payload: Record<string, any>;
      context: EventContext;
      timestamp: Date;
    };
    webhooksTriggered: Array<{
      webhookId: string;
      deliveryId: string;
      status: 'pending' | 'delivered' | 'failed';
      attempts: number;
      lastAttemptAt?: Date;
      errorMessage?: string;
    }>;
    timeline: Array<{
      timestamp: Date;
      stage: 'received' | 'filtered' | 'dispatched' | 'completed';
      details: Record<string, any>;
    }>;
  }>;

  // Event validation
  validateEvent(
    eventType: WebhookEvent,
    payload: Record<string, any>
  ): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  };

  validateEventContext(context: EventContext): {
    isValid: boolean;
    errors: string[];
  };

  // Event transformation and enrichment
  enrichEventPayload(
    eventType: WebhookEvent,
    payload: Record<string, any>,
    context: EventContext
  ): Promise<Record<string, any>>;

  transformPayloadForWebhook(
    payload: Record<string, any>,
    webhookId: string,
    eventType: WebhookEvent
  ): Promise<Record<string, any>>;

  // Event scheduling and delayed dispatch
  scheduleEvent(
    eventType: WebhookEvent,
    payload: Record<string, any>,
    context: EventContext,
    scheduledFor: Date,
    options?: Omit<DispatchOptions, 'scheduledFor'>
  ): Promise<{
    scheduleId: string;
    scheduledFor: Date;
    estimatedWebhooks: number;
  }>;

  cancelScheduledEvent(scheduleId: string): Promise<void>;

  processScheduledEvents(batchSize?: number): Promise<{
    processed: number;
    successful: number;
    failed: number;
    skipped: number;
  }>;

  // Event rate limiting and throttling
  checkEventRateLimit(
    eventType: WebhookEvent,
    workspaceId: WorkspaceId
  ): Promise<{
    isAllowed: boolean;
    remainingEvents: number;
    resetTime: Date;
    retryAfter?: number;
  }>;

  setEventRateLimit(
    eventType: WebhookEvent,
    workspaceId: WorkspaceId,
    eventsPerMinute: number
  ): Promise<void>;

  // Event circuit breaker
  checkCircuitBreaker(
    eventType: WebhookEvent,
    workspaceId: WorkspaceId
  ): Promise<{
    state: 'closed' | 'open' | 'half-open';
    failureRate: number;
    lastFailure?: Date;
    nextRetryAt?: Date;
  }>;

  // Event monitoring and alerting
  getEventHealthStatus(workspaceId: WorkspaceId): Promise<{
    overallHealth: 'healthy' | 'degraded' | 'critical';
    eventProcessingRate: number;
    averageDispatchTime: number;
    failureRate: number;
    backlogSize: number;
    issues: Array<{
      severity: 'low' | 'medium' | 'high';
      message: string;
      eventType?: WebhookEvent;
      affectedWebhooks?: string[];
    }>;
  }>;

  // Event configuration
  getEventConfiguration(
    eventType: WebhookEvent,
    workspaceId: WorkspaceId
  ): Promise<{
    isEnabled: boolean;
    rateLimit?: number;
    retryPolicy: {
      maxRetries: number;
      retryDelay: number;
      backoffMultiplier: number;
    };
    filterRules: Array<{
      field: string;
      operator: 'equals' | 'contains' | 'regex';
      value: any;
    }>;
  }>;

  updateEventConfiguration(
    eventType: WebhookEvent,
    workspaceId: WorkspaceId,
    configuration: {
      isEnabled?: boolean;
      rateLimit?: number;
      retryPolicy?: {
        maxRetries?: number;
        retryDelay?: number;
        backoffMultiplier?: number;
      };
      filterRules?: Array<{
        field: string;
        operator: 'equals' | 'contains' | 'regex';
        value: any;
      }>;
    }
  ): Promise<void>;

  // Maintenance and cleanup
  cleanupOldEventHistory(
    olderThan: Date,
    workspaceId?: WorkspaceId
  ): Promise<number>;

  resetEventStats(
    workspaceId: WorkspaceId,
    eventType?: WebhookEvent
  ): Promise<void>;

  // Integration with domain events
  subscribeToDomainEvents(): void;
  unsubscribeFromDomainEvents(): void;

  handleDomainEvent(event: DomainEvent): Promise<void>;
}
