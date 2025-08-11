import { DomainEvent } from './domain-event';
import { UserId, Email, UserStatusVO } from '../value-objects';

/**
 * User Created Event
 */
export class UserCreatedEvent extends DomainEvent {
  constructor(
    public readonly userId: UserId,
    public readonly email: Email,
    public readonly name: string
  ) {
    super();
  }

  getEventName(): string {
    return 'UserCreated';
  }

  getAggregateId(): string {
    return this.userId.toString();
  }

  protected getPayload(): Record<string, any> {
    return {
      userId: this.userId.toString(),
      email: this.email.value,
      name: this.name,
    };
  }
}

/**
 * User Profile Updated Event
 */
export class UserProfileUpdatedEvent extends DomainEvent {
  constructor(
    public readonly userId: UserId,
    public readonly changes: Record<string, any>
  ) {
    super();
  }

  getEventName(): string {
    return 'UserProfileUpdated';
  }

  getAggregateId(): string {
    return this.userId.toString();
  }

  protected getPayload(): Record<string, any> {
    return {
      userId: this.userId.toString(),
      changes: this.changes,
    };
  }
}

/**
 * User Activated Event
 */
export class UserActivatedEvent extends DomainEvent {
  constructor(
    public readonly userId: UserId,
    public readonly activatedBy?: UserId
  ) {
    super();
  }

  getEventName(): string {
    return 'UserActivated';
  }

  getAggregateId(): string {
    return this.userId.toString();
  }

  protected getPayload(): Record<string, any> {
    return {
      userId: this.userId.toString(),
      activatedBy: this.activatedBy?.toString(),
    };
  }
}

/**
 * User Deactivated Event
 */
export class UserDeactivatedEvent extends DomainEvent {
  constructor(
    public readonly userId: UserId,
    public readonly deactivatedBy?: UserId,
    public readonly reason?: string
  ) {
    super();
  }

  getEventName(): string {
    return 'UserDeactivated';
  }

  getAggregateId(): string {
    return this.userId.toString();
  }

  protected getPayload(): Record<string, any> {
    return {
      userId: this.userId.toString(),
      deactivatedBy: this.deactivatedBy?.toString(),
      reason: this.reason,
    };
  }
}

/**
 * User Suspended Event
 */
export class UserSuspendedEvent extends DomainEvent {
  constructor(
    public readonly userId: UserId,
    public readonly suspendedBy: UserId,
    public readonly reason?: string
  ) {
    super();
  }

  getEventName(): string {
    return 'UserSuspended';
  }

  getAggregateId(): string {
    return this.userId.toString();
  }

  protected getPayload(): Record<string, any> {
    return {
      userId: this.userId.toString(),
      suspendedBy: this.suspendedBy.toString(),
      reason: this.reason,
    };
  }
}

/**
 * User Login Recorded Event
 */
export class UserLoginRecordedEvent extends DomainEvent {
  constructor(
    public readonly userId: UserId,
    public readonly loginTime: Date,
    public readonly ipAddress?: string,
    public readonly userAgent?: string
  ) {
    super();
  }

  getEventName(): string {
    return 'UserLoginRecorded';
  }

  getAggregateId(): string {
    return this.userId.toString();
  }

  protected getPayload(): Record<string, any> {
    return {
      userId: this.userId.toString(),
      loginTime: this.loginTime.toISOString(),
      ipAddress: this.ipAddress,
      userAgent: this.userAgent,
    };
  }
}

/**
 * User Password Updated Event
 */
export class UserPasswordUpdatedEvent extends DomainEvent {
  constructor(
    public readonly userId: UserId,
    public readonly updatedBy?: UserId
  ) {
    super();
  }

  getEventName(): string {
    return 'UserPasswordUpdated';
  }

  getAggregateId(): string {
    return this.userId.toString();
  }

  protected getPayload(): Record<string, any> {
    return {
      userId: this.userId.toString(),
      updatedBy: this.updatedBy?.toString(),
    };
  }
}

/**
 * User Email Changed Event
 */
export class UserEmailChangedEvent extends DomainEvent {
  constructor(
    public readonly userId: UserId,
    public readonly oldEmail: Email,
    public readonly newEmail: Email
  ) {
    super();
  }

  getEventName(): string {
    return 'UserEmailChanged';
  }

  getAggregateId(): string {
    return this.userId.toString();
  }

  protected getPayload(): Record<string, any> {
    return {
      userId: this.userId.toString(),
      oldEmail: this.oldEmail.value,
      newEmail: this.newEmail.value,
    };
  }
}

/**
 * User Registered Event
 */
export class UserRegisteredEvent extends DomainEvent {
  constructor(
    public readonly userId: UserId,
    public readonly email: Email,
    public readonly name: string,
    public readonly registrationMethod: string = 'direct'
  ) {
    super();
  }

  getEventName(): string {
    return 'UserRegistered';
  }

  getAggregateId(): string {
    return this.userId.toString();
  }

  protected getPayload(): Record<string, any> {
    return {
      userId: this.userId.toString(),
      email: this.email.value,
      name: this.name,
      registrationMethod: this.registrationMethod,
    };
  }
}
