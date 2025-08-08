import { Entity } from '../../shared/base/entity';
import { WebhookId } from '../value-objects/webhook-id';
import { UserId } from '../../authentication/value-objects/user-id';
import { WorkspaceId } from '../../task-management/value-objects/workspace-id';
import { WebhookUrl } from '../value-objects/webhook-url';
import { WebhookSecret } from '../value-objects/webhook-secret';
import { WebhookStatus } from '../value-objects/webhook-status';
import { WebhookEvent } from '../value-objects/webhook-event';
import { DomainEvent } from '../../shared/events/domain-event';

export interface WebhookProps {
  id: WebhookId;
  workspaceId: WorkspaceId;
  userId: UserId;
  name: string;
  url: WebhookUrl;
  secret?: WebhookSecret;
  status: WebhookStatus;
  events: WebhookEvent[];
  headers: Record<string, string>;
  httpMethod: 'POST' | 'PUT' | 'PATCH';
  contentType: 'application/json' | 'application/x-www-form-urlencoded';
  signatureHeader?: string;
  signatureAlgorithm: 'sha256' | 'sha1' | 'md5';
  timeout: number;
  maxRetries: number;
  retryDelay: number;
  metadata: Record<string, any>;
  successCount: number;
  failureCount: number;
  lastDeliveryAt?: Date;
  lastDeliveryStatus?: 'success' | 'failed';
  lastError?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class WebhookEntity extends Entity<WebhookProps> {
  get id(): WebhookId {
    return this.props.id;
  }

  get workspaceId(): WorkspaceId {
    return this.props.workspaceId;
  }

  get userId(): UserId {
    return this.props.userId;
  }

  get name(): string {
    return this.props.name;
  }

  get url(): WebhookUrl {
    return this.props.url;
  }

  get secret(): WebhookSecret | undefined {
    return this.props.secret;
  }

  get status(): WebhookStatus {
    return this.props.status;
  }

  get events(): WebhookEvent[] {
    return this.props.events;
  }

  get headers(): Record<string, string> {
    return this.props.headers;
  }

  get httpMethod(): 'POST' | 'PUT' | 'PATCH' {
    return this.props.httpMethod;
  }

  get contentType(): 'application/json' | 'application/x-www-form-urlencoded' {
    return this.props.contentType;
  }

  get signatureHeader(): string | undefined {
    return this.props.signatureHeader;
  }

  get signatureAlgorithm(): 'sha256' | 'sha1' | 'md5' {
    return this.props.signatureAlgorithm;
  }

  get timeout(): number {
    return this.props.timeout;
  }

  get maxRetries(): number {
    return this.props.maxRetries;
  }

  get retryDelay(): number {
    return this.props.retryDelay;
  }

  get metadata(): Record<string, any> {
    return this.props.metadata;
  }

  get successCount(): number {
    return this.props.successCount;
  }

  get failureCount(): number {
    return this.props.failureCount;
  }

  get lastDeliveryAt(): Date | undefined {
    return this.props.lastDeliveryAt;
  }

  get lastDeliveryStatus(): 'success' | 'failed' | undefined {
    return this.props.lastDeliveryStatus;
  }

  get lastError(): string | undefined {
    return this.props.lastError;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  get isActive(): boolean {
    return this.props.status.isActive();
  }

  get deliveryRate(): number {
    const total = this.props.successCount + this.props.failureCount;
    return total > 0 ? (this.props.successCount / total) * 100 : 0;
  }

  // Business methods
  activate(): void {
    if (this.props.status.isActive()) {
      return;
    }

    this.props.status = WebhookStatus.active();
    this.props.updatedAt = new Date();

    this.addDomainEvent(
      new WebhookActivatedEvent(this.props.id, this.props.workspaceId)
    );
  }

  deactivate(): void {
    if (!this.props.status.isActive()) {
      return;
    }

    this.props.status = WebhookStatus.inactive();
    this.props.updatedAt = new Date();

    this.addDomainEvent(
      new WebhookDeactivatedEvent(this.props.id, this.props.workspaceId)
    );
  }

  updateConfiguration(updates: {
    name?: string;
    url?: WebhookUrl;
    secret?: WebhookSecret;
    events?: WebhookEvent[];
    headers?: Record<string, string>;
    httpMethod?: 'POST' | 'PUT' | 'PATCH';
    contentType?: 'application/json' | 'application/x-www-form-urlencoded';
    signatureHeader?: string;
    signatureAlgorithm?: 'sha256' | 'sha1' | 'md5';
    timeout?: number;
    maxRetries?: number;
    retryDelay?: number;
    metadata?: Record<string, any>;
  }): void {
    const oldConfiguration = {
      name: this.props.name,
      url: this.props.url.value,
      events: this.props.events.map(e => e.value),
    };

    if (updates.name !== undefined) {
      this.props.name = updates.name;
    }
    if (updates.url !== undefined) {
      this.props.url = updates.url;
    }
    if (updates.secret !== undefined) {
      this.props.secret = updates.secret;
    }
    if (updates.events !== undefined) {
      this.props.events = updates.events;
    }
    if (updates.headers !== undefined) {
      this.props.headers = updates.headers;
    }
    if (updates.httpMethod !== undefined) {
      this.props.httpMethod = updates.httpMethod;
    }
    if (updates.contentType !== undefined) {
      this.props.contentType = updates.contentType;
    }
    if (updates.signatureHeader !== undefined) {
      this.props.signatureHeader = updates.signatureHeader;
    }
    if (updates.signatureAlgorithm !== undefined) {
      this.props.signatureAlgorithm = updates.signatureAlgorithm;
    }
    if (updates.timeout !== undefined) {
      this.props.timeout = updates.timeout;
    }
    if (updates.maxRetries !== undefined) {
      this.props.maxRetries = updates.maxRetries;
    }
    if (updates.retryDelay !== undefined) {
      this.props.retryDelay = updates.retryDelay;
    }
    if (updates.metadata !== undefined) {
      this.props.metadata = { ...this.props.metadata, ...updates.metadata };
    }

    this.props.updatedAt = new Date();

    this.addDomainEvent(
      new WebhookConfigurationUpdatedEvent(
        this.props.id,
        this.props.workspaceId,
        oldConfiguration,
        {
          name: this.props.name,
          url: this.props.url.value,
          events: this.props.events.map(e => e.value),
        }
      )
    );
  }

  recordDeliverySuccess(): void {
    this.props.successCount += 1;
    this.props.lastDeliveryAt = new Date();
    this.props.lastDeliveryStatus = 'success';
    this.props.lastError = undefined;
    this.props.updatedAt = new Date();
  }

  recordDeliveryFailure(error: string): void {
    this.props.failureCount += 1;
    this.props.lastDeliveryAt = new Date();
    this.props.lastDeliveryStatus = 'failed';
    this.props.lastError = error;
    this.props.updatedAt = new Date();

    // Auto-disable webhook if failure rate is too high
    if (this.shouldAutoDisable()) {
      this.deactivate();
    }
  }

  canReceiveEvent(event: WebhookEvent): boolean {
    return this.isActive && this.props.events.some(e => e.equals(event));
  }

  private shouldAutoDisable(): boolean {
    const total = this.props.successCount + this.props.failureCount;
    if (total < 10) return false; // Need at least 10 attempts

    const failureRate = (this.props.failureCount / total) * 100;
    return failureRate > 80; // Disable if failure rate > 80%
  }

  static create(
    workspaceId: WorkspaceId,
    userId: UserId,
    name: string,
    url: WebhookUrl,
    events: WebhookEvent[],
    options?: {
      secret?: WebhookSecret;
      headers?: Record<string, string>;
      httpMethod?: 'POST' | 'PUT' | 'PATCH';
      contentType?: 'application/json' | 'application/x-www-form-urlencoded';
      signatureHeader?: string;
      signatureAlgorithm?: 'sha256' | 'sha1' | 'md5';
      timeout?: number;
      maxRetries?: number;
      retryDelay?: number;
      metadata?: Record<string, any>;
    }
  ): WebhookEntity {
    const id = WebhookId.generate();
    const now = new Date();

    const webhook = new WebhookEntity({
      id,
      workspaceId,
      userId,
      name,
      url,
      secret: options?.secret,
      status: WebhookStatus.active(),
      events,
      headers: options?.headers || {},
      httpMethod: options?.httpMethod || 'POST',
      contentType: options?.contentType || 'application/json',
      signatureHeader: options?.signatureHeader,
      signatureAlgorithm: options?.signatureAlgorithm || 'sha256',
      timeout: options?.timeout || 30000,
      maxRetries: options?.maxRetries || 3,
      retryDelay: options?.retryDelay || 1000,
      metadata: options?.metadata || {},
      successCount: 0,
      failureCount: 0,
      createdAt: now,
      updatedAt: now,
    });

    webhook.addDomainEvent(
      new WebhookCreatedEvent(
        id,
        workspaceId,
        userId,
        name,
        url.value,
        events.map(e => e.value)
      )
    );

    return webhook;
  }
}

// Domain Events
export class WebhookCreatedEvent extends DomainEvent {
  constructor(
    public readonly webhookId: WebhookId,
    public readonly workspaceId: WorkspaceId,
    public readonly userId: UserId,
    public readonly name: string,
    public readonly url: string,
    public readonly events: string[]
  ) {
    super('webhook.created');
  }
}

export class WebhookActivatedEvent extends DomainEvent {
  constructor(
    public readonly webhookId: WebhookId,
    public readonly workspaceId: WorkspaceId
  ) {
    super('webhook.activated');
  }
}

export class WebhookDeactivatedEvent extends DomainEvent {
  constructor(
    public readonly webhookId: WebhookId,
    public readonly workspaceId: WorkspaceId
  ) {
    super('webhook.deactivated');
  }
}

export class WebhookConfigurationUpdatedEvent extends DomainEvent {
  constructor(
    public readonly webhookId: WebhookId,
    public readonly workspaceId: WorkspaceId,
    public readonly oldConfiguration: any,
    public readonly newConfiguration: any
  ) {
    super('webhook.configuration.updated');
  }
}
