import { ValueObject } from './value-object';
import { ValidationError } from '../../shared/errors';
import {
  ProjectStatus,
  PROJECT_STATUS_TRANSITIONS,
} from '../../shared/constants/project-constants';

/**
 * Project Status value object
 * Represents a project status with state transition validation
 */
export class ProjectStatusVO extends ValueObject<ProjectStatus> {
  protected validate(value: ProjectStatus): void {
    if (!value) {
      throw new ValidationError('Project status cannot be empty');
    }

    if (!Object.values(ProjectStatus).includes(value)) {
      throw new ValidationError(
        `Invalid project status. Must be one of: ${Object.values(ProjectStatus).join(', ')}`
      );
    }
  }

  /**
   * Create a new ProjectStatusVO from a ProjectStatus enum
   */
  static create(status: ProjectStatus): ProjectStatusVO {
    return new ProjectStatusVO(status);
  }

  /**
   * Create a ProjectStatusVO from a string
   */
  static fromString(status: string): ProjectStatusVO {
    const upperStatus = status.toUpperCase() as ProjectStatus;
    return new ProjectStatusVO(upperStatus);
  }

  /**
   * Check if this status can transition to another status
   */
  canTransitionTo(newStatus: ProjectStatus): boolean {
    const allowedTransitions = PROJECT_STATUS_TRANSITIONS[this._value];
    return allowedTransitions.includes(newStatus);
  }

  /**
   * Get all valid transitions from this status
   */
  getValidTransitions(): ProjectStatus[] {
    return [...PROJECT_STATUS_TRANSITIONS[this._value]];
  }

  /**
   * Check if the project is active
   */
  isActive(): boolean {
    return this._value === ProjectStatus.ACTIVE;
  }

  /**
   * Check if the project is on hold
   */
  isOnHold(): boolean {
    return this._value === ProjectStatus.ON_HOLD;
  }

  /**
   * Check if the project is completed
   */
  isCompleted(): boolean {
    return this._value === ProjectStatus.COMPLETED;
  }

  /**
   * Check if the project is cancelled
   */
  isCancelled(): boolean {
    return this._value === ProjectStatus.CANCELLED;
  }

  /**
   * Check if the project is archived
   */
  isArchived(): boolean {
    return this._value === ProjectStatus.ARCHIVED;
  }

  /**
   * Check if the project is operational (active or on hold)
   */
  isOperational(): boolean {
    return this.isActive() || this.isOnHold();
  }

  /**
   * Check if the project is closed (completed, cancelled, or archived)
   */
  isClosed(): boolean {
    return this.isCompleted() || this.isCancelled() || this.isArchived();
  }

  /**
   * Check if tasks can be created in this project
   */
  canCreateTasks(): boolean {
    return this.isActive();
  }

  /**
   * Check if the project can be modified
   */
  canBeModified(): boolean {
    return this.isOperational();
  }

  /**
   * Get a human-readable description of the status
   */
  getDescription(): string {
    switch (this._value) {
      case ProjectStatus.ACTIVE:
        return 'Active';
      case ProjectStatus.ON_HOLD:
        return 'On Hold';
      case ProjectStatus.COMPLETED:
        return 'Completed';
      case ProjectStatus.CANCELLED:
        return 'Cancelled';
      case ProjectStatus.ARCHIVED:
        return 'Archived';
      default:
        return this._value;
    }
  }

  /**
   * Get the color associated with this status (for UI purposes)
   */
  getColor(): string {
    switch (this._value) {
      case ProjectStatus.ACTIVE:
        return '#28a745'; // Green
      case ProjectStatus.ON_HOLD:
        return '#ffc107'; // Yellow
      case ProjectStatus.COMPLETED:
        return '#17a2b8'; // Blue
      case ProjectStatus.CANCELLED:
        return '#dc3545'; // Red
      case ProjectStatus.ARCHIVED:
        return '#6c757d'; // Gray
      default:
        return '#6c757d'; // Gray
    }
  }
}
