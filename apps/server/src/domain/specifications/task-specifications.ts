import { Task } from '../entities/task';
import { User } from '../entities/user';
import { UserId} from '../value-objects';
import { TaskStatus } from '../../shared/constants/task-constants';

/**
 * Base specification interface
 */
export interface ISpecification<T> {
  isSatisfiedBy(candidate: T): boolean;
  and(other: ISpecification<T>): ISpecification<T>;
  or(other: ISpecification<T>): ISpecification<T>;
  not(): ISpecification<T>;
}

/**
 * Abstract base specification
 */
export abstract class Specification<T> implements ISpecification<T> {
  abstract isSatisfiedBy(candidate: T): boolean;

  and(other: ISpecification<T>): ISpecification<T> {
    return new AndSpecification(this, other);
  }

  or(other: ISpecification<T>): ISpecification<T> {
    return new OrSpecification(this, other);
  }

  not(): ISpecification<T> {
    return new NotSpecification(this);
  }
}

/**
 * Composite specifications
 */
class AndSpecification<T> extends Specification<T> {
  constructor(
    private left: ISpecification<T>,
    private right: ISpecification<T>
  ) {
    super();
  }

  isSatisfiedBy(candidate: T): boolean {
    return (
      this.left.isSatisfiedBy(candidate) && this.right.isSatisfiedBy(candidate)
    );
  }
}

class OrSpecification<T> extends Specification<T> {
  constructor(
    private left: ISpecification<T>,
    private right: ISpecification<T>
  ) {
    super();
  }

  isSatisfiedBy(candidate: T): boolean {
    return (
      this.left.isSatisfiedBy(candidate) || this.right.isSatisfiedBy(candidate)
    );
  }
}

class NotSpecification<T> extends Specification<T> {
  constructor(private spec: ISpecification<T>) {
    super();
  }

  isSatisfiedBy(candidate: T): boolean {
    return !this.spec.isSatisfiedBy(candidate);
  }
}

/**
 * Task can be assigned specification
 */
export class TaskCanBeAssignedSpecification extends Specification<Task> {
  isSatisfiedBy(task: Task): boolean {
    return task.canBeAssigned();
  }
}

/**
 * Task is overdue specification
 */
export class TaskIsOverdueSpecification extends Specification<Task> {
  isSatisfiedBy(task: Task): boolean {
    return task.isOverdue();
  }
}

/**
 * Task is assigned to user specification
 */
export class TaskIsAssignedToUserSpecification extends Specification<Task> {
  constructor(private userId: UserId) {
    super();
  }

  isSatisfiedBy(task: Task): boolean {
    return task.isAssignedTo(this.userId);
  }
}

/**
 * Task has status specification
 */
export class TaskHasStatusSpecification extends Specification<Task> {
  constructor(private status: TaskStatus) {
    super();
  }

  isSatisfiedBy(task: Task): boolean {
    return task.status.value === this.status;
  }
}

/**
 * Task is high priority specification
 */
export class TaskIsHighPrioritySpecification extends Specification<Task> {
  isSatisfiedBy(task: Task): boolean {
    return task.priority.isHigh() || task.priority.isUrgent();
  }
}

/**
 * Task is due within days specification
 */
export class TaskIsDueWithinDaysSpecification extends Specification<Task> {
  constructor(private days: number) {
    super();
  }

  isSatisfiedBy(task: Task): boolean {
    const daysUntilDue = task.getDaysUntilDue();
    return daysUntilDue !== null && daysUntilDue <= this.days;
  }
}

/**
 * Task can be started specification
 */
export class TaskCanBeStartedSpecification extends Specification<Task> {
  constructor(private dependencies: Task[] = []) {
    super();
  }

  isSatisfiedBy(task: Task): boolean {
    // Task must be in TODO status
    if (!task.status.canTransitionTo(TaskStatus.IN_PROGRESS)) {
      return false;
    }

    // All dependencies must be completed
    return this.dependencies.every(dep => dep.isCompleted());
  }
}

/**
 * Task can be completed specification
 */
export class TaskCanBeCompletedSpecification extends Specification<Task> {
  constructor(private dependencies: Task[] = []) {
    super();
  }

  isSatisfiedBy(task: Task): boolean {
    // Task must be in a status that allows completion
    if (!task.status.canTransitionTo(TaskStatus.COMPLETED)) {
      return false;
    }

    // All dependencies must be completed
    return this.dependencies.every(dep => dep.isCompleted());
  }
}

/**
 * Task requires attention specification
 */
export class TaskRequiresAttentionSpecification extends Specification<Task> {
  isSatisfiedBy(task: Task): boolean {
    // Task requires attention if it's:
    // - Overdue
    // - High priority and not assigned
    // - Due within 2 days and not in progress

    if (task.isOverdue()) {
      return true;
    }

    if (task.priority.requiresImmediateAttention() && !task.isAssigned()) {
      return true;
    }

    const daysUntilDue = task.getDaysUntilDue();
    if (daysUntilDue !== null && daysUntilDue <= 2 && !task.isInProgress()) {
      return true;
    }

    return false;
  }
}

/**
 * User can be assigned task specification
 */
export class UserCanBeAssignedTaskSpecification extends Specification<{
  user: User;
  task: Task;
  userActiveTasks: Task[];
}> {
  isSatisfiedBy(candidate: {
    user: User;
    task: Task;
    userActiveTasks: Task[];
  }): boolean {
    const { user, task, userActiveTasks } = candidate;

    // User must be active
    if (!user.canBeAssignedTasks()) {
      return false;
    }

    // Task must be assignable
    if (!task.canBeAssigned()) {
      return false;
    }

    // Check workload limits (max 10 active tasks)
    const activeTaskCount = userActiveTasks.filter(t =>
      t.status.isActive()
    ).length;
    if (activeTaskCount >= 10) {
      return false;
    }

    // Check for conflicting urgent tasks on same due date
    if (task.priority.isUrgent() && task.dueDate) {
      const conflictingTasks = userActiveTasks.filter(
        t =>
          t.priority.isUrgent() &&
          t.dueDate &&
          this.isSameDay(t.dueDate, task.dueDate!)
      );

      if (conflictingTasks.length > 0) {
        return false;
      }
    }

    return true;
  }

  private isSameDay(date1: Date, date2: Date): boolean {
    return date1.toDateString() === date2.toDateString();
  }
}

/**
 * Task is ready for review specification
 */
export class TaskIsReadyForReviewSpecification extends Specification<Task> {
  isSatisfiedBy(task: Task): boolean {
    return (
      task.status.canTransitionTo(TaskStatus.IN_REVIEW) && task.isAssigned()
    );
  }
}

/**
 * Task is blocked specification
 */
export class TaskIsBlockedSpecification extends Specification<Task> {
  constructor(private dependencies: Task[] = []) {
    super();
  }

  isSatisfiedBy(task: Task): boolean {
    // Task is blocked if it has incomplete dependencies and is not completed
    if (task.isCompleted() || task.status.isCancelled()) {
      return false;
    }

    return this.dependencies.some(dep => !dep.isCompleted());
  }
}

/**
 * Task is stale specification (no activity for specified days)
 */
export class TaskIsStaleSpecification extends Specification<Task> {
  constructor(private staleDays: number = 7) {
    super();
  }

  isSatisfiedBy(task: Task): boolean {
    if (task.isCompleted() || task.status.isCancelled()) {
      return false;
    }

    const daysSinceUpdate = Math.floor(
      (Date.now() - task.updatedAt.getTime()) / (1000 * 60 * 60 * 24)
    );

    return daysSinceUpdate >= this.staleDays;
  }
}

/**
 * Composite specifications for common use cases
 */

/**
 * Active tasks specification
 */
export class ActiveTasksSpecification extends Specification<Task> {
  isSatisfiedBy(task: Task): boolean {
    return task.status.isActive();
  }
}

/**
 * Urgent tasks specification
 */
export class UrgentTasksSpecification extends Specification<Task> {
  isSatisfiedBy(task: Task): boolean {
    const isHighPriority = new TaskIsHighPrioritySpecification();
    const isDueSoon = new TaskIsDueWithinDaysSpecification(3);
    const isOverdue = new TaskIsOverdueSpecification();

    return (
      isHighPriority.isSatisfiedBy(task) ||
      isDueSoon.isSatisfiedBy(task) ||
      isOverdue.isSatisfiedBy(task)
    );
  }
}

/**
 * Tasks needing assignment specification
 */
export class TasksNeedingAssignmentSpecification extends Specification<Task> {
  isSatisfiedBy(task: Task): boolean {
    const canBeAssigned = new TaskCanBeAssignedSpecification();
    const isNotAssigned = new (class extends Specification<Task> {
      isSatisfiedBy(task: Task): boolean {
        return !task.isAssigned();
      }
    })();

    return canBeAssigned.and(isNotAssigned).isSatisfiedBy(task);
  }
}
