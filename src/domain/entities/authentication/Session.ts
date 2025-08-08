import { BaseEntity } from '../../shared/entities/BaseEntity';
import { SessionId } from '../value-objects/SessionId';
import { UserId } from '../value-objects/UserId';
import { WorkspaceId } from '../../task-management/value-objects/WorkspaceId';
import { DeviceId } from '../value-objects/DeviceId';
import { DomainEvent } from '../../shared/events/DomainEvent';

export interface SessionProps {
  id: SessionId;
  sessionToken: string;
  userId: UserId;
  expires: Date;
  workspaceId?: WorkspaceId;
  deviceId?: DeviceId;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class SessionCreatedEvent extends DomainEvent {
  constructor(
    public readonly sessionId: SessionId,
    public readonly userId: UserId,
    public readonly workspaceId?: WorkspaceId
  ) {
    super('SessionCreated', {
      sessionId: sessionId.value,
      userId: userId.value,
      workspaceId: workspaceId?.value,
    });
  }
}

export class SessionExpiredEvent extends DomainEvent {
  constructor(
    public readonly sessionId: SessionId,
    public readonly userId: UserId
  ) {
    super('SessionExpired', {
      sessionId: sessionId.value,
      userId: userId.value,
    });
  }
}

export class SessionWorkspaceContextChangedEvent extends DomainEvent {
  constructor(
    public readonly sessionId: SessionId,
    public readonly userId: UserId,
    public readonly previousWorkspaceId?: WorkspaceId,
    public readonly newWorkspaceId?: WorkspaceId
  ) {
    super('SessionWorkspaceContextChanged', {
      sessionId: sessionId.value,
      userId: userId.value,
      previousWorkspaceId: previousWorkspaceId?.value,
      newWorkspaceId: newWorkspaceId?.value,
    });
  }
}

export class SessionRevokedEvent extends DomainEvent {
  constructor(
    public readonly sessionId: SessionId,
    public readonly userId: UserId,
    public readonly reason: string
  ) {
    super('SessionRevoked', {
      sessionId: sessionId.value,
      userId: userId.value,
      reason,
    });
  }
}

export class Session extends BaseEntity<SessionProps> {
  private constructor(props: SessionProps) {
    super(props);
  }

  public static create(
    props: Omit<SessionProps, 'id' | 'createdAt' | 'updatedAt'>
  ): Session {
    const session = new Session({
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

  public static fromPersistence(props: SessionProps): Session {
    return new Session(props);
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

  get deviceId(): DeviceId | undefined {
    return this.props.deviceId;
  }

  get ipAddress(): string | undefined {
    return this.props.ipAddress;
  }

  get userAgent(): string | undefined {
    return this.props.userAgent;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
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
    this.props.updatedAt = new Date();
  }

  public expire(): void {
    this.props.expires = new Date();
    this.props.updatedAt = new Date();

    this.addDomainEvent(new SessionExpiredEvent(this.id, this.userId));
  }

  public revoke(reason: string): void {
    this.props.expires = new Date();
    this.props.updatedAt = new Date();

    this.addDomainEvent(new SessionRevokedEvent(this.id, this.userId, reason));
  }

  public switchWorkspaceContext(workspaceId?: WorkspaceId): void {
    const previousWorkspaceId = this.props.workspaceId;
    this.props.workspaceId = workspaceId;
    this.props.updatedAt = new Date();

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
    this.props.updatedAt = new Date();
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

  public isFromSameDevice(deviceId: DeviceId): boolean {
    return this.props.deviceId?.equals(deviceId) ?? false;
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
      deviceId: this.deviceId?.value,
      ipAddress: this.ipAddress,
      userAgent: this.userAgent,
      expires: this.expires,
      isExpired: this.isExpired(),
      remainingTime: this.getRemainingTime(),
    };
  }
}
