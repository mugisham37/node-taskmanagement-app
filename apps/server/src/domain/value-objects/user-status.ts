import { ValueObject } from './value-object';
import { ValidationError } from '../../shared/errors';
import { Status as UserStatus } from '../../shared/enums/common.enums';
import {
  USER_STATUS_TRANSITIONS,
} from '../../shared/constants/user-constants';

/**
 * User Status value object
 * Represents a user status with state transition validation
 */
export class UserStatusVO extends ValueObject<UserStatus> {
  protected validate(value: UserStatus): void {
    if (!value) {
      throw ValidationError.forField(
        'userStatus',
        'User status cannot be empty',
        value
      );
    }

    if (!Object.values(UserStatus).includes(value)) {
      throw ValidationError.forField(
        'userStatus',
        `Invalid user status. Must be one of: ${Object.values(UserStatus).join(', ')}`,
        value
      );
    }
  }

  /**
   * Create a new UserStatusVO from a UserStatus enum
   */
  static create(status: UserStatus): UserStatusVO {
    return new UserStatusVO(status);
  }

  /**
   * Create a UserStatusVO from a string
   */
  static fromString(status: string): UserStatusVO {
    const upperStatus = status.toUpperCase() as UserStatus;
    return new UserStatusVO(upperStatus);
  }

  /**
   * Check if this status can transition to another status
   */
  canTransitionTo(newStatus: UserStatus): boolean {
    const allowedTransitions = USER_STATUS_TRANSITIONS[this._value];
    return allowedTransitions.includes(newStatus);
  }

  /**
   * Get all valid transitions from this status
   */
  getValidTransitions(): UserStatus[] {
    return [...USER_STATUS_TRANSITIONS[this._value]];
  }

  /**
   * Check if the user is active
   */
  isActive(): boolean {
    return this._value === UserStatus.ACTIVE;
  }

  /**
   * Check if the user is inactive
   */
  isInactive(): boolean {
    return this._value === UserStatus.INACTIVE;
  }

  /**
   * Check if the user is suspended
   */
  isSuspended(): boolean {
    return this._value === UserStatus.SUSPENDED;
  }

  /**
   * Check if the user is pending verification
   */
  isPendingVerification(): boolean {
    return this._value === UserStatus.PENDING_VERIFICATION;
  }

  /**
   * Check if the user can log in
   */
  canLogin(): boolean {
    return this.isActive();
  }

  /**
   * Check if the user can perform actions
   */
  canPerformActions(): boolean {
    return this.isActive();
  }

  /**
   * Check if the user needs verification
   */
  needsVerification(): boolean {
    return this.isPendingVerification();
  }

  /**
   * Check if the user account is locked
   */
  isLocked(): boolean {
    return this.isSuspended();
  }

  /**
   * Get a human-readable description of the status
   */
  getDescription(): string {
    switch (this._value) {
      case UserStatus.ACTIVE:
        return 'Active';
      case UserStatus.INACTIVE:
        return 'Inactive';
      case UserStatus.SUSPENDED:
        return 'Suspended';
      case UserStatus.PENDING_VERIFICATION:
        return 'Pending Verification';
      default:
        return this._value;
    }
  }

  /**
   * Get the color associated with this status (for UI purposes)
   */
  getColor(): string {
    switch (this._value) {
      case UserStatus.ACTIVE:
        return '#28a745'; // Green
      case UserStatus.INACTIVE:
        return '#6c757d'; // Gray
      case UserStatus.SUSPENDED:
        return '#dc3545'; // Red
      case UserStatus.PENDING_VERIFICATION:
        return '#ffc107'; // Yellow
      default:
        return '#6c757d'; // Gray
    }
  }
}
