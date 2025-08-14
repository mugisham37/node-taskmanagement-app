import { AggregateRoot, AggregateProps } from './aggregate-root';
import { Webhook, WebhookDelivery, WebhookEvent } from '../entities/webhook';
import {
  WebhookCreatedEvent,
  WebhookTriggeredEvent,
  WebhookDeliverySucceededEvent,
  WebhookDeliveryFailedEvent,
} from '../events/webhook-events';

export interface WebhookAggregateProps extends AggregateProps {
  webhook: Webhook;
  deliveries: WebhookDelivery[];
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
        webhook.events.map(e => e.toString())
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
    return this.props.webhook.isActive() && this.props.webhook.supportsEvent(event);
  }

  public trigger(
    event: WebhookEvent,
    payload: Record<string, any>
  ): WebhookDelivery {
    if (!this.canTrigger(event)) {
      throw new Error(
        `Webhook ${this.props.webhook.id} cannot handle event ${event} or is not active`
      );
    }

    const delivery = WebhookDelivery.create({
      webhookId: this.props.webhook.id,
      event,
      payload,
      attempt: 1,
      maxAttempts: this.props.webhook.maxRetries,
    });

    this.props.deliveries.push(delivery);
    this.props.updatedAt = new Date();

    this.addDomainEvent(
      new WebhookTriggeredEvent(
        this.props.webhook.id,
        event.toString(),
        payload,
        delivery.id
      )
    );

    return delivery;
  }

  public markDeliveryAsSucceeded(
    deliveryId: string,
    response: Record<string, any>,
    statusCode: number
  ): void {
    const delivery = this.getDelivery(deliveryId);
    
    const updatedDelivery = delivery.withSuccess(
      statusCode,
      JSON.stringify(response),
      {},
      0 // duration - would be calculated in real implementation
    );

    this.updateDelivery(deliveryId, updatedDelivery);
    this.props.updatedAt = new Date();

    this.addDomainEvent(
      new WebhookDeliverySucceededEvent(
        this.props.webhook.id,
        deliveryId,
        response,
        statusCode,
        delivery.attempt
      )
    );
  }

  public markDeliveryAsFailed(
    deliveryId: string,
    error: string,
    statusCode?: number
  ): void {
    const delivery = this.getDelivery(deliveryId);
    
    const willRetry = delivery.attempt < delivery.maxAttempts;
    const nextRetryAt = willRetry ? this.calculateNextRetryTime(delivery.attempt) : undefined;
    
    const updatedDelivery = delivery.withFailure(
      error,
      statusCode,
      undefined,
      nextRetryAt
    );

    this.updateDelivery(deliveryId, updatedDelivery);
    this.props.updatedAt = new Date();

    this.addDomainEvent(
      new WebhookDeliveryFailedEvent(
        this.props.webhook.id,
        deliveryId,
        error,
        statusCode || 0,
        delivery.attempt,
        willRetry
      )
    );

    // If we should retry, schedule the retry
    if (willRetry) {
      this.scheduleRetry(deliveryId);
    }
  }

  public retryDelivery(deliveryId: string): void {
    const delivery = this.getDelivery(deliveryId);
    
    if (!delivery.canRetry()) {
      throw new Error(`Delivery ${deliveryId} cannot be retried`);
    }

    const retryDelivery = delivery.withRetryAttempt();
    this.updateDelivery(deliveryId, retryDelivery);
    this.props.updatedAt = new Date();
  }

  public disable(): void {
    this.props.webhook = this.props.webhook.withStatus('INACTIVE' as any);
    this.props.updatedAt = new Date();
  }

  public enable(): void {
    this.props.webhook = this.props.webhook.withStatus('ACTIVE' as any);
    this.props.updatedAt = new Date();
  }

  private getDelivery(deliveryId: string): WebhookDelivery {
    const delivery = this.props.deliveries.find(d => d.id === deliveryId);
    if (!delivery) {
      throw new Error(`Delivery ${deliveryId} not found`);
    }
    return delivery;
  }

  private updateDelivery(deliveryId: string, updatedDelivery: WebhookDelivery): void {
    const index = this.props.deliveries.findIndex(d => d.id === deliveryId);
    if (index === -1) {
      throw new Error(`Delivery ${deliveryId} not found`);
    }
    this.props.deliveries[index] = updatedDelivery;
  }

  private calculateNextRetryTime(attempt: number): Date {
    // Exponential backoff: 2^attempt seconds
    const seconds = Math.pow(2, attempt);
    return new Date(Date.now() + seconds * 1000);
  }

  private scheduleRetry(deliveryId: string): void {
    // In a real implementation, this would schedule the retry
    // For now, we'll just update the delivery with the next retry time
    const delivery = this.getDelivery(deliveryId);
    const nextRetryAt = this.calculateNextRetryTime(delivery.attempt);
    const updatedDelivery = delivery.withRetryAttempt(nextRetryAt);
    this.updateDelivery(deliveryId, updatedDelivery);
  }

  public getActiveDeliveries(): WebhookDelivery[] {
    return this.props.deliveries.filter(d => d.isPending());
  }

  public getFailedDeliveries(): WebhookDelivery[] {
    return this.props.deliveries.filter(d => d.hasFailed());
  }

  public getSuccessfulDeliveries(): WebhookDelivery[] {
    return this.props.deliveries.filter(d => d.isSuccessful());
  }

  // Required abstract method implementations
  protected applyEvent(_event: any): void {
    // Handle event sourcing if needed
    // For now, we'll leave this empty as it's not being used
  }

  protected checkInvariants(): void {
    if (!this.props.webhook) {
      throw new Error('Webhook is required');
    }
    
    if (!this.props.webhook.url || this.props.webhook.url.trim() === '') {
      throw new Error('Webhook URL is required');
    }
    
    if (!this.props.webhook.name || this.props.webhook.name.trim() === '') {
      throw new Error('Webhook name is required');
    }
  }

  createSnapshot(): Record<string, any> {
    return {
      id: this.id,
      webhook: {
        id: this.props.webhook.id,
        workspaceId: this.props.webhook.workspaceId,
        name: this.props.webhook.name,
        url: this.props.webhook.url,
        events: this.props.webhook.events,
        status: this.props.webhook.status,
        // Add other webhook properties as needed
      },
      deliveries: this.props.deliveries.map(d => ({
        id: d.id,
        webhookId: d.webhookId,
        event: d.event,
        payload: d.payload,
        status: d.status,
        attempt: d.attempt,
        maxAttempts: d.maxAttempts,
        // Add other delivery properties as needed
      })),
      createdAt: this.props.createdAt.toISOString(),
      updatedAt: this.props.updatedAt.toISOString(),
    };
  }

  restoreFromSnapshot(_snapshot: Record<string, any>): void {
    // Implement snapshot restoration if needed for event sourcing
    // For now, we'll leave this empty as it's not being used
  }

  getValidationErrors(): string[] {
    const errors: string[] = [];
    
    try {
      this.checkInvariants();
    } catch (error) {
      if (error instanceof Error) {
        errors.push(error.message);
      }
    }
    
    return errors;
  }
}
