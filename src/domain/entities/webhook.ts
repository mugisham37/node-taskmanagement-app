import { BaseEntity } from '../base/entity';
import { nanoid } from 'nanoid';
import { WebhookEvent } from '../enums/webhook-event';

/**
 * Webhook Status - Current status of a webhook
 */
export enum WebhookStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  FAILED = 'failed',
  SUSPENDED = 'suspended',
}

/**
 * Webhook Delivery Status - Status of individual webhook deliveries
 */
export enum WebhookDeliveryStatus {
  PENDING = 'pending',
  SUCCESS = 'success',
  FAILED = 'failed',
  RETRYING = 'retrying',
}

// Re-export WebhookEvent for backward compatibility
export { WebhookEvent };

/**
 * Webhook Entity Properties
 */
export interface WebhookProps {
  id: string;
  workspaceId: string;
  name: string;
  url: string;
  events: WebhookEvent[];
  headers: Record<string, string>;
  secret?: string;
  status: WebhookStatus;
  description?: string;
  lastDeliveryAt?: Date;
  lastSuccessAt?: Date;
  lastFailureAt?: Date;
  failureReason?: string;
  retryCount: number;
  maxRetries: number;
  timeout: number;
  lastTriggeredAt?: Date;
  failureCount: number;
  maxFailures: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  metadata: Record<string, any>;
}

/**
 * Webhook Domain Entity
 * Represents a webhook configuration for external event notifications
 */
export class Webhook extends BaseEntity<string> {
  public readonly workspaceId: string;
  public readonly name: string;
  public readonly url: string;
  public readonly events: WebhookEvent[];
  public readonly headers: Record<string, string>;
  public readonly secret?: string;
  public readonly status: WebhookStatus;
  public readonly description?: string;
  public readonly lastDeliveryAt?: Date;
  public readonly lastSuccessAt?: Date;
  public readonly lastFailureAt?: Date;
  public readonly failureReason?: string;
  public readonly retryCount: number;
  public readonly maxRetries: number;
  public readonly timeout: number;
  public readonly lastTriggeredAt?: Date;
  public readonly failureCount: number;
  public readonly maxFailures: number;
  public readonly createdBy: string;
  public readonly metadata: Record<string, any>;

  constructor(props: WebhookProps) {
    super(props.id, props.createdAt, props.updatedAt);
    this.workspaceId = props.workspaceId;
    this.name = props.name;
    this.url = props.url;
    this.events = props.events;
    this.headers = props.headers;
    
    if (props.secret !== undefined) {
      this.secret = props.secret;
    }
    
    this.status = props.status;
    
    if (props.description !== undefined) {
      this.description = props.description;
    }
    if (props.lastDeliveryAt !== undefined) {
      this.lastDeliveryAt = props.lastDeliveryAt;
    }
    if (props.lastSuccessAt !== undefined) {
      this.lastSuccessAt = props.lastSuccessAt;
    }
    if (props.lastFailureAt !== undefined) {
      this.lastFailureAt = props.lastFailureAt;
    }
    if (props.failureReason !== undefined) {
      this.failureReason = props.failureReason;
    }
    
    this.retryCount = props.retryCount;
    this.maxRetries = props.maxRetries;
    this.timeout = props.timeout;
    
    if (props.lastTriggeredAt !== undefined) {
      this.lastTriggeredAt = props.lastTriggeredAt;
    }
    
    this.failureCount = props.failureCount;
    this.maxFailures = props.maxFailures;
    this.createdBy = props.createdBy;
    this.metadata = props.metadata;
  }

  /**
   * Check if webhook is active and can receive events
   */
  public isActive(): boolean {
    return this.status === WebhookStatus.ACTIVE;
  }

  /**
   * Check if webhook has exceeded maximum failures
   */
  public hasExceededMaxFailures(): boolean {
    return this.failureCount >= this.maxFailures;
  }

  /**
   * Check if webhook supports a specific event
   */
  public supportsEvent(event: WebhookEvent): boolean {
    return this.events.includes(event);
  }

  /**
   * Create an updated webhook with new status
   */
  public withStatus(status: WebhookStatus): Webhook {
    return new Webhook({
      ...this.toPlainObject(),
      status,
      updatedAt: new Date(),
    });
  }

  /**
   * Create an updated webhook with incremented failure count
   */
  public withIncrementedFailureCount(failureReason?: string): Webhook {
    const plainObject = this.toPlainObject();
    const newProps: WebhookProps = {
      ...plainObject,
      failureCount: this.failureCount + 1,
      lastFailureAt: new Date(),
      updatedAt: new Date(),
    };
    
    if (failureReason) {
      newProps.failureReason = failureReason;
    }
    
    return new Webhook(newProps);
  }

  /**
   * Create an updated webhook after successful delivery
   */
  public withSuccessfulDelivery(): Webhook {
    const plainObject = this.toPlainObject();
    const newProps: WebhookProps = {
      ...plainObject,
      lastSuccessAt: new Date(),
      lastDeliveryAt: new Date(),
      failureCount: 0, // Reset failure count on success
      updatedAt: new Date(),
    };

    // Remove failureReason on success - don't add it to the new props
    delete (newProps as any).failureReason;

    return new Webhook(newProps);
  }

  /**
   * Get plain object representation
   */
  public override toPlainObject(): WebhookProps {
    const result: WebhookProps = {
      id: this.id,
      workspaceId: this.workspaceId,
      name: this.name,
      url: this.url,
      events: this.events,
      headers: this.headers,
      status: this.status,
      retryCount: this.retryCount,
      maxRetries: this.maxRetries,
      timeout: this.timeout,
      failureCount: this.failureCount,
      maxFailures: this.maxFailures,
      createdBy: this.createdBy,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      metadata: this.metadata,
    };

    // Only add optional properties if they are defined
    if (this.secret !== undefined) {
      result.secret = this.secret;
    }
    if (this.description !== undefined) {
      result.description = this.description;
    }
    if (this.lastDeliveryAt !== undefined) {
      result.lastDeliveryAt = this.lastDeliveryAt;
    }
    if (this.lastSuccessAt !== undefined) {
      result.lastSuccessAt = this.lastSuccessAt;
    }
    if (this.lastFailureAt !== undefined) {
      result.lastFailureAt = this.lastFailureAt;
    }
    if (this.failureReason !== undefined) {
      result.failureReason = this.failureReason;
    }
    if (this.lastTriggeredAt !== undefined) {
      result.lastTriggeredAt = this.lastTriggeredAt;
    }

    return result;
  }

  /**
   * Static method to create a new webhook
   */
  static create(props: Omit<WebhookProps, 'id' | 'createdAt' | 'updatedAt'>): Webhook {
    return new Webhook({
      ...props,
      id: nanoid(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  /**
   * Update webhook name
   */
  updateName(newName: string): void {
    if (!newName.trim()) {
      throw new Error('Webhook name cannot be empty');
    }
    (this as any).name = newName.trim();
    this.markAsUpdated();
  }

  /**
   * Update webhook URL
   */
  updateUrl(newUrl: string): void {
    if (!this.isValidUrl(newUrl)) {
      throw new Error('Invalid webhook URL');
    }
    (this as any).url = newUrl;
    this.markAsUpdated();
  }

  /**
   * Update webhook events
   */
  updateEvents(newEvents: WebhookEvent[]): void {
    if (!newEvents || newEvents.length === 0) {
      throw new Error('At least one event must be specified');
    }
    (this as any).events = [...newEvents];
    this.markAsUpdated();
  }

  /**
   * Update webhook secret
   */
  updateSecret(newSecret?: string): void {
    (this as any).secret = newSecret;
    this.markAsUpdated();
  }

  /**
   * Update webhook headers
   */
  updateHeaders(newHeaders: Record<string, string>): void {
    (this as any).headers = { ...newHeaders };
    this.markAsUpdated();
  }

  /**
   * Activate webhook
   */
  activate(): void {
    (this as any).status = WebhookStatus.ACTIVE;
    this.markAsUpdated();
  }

  /**
   * Deactivate webhook
   */
  deactivate(): void {
    (this as any).status = WebhookStatus.INACTIVE;
    this.markAsUpdated();
  }

  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  private markAsUpdated(): void {
    (this as any).updatedAt = new Date();
  }
}

/**
 * Webhook Delivery Entity Properties
 */
export interface WebhookDeliveryProps {
  id: string;
  webhookId: string;
  event: WebhookEvent;
  payload: Record<string, any>;
  headers?: Record<string, string>;
  status: WebhookDeliveryStatus;
  httpStatus?: number;
  responseBody?: string;
  responseHeaders?: Record<string, string>;
  duration?: number;
  attempt: number;
  maxAttempts: number;
  nextRetryAt?: Date;
  errorMessage?: string;
  deliveredAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Webhook Delivery Domain Entity
 * Represents an individual webhook delivery attempt
 */
export class WebhookDelivery extends BaseEntity<string> {
  public readonly webhookId: string;
  public readonly event: WebhookEvent;
  public readonly payload: Record<string, any>;
  public readonly headers?: Record<string, string>;
  public readonly status: WebhookDeliveryStatus;
  public readonly httpStatus?: number;
  public readonly responseBody?: string;
  public readonly responseHeaders?: Record<string, string>;
  public readonly duration?: number;
  public readonly attempt: number;
  public readonly maxAttempts: number;
  public readonly nextRetryAt?: Date;
  public readonly errorMessage?: string;
  public readonly deliveredAt?: Date;

  constructor(props: WebhookDeliveryProps) {
    super(props.id, props.createdAt, props.updatedAt);
    this.webhookId = props.webhookId;
    this.event = props.event;
    this.payload = props.payload;
    this.status = props.status;
    this.attempt = props.attempt;
    this.maxAttempts = props.maxAttempts;

    if (props.headers !== undefined) {
      this.headers = props.headers;
    }
    if (props.httpStatus !== undefined) {
      this.httpStatus = props.httpStatus;
    }
    if (props.responseBody !== undefined) {
      this.responseBody = props.responseBody;
    }
    if (props.responseHeaders !== undefined) {
      this.responseHeaders = props.responseHeaders;
    }
    if (props.duration !== undefined) {
      this.duration = props.duration;
    }
    if (props.nextRetryAt !== undefined) {
      this.nextRetryAt = props.nextRetryAt;
    }
    if (props.errorMessage !== undefined) {
      this.errorMessage = props.errorMessage;
    }
    if (props.deliveredAt !== undefined) {
      this.deliveredAt = props.deliveredAt;
    }
  }

  /**
   * Check if delivery is pending
   */
  public isPending(): boolean {
    return this.status === WebhookDeliveryStatus.PENDING;
  }

  /**
   * Check if delivery was successful
   */
  public isSuccessful(): boolean {
    return this.status === WebhookDeliveryStatus.SUCCESS;
  }

  /**
   * Check if delivery failed
   */
  public hasFailed(): boolean {
    return this.status === WebhookDeliveryStatus.FAILED;
  }

  /**
   * Check if delivery can be retried
   */
  public canRetry(): boolean {
    return this.attempt < this.maxAttempts && this.hasFailed();
  }

  /**
   * Check if delivery is ready for retry
   */
  public isReadyForRetry(): boolean {
    if (!this.canRetry()) return false;
    if (!this.nextRetryAt) return true;
    return new Date() >= this.nextRetryAt;
  }

  /**
   * Create delivery with updated status
   */
  public withStatus(status: WebhookDeliveryStatus): WebhookDelivery {
    return new WebhookDelivery({
      ...this.toPlainObject(),
      status,
      updatedAt: new Date(),
    });
  }

  /**
   * Create delivery with successful completion
   */
  public withSuccess(httpStatus: number, responseBody?: string, responseHeaders?: Record<string, string>, duration?: number): WebhookDelivery {
    const plainObject = this.toPlainObject();
    const newProps: WebhookDeliveryProps = {
      ...plainObject,
      status: WebhookDeliveryStatus.SUCCESS,
      httpStatus,
      deliveredAt: new Date(),
      updatedAt: new Date(),
    };

    if (responseBody !== undefined) {
      newProps.responseBody = responseBody;
    }
    if (responseHeaders !== undefined) {
      newProps.responseHeaders = responseHeaders;
    }
    if (duration !== undefined) {
      newProps.duration = duration;
    }

    return new WebhookDelivery(newProps);
  }

  /**
   * Create delivery with failure information
   */
  public withFailure(errorMessage: string, httpStatus?: number, responseBody?: string, nextRetryAt?: Date): WebhookDelivery {
    const plainObject = this.toPlainObject();
    const newProps: WebhookDeliveryProps = {
      ...plainObject,
      status: WebhookDeliveryStatus.FAILED,
      errorMessage,
      updatedAt: new Date(),
    };

    if (httpStatus !== undefined) {
      newProps.httpStatus = httpStatus;
    }
    if (responseBody !== undefined) {
      newProps.responseBody = responseBody;
    }
    if (nextRetryAt !== undefined) {
      newProps.nextRetryAt = nextRetryAt;
    }

    return new WebhookDelivery(newProps);
  }

  /**
   * Create delivery for retry attempt
   */
  public withRetryAttempt(nextRetryAt?: Date): WebhookDelivery {
    const plainObject = this.toPlainObject();
    const newProps: WebhookDeliveryProps = {
      ...plainObject,
      status: WebhookDeliveryStatus.RETRYING,
      attempt: this.attempt + 1,
      updatedAt: new Date(),
    };

    if (nextRetryAt !== undefined) {
      newProps.nextRetryAt = nextRetryAt;
    }

    return new WebhookDelivery(newProps);
  }

  /**
   * Get plain object representation
   */
  public override toPlainObject(): WebhookDeliveryProps {
    const result: WebhookDeliveryProps = {
      id: this.id,
      webhookId: this.webhookId,
      event: this.event,
      payload: this.payload,
      status: this.status,
      attempt: this.attempt,
      maxAttempts: this.maxAttempts,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };

    // Only add optional properties if they are defined
    if (this.headers !== undefined) {
      result.headers = this.headers;
    }
    if (this.httpStatus !== undefined) {
      result.httpStatus = this.httpStatus;
    }
    if (this.responseBody !== undefined) {
      result.responseBody = this.responseBody;
    }
    if (this.responseHeaders !== undefined) {
      result.responseHeaders = this.responseHeaders;
    }
    if (this.duration !== undefined) {
      result.duration = this.duration;
    }
    if (this.nextRetryAt !== undefined) {
      result.nextRetryAt = this.nextRetryAt;
    }
    if (this.errorMessage !== undefined) {
      result.errorMessage = this.errorMessage;
    }
    if (this.deliveredAt !== undefined) {
      result.deliveredAt = this.deliveredAt;
    }

    return result;
  }
}
