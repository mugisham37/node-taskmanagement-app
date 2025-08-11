import { BaseEntity } from './base-entity';

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

export class Webhook extends BaseEntity<WebhookProps> {
  constructor(props: WebhookProps) {
    super(props.id, props.createdAt, props.updatedAt);
    this.props = props;
  }

  get name(): string {
    return this.props.name;
  }

  get url(): string {
    return this.props.url;
  }

  get secret(): string {
    return this.props.secret;
  }

  get events(): WebhookEvent[] {
    return this.props.events;
  }

  get status(): WebhookStatus {
    return this.props.status;
  }

  get workspaceId(): string {
    return this.props.workspaceId;
  }

  get createdBy(): string {
    return this.props.createdBy;
  }

  get lastTriggeredAt(): Date | undefined {
    return this.props.lastTriggeredAt;
  }

  get failureCount(): number {
    return this.props.failureCount;
  }

  get maxFailures(): number {
    return this.props.maxFailures;
  }

  get timeout(): number {
    return this.props.timeout;
  }

  get retryCount(): number {
    return this.props.retryCount;
  }

  get maxRetries(): number {
    return this.props.maxRetries;
  }

  get headers(): Record<string, string> {
    return this.props.headers;
  }

  get metadata(): Record<string, any> {
    return this.props.metadata;
  }

  // Business methods
  public isActive(): boolean {
    return this.props.status === WebhookStatus.ACTIVE;
  }

  public isSuspended(): boolean {
    return this.props.status === WebhookStatus.SUSPENDED;
  }

  public hasFailed(): boolean {
    return this.props.status === WebhookStatus.FAILED;
  }

  public canTrigger(): boolean {
    return this.isActive() && !this.isSuspended();
  }

  public supportsEvent(event: WebhookEvent): boolean {
    return this.props.events.includes(event);
  }

  public recordSuccess(): void {
    this.props.lastTriggeredAt = new Date();
    this.props.failureCount = 0;
    this.props.retryCount = 0;

    if (this.props.status === WebhookStatus.FAILED) {
      this.props.status = WebhookStatus.ACTIVE;
    }

    this.props.updatedAt = new Date();
  }

  public recordFailure(): void {
    this.props.failureCount++;
    this.props.updatedAt = new Date();

    if (this.props.failureCount >= this.props.maxFailures) {
      this.props.status = WebhookStatus.FAILED;
    }
  }

  public incrementRetryCount(): void {
    this.props.retryCount++;
    this.props.updatedAt = new Date();
  }

  public canRetry(): boolean {
    return this.props.retryCount < this.props.maxRetries;
  }

  public activate(): void {
    this.props.status = WebhookStatus.ACTIVE;
    this.props.failureCount = 0;
    this.props.retryCount = 0;
    this.props.updatedAt = new Date();
  }

  public deactivate(): void {
    this.props.status = WebhookStatus.INACTIVE;
    this.props.updatedAt = new Date();
  }

  public suspend(): void {
    this.props.status = WebhookStatus.SUSPENDED;
    this.props.updatedAt = new Date();
  }

  public updateUrl(url: string): void {
    this.props.url = url;
    this.props.updatedAt = new Date();
  }

  public updateSecret(secret: string): void {
    this.props.secret = secret;
    this.props.updatedAt = new Date();
  }

  public updateEvents(events: WebhookEvent[]): void {
    this.props.events = [...events];
    this.props.updatedAt = new Date();
  }

  public addEvent(event: WebhookEvent): void {
    if (!this.supportsEvent(event)) {
      this.props.events.push(event);
      this.props.updatedAt = new Date();
    }
  }

  public removeEvent(event: WebhookEvent): void {
    const index = this.props.events.indexOf(event);
    if (index > -1) {
      this.props.events.splice(index, 1);
      this.props.updatedAt = new Date();
    }
  }

  public updateHeaders(headers: Record<string, string>): void {
    this.props.headers = { ...headers };
    this.props.updatedAt = new Date();
  }

  public addHeader(key: string, value: string): void {
    this.props.headers[key] = value;
    this.props.updatedAt = new Date();
  }

  public removeHeader(key: string): void {
    delete this.props.headers[key];
    this.props.updatedAt = new Date();
  }

  public updateMetadata(metadata: Record<string, any>): void {
    this.props.metadata = { ...this.props.metadata, ...metadata };
    this.props.updatedAt = new Date();
  }

  public getHealthStatus(): {
    isHealthy: boolean;
    failureRate: number;
    lastTriggered?: Date;
    status: WebhookStatus;
  } {
    const failureRate =
      this.props.maxFailures > 0
        ? this.props.failureCount / this.props.maxFailures
        : 0;

    return {
      isHealthy: this.isActive() && failureRate < 0.5,
      failureRate,
      lastTriggered: this.props.lastTriggeredAt,
      status: this.props.status,
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
    // Webhook validation will be handled by the infrastructure layer
    // This is a legacy entity that needs refactoring
  }

  getValidationErrors(): string[] {
    return [];
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

export class WebhookDelivery extends BaseEntity<WebhookDeliveryProps> {
  constructor(props: WebhookDeliveryProps) {
    super(props.id, props.createdAt, props.updatedAt);
    this.props = props;
  }

  get webhookId(): string {
    return this.props.webhookId;
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

  get httpStatus(): number | undefined {
    return this.props.httpStatus;
  }

  get responseBody(): string | undefined {
    return this.props.responseBody;
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

  // Business methods
  public isPending(): boolean {
    return this.props.status === WebhookDeliveryStatus.PENDING;
  }

  public isSuccess(): boolean {
    return this.props.status === WebhookDeliveryStatus.SUCCESS;
  }

  public isFailed(): boolean {
    return this.props.status === WebhookDeliveryStatus.FAILED;
  }

  public isRetrying(): boolean {
    return this.props.status === WebhookDeliveryStatus.RETRYING;
  }

  public canRetry(): boolean {
    return (
      this.props.attemptCount < this.props.maxAttempts &&
      (this.isFailed() || this.isRetrying())
    );
  }

  public markAsSuccess(httpStatus: number, responseBody?: string): void {
    this.props.status = WebhookDeliveryStatus.SUCCESS;
    this.props.httpStatus = httpStatus;
    this.props.responseBody = responseBody;
    this.props.deliveredAt = new Date();
    this.props.updatedAt = new Date();
  }

  public markAsFailed(
    httpStatus?: number,
    errorMessage?: string,
    responseBody?: string
  ): void {
    this.props.status = WebhookDeliveryStatus.FAILED;
    this.props.httpStatus = httpStatus;
    this.props.errorMessage = errorMessage;
    this.props.responseBody = responseBody;
    this.props.updatedAt = new Date();
  }

  public scheduleRetry(retryDelayMs: number = 60000): void {
    if (!this.canRetry()) {
      throw new Error('Cannot retry this delivery');
    }

    this.props.status = WebhookDeliveryStatus.RETRYING;
    this.props.attemptCount++;
    this.props.nextRetryAt = new Date(Date.now() + retryDelayMs);
    this.props.updatedAt = new Date();
  }

  public isReadyForRetry(): boolean {
    return (
      this.isRetrying() &&
      this.props.nextRetryAt &&
      new Date() >= this.props.nextRetryAt
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
    // WebhookDelivery validation will be handled by the infrastructure layer
    // This is a legacy entity that needs refactoring
  }

  getValidationErrors(): string[] {
    return [];
  }
}
