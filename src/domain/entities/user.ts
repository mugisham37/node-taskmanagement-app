import { BaseEntity } from './base-entity';
import { UserId, Email, UserStatusVO } from '../value-objects';
import { UserStatus } from '../../shared/constants/user-constants';
import { DomainError, ValidationError } from '../../shared/errors';
import { USER_VALIDATION } from '../../shared/constants/user-constants';

/**
 * User domain entity
 * Represents a user in the system with profile management and business methods
 */
export class User extends BaseEntity<UserId> {
  private _email: Email;
  private _name: string;
  private _hashedPassword: string;
  private _status: UserStatusVO;
  private _lastLoginAt: Date | null;

  constructor(
    id: UserId,
    email: Email,
    name: string,
    hashedPassword: string,
    status: UserStatusVO = UserStatusVO.create(UserStatus.PENDING_VERIFICATION),
    lastLoginAt: Date | null = null,
    createdAt?: Date,
    updatedAt?: Date
  ) {
    super(id, createdAt, updatedAt);
    this._email = email;
    this._name = name;
    this._hashedPassword = hashedPassword;
    this._status = status;
    this._lastLoginAt = lastLoginAt;
    this.validate();
  }

  /**
   * Get the user's email
   */
  get email(): Email {
    return this._email;
  }

  /**
   * Get the user's name
   */
  get name(): string {
    return this._name;
  }

  /**
   * Get the user's hashed password
   */
  get hashedPassword(): string {
    return this._hashedPassword;
  }

  /**
   * Get the user's status
   */
  get status(): UserStatusVO {
    return this._status;
  }

  /**
   * Get the user's last login time
   */
  get lastLoginAt(): Date | null {
    return this._lastLoginAt;
  }

  /**
   * Update the user's profile information
   */
  updateProfile(name: string, email?: Email): void {
    this.validateName(name);

    this._name = name;
    if (email && !email.equals(this._email)) {
      this._email = email;
      // If email changes, user needs to verify again
      if (this._status.isActive()) {
        this._status = UserStatusVO.create(UserStatus.PENDING_VERIFICATION);
      }
    }

    this.markAsUpdated();
    this.validate();
  }

  /**
   * Activate the user account
   */
  activate(): void {
    if (!this._status.canTransitionTo(UserStatus.ACTIVE)) {
      throw new DomainError(
        `Cannot activate user from ${this._status.value} status`
      );
    }

    this._status = UserStatusVO.create(UserStatus.ACTIVE);
    this.markAsUpdated();
  }

  /**
   * Deactivate the user account
   */
  deactivate(): void {
    if (!this._status.canTransitionTo(UserStatus.INACTIVE)) {
      throw new DomainError(
        `Cannot deactivate user from ${this._status.value} status`
      );
    }

    this._status = UserStatusVO.create(UserStatus.INACTIVE);
    this.markAsUpdated();
  }

  /**
   * Suspend the user account
   */
  suspend(): void {
    if (!this._status.canTransitionTo(UserStatus.SUSPENDED)) {
      throw new DomainError(
        `Cannot suspend user from ${this._status.value} status`
      );
    }

    this._status = UserStatusVO.create(UserStatus.SUSPENDED);
    this.markAsUpdated();
  }

  /**
   * Record a successful login
   */
  recordLogin(): void {
    if (!this._status.canLogin()) {
      throw new DomainError(
        `User cannot login with ${this._status.value} status`
      );
    }

    this._lastLoginAt = new Date();
    this.markAsUpdated();
  }

  /**
   * Update the user's password
   */
  updatePassword(newHashedPassword: string): void {
    if (!newHashedPassword) {
      throw new ValidationError('Hashed password cannot be empty');
    }

    this._hashedPassword = newHashedPassword;
    this.markAsUpdated();
  }

  /**
   * Check if the user can create projects
   */
  canCreateProject(): boolean {
    return this._status.canPerformActions();
  }

  /**
   * Check if the user can be assigned tasks
   */
  canBeAssignedTasks(): boolean {
    return this._status.canPerformActions();
  }

  /**
   * Check if the user can login
   */
  canLogin(): boolean {
    return this._status.canLogin();
  }

  /**
   * Check if the user is active
   */
  isActive(): boolean {
    return this._status.isActive();
  }

  /**
   * Check if the user needs email verification
   */
  needsVerification(): boolean {
    return this._status.needsVerification();
  }

  /**
   * Get the user's display name (for UI purposes)
   */
  getDisplayName(): string {
    return this._name;
  }

  /**
   * Get the user's masked email for privacy
   */
  getMaskedEmail(): string {
    return this._email.getMasked();
  }

  /**
   * Validate the user entity
   */
  protected validate(): void {
    this.validateName(this._name);

    if (!this._hashedPassword) {
      throw new ValidationError('Hashed password is required');
    }
  }

  /**
   * Validate the user's name
   */
  private validateName(name: string): void {
    if (!name || name.trim().length === 0) {
      throw new ValidationError('Name cannot be empty');
    }

    if (name.length < USER_VALIDATION.NAME_MIN_LENGTH) {
      throw new ValidationError(
        `Name must be at least ${USER_VALIDATION.NAME_MIN_LENGTH} character(s)`
      );
    }

    if (name.length > USER_VALIDATION.NAME_MAX_LENGTH) {
      throw new ValidationError(
        `Name cannot exceed ${USER_VALIDATION.NAME_MAX_LENGTH} characters`
      );
    }
  }

  /**
   * Get validation errors for the current state
   */
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

  /**
   * Create a new User instance
   */
  static create(
    id: UserId,
    email: Email,
    name: string,
    hashedPassword: string
  ): User {
    return new User(id, email, name, hashedPassword);
  }

  /**
   * Restore a User from persistence
   */
  static restore(
    id: UserId,
    email: Email,
    name: string,
    hashedPassword: string,
    status: UserStatusVO,
    lastLoginAt: Date | null,
    createdAt: Date,
    updatedAt: Date
  ): User {
    return new User(
      id,
      email,
      name,
      hashedPassword,
      status,
      lastLoginAt,
      createdAt,
      updatedAt
    );
  }
}
