import { BaseEntity } from './base-entity';
import { WebhookId } from '../value-objects/webhook-id';
import { ValueObject } from '../value-objects/value-object';
import { nanoid } from 'nanoid';

/**
 * Webhook Delivery Status - Status of individual webhook deliveries
 */
export enum WebhookDeliveryStatus {
  PENDING = 'pending',
  SUCCESS = 'success',
  FAILED = 'failed',
  RETRYING = 'retrying',
}

/**
 * Webhook Delivery ID Value Object
 */
export class WebhookDeliveryId extends ValueObject<string> {
  protected validate(value: string): void {
    if (!value) {
      throw new Error('WebhookDelivery ID cannot be empty');
    }
  }
  
  static create(): WebhookDeliveryId {
    return new WebhookDeliveryId(nanoid());
  }
  
  static fromString(value: string): WebhookDeliveryId {
    return new WebhookDeliveryId(value);
  }
}

/**
 * Webhook Delivery Entity Properties
 */
export interface WebhookDeliveryProps {
  id: WebhookDeliveryId;
  webhookId: WebhookId;
  eventType: string;
  payload: Record<string, any>;
  status: WebhookDeliveryStatus;
  httpStatus?: number;
  responseBody?: string;
  responseHeaders?: Record<string, string>;
  errorMessage?: string;
  attempts: number;
  maxAttempts: number;
  nextRetryAt?: Date;
  deliveredAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Webhook Delivery Entity
 * Represents a delivery attempt of a webhook
 */
export class WebhookDelivery extends BaseEntity<WebhookDeliveryId> {
  private _webhookId: WebhookId;
  private _eventType: string;
  private _payload: Record<string, any>;
  private _status: WebhookDeliveryStatus;
  private _httpStatus?: number;
  private _responseBody?: string;
  private _responseHeaders?: Record<string, string>;
  private _errorMessage?: string;
  private _attempts: number;
  private _maxAttempts: number;
  private _nextRetryAt?: Date;
  private _deliveredAt?: Date;

  constructor(props: WebhookDeliveryProps) {
    super(props.id, props.createdAt, props.updatedAt);
    this._webhookId = props.webhookId;
    this._eventType = props.eventType;
    this._payload = props.payload;
    this._status = props.status;
    this._httpStatus = props.httpStatus;
    this._responseBody = props.responseBody;
    this._responseHeaders = props.responseHeaders;
    this._errorMessage = props.errorMessage;
    this._attempts = props.attempts;
    this._maxAttempts = props.maxAttempts;
    this._nextRetryAt = props.nextRetryAt;
    this._deliveredAt = props.deliveredAt;
  }

  // Getters
  get webhookId(): WebhookId {
    return this._webhookId;
  }

  get eventType(): string {
    return this._eventType;
  }

  get payload(): Record<string, any> {
    return this._payload;
  }

  get status(): WebhookDeliveryStatus {
    return this._status;
  }

  get httpStatus(): number | undefined {
    return this._httpStatus;
  }

  get responseBody(): string | undefined {
    return this._responseBody;
  }

  get responseHeaders(): Record<string, string> | undefined {
    return this._responseHeaders;
  }

  get errorMessage(): string | undefined {
    return this._errorMessage;
  }

  get attempts(): number {
    return this._attempts;
  }

  get maxAttempts(): number {
    return this._maxAttempts;
  }

  get nextRetryAt(): Date | undefined {
    return this._nextRetryAt;
  }

  get deliveredAt(): Date | undefined {
    return this._deliveredAt;
  }

  // Business methods
  markAsSuccess(httpStatus: number, responseBody?: string, responseHeaders?: Record<string, string>): void {
    this._status = WebhookDeliveryStatus.SUCCESS;
    this._httpStatus = httpStatus;
    this._responseBody = responseBody;
    this._responseHeaders = responseHeaders;
    this._deliveredAt = new Date();
    this._nextRetryAt = undefined;
    this.markAsUpdated();
  }

  markAsFailure(httpStatus?: number, errorMessage?: string, responseBody?: string): void {
    this._status = WebhookDeliveryStatus.FAILED;
    this._httpStatus = httpStatus;
    this._errorMessage = errorMessage;
    this._responseBody = responseBody;
    this._attempts += 1;
    
    if (this._attempts < this._maxAttempts) {
      this._status = WebhookDeliveryStatus.RETRYING;
      this._nextRetryAt = this.calculateNextRetry();
    }
    
    this.markAsUpdated();
  }

  canRetry(): boolean {
    return this._attempts < this._maxAttempts && 
           (this._status === WebhookDeliveryStatus.FAILED || this._status === WebhookDeliveryStatus.RETRYING);
  }

  private calculateNextRetry(): Date {
    // Exponential backoff: 2^attempts * 60 seconds
    const backoffMinutes = Math.pow(2, this._attempts) * 1;
    return new Date(Date.now() + backoffMinutes * 60 * 1000);
  }

  protected validate(): void {
    // Add validation logic if needed
  }

  getValidationErrors(): string[] {
    return [];
  }

  static create(
    webhookId: WebhookId,
    eventType: string,
    payload: Record<string, any>,
    maxAttempts: number = 5
  ): WebhookDelivery {
    return new WebhookDelivery({
      id: WebhookDeliveryId.create(),
      webhookId,
      eventType,
      payload,
      status: WebhookDeliveryStatus.PENDING,
      attempts: 0,
      maxAttempts,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
}
