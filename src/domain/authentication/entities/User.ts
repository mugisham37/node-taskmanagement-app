import { BaseEntity } from '../../shared/entities/BaseEntity';
import { Email } from '../value-objects/Email';
import { UserId } from '../value-objects/UserId';
import { WorkspaceId } from '../../task-management/value-objects/WorkspaceId';
import { DomainEvent } from '../../shared/events/DomainEvent';

export interface UserProps {
  id: UserId;
  email: Email;
  emailVerified?: Date;
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

  // Task management extensions
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
  activeWorkspaceId?: WorkspaceId;
  workspacePreferences: Record<string, any>;

  createdAt: Date;
  updatedAt: Date;
}

export class UserCreatedEvent extends DomainEvent {
  constructor(
    public readonly userId: UserId,
    public readonly email: Email,
    public readonly name?: string
  ) {
    super('UserCreated', { userId: userId.value, email: email.value, name });
  }
}

export class UserEmailVerifiedEvent extends DomainEvent {
  constructor(
    public readonly userId: UserId,
    public readonly email: Email
  ) {
    super('UserEmailVerified', { userId: userId.value, email: email.value });
  }
}

export class UserMfaEnabledEvent extends DomainEvent {
  constructor(
    public readonly userId: UserId,
    public readonly method: string
  ) {
    super('UserMfaEnabled', { userId: userId.value, method });
  }
}

export class UserLockedEvent extends DomainEvent {
  constructor(
    public readonly userId: UserId,
    public readonly reason: string,
    public readonly lockedUntil: Date
  ) {
    super('UserLocked', { userId: userId.value, reason, lockedUntil });
  }
}

export class UserWorkspaceContextChangedEvent extends DomainEvent {
  constructor(
    public readonly userId: UserId,
    public readonly previousWorkspaceId?: WorkspaceId,
    public readonly newWorkspaceId?: WorkspaceId
  ) {
    super('UserWorkspaceContextChanged', {
      userId: userId.value,
      previousWorkspaceId: previousWorkspaceId?.value,
      newWorkspaceId: newWorkspaceId?.value,
    });
  }
}

export class User extends BaseEntity<UserProps> {
  private constructor(props: UserProps) {
    super(props);
  }

  public static create(
    props: Omit<UserProps, 'id' | 'createdAt' | 'updatedAt'>
  ): User {
    const user = new User({
      ...props,
      id: UserId.generate(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    user.addDomainEvent(new UserCreatedEvent(user.id, user.email, user.name));
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

  get emailVerified(): Date | undefined {
    return this.props.emailVerified;
  }

  get name(): string | undefined {
    return this.props.name;
  }

  get image(): string | undefined {
    return this.props.image;
  }

  get passwordHash(): string | undefined {
    return this.props.passwordHash;
  }

  get mfaEnabled(): boolean {
    return this.props.mfaEnabled;
  }

  get totpSecret(): string | undefined {
    return this.props.totpSecret;
  }

  get backupCodes(): string[] {
    return [...this.props.backupCodes];
  }

  get failedLoginAttempts(): number {
    return this.props.failedLoginAttempts;
  }

  get lockedUntil(): Date | undefined {
    return this.props.lockedUntil;
  }

  get lastLoginAt(): Date | undefined {
    return this.props.lastLoginAt;
  }

  get lastLoginIp(): string | undefined {
    return this.props.lastLoginIp;
  }

  get riskScore(): number {
    return this.props.riskScore;
  }

  get timezone(): string {
    return this.props.timezone;
  }

  get workHours(): UserProps['workHours'] {
    return { ...this.props.workHours };
  }

  get taskViewPreferences(): UserProps['taskViewPreferences'] {
    return { ...this.props.taskViewPreferences };
  }

  get notificationSettings(): UserProps['notificationSettings'] {
    return { ...this.props.notificationSettings };
  }

  get productivitySettings(): UserProps['productivitySettings'] {
    return { ...this.props.productivitySettings };
  }

  get avatarColor(): string {
    return this.props.avatarColor;
  }

  get activeWorkspaceId(): WorkspaceId | undefined {
    return this.props.activeWorkspaceId;
  }

  get workspacePreferences(): Record<string, any> {
    return { ...this.props.workspacePreferences };
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  // Business methods
  public verifyEmail(): void {
    if (this.props.emailVerified) {
      throw new Error('Email is already verified');
    }

    this.props.emailVerified = new Date();
    this.props.updatedAt = new Date();

    this.addDomainEvent(new UserEmailVerifiedEvent(this.id, this.email));
  }

  public enableMfa(totpSecret: string, backupCodes: string[]): void {
    if (this.props.mfaEnabled) {
      throw new Error('MFA is already enabled');
    }

    this.props.mfaEnabled = true;
    this.props.totpSecret = totpSecret;
    this.props.backupCodes = [...backupCodes];
    this.props.updatedAt = new Date();

    this.addDomainEvent(new UserMfaEnabledEvent(this.id, 'TOTP'));
  }

  public disableMfa(): void {
    if (!this.props.mfaEnabled) {
      throw new Error('MFA is not enabled');
    }

    this.props.mfaEnabled = false;
    this.props.totpSecret = undefined;
    this.props.backupCodes = [];
    this.props.updatedAt = new Date();
  }

  public recordFailedLogin(ipAddress?: string): void {
    this.props.failedLoginAttempts += 1;
    this.props.lastLoginIp = ipAddress;
    this.props.updatedAt = new Date();

    // Lock user after 5 failed attempts
    if (this.props.failedLoginAttempts >= 5) {
      this.lockAccount('Too many failed login attempts');
    }
  }

  public recordSuccessfulLogin(ipAddress?: string): void {
    this.props.failedLoginAttempts = 0;
    this.props.lockedUntil = undefined;
    this.props.lastLoginAt = new Date();
    this.props.lastLoginIp = ipAddress;
    this.props.updatedAt = new Date();
  }

  public lockAccount(reason: string, duration: number = 30 * 60 * 1000): void {
    const lockedUntil = new Date(Date.now() + duration);
    this.props.lockedUntil = lockedUntil;
    this.props.updatedAt = new Date();

    this.addDomainEvent(new UserLockedEvent(this.id, reason, lockedUntil));
  }

  public unlockAccount(): void {
    this.props.lockedUntil = undefined;
    this.props.failedLoginAttempts = 0;
    this.props.updatedAt = new Date();
  }

  public isLocked(): boolean {
    return this.props.lockedUntil ? this.props.lockedUntil > new Date() : false;
  }

  public updateRiskScore(score: number): void {
    if (score < 0 || score > 1) {
      throw new Error('Risk score must be between 0 and 1');
    }

    this.props.riskScore = score;
    this.props.updatedAt = new Date();
  }

  public switchWorkspaceContext(workspaceId?: WorkspaceId): void {
    const previousWorkspaceId = this.props.activeWorkspaceId;
    this.props.activeWorkspaceId = workspaceId;
    this.props.updatedAt = new Date();

    this.addDomainEvent(
      new UserWorkspaceContextChangedEvent(
        this.id,
        previousWorkspaceId,
        workspaceId
      )
    );
  }

  public updateProfile(updates: {
    name?: string;
    image?: string;
    timezone?: string;
    avatarColor?: string;
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
    if (updates.avatarColor !== undefined) {
      this.props.avatarColor = updates.avatarColor;
    }

    this.props.updatedAt = new Date();
  }

  public updateTaskViewPreferences(
    preferences: Partial<UserProps['taskViewPreferences']>
  ): void {
    this.props.taskViewPreferences = {
      ...this.props.taskViewPreferences,
      ...preferences,
    };
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
  }

  public updateProductivitySettings(
    settings: Partial<UserProps['productivitySettings']>
  ): void {
    this.props.productivitySettings = {
      ...this.props.productivitySettings,
      ...settings,
    };
    this.props.updatedAt = new Date();
  }

  public updateWorkHours(workHours: Partial<UserProps['workHours']>): void {
    this.props.workHours = {
      ...this.props.workHours,
      ...workHours,
    };
    this.props.updatedAt = new Date();
  }

  public updateWorkspacePreferences(
    workspaceId: WorkspaceId,
    preferences: Record<string, any>
  ): void {
    this.props.workspacePreferences = {
      ...this.props.workspacePreferences,
      [workspaceId.value]: preferences,
    };
    this.props.updatedAt = new Date();
  }

  public getWorkspacePreferences(
    workspaceId: WorkspaceId
  ): Record<string, any> {
    return this.props.workspacePreferences[workspaceId.value] || {};
  }

  public hasPassword(): boolean {
    return !!this.props.passwordHash;
  }

  public isEmailVerified(): boolean {
    return !!this.props.emailVerified;
  }

  public canLogin(): boolean {
    return !this.isLocked() && this.isEmailVerified();
  }
}
