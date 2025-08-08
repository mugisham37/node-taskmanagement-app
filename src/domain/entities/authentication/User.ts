import { AggregateRoot } from '../../shared/base/aggregate-root';
import { DomainEvent } from '../../shared/events/DomainEvent';
import { UserId } from '../value-objects/UserId';
import { Email } from '../../shared/value-objects/Email';
import { Phone } from '../../shared/value-objects/Phone';

export interface UserProps {
  id: UserId;
  email: Email;
  emailVerified: boolean;
  name?: string;
  image?: string;
  passwordHash?: string;

  // MFA fields
  mfaEnabled: boolean;
  totpSecret?: string;
  backupCodes: string[];

  // Security fields
  failedLoginAttempts: number;
  lockedUntil?: Date;
  lastLoginAt?: Date;
  lastLoginIp?: string;
  riskScore: number;

  // Profile fields
  timezone: string;
  workHours: {
    start: string;
    end: string;
    days: number[];
  };
  taskViewPreferences: {
    defaultView: string;
    groupBy: string;
  };
  notificationSettings: {
    email: boolean;
    push: boolean;
    desktop: boolean;
  };
  productivitySettings: {
    pomodoroLength: number;
    breakLength: number;
  };
  avatarColor: string;

  // Workspace context
  activeWorkspaceId?: string;
  workspacePreferences: Record<string, any>;

  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

// Domain Events
export class UserRegisteredEvent extends DomainEvent {
  constructor(
    public readonly userId: UserId,
    public readonly email: Email,
    public readonly name?: string
  ) {
    super('UserRegistered', {
      userId: userId.value,
      email: email.value,
      name,
    });
  }
}

export class UserEmailVerifiedEvent extends DomainEvent {
  constructor(
    public readonly userId: UserId,
    public readonly email: Email
  ) {
    super('UserEmailVerified', {
      userId: userId.value,
      email: email.value,
    });
  }
}

export class UserProfileUpdatedEvent extends DomainEvent {
  constructor(
    public readonly userId: UserId,
    public readonly changes: Partial<UserProps>
  ) {
    super('UserProfileUpdated', {
      userId: userId.value,
      changes,
    });
  }
}

export class UserMFAEnabledEvent extends DomainEvent {
  constructor(public readonly userId: UserId) {
    super('UserMFAEnabled', {
      userId: userId.value,
    });
  }
}

export class UserMFADisabledEvent extends DomainEvent {
  constructor(public readonly userId: UserId) {
    super('UserMFADisabled', {
      userId: userId.value,
    });
  }
}

export class UserLockedEvent extends DomainEvent {
  constructor(
    public readonly userId: UserId,
    public readonly reason: string,
    public readonly lockedUntil?: Date
  ) {
    super('UserLocked', {
      userId: userId.value,
      reason,
      lockedUntil: lockedUntil?.toISOString(),
    });
  }
}

export class UserUnlockedEvent extends DomainEvent {
  constructor(public readonly userId: UserId) {
    super('UserUnlocked', {
      userId: userId.value,
    });
  }
}

export class User extends AggregateRoot<UserProps> {
  private constructor(props: UserProps) {
    super(props);
  }

  public static create(
    props: Omit<UserProps, 'id' | 'createdAt' | 'updatedAt'>
  ): User {
    const user = new User({
      ...props,
      id: UserId.generate(),
      emailVerified: false,
      mfaEnabled: false,
      backupCodes: [],
      failedLoginAttempts: 0,
      riskScore: 0,
      timezone: props.timezone || 'UTC',
      workHours: props.workHours || {
        start: '09:00',
        end: '17:00',
        days: [1, 2, 3, 4, 5],
      },
      taskViewPreferences: props.taskViewPreferences || {
        defaultView: 'list',
        groupBy: 'status',
      },
      notificationSettings: props.notificationSettings || {
        email: true,
        push: true,
        desktop: true,
      },
      productivitySettings: props.productivitySettings || {
        pomodoroLength: 25,
        breakLength: 5,
      },
      avatarColor: props.avatarColor || '#3B82F6',
      workspacePreferences: props.workspacePreferences || {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    user.addDomainEvent(
      new UserRegisteredEvent(user.id, user.email, user.name)
    );

    return user;
  }

  public static fromPersistence(props: UserProps): User {
    return new User(props);
  }

  // Getters
  get id(): UserId {
    return this.props.id;
  }

  get email(): Email {
    return this.props.email;
  }

  get emailVerified(): boolean {
    return this.props.emailVerified;
  }

  get name(): string | undefined {
    return this.props.name;
  }

  get image(): string | undefined {
    return this.props.image;
  }

  get mfaEnabled(): boolean {
    return this.props.mfaEnabled;
  }

  get failedLoginAttempts(): number {
    return this.props.failedLoginAttempts;
  }

  get isLocked(): boolean {
    return !!this.props.lockedUntil && this.props.lockedUntil > new Date();
  }

  get lastLoginAt(): Date | undefined {
    return this.props.lastLoginAt;
  }

  get riskScore(): number {
    return this.props.riskScore;
  }

  get timezone(): string {
    return this.props.timezone;
  }

  get activeWorkspaceId(): string | undefined {
    return this.props.activeWorkspaceId;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  get isDeleted(): boolean {
    return !!this.props.deletedAt;
  }

  // Business methods
  public updateProfile(updates: {
    name?: string;
    image?: string;
    timezone?: string;
  }): void {
    if (updates.name !== undefined) {
      this.props.name = updates.name;
    }

    if (updates.image !== undefined) {
      this.props.image = updates.image;
    }

    if (updates.timezone !== undefined) {
      this.props.timezone = updates.timezone;
    }

    this.props.updatedAt = new Date();
    this.addDomainEvent(new UserProfileUpdatedEvent(this.id, updates));
  }

  public verifyEmail(): void {
    if (this.props.emailVerified) {
      return; // Already verified
    }

    this.props.emailVerified = true;
    this.props.updatedAt = new Date();

    this.addDomainEvent(new UserEmailVerifiedEvent(this.id, this.email));
  }

  public enableMFA(totpSecret: string, backupCodes: string[]): void {
    if (this.props.mfaEnabled) {
      throw new Error('MFA is already enabled for this user');
    }

    this.props.mfaEnabled = true;
    this.props.totpSecret = totpSecret;
    this.props.backupCodes = [...backupCodes];
    this.props.updatedAt = new Date();

    this.addDomainEvent(new UserMFAEnabledEvent(this.id));
  }

  public disableMFA(): void {
    if (!this.props.mfaEnabled) {
      throw new Error('MFA is not enabled for this user');
    }

    this.props.mfaEnabled = false;
    this.props.totpSecret = undefined;
    this.props.backupCodes = [];
    this.props.updatedAt = new Date();

    this.addDomainEvent(new UserMFADisabledEvent(this.id));
  }

  public recordFailedLogin(ipAddress?: string): void {
    this.props.failedLoginAttempts++;
    this.props.lastLoginIp = ipAddress;
    this.props.updatedAt = new Date();

    // Auto-lock after 5 failed attempts
    if (this.props.failedLoginAttempts >= 5) {
      this.lock('Too many failed login attempts', 30); // 30 minutes
    }
  }

  public recordSuccessfulLogin(ipAddress?: string): void {
    this.props.failedLoginAttempts = 0;
    this.props.lastLoginAt = new Date();
    this.props.lastLoginIp = ipAddress;
    this.props.lockedUntil = undefined;
    this.props.updatedAt = new Date();
  }

  public lock(reason: string, durationMinutes?: number): void {
    if (durationMinutes) {
      const lockUntil = new Date();
      lockUntil.setMinutes(lockUntil.getMinutes() + durationMinutes);
      this.props.lockedUntil = lockUntil;
    } else {
      // Permanent lock
      this.props.lockedUntil = new Date(
        Date.now() + 100 * 365 * 24 * 60 * 60 * 1000
      ); // 100 years
    }

    this.props.updatedAt = new Date();
    this.addDomainEvent(
      new UserLockedEvent(this.id, reason, this.props.lockedUntil)
    );
  }

  public unlock(): void {
    if (!this.isLocked) {
      return; // Not locked
    }

    this.props.lockedUntil = undefined;
    this.props.failedLoginAttempts = 0;
    this.props.updatedAt = new Date();

    this.addDomainEvent(new UserUnlockedEvent(this.id));
  }

  public updateRiskScore(score: number): void {
    if (score < 0 || score > 100) {
      throw new Error('Risk score must be between 0 and 100');
    }

    this.props.riskScore = score;
    this.props.updatedAt = new Date();
  }

  public updateNotificationSettings(
    settings: Partial<UserProps['notificationSettings']>
  ): void {
    this.props.notificationSettings = {
      ...this.props.notificationSettings,
      ...settings,
    };
    this.props.updatedAt = new Date();

    this.addDomainEvent(
      new UserProfileUpdatedEvent(this.id, {
        notificationSettings: this.props.notificationSettings,
      })
    );
  }

  public updateWorkHours(workHours: Partial<UserProps['workHours']>): void {
    this.props.workHours = {
      ...this.props.workHours,
      ...workHours,
    };
    this.props.updatedAt = new Date();

    this.addDomainEvent(
      new UserProfileUpdatedEvent(this.id, { workHours: this.props.workHours })
    );
  }

  public setActiveWorkspace(workspaceId: string): void {
    this.props.activeWorkspaceId = workspaceId;
    this.props.updatedAt = new Date();
  }

  public updateWorkspacePreferences(
    workspaceId: string,
    preferences: Record<string, any>
  ): void {
    this.props.workspacePreferences[workspaceId] = {
      ...this.props.workspacePreferences[workspaceId],
      ...preferences,
    };
    this.props.updatedAt = new Date();
  }

  public delete(): void {
    if (this.props.deletedAt) {
      throw new Error('User is already deleted');
    }

    this.props.deletedAt = new Date();
    this.props.updatedAt = new Date();
  }

  // Query methods
  public isInWorkingHours(date: Date = new Date()): boolean {
    const dayOfWeek = date.getDay();
    if (!this.props.workHours.days.includes(dayOfWeek)) {
      return false;
    }

    const currentTime = date.toTimeString().substring(0, 5); // HH:MM format
    return (
      currentTime >= this.props.workHours.start &&
      currentTime <= this.props.workHours.end
    );
  }

  public hasHighRiskScore(): boolean {
    return this.props.riskScore >= 70;
  }

  public isNewUser(daysThreshold: number = 7): boolean {
    const daysSinceCreation =
      (Date.now() - this.props.createdAt.getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceCreation <= daysThreshold;
  }

  public isActive(daysThreshold: number = 30): boolean {
    if (!this.props.lastLoginAt) return false;
    const daysSinceLastLogin =
      (Date.now() - this.props.lastLoginAt.getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceLastLogin <= daysThreshold;
  }

  // Aggregate root implementation
  protected validate(): void {
    if (!this.props.email) {
      throw new Error('User email is required');
    }

    if (this.props.riskScore < 0 || this.props.riskScore > 100) {
      throw new Error('Risk score must be between 0 and 100');
    }

    if (this.props.failedLoginAttempts < 0) {
      throw new Error('Failed login attempts cannot be negative');
    }
  }

  protected applyBusinessRules(): void {
    // Auto-verify email for certain domains (if configured)
    // Auto-enable MFA for high-risk users
    if (this.props.riskScore >= 80 && !this.props.mfaEnabled) {
      // This would trigger a recommendation to enable MFA
    }

    // Update activity timestamp
    this.props.updatedAt = new Date();
  }
}
