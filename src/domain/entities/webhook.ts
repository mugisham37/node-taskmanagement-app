import { BaseEntity } from './base-entity';
import { ValidationError } from '../../shared/errors';
import { ValueObject } from '../value-objects/value-object';

// Simple ID value object for webhook
class WebhookId extends ValueObject<string> {
  protected validate(value: string): void {
    if (!value || value.trim().length === 0) {
      throw new Error('WebhookId cannot be empty');
    }
  }

  static create(value: string): WebhookId {
    return new WebhookId(value);
  }
}

// Simple ID value object for webhook delivery
class WebhookDeliveryId extends ValueObject<string> {
  protected validate(value: string): void {
    if (!value || value.trim().length === 0) {
      throw new Error('WebhookDeliveryId cannot be empty');
    }
  }

  static create(value: string): WebhookDeliveryId {
    return new WebhookDeliveryId(value);
  }
}

export enum WebhookEvent {
  TASK_CREATED = 'task.created',
  TASK_UPDATED = 'task.updated',
  TASK_COMPLETED = 'task.completed',
  TASK_DELETED = 'task.deleted',
  PROJECT_CREATED = 'project.created',
  PROJECT_UPDATED = 'project.updated',
  PROJECT_DELETED = 'project.deleted',
  USER_JOINED = 'user.joined',
  USER_LEFT = 'user.left',
  COMMENT_ADDED = 'comment.added',
  FILE_UPLOADED = 'file.uploaded',
}

export enum WebhookStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  FAILED = 'failed',
  SUSPENDED = 'suspended',
}

export interface WebhookProps {
  id: string;
  name: string;
  url: string;
  secret: string;
  events: WebhookEvent[];
  status: WebhookStatus;
  workspaceId: string;
  createdBy: string;
  lastTriggeredAt?: Date;
  failureCount: number;
  maxFailures: number;
  timeout: number;
  retryCount: number;
  maxRetries: number;
  headers: Record<string, string>;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export class Webhook extends BaseEntity<WebhookId> {
  private _name: string;
  private _url: string;
  private _secret: string;
  private _events: WebhookEvent[];
  private _status: WebhookStatus;
  private _workspaceId: string;
  private _createdBy: string;
  private _lastTriggeredAt?: Date;
  private _failureCount: number;
  private _maxFailures: number;
  private _timeout: number;
  private _retryCount: number;
  private _maxRetries: number;
  private _headers: Record<string, string>;
  private _metadata: Record<string, any>;

  constructor(props: WebhookProps) {
    super(WebhookId.create(props.id), props.createdAt, props.updatedAt);
    this._name = props.name;
    this._url = props.url;
    this._secret = props.secret;
    this._events = props.events;
    this._status = props.status;
    this._workspaceId = props.workspaceId;
    this._createdBy = props.createdBy;
    this._lastTriggeredAt = props.lastTriggeredAt;
    this._failureCount = props.failureCount;
    this._maxFailures = props.maxFailures;
    this._timeout = props.timeout;
    this._retryCount = props.retryCount;
    this._maxRetries = props.maxRetries;
    this._headers = props.headers;
    this._metadata = props.metadata;
  }

  get name(): string {
    return this._name;
  }

  get url(): string {
    return this._url;
  }

  get secret(): string {
    return this._secret;
  }

  get events(): WebhookEvent[] {
    return this._events;
  }

  get status(): WebhookStatus {
    return this._status;
  }

  get workspaceId(): string {
    return this._workspaceId;
  }

  get createdBy(): string {
    return this._createdBy;
  }

  get lastTriggeredAt(): Date | undefined {
    return this._lastTriggeredAt;
  }

  get failureCount(): number {
    return this._failureCount;
  }

  get maxFailures(): number {
    return this._maxFailures;
  }

  get timeout(): number {
    return this._timeout;
  }

  get retryCount(): number {
    return this._retryCount;
  }

  get maxRetries(): number {
    return this._maxRetries;
  }

  get headers(): Record<string, string> {
    return this._headers;
  }

  get metadata(): Record<string, any> {
    return this._metadata;
  }

  // Business methods
  public isActive(): boolean {
    return this._status === WebhookStatus.ACTIVE;
  }

  public isSuspended(): boolean {
    return this._status === WebhookStatus.SUSPENDED;
  }

  public hasFailed(): boolean {
    return this._status === WebhookStatus.FAILED;
  }

  public canTrigger(): boolean {
    return this.isActive() && !this.isSuspended();
  }

  public supportsEvent(event: WebhookEvent): boolean {
    return this._events.includes(event);
  }

  public recordSuccess(): void {
    this._lastTriggeredAt = new Date();
    this._failureCount = 0;
    this._retryCount = 0;

    if (this._status === WebhookStatus.FAILED) {
      this._status = WebhookStatus.ACTIVE;
    }

    this.markAsUpdated();
  }

  public recordFailure(): void {
    this._failureCount++;
    this.markAsUpdated();

    if (this._failureCount >= this._maxFailures) {
      this._status = WebhookStatus.FAILED;
    }
  }

  public incrementRetryCount(): void {
    this._retryCount++;
    this.markAsUpdated();
  }

  public canRetry(): boolean {
    return this._retryCount < this._maxRetries;
  }

  public activate(): void {
    this._status = WebhookStatus.ACTIVE;
    this._failureCount = 0;
    this._retryCount = 0;
    this.markAsUpdated();
  }

  public deactivate(): void {
    this._status = WebhookStatus.INACTIVE;
    this.markAsUpdated();
  }

  public suspend(): void {
    this._status = WebhookStatus.SUSPENDED;
    this.markAsUpdated();
  }

  public updateUrl(url: string): void {
    this._url = url;
    this.markAsUpdated();
  }

  public updateSecret(secret: string): void {
    this._secret = secret;
    this.markAsUpdated();
  }

  public updateEvents(events: WebhookEvent[]): void {
    this._events = [...events];
    this.markAsUpdated();
  }

  public addEvent(event: WebhookEvent): void {
    if (!this.supportsEvent(event)) {
      this._events.push(event);
      this.markAsUpdated();
    }
  }

  public removeEvent(event: WebhookEvent): void {
    const index = this._events.indexOf(event);
    if (index > -1) {
      this._events.splice(index, 1);
      this.markAsUpdated();
    }
  }

  public updateHeaders(headers: Record<string, string>): void {
    this._headers = { ...headers };
    this.markAsUpdated();
  }

  public addHeader(key: string, value: string): void {
    this._headers[key] = value;
    this.markAsUpdated();
  }

  public removeHeader(key: string): void {
    delete this._headers[key];
    this.markAsUpdated();
  }

  public updateMetadata(metadata: Record<string, any>): void {
    this._metadata = { ...this._metadata, ...metadata };
    this.markAsUpdated();
  }

  public getHealthStatus(): {
    isHealthy: boolean;
    failureRate: number;
    lastTriggered?: Date;
    status: WebhookStatus;
  } {
    const failureRate =
      this._maxFailures > 0 ? this._failureCount / this._maxFailures : 0;

    return {
      isHealthy: this.isActive() && failureRate < 0.5,
      failureRate,
      lastTriggered: this._lastTriggeredAt,
      status: this._status,
    };
  }

  public static create(
    props: Omit<
      WebhookProps,
      'id' | 'createdAt' | 'updatedAt' | 'failureCount' | 'retryCount'
    >
  ): Webhook {
    const now = new Date();
    return new Webhook({
      ...props,
      id: crypto.randomUUID(),
      failureCount: 0,
      retryCount: 0,
      maxFailures: props.maxFailures || 5,
      maxRetries: props.maxRetries || 3,
      timeout: props.timeout || 30000, // 30 seconds
      headers: props.headers || {},
      metadata: props.metadata || {},
      createdAt: now,
      updatedAt: now,
    });
  }

  public static generateSecret(): string {
    return crypto.randomUUID().replace(/-/g, '');
  }

  protected validate(): void {
    if (!this._name || this._name.trim().length === 0) {
      throw ValidationError.forField('name', 'Webhook name cannot be empty');
    }
    if (!this._url || this._url.trim().length === 0) {
      throw ValidationError.forField('url', 'Webhook URL cannot be empty');
    }
    if (!this._secret || this._secret.trim().length === 0) {
      throw ValidationError.forField(
        'secret',
        'Webhook secret cannot be empty'
      );
    }
  }

  getValidationErrors(): string[] {
    const errors: string[] = [];
    try {
      this.validate();
    } catch (error) {
      if (error instanceof ValidationError) {
        errors.push(error.message);
      }
    }
    return errors;
  }
}

export enum WebhookDeliveryStatus {
  PENDING = 'pending',
  SUCCESS = 'success',
  FAILED = 'failed',
  RETRYING = 'retrying',
}

export interface WebhookDeliveryProps {
  id: string;
  webhookId: string;
  event: WebhookEvent;
  payload: Record<string, any>;
  status: WebhookDeliveryStatus;
  httpStatus?: number;
  responseBody?: string;
  errorMessage?: string;
  attemptCount: number;
  maxAttempts: number;
  nextRetryAt?: Date;
  deliveredAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class WebhookDelivery extends BaseEntity<WebhookDeliveryId> {
  private _webhookId: string;
  private _event: WebhookEvent;
  private _payload: Record<string, any>;
  private _status: WebhookDeliveryStatus;
  private _httpStatus?: number;
  private _responseBody?: string;
  private _errorMessage?: string;
  private _attemptCount: number;
  private _maxAttempts: number;
  private _nextRetryAt?: Date;
  private _deliveredAt?: Date;

  constructor(props: WebhookDeliveryProps) {
    super(WebhookDeliveryId.create(props.id), props.createdAt, props.updatedAt);
    this._webhookId = props.webhookId;
    this._event = props.event;
    this._payload = props.payload;
    this._status = props.status;
    this._httpStatus = props.httpStatus;
    this._responseBody = props.responseBody;
    this._errorMessage = props.errorMessage;
    this._attemptCount = props.attemptCount;
    this._maxAttempts = props.maxAttempts;
    this._nextRetryAt = props.nextRetryAt;
    this._deliveredAt = props.deliveredAt;
  }

  get webhookId(): string {
    return this._webhookId;
  }

  get event(): WebhookEvent {
    return this._event;
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

  get errorMessage(): string | undefined {
    return this._errorMessage;
  }

  get attemptCount(): number {
    return this._attemptCount;
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
  public isPending(): boolean {
    return this._status === WebhookDeliveryStatus.PENDING;
  }

  public isSuccess(): boolean {
    return this._status === WebhookDeliveryStatus.SUCCESS;
  }

  public isFailed(): boolean {
    return this._status === WebhookDeliveryStatus.FAILED;
  }

  public isRetrying(): boolean {
    return this._status === WebhookDeliveryStatus.RETRYING;
  }

  public canRetry(): boolean {
    return (
      this._attemptCount < this._maxAttempts &&
      (this.isFailed() || this.isRetrying())
    );
  }

  public markAsSuccess(httpStatus: number, responseBody?: string): void {
    this._status = WebhookDeliveryStatus.SUCCESS;
    this._httpStatus = httpStatus;
    this._responseBody = responseBody;
    this._deliveredAt = new Date();
    this.markAsUpdated();
  }

  public markAsFailed(
    httpStatus?: number,
    errorMessage?: string,
    responseBody?: string
  ): void {
    this._status = WebhookDeliveryStatus.FAILED;
    this._httpStatus = httpStatus;
    this._errorMessage = errorMessage;
    this._responseBody = responseBody;
    this.markAsUpdated();
  }

  public scheduleRetry(retryDelayMs: number = 60000): void {
    if (!this.canRetry()) {
      throw new Error('Cannot retry this delivery');
    }

    this._status = WebhookDeliveryStatus.RETRYING;
    this._attemptCount++;
    this._nextRetryAt = new Date(Date.now() + retryDelayMs);
    this.markAsUpdated();
  }

  public isReadyForRetry(): boolean {
    return (
      this.isRetrying() && this._nextRetryAt && new Date() >= this._nextRetryAt
    );
  }

  public static create(
    props: Omit<
      WebhookDeliveryProps,
      'id' | 'createdAt' | 'updatedAt' | 'attemptCount'
    >
  ): WebhookDelivery {
    const now = new Date();
    return new WebhookDelivery({
      ...props,
      id: crypto.randomUUID(),
      attemptCount: 0,
      maxAttempts: props.maxAttempts || 3,
      createdAt: now,
      updatedAt: now,
    });
  }

  protected validate(): void {
    if (!this._webhookId || this._webhookId.trim().length === 0) {
      throw ValidationError.forField('webhookId', 'Webhook ID cannot be empty');
    }
    if (!this._payload) {
      throw ValidationError.forField('payload', 'Payload cannot be empty');
    }
  }

  getValidationErrors(): string[] {
    const errors: string[] = [];
    try {
      this.validate();
    } catch (error) {
      if (error instanceof ValidationError) {
        errors.push(error.message);
      }
    }
    return errors;
  }
}
