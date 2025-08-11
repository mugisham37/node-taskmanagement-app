import { DomainEvent } from './domain-event';

/**
 * Webhook Created Event
 */
export class WebhookCreatedEvent extends DomainEvent {
  constructor(
    public readonly webhookId: string,
    public readonly workspaceId: string,
    public readonly name: string,
    public readonly url: string,
    public readonly events: string[]
  ) {
    super();
  }

  getEventName(): string {
    return 'WebhookCreated';
  }

  getAggregateId(): string {
    return this.webhookId;
  }

  protected getPayload(): Record<string, any> {
    return {
      webhookId: this.webhookId,
      workspaceId: this.workspaceId,
      name: this.name,
      url: this.url,
      events: this.events,
    };
  }
}

/**
 * Webhook Triggered Event
 */
export class WebhookTriggeredEvent extends DomainEvent {
  constructor(
    public readonly webhookId: string,
    public readonly event: string,
    public readonly payload: Record<string, any>,
    public readonly deliveryId: string
  ) {
    super();
  }

  getEventName(): string {
    return 'WebhookTriggered';
  }

  getAggregateId(): string {
    return this.webhookId;
  }

  protected getPayload(): Record<string, any> {
    return {
      webhookId: this.webhookId,
      event: this.event,
      payload: this.payload,
      deliveryId: this.deliveryId,
    };
  }
}

/**
 * Webhook Delivery Succeeded Event
 */
export class WebhookDeliverySucceededEvent extends DomainEvent {
  constructor(
    public readonly webhookId: string,
    public readonly deliveryId: string,
    public readonly httpStatus: number,
    public readonly attemptCount: number
  ) {
    super();
  }

  getEventName(): string {
    return 'WebhookDeliverySucceeded';
  }

  getAggregateId(): string {
    return this.webhookId;
  }

  protected getPayload(): Record<string, any> {
    return {
      webhookId: this.webhookId,
      deliveryId: this.deliveryId,
      httpStatus: this.httpStatus,
      attemptCount: this.attemptCount,
    };
  }
}

/**
 * Webhook Delivery Failed Event
 */
export class WebhookDeliveryFailedEvent extends DomainEvent {
  constructor(
    public readonly webhookId: string,
    public readonly deliveryId: string,
    public readonly errorMessage: string,
    public readonly attemptCount: number,
    public readonly willRetry: boolean
  ) {
    super();
  }

  getEventName(): string {
    return 'WebhookDeliveryFailed';
  }

  getAggregateId(): string {
    return this.webhookId;
  }

  protected getPayload(): Record<string, any> {
    return {
      webhookId: this.webhookId,
      deliveryId: this.deliveryId,
      errorMessage: this.errorMessage,
      attemptCount: this.attemptCount,
      willRetry: this.willRetry,
    };
  }
}

/**
 * Webhook Disabled Event
 */
export class WebhookDisabledEvent extends DomainEvent {
  constructor(
    public readonly webhookId: string,
    public readonly reason: string,
    public readonly failureCount: number
  ) {
    super();
  }

  getEventName(): string {
    return 'WebhookDisabled';
  }

  getAggregateId(): string {
    return this.webhookId;
  }

  protected getPayload(): Record<string, any> {
    return {
      webhookId: this.webhookId,
      reason: this.reason,
      failureCount: this.failureCount,
    };
  }
}
