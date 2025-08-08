import { Entity } from '../../shared/base/entity';
import { WebhookDeliveryId } from '../value-objects/webhook-delivery-id';
import { WebhookId } from '../value-objects/webhook-id';
import { WorkspaceId } from '../../task-management/value-objects/workspace-id';
import { WebhookEvent } from '../value-objects/webhook-event';
import { WebhookDeliveryStatus } from '../value-objects/webhook-delivery-status';
import { DomainEvent } from '../../shared/events/domain-event';

export interface WebhookDeliveryProps {
  id: WebhookDeliveryId;
  webhookId: WebhookId;
  workspaceId: WorkspaceId;
  event: WebhookEvent;
  payload: Record<string, any>;
  status: WebhookDeliveryStatus;
  httpStatusCode?: number;
  responseBody?: string;
  responseHeaders?: Record<string, string>;
  errorMessage?: string;
  attemptCount: number;
  maxAttempts: number;
  nextRetryAt?: Date;
  deliveredAt?: Date;
  duration?: number; // in milliseconds
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export class WebhookDeliveryEntity extends Entity<WebhookDeliveryProps> {
  get id(): WebhookDeliveryId {
    return this.props.id;
  }

  get webhookId(): WebhookId {
    return this.props.webhookId;
  }

  get workspaceId(): WorkspaceId {
    return this.props.workspaceId;
  }

  get event(): WebhookEvent {
    return this.props.event;
  }

  get payload(): Record<string, any> {
    return this.props.payload;
  }

  get status(): WebhookDeliveryStatus {
    return this.props.status;
  }

  get httpStatusCode(): number | undefined {
    return this.props.httpStatusCode;
  }

  get responseBody(): string | undefined {
    return this.props.responseBody;
  }

  get responseHeaders(): Record<string, string> | undefined {
    return this.props.responseHeaders;
  }

  get errorMessage(): string | undefined {
    return this.props.errorMessage;
  }

  get attemptCount(): number {
    return this.props.attemptCount;
  }

  get maxAttempts(): number {
    return this.props.maxAttempts;
  }

  get nextRetryAt(): Date | undefined {
    return this.props.nextRetryAt;
  }

  get deliveredAt(): Date | undefined {
    return this.props.deliveredAt;
  }

  get duration(): number | undefined {
    return this.props.duration;
  }

  get metadata(): Record<string, any> {
    return this.props.metadata;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  get isPending(): boolean {
    return this.props.status.isPending();
  }

  get isDelivered(): boolean {
    return this.props.status.isDelivered();
  }

  get isFailed(): boolean {
    return this.props.status.isFailed();
  }

  get canRetry(): boolean {
    return (
      this.props.attemptCount < this.props.maxAttempts &&
      (this.props.status.isPending() || this.props.status.isFailed())
    );
  }

  get isRetryDue(): boolean {
    if (!this.canRetry || !this.props.nextRetryAt) {
      return false;
    }
    return new Date() >= this.props.nextRetryAt;
  }

  // Business methods
  markAsDelivered(
    httpStatusCode: number,
    responseBody?: string,
    responseHeaders?: Record<string, string>,
    duration?: number
  ): void {
    if (this.props.status.isDelivered()) {
      return;
    }

    this.props.status = WebhookDeliveryStatus.delivered();
    this.props.httpStatusCode = httpStatusCode;
    this.props.responseBody = responseBody;
    this.props.responseHeaders = responseHeaders;
    this.props.deliveredAt = new Date();
    this.props.duration = duration;
    this.props.errorMessage = undefined;
    this.props.nextRetryAt = undefined;
    this.props.updatedAt = new Date();

    this.addDomainEvent(
      new WebhookDeliverySucceededEvent(
        this.props.id,
        this.props.webhookId,
        this.props.workspaceId,
        this.props.event,
        this.props.attemptCount,
        httpStatusCode,
        duration
      )
    );
  }

  markAsFailed(
    errorMessage: string,
    httpStatusCode?: number,
    responseBody?: string,
    responseHeaders?: Record<string, string>,
    duration?: number
  ): void {
    this.props.attemptCount += 1;
    this.props.errorMessage = errorMessage;
    this.props.httpStatusCode = httpStatusCode;
    this.props.responseBody = responseBody;
    this.props.responseHeaders = responseHeaders;
    this.props.duration = duration;
    this.props.updatedAt = new Date();

    if (this.canRetry) {
      this.props.status = WebhookDeliveryStatus.pending();
      this.scheduleNextRetry();
    } else {
      this.props.status = WebhookDeliveryStatus.failed();
      this.props.nextRetryAt = undefined;
    }

    this.addDomainEvent(
      new WebhookDeliveryFailedEvent(
        this.props.id,
        this.props.webhookId,
        this.props.workspaceId,
        this.props.event,
        this.props.attemptCount,
        errorMessage,
        httpStatusCode,
        this.canRetry
      )
    );
  }

  scheduleRetry(): void {
    if (!this.canRetry) {
      throw new Error('Cannot retry webhook delivery: max attempts reached');
    }

    this.props.status = WebhookDeliveryStatus.pending();
    this.scheduleNextRetry();
    this.props.updatedAt = new Date();

    this.addDomainEvent(
      new WebhookDeliveryRetryScheduledEvent(
        this.props.id,
        this.props.webhookId,
        this.props.workspaceId,
        this.props.nextRetryAt!
      )
    );
  }

  cancel(): void {
    if (this.props.status.isDelivered()) {
      throw new Error('Cannot cancel delivered webhook');
    }

    this.props.status = WebhookDeliveryStatus.failed();
    this.props.nextRetryAt = undefined;
    this.props.errorMessage = 'Delivery cancelled';
    this.props.updatedAt = new Date();

    this.addDomainEvent(
      new WebhookDeliveryCancelledEvent(
        this.props.id,
        this.props.webhookId,
        this.props.workspaceId
      )
    );
  }

  private scheduleNextRetry(): void {
    // Exponential backoff: base delay * (2 ^ attempt)
    const baseDelay = 1000; // 1 second
    const delay = baseDelay * Math.pow(2, this.props.attemptCount - 1);
    const maxDelay = 300000; // 5 minutes

    const actualDelay = Math.min(delay, maxDelay);
    this.props.nextRetryAt = new Date(Date.now() + actualDelay);
  }

  static create(
    webhookId: WebhookId,
    workspaceId: WorkspaceId,
    event: WebhookEvent,
    payload: Record<string, any>,
    maxAttempts: number = 3,
    metadata: Record<string, any> = {}
  ): WebhookDeliveryEntity {
    const id = WebhookDeliveryId.generate();
    const now = new Date();

    const delivery = new WebhookDeliveryEntity({
      id,
      webhookId,
      workspaceId,
      event,
      payload,
      status: WebhookDeliveryStatus.pending(),
      attemptCount: 0,
      maxAttempts,
      metadata,
      createdAt: now,
      updatedAt: now,
    });

    delivery.addDomainEvent(
      new WebhookDeliveryCreatedEvent(
        id,
        webhookId,
        workspaceId,
        event,
        payload
      )
    );

    return delivery;
  }
}

// Domain Events
export class WebhookDeliveryCreatedEvent extends DomainEvent {
  constructor(
    public readonly deliveryId: WebhookDeliveryId,
    public readonly webhookId: WebhookId,
    public readonly workspaceId: WorkspaceId,
    public readonly event: WebhookEvent,
    public readonly payload: Record<string, any>
  ) {
    super('webhook.delivery.created');
  }
}

export class WebhookDeliverySucceededEvent extends DomainEvent {
  constructor(
    public readonly deliveryId: WebhookDeliveryId,
    public readonly webhookId: WebhookId,
    public readonly workspaceId: WorkspaceId,
    public readonly event: WebhookEvent,
    public readonly attemptCount: number,
    public readonly httpStatusCode: number,
    public readonly duration?: number
  ) {
    super('webhook.delivery.succeeded');
  }
}

export class WebhookDeliveryFailedEvent extends DomainEvent {
  constructor(
    public readonly deliveryId: WebhookDeliveryId,
    public readonly webhookId: WebhookId,
    public readonly workspaceId: WorkspaceId,
    public readonly event: WebhookEvent,
    public readonly attemptCount: number,
    public readonly errorMessage: string,
    public readonly httpStatusCode?: number,
    public readonly willRetry: boolean = false
  ) {
    super('webhook.delivery.failed');
  }
}

export class WebhookDeliveryRetryScheduledEvent extends DomainEvent {
  constructor(
    public readonly deliveryId: WebhookDeliveryId,
    public readonly webhookId: WebhookId,
    public readonly workspaceId: WorkspaceId,
    public readonly nextRetryAt: Date
  ) {
    super('webhook.delivery.retry.scheduled');
  }
}

export class WebhookDeliveryCancelledEvent extends DomainEvent {
  constructor(
    public readonly deliveryId: WebhookDeliveryId,
    public readonly webhookId: WebhookId,
    public readonly workspaceId: WorkspaceId
  ) {
    super('webhook.delivery.cancelled');
  }
}
