import { BaseEntity } from './base-entity';
import {
  TaskId,
  UserId,
  ProjectId,
  TaskStatusVO,
  Priority,
} from '../value-objects';
import { TaskStatus, TASK_VALIDATION } from '../../shared/constants/task-constants';
import { DomainError, ValidationError } from '../../shared/errors';

/**
 * Task domain entity
 * Represents a task with assignment, completion, and business methods
 */
export class Task extends BaseEntity<TaskId> {
  private _title: string;
  private _description: string;
  private _status: TaskStatusVO;
  private _priority: Priority;
  private _assigneeId: UserId | null;
  private _projectId: ProjectId;
  private _createdById: UserId;
  private _dueDate: Date | null;
  private _estimatedHours: number | null;
  private _actualHours: number | null;
  private _completedAt: Date | null;

  constructor(
    id: TaskId,
    title: string,
    description: string,
    projectId: ProjectId,
    createdById: UserId,
    status: TaskStatusVO = TaskStatusVO.create(TaskStatus.TODO),
    priority: Priority = Priority.create('MEDIUM' as any),
    assigneeId: UserId | null = null,
    dueDate: Date | null = null,
    estimatedHours: number | null = null,
    actualHours: number | null = null,
    completedAt: Date | null = null,
    createdAt?: Date,
    updatedAt?: Date
  ) {
    super(id, createdAt, updatedAt);
    this._title = title;
    this._description = description;
    this._status = status;
    this._priority = priority;
    this._assigneeId = assigneeId;
    this._projectId = projectId;
    this._createdById = createdById;
    this._dueDate = dueDate;
    this._estimatedHours = estimatedHours;
    this._actualHours = actualHours;
    this._completedAt = completedAt;
    this.validate();
  }

  /**
   * Update the task's title
   */
  updateTitle(title: string, _updatedBy: UserId): void {
    this.validateTitle(title);
    if (this._title === title) {
      return; // No change needed
    }

    this._title = title;
    this.markAsUpdated();

    // TODO: Add domain event for title change
  }

  /**
   * Update the task's description
   */
  updateDescription(description: string, _updatedBy: UserId): void {
    this.validateDescription(description);
    if (this._description === description) {
      return; // No change needed
    }

    this._description = description;
    this.markAsUpdated();

    // TODO: Add domain event for description change
  }

  /**
   * Update the task's due date
   */
  updateDueDate(dueDate: Date | null, _updatedBy: UserId): void {
    if (this._dueDate === dueDate) {
      return; // No change needed
    }

    this._dueDate = dueDate;
    this.markAsUpdated();

    // TODO: Add domain event for due date change
  }

  /**
   * Update the task's estimated hours
   */
  updateEstimatedHours(estimatedHours: number | null, _updatedBy: UserId): void {
    if (estimatedHours !== null) {
      this.validateEstimatedHours(estimatedHours);
    }
    
    if (this._estimatedHours === estimatedHours) {
      return; // No change needed
    }

    this._estimatedHours = estimatedHours;
    this.markAsUpdated();

    // TODO: Add domain event for estimated hours change
  }

  /**
   * Update task status
   */
  updateStatus(status: TaskStatusVO, _updatedBy: UserId): void {
    if (!this._status.canTransitionTo(status.value)) {
      throw new DomainError(
        `Cannot transition from ${this._status.value} to ${status.value}`
      );
    }

    this._status = status;
    this.markAsUpdated();

    // TODO: Add domain event for status change
  }

  /**
   * Update the task's priority
   */
  updatePriority(priority: Priority, _updatedBy: UserId): void {
    if (this._priority.equals(priority)) {
      return; // No change needed
    }

    this._priority = priority;
    this.markAsUpdated();

    // TODO: Add domain event for priority change
  }

  /**
   * Get the task's title
   */
  get title(): string {
    return this._title;
  }

  /**
   * Get the task's description
   */
  get description(): string {
    return this._description;
  }

  /**
   * Get the task's status
   */
  get status(): TaskStatusVO {
    return this._status;
  }

  /**
   * Get the task's priority
   */
  get priority(): Priority {
    return this._priority;
  }

  /**
   * Get the task's assignee ID
   */
  get assigneeId(): UserId | null {
    return this._assigneeId;
  }

  /**
   * Get the task's project ID
   */
  get projectId(): ProjectId {
    return this._projectId;
  }

  /**
   * Get the task's creator ID
   */
  get createdById(): UserId {
    return this._createdById;
  }

  /**
   * Get the task's due date
   */
  get dueDate(): Date | null {
    return this._dueDate;
  }

  /**
   * Get the task's estimated hours
   */
  get estimatedHours(): number | null {
    return this._estimatedHours;
  }

  /**
   * Get the task's actual hours
   */
  get actualHours(): number | null {
    return this._actualHours;
  }

  /**
   * Get when the task was completed
   */
  get completedAt(): Date | null {
    return this._completedAt;
  }

  /**
   * Update the task's basic information
   */
  updateBasicInfo(
    title: string,
    description: string,
    dueDate?: Date | null,
    estimatedHours?: number | null
  ): void {
    this.validateTitle(title);
    this.validateDescription(description);

    if (estimatedHours !== undefined && estimatedHours !== null) {
      this.validateEstimatedHours(estimatedHours);
    }

    this._title = title;
    this._description = description;
    this._dueDate = dueDate ?? this._dueDate;
    this._estimatedHours = estimatedHours ?? this._estimatedHours;

    this.markAsUpdated();
  }

  /**
   * Assign the task to a user
   */
  assign(assigneeId: UserId, _assignedBy: UserId): void {
    if (!this._status.canBeAssigned()) {
      throw new DomainError(
        `Cannot assign task with status ${this._status.value}`
      );
    }

    this._assigneeId = assigneeId;
    this.markAsUpdated();

    // TODO: Add domain event for task assignment
  }

  /**
   * Unassign the task
   */
  unassign(_unassignedBy: UserId): void {
    if (!this._assigneeId) {
      throw new DomainError('Task is not assigned to anyone');
    }

    this._assigneeId = null;
    this.markAsUpdated();

    // TODO: Add domain event for task unassignment
  }

  /**
   * Start working on the task
   */
  start(startedBy: UserId): void {
    if (!this._status.canTransitionTo(TaskStatus.IN_PROGRESS)) {
      throw new DomainError(
        `Cannot start task from ${this._status.value} status`
      );
    }

    if (this._assigneeId && !this._assigneeId.equals(startedBy)) {
      throw new DomainError('Only the assigned user can start this task');
    }

    this._status = TaskStatusVO.create(TaskStatus.IN_PROGRESS);
    if (!this._assigneeId) {
      this._assigneeId = startedBy;
    }

    this.markAsUpdated();

    // TODO: Add domain event for task started
  }

  /**
   * Move the task to review
   */
  moveToReview(movedBy: UserId): void {
    if (!this._status.canTransitionTo(TaskStatus.IN_REVIEW)) {
      throw new DomainError(
        `Cannot move task to review from ${this._status.value} status`
      );
    }

    if (this._assigneeId && !this._assigneeId.equals(movedBy)) {
      throw new DomainError(
        'Only the assigned user can move this task to review'
      );
    }

    this._status = TaskStatusVO.create(TaskStatus.IN_REVIEW);
    this.markAsUpdated();

    // TODO: Add domain event for task moved to review
  }

  /**
   * Complete the task
   */
  complete(_completedBy: UserId, actualHours?: number): void {
    if (!this._status.canTransitionTo(TaskStatus.COMPLETED)) {
      throw new DomainError(
        `Cannot complete task from ${this._status.value} status`
      );
    }

    if (actualHours !== undefined) {
      this.validateActualHours(actualHours);
      this._actualHours = actualHours;
    }

    this._status = TaskStatusVO.create(TaskStatus.COMPLETED);
    this._completedAt = new Date();
    this.markAsUpdated();

    // TODO: Add domain event for task completion
  }

  /**
   * Cancel the task
   */
  cancel(_cancelledBy: UserId, _reason?: string): void {
    if (!this._status.canTransitionTo(TaskStatus.CANCELLED)) {
      throw new DomainError(
        `Cannot cancel task from ${this._status.value} status`
      );
    }

    this._status = TaskStatusVO.create(TaskStatus.CANCELLED);
    this.markAsUpdated();

    // TODO: Add domain event for task cancellation
  }

  /**
   * Reopen the task (from cancelled status)
   */
  reopen(_reopenedBy: UserId): void {
    if (!this._status.canTransitionTo(TaskStatus.TODO)) {
      throw new DomainError(
        `Cannot reopen task from ${this._status.value} status`
      );
    }

    this._status = TaskStatusVO.create(TaskStatus.TODO);
    this._completedAt = null;
    this.markAsUpdated();

    // TODO: Add domain event for task reopened
  }

  /**
   * Check if the task is overdue
   */
  isOverdue(): boolean {
    if (
      !this._dueDate ||
      this._status.isCompleted() ||
      this._status.isCancelled()
    ) {
      return false;
    }

    return new Date() > this._dueDate;
  }

  /**
   * Check if the task can be assigned
   */
  canBeAssigned(): boolean {
    return this._status.canBeAssigned();
  }

  /**
   * Check if the task is assigned
   */
  isAssigned(): boolean {
    return this._assigneeId !== null;
  }

  /**
   * Check if the task is assigned to a specific user
   */
  isAssignedTo(userId: UserId): boolean {
    return this._assigneeId?.equals(userId) ?? false;
  }

  /**
   * Check if the task is completed
   */
  isCompleted(): boolean {
    return this._status.isCompleted();
  }

  /**
   * Check if the task is in progress
   */
  isInProgress(): boolean {
    return this._status.isInProgress();
  }

  /**
   * Get the task's progress percentage (estimated vs actual hours)
   */
  getProgressPercentage(): number | null {
    if (!this._estimatedHours || !this._actualHours) {
      return null;
    }

    return Math.min(100, (this._actualHours / this._estimatedHours) * 100);
  }

  /**
   * Get days until due date (negative if overdue)
   */
  getDaysUntilDue(): number | null {
    if (!this._dueDate) {
      return null;
    }

    const now = new Date();
    const diffTime = this._dueDate.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Validate the task entity
   */
  protected validate(): void {
    this.validateTitle(this._title);
    this.validateDescription(this._description);

    if (this._estimatedHours !== null) {
      this.validateEstimatedHours(this._estimatedHours);
    }

    if (this._actualHours !== null) {
      this.validateActualHours(this._actualHours);
    }
  }

  /**
   * Validate the task's title
   */
  private validateTitle(title: string): void {
    if (!title || title.trim().length === 0) {
      throw ValidationError.forField('title', 'Task title cannot be empty');
    }

    if (title.length < TASK_VALIDATION.TITLE_MIN_LENGTH) {
      throw ValidationError.forField(
        'title',
        `Task title must be at least ${TASK_VALIDATION.TITLE_MIN_LENGTH} character(s)`
      );
    }

    if (title.length > TASK_VALIDATION.TITLE_MAX_LENGTH) {
      throw ValidationError.forField(
        'title',
        `Task title cannot exceed ${TASK_VALIDATION.TITLE_MAX_LENGTH} characters`
      );
    }
  }

  /**
   * Validate the task's description
   */
  private validateDescription(description: string): void {
    if (
      description &&
      description.length > TASK_VALIDATION.DESCRIPTION_MAX_LENGTH
    ) {
      throw ValidationError.forField(
        'description',
        `Task description cannot exceed ${TASK_VALIDATION.DESCRIPTION_MAX_LENGTH} characters`
      );
    }
  }

  /**
   * Validate estimated hours
   */
  private validateEstimatedHours(hours: number): void {
    if (hours < TASK_VALIDATION.MIN_ESTIMATED_HOURS) {
      throw ValidationError.forField(
        'estimatedHours',
        `Estimated hours must be at least ${TASK_VALIDATION.MIN_ESTIMATED_HOURS}`
      );
    }

    if (hours > TASK_VALIDATION.MAX_ESTIMATED_HOURS) {
      throw ValidationError.forField(
        'estimatedHours',
        `Estimated hours cannot exceed ${TASK_VALIDATION.MAX_ESTIMATED_HOURS}`
      );
    }
  }

  /**
   * Validate actual hours
   */
  private validateActualHours(hours: number): void {
    if (hours < TASK_VALIDATION.MIN_ACTUAL_HOURS) {
      throw ValidationError.forField(
        'actualHours',
        `Actual hours must be at least ${TASK_VALIDATION.MIN_ACTUAL_HOURS}`
      );
    }

    if (hours > TASK_VALIDATION.MAX_ACTUAL_HOURS) {
      throw ValidationError.forField(
        'actualHours',
        `Actual hours cannot exceed ${TASK_VALIDATION.MAX_ACTUAL_HOURS}`
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
   * Create a new Task instance
   */
  static create(
    id: TaskId,
    title: string,
    description: string,
    projectId: ProjectId,
    createdById: UserId,
    priority?: Priority,
    dueDate?: Date,
    estimatedHours?: number
  ): Task {
    return new Task(
      id,
      title,
      description,
      projectId,
      createdById,
      TaskStatusVO.create(TaskStatus.TODO),
      priority,
      null, // assigneeId
      dueDate ?? null,
      estimatedHours ?? null
    );
  }

  /**
   * Restore a Task from persistence
   */
  static restore(
    id: TaskId,
    title: string,
    description: string,
    status: TaskStatusVO,
    priority: Priority,
    assigneeId: UserId | null,
    projectId: ProjectId,
    createdById: UserId,
    dueDate: Date | null,
    estimatedHours: number | null,
    actualHours: number | null,
    completedAt: Date | null,
    createdAt: Date,
    updatedAt: Date
  ): Task {
    return new Task(
      id,
      title,
      description,
      projectId,
      createdById,
      status,
      priority,
      assigneeId,
      dueDate,
      estimatedHours,
      actualHours,
      completedAt,
      createdAt,
      updatedAt
    );
  }
}
