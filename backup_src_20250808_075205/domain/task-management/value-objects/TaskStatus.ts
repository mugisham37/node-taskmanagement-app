import { ValueObject } from '../../shared/value-objects/ValueObject';

export enum TaskStatusEnum {
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  IN_REVIEW = 'IN_REVIEW',
  DONE = 'DONE',
  CANCELLED = 'CANCELLED',
}

export interface TaskStatusProps {
  value: TaskStatusEnum;
}

export class TaskStatus extends ValueObject<TaskStatusProps> {
  private constructor(props: TaskStatusProps) {
    super(props);
  }

  public static create(value: TaskStatusEnum): TaskStatus {
    return new TaskStatus({ value });
  }

  public static fromString(value: string): TaskStatus {
    const upperValue = value.toUpperCase();
    if (!Object.values(TaskStatusEnum).includes(upperValue as TaskStatusEnum)) {
      throw new Error(`Invalid task status: ${value}`);
    }
    return new TaskStatus({ value: upperValue as TaskStatusEnum });
  }

  public static todo(): TaskStatus {
    return new TaskStatus({ value: TaskStatusEnum.TODO });
  }

  public static inProgress(): TaskStatus {
    return new TaskStatus({ value: TaskStatusEnum.IN_PROGRESS });
  }

  public static inReview(): TaskStatus {
    return new TaskStatus({ value: TaskStatusEnum.IN_REVIEW });
  }

  public static done(): TaskStatus {
    return new TaskStatus({ value: TaskStatusEnum.DONE });
  }

  public static cancelled(): TaskStatus {
    return new TaskStatus({ value: TaskStatusEnum.CANCELLED });
  }

  get value(): TaskStatusEnum {
    return this.props.value;
  }

  public equals(other: TaskStatus): boolean {
    return this.props.value === other.props.value;
  }

  public toString(): string {
    return this.props.value;
  }

  public isCompleted(): boolean {
    return this.props.value === TaskStatusEnum.DONE;
  }

  public isCancelled(): boolean {
    return this.props.value === TaskStatusEnum.CANCELLED;
  }

  public isActive(): boolean {
    return !this.isCompleted() && !this.isCancelled();
  }

  public isInProgress(): boolean {
    return this.props.value === TaskStatusEnum.IN_PROGRESS;
  }

  public canTransitionTo(newStatus: TaskStatus): boolean {
    const transitions: Record<TaskStatusEnum, TaskStatusEnum[]> = {
      [TaskStatusEnum.TODO]: [
        TaskStatusEnum.IN_PROGRESS,
        TaskStatusEnum.CANCELLED,
      ],
      [TaskStatusEnum.IN_PROGRESS]: [
        TaskStatusEnum.IN_REVIEW,
        TaskStatusEnum.TODO,
        TaskStatusEnum.CANCELLED,
      ],
      [TaskStatusEnum.IN_REVIEW]: [
        TaskStatusEnum.DONE,
        TaskStatusEnum.IN_PROGRESS,
        TaskStatusEnum.CANCELLED,
      ],
      [TaskStatusEnum.DONE]: [TaskStatusEnum.IN_PROGRESS], // Allow reopening
      [TaskStatusEnum.CANCELLED]: [TaskStatusEnum.TODO], // Allow reactivation
    };

    return transitions[this.props.value].includes(newStatus.value);
  }
}
