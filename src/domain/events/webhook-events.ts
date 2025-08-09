import { DomainEvent } from './domain-event';

export class WebhookCreatedEvent extends DomainEvent {
  constructor(
    public readonly webhookId: string,
    public readonly workspaceId: string,
    public readonly name: string,
    public readonly url: string,
    public readonly events: string[]
  ) {
    super('WebhookCreated', {
      webhookId,
      workspaceId,
      name,
      url,
      events,
    });
  }
}

export class WebhookTriggeredEvent extends DomainEvent {
  constructor(
    public readonly webhookId: string,
    public readonly event: string,
    public readonly payload: Record<string, any>,
    public readonly deliveryId: string
  ) {
    super('WebhookTriggered', {
      webhookId,
      event,
      payload,
      deliveryId,
    });
  }
}

export class WebhookDeliverySucceededEvent extends DomainEvent {
  constructor(
    public readonly webhookId: string,
    public readonly deliveryId: string,
    public readonly httpStatus: number,
    public readonly attemptCount: number
  ) {
    super('WebhookDeliverySucceeded', {
      webhookId,
      deliveryId,
      httpStatus,
      attemptCount,
    });
  }
}

export class WebhookDeliveryFailedEvent extends DomainEvent {
  constructor(
    public readonly webhookId: string,
    public readonly deliveryId: string,
    public readonly errorMessage: string,
    public readonly attemptCount: number,
    public readonly willRetry: boolean
  ) {
    super('WebhookDeliveryFailed', {
      webhookId,
      deliveryId,
      errorMessage,
      attemptCount,
      willRetry,
    });
  }
}

export class WebhookDisabledEvent extends DomainEvent {
  constructor(
    public readonly webhookId: string,
    public readonly reason: string,
    public readonly failureCount: number
  ) {
    super('WebhookDisabled', {
      webhookId,
      reason,
      failureCount,
    });
  }
}
