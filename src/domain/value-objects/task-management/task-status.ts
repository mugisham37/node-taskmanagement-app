import { StringValueObject } from '../../../shared/domain/value-object';

export enum TaskStatusEnum {
  TODO = 'todo',
  IN_PROGRESS = 'in_progress',
  IN_REVIEW = 'in_review',
  BLOCKED = 'blocked',
  DONE = 'done',
  CANCELLED = 'cancelled',
}

export class TaskStatus extends StringValueObject {
  private constructor(value: TaskStatusEnum) {
    super(value);
  }

  public static create(status: TaskStatusEnum): TaskStatus {
    return new TaskStatus(status);
  }

  public static todo(): TaskStatus {
    return new TaskStatus(TaskStatusEnum.TODO);
  }

  public static inProgress(): TaskStatus {
    return new TaskStatus(TaskStatusEnum.IN_PROGRESS);
  }

  public static inReview(): TaskStatus {
    return new TaskStatus(TaskStatusEnum.IN_REVIEW);
  }

  public static blocked(): TaskStatus {
    return new TaskStatus(TaskStatusEnum.BLOCKED);
  }

  public static done(): TaskStatus {
    return new TaskStatus(TaskStatusEnum.DONE);
  }

  public static cancelled(): TaskStatus {
    return new TaskStatus(TaskStatusEnum.CANCELLED);
  }

  protected validateString(value: string): void {
    if (!Object.values(TaskStatusEnum).includes(value as TaskStatusEnum)) {
      throw new Error(`Invalid task status: ${value}`);
    }
  }

  public canTransitionTo(newStatus: TaskStatus): boolean {
    const transitions: Record<TaskStatusEnum, TaskStatusEnum[]> = {
      [TaskStatusEnum.TODO]: [
        TaskStatusEnum.IN_PROGRESS,
        TaskStatusEnum.BLOCKED,
        TaskStatusEnum.CANCELLED,
      ],
      [TaskStatusEnum.IN_PROGRESS]: [
        TaskStatusEnum.TODO,
        TaskStatusEnum.IN_REVIEW,
        TaskStatusEnum.BLOCKED,
        TaskStatusEnum.DONE,
        TaskStatusEnum.CANCELLED,
      ],
      [TaskStatusEnum.IN_REVIEW]: [
        TaskStatusEnum.IN_PROGRESS,
        TaskStatusEnum.DONE,
        TaskStatusEnum.CANCELLED,
      ],
      [TaskStatusEnum.BLOCKED]: [
        TaskStatusEnum.TODO,
        TaskStatusEnum.IN_PROGRESS,
        TaskStatusEnum.CANCELLED,
      ],
      [TaskStatusEnum.DONE]: [TaskStatusEnum.IN_PROGRESS], // Can reopen
      [TaskStatusEnum.CANCELLED]: [TaskStatusEnum.TODO], // Can reopen
    };

    return (
      transitions[this.value as TaskStatusEnum]?.includes(
        newStatus.value as TaskStatusEnum
      ) ?? false
    );
  }

  public isCompleted(): boolean {
    return this.value === TaskStatusEnum.DONE;
  }

  public isCancelled(): boolean {
    return this.value === TaskStatusEnum.CANCELLED;
  }

  public isActive(): boolean {
    return [
      TaskStatusEnum.TODO,
      TaskStatusEnum.IN_PROGRESS,
      TaskStatusEnum.IN_REVIEW,
      TaskStatusEnum.BLOCKED,
    ].includes(this.value as TaskStatusEnum);
  }

  public isBlocked(): boolean {
    return this.value === TaskStatusEnum.BLOCKED;
  }

  public requiresAction(): boolean {
    return [TaskStatusEnum.TODO, TaskStatusEnum.IN_PROGRESS].includes(
      this.value as TaskStatusEnum
    );
  }
}
