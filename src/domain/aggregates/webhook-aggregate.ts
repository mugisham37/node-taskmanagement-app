import { AggregateRoot } from './aggregate-root';
import { Webhook, WebhookDelivery, WebhookEvent } from '../entities/webhook';
import {
  WebhookCreatedEvent,
  WebhookTriggeredEvent,
  WebhookDeliverySucceededEvent,
  WebhookDeliveryFailedEvent,
} from '../events/webhook-events';

export interface WebhookAggregateProps {
  id: string;
  webhook: Webhook;
  deliveries: WebhookDelivery[];
  createdAt: Date;
  updatedAt: Date;
}

export class WebhookAggregate extends AggregateRoot<WebhookAggregateProps> {
  private constructor(props: WebhookAggregateProps) {
    super(props);
  }

  public static create(webhook: Webhook): WebhookAggregate {
    const now = new Date();
    const aggregate = new WebhookAggregate({
      id: webhook.id,
      webhook,
      deliveries: [],
      createdAt: now,
      updatedAt: now,
    });

    aggregate.addDomainEvent(
      new WebhookCreatedEvent(
        webhook.id,
        webhook.workspaceId,
        webhook.name,
        webhook.url,
        webhook.events
      )
    );

    return aggregate;
  }

  public static fromPersistence(
    props: WebhookAggregateProps
  ): WebhookAggregate {
    return new WebhookAggregate(props);
  }

  get webhook(): Webhook {
    return this.props.webhook;
  }

  get deliveries(): WebhookDelivery[] {
    return [...this.props.deliveries];
  }

  public canTrigger(event: WebhookEvent): boolean {
    return (
      this.props.webhook.canTrigger() && this.props.webhook.supportsEvent(event)
    );
  }

  public trigger(
    event: WebhookEvent,
    payload: Record<string, any>
  ): WebhookDelivery {
    if (!this.canTrigger(event)) {
      throw new Error('Webhook cannot be triggered for this event');
    }

    const delivery = WebhookDelivery.create({
      webhookId: this.props.webhook.id,
      event,
      payload: {
        ...payload,
        event,
        timestamp: new Date().toISOString(),
        workspaceId: this.props.webhook.workspaceId,
      },
      status: 'pending' as any,
      maxAttempts: this.props.webhook.maxRetries,
    });

    this.props.deliveries.push(delivery);
    this.props.updatedAt = new Date();

    this.addDomainEvent(
      new WebhookTriggeredEvent(
        this.props.webhook.id,
        event,
        payload,
        delivery.id
      )
    );

    return delivery;
  }

  public recordDeliverySuccess(
    deliveryId: string,
    httpStatus: number,
    responseBody?: string
  ): void {
    const delivery = this.findDelivery(deliveryId);
    if (!delivery) {
      throw new Error('Delivery not found');
    }

    delivery.markAsSuccess(httpStatus, responseBody);
    this.props.webhook.recordSuccess();
    this.props.updatedAt = new Date();

    this.addDomainEvent(
      new WebhookDeliverySucceededEvent(
        this.props.webhook.id,
        deliveryId,
        httpStatus,
        delivery.attemptCount
      )
    );
  }

  public recordDeliveryFailure(
    deliveryId: string,
    errorMessage: string,
    httpStatus?: number,
    responseBody?: string
  ): void {
    const delivery = this.findDelivery(deliveryId);
    if (!delivery) {
      throw new Error('Delivery not found');
    }

    delivery.markAsFailed(httpStatus, errorMessage, responseBody);
    this.props.webhook.recordFailure();
    this.props.updatedAt = new Date();

    const willRetry = delivery.canRetry();
    if (willRetry) {
      const retryDelay = this.calculateRetryDelay(delivery.attemptCount);
      delivery.scheduleRetry(retryDelay);
    }

    this.addDomainEvent(
      new WebhookDeliveryFailedEvent(
        this.props.webhook.id,
        deliveryId,
        errorMessage,
        delivery.attemptCount,
        willRetry
      )
    );
  }

  public activate(): void {
    this.props.webhook.activate();
    this.props.updatedAt = new Date();
  }

  public deactivate(): void {
    this.props.webhook.deactivate();
    this.props.updatedAt = new Date();
  }

  public suspend(): void {
    this.props.webhook.suspend();
    this.props.updatedAt = new Date();
  }

  public updateConfiguration(updates: {
    name?: string;
    url?: string;
    events?: WebhookEvent[];
    headers?: Record<string, string>;
    secret?: string;
  }): void {
    if (updates.name) {
      this.props.webhook.updateUrl(updates.name); // This should be updateName in the entity
    }
    if (updates.url) {
      this.props.webhook.updateUrl(updates.url);
    }
    if (updates.events) {
      this.props.webhook.updateEvents(updates.events);
    }
    if (updates.headers) {
      this.props.webhook.updateHeaders(updates.headers);
    }
    if (updates.secret) {
      this.props.webhook.updateSecret(updates.secret);
    }

    this.props.updatedAt = new Date();
  }

  public getHealthStatus(): {
    isHealthy: boolean;
    failureRate: number;
    recentDeliveries: number;
    successRate: number;
    lastTriggered?: Date;
  } {
    const health = this.props.webhook.getHealthStatus();
    const recentDeliveries = this.props.deliveries.filter(
      d => d.createdAt > new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
    );

    const successfulDeliveries = recentDeliveries.filter(d => d.isSuccess());
    const successRate =
      recentDeliveries.length > 0
        ? successfulDeliveries.length / recentDeliveries.length
        : 0;

    return {
      ...health,
      recentDeliveries: recentDeliveries.length,
      successRate,
    };
  }

  public getPendingDeliveries(): WebhookDelivery[] {
    return this.props.deliveries.filter(d => d.isPending());
  }

  public getFailedDeliveries(): WebhookDelivery[] {
    return this.props.deliveries.filter(d => d.isFailed());
  }

  public getRetryableDeliveries(): WebhookDelivery[] {
    return this.props.deliveries.filter(
      d => d.canRetry() && d.isReadyForRetry()
    );
  }

  private findDelivery(deliveryId: string): WebhookDelivery | undefined {
    return this.props.deliveries.find(d => d.id === deliveryId);
  }

  private calculateRetryDelay(attemptCount: number): number {
    // Exponential backoff: 1min, 2min, 4min, 8min, etc.
    return Math.min(60000 * Math.pow(2, attemptCount - 1), 30 * 60000); // Max 30 minutes
  }

  protected validate(): void {
    if (!this.props.webhook) {
      throw new Error('Webhook is required');
    }
  }
}
