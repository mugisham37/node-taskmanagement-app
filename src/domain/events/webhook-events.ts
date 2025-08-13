import { BaseDomainEvent } from './domain-event';

/**
 * Webhook Created Event
 */
export class WebhookCreatedEvent extends BaseDomainEvent {
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
export class WebhookTriggeredEvent extends BaseDomainEvent {
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
export class WebhookDeliverySucceededEvent extends BaseDomainEvent {
  constructor(
    public readonly webhookId: string,
    public readonly deliveryId: string,
    public readonly response: Record<string, any>,
    public readonly statusCode: number,
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
      response: this.response,
      statusCode: this.statusCode,
      attemptCount: this.attemptCount,
    };
  }
}

/**
 * Webhook Delivery Failed Event
 */
export class WebhookDeliveryFailedEvent extends BaseDomainEvent {
  constructor(
    public readonly webhookId: string,
    public readonly deliveryId: string,
    public readonly error: string,
    public readonly statusCode: number,
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
      error: this.error,
      statusCode: this.statusCode,
      attemptCount: this.attemptCount,
      willRetry: this.willRetry,
    };
  }
}
