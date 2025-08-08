import { AggregateRoot } from '../../../shared/domain/aggregate-root';
import { BaseDomainEvent } from '../../../shared/domain/domain-event';
import { SessionId } from '../value-objects/session-id';
import { UserId } from '../value-objects/user-id';
import { WorkspaceId } from '../../task-management/value-objects/workspace-id';

export interface SessionProps {
  id: SessionId;
  sessionToken: string;
  userId: UserId;
  expires: Date;
  workspaceId?: WorkspaceId;
  deviceId?: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Domain Events
export class SessionCreatedEvent extends BaseDomainEvent {
  constructor(sessionId: SessionId, userId: UserId, workspaceId?: WorkspaceId) {
    super(sessionId.value, 'SessionCreated', {
      sessionId: sessionId.value,
      userId: userId.value,
      workspaceId: workspaceId?.value,
    });
  }
}

export class SessionExpiredEvent extends BaseDomainEvent {
  constructor(sessionId: SessionId, userId: UserId) {
    super(sessionId.value, 'SessionExpired', {
      sessionId: sessionId.value,
      userId: userId.value,
    });
  }
}

export class SessionWorkspaceContextChangedEvent extends BaseDomainEvent {
  constructor(
    sessionId: SessionId,
    userId: UserId,
    previousWorkspaceId?: WorkspaceId,
    newWorkspaceId?: WorkspaceId
  ) {
    super(sessionId.value, 'SessionWorkspaceContextChanged', {
      sessionId: sessionId.value,
      userId: userId.value,
      previousWorkspaceId: previousWorkspaceId?.value,
      newWorkspaceId: newWorkspaceId?.value,
    });
  }
}

export class SessionRevokedEvent extends BaseDomainEvent {
  constructor(sessionId: SessionId, userId: UserId, reason: string) {
    super(sessionId.value, 'SessionRevoked', {
      sessionId: sessionId.value,
      userId: userId.value,
      reason,
    });
  }
}

export class SessionAggregate extends AggregateRoot<SessionProps> {
  private constructor(props: SessionProps) {
    super(props, props.id.value, props.createdAt, props.updatedAt);
  }

  public static create(
    props: Omit<SessionProps, 'id' | 'createdAt' | 'updatedAt'>
  ): SessionAggregate {
    const session = new SessionAggregate({
      ...props,
      id: SessionId.generate(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    session.addDomainEvent(
      new SessionCreatedEvent(session.id, session.userId, session.workspaceId)
    );

    return session;
  }

  public static fromPersistence(props: SessionProps): SessionAggregate {
    return new SessionAggregate(props);
  }

  // Getters
  get id(): SessionId {
    return this.props.id;
  }

  get sessionToken(): string {
    return this.props.sessionToken;
  }

  get userId(): UserId {
    return this.props.userId;
  }

  get expires(): Date {
    return this.props.expires;
  }

  get workspaceId(): WorkspaceId | undefined {
    return this.props.workspaceId;
  }

  get deviceId(): string | undefined {
    return this.props.deviceId;
  }

  get ipAddress(): string | undefined {
    return this.props.ipAddress;
  }

  get userAgent(): string | undefined {
    return this.props.userAgent;
  }

  // Business methods
  public isExpired(): boolean {
    return this.props.expires < new Date();
  }

  public isValid(): boolean {
    return !this.isExpired();
  }

  public extend(additionalTime: number = 24 * 60 * 60 * 1000): void {
    if (this.isExpired()) {
      throw new Error('Cannot extend expired session');
    }

    this.props.expires = new Date(
      this.props.expires.getTime() + additionalTime
    );
    this.markAsModified();
  }

  public expire(): void {
    this.props.expires = new Date();
    this.markAsModified();

    this.addDomainEvent(new SessionExpiredEvent(this.id, this.userId));
  }

  public revoke(reason: string): void {
    this.props.expires = new Date();
    this.markAsModified();

    this.addDomainEvent(new SessionRevokedEvent(this.id, this.userId, reason));
  }

  public switchWorkspaceContext(workspaceId?: WorkspaceId): void {
    const previousWorkspaceId = this.props.workspaceId;
    this.props.workspaceId = workspaceId;
    this.markAsModified();

    this.addDomainEvent(
      new SessionWorkspaceContextChangedEvent(
        this.id,
        this.userId,
        previousWorkspaceId,
        workspaceId
      )
    );
  }

  public updateActivity(ipAddress?: string, userAgent?: string): void {
    if (ipAddress) {
      this.props.ipAddress = ipAddress;
    }
    if (userAgent) {
      this.props.userAgent = userAgent;
    }
    this.markAsModified();
  }

  public getRemainingTime(): number {
    if (this.isExpired()) {
      return 0;
    }
    return this.props.expires.getTime() - Date.now();
  }

  public shouldRefresh(threshold: number = 60 * 60 * 1000): boolean {
    return this.getRemainingTime() < threshold && !this.isExpired();
  }

  public hasWorkspaceContext(): boolean {
    return !!this.props.workspaceId;
  }

  public isFromSameDevice(deviceId: string): boolean {
    return this.props.deviceId === deviceId;
  }

  public isFromSameIP(ipAddress: string): boolean {
    return this.props.ipAddress === ipAddress;
  }

  public getSessionInfo(): {
    id: string;
    userId: string;
    workspaceId?: string;
    deviceId?: string;
    ipAddress?: string;
    userAgent?: string;
    expires: Date;
    isExpired: boolean;
    remainingTime: number;
  } {
    return {
      id: this.id.value,
      userId: this.userId.value,
      workspaceId: this.workspaceId?.value,
      deviceId: this.deviceId,
      ipAddress: this.ipAddress,
      userAgent: this.userAgent,
      expires: this.expires,
      isExpired: this.isExpired(),
      remainingTime: this.getRemainingTime(),
    };
  }

  // Aggregate root implementation
  protected validate(): void {
    if (!this.props.sessionToken) {
      throw new Error('Session token is required');
    }

    if (!this.props.userId) {
      throw new Error('User ID is required');
    }

    if (!this.props.expires) {
      throw new Error('Expiration date is required');
    }

    if (this.props.expires <= this.props.createdAt) {
      throw new Error('Expiration date must be after creation date');
    }
  }

  protected applyBusinessRules(): void {
    // Ensure session token is properly formatted
    if (this.props.sessionToken.length < 32) {
      throw new Error('Session token must be at least 32 characters');
    }

    // Update activity timestamp
    this.props.updatedAt = new Date();
  }
}
