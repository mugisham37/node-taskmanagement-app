import { AggregateRoot, AggregateProps } from './aggregate-root';
import { Task } from '../entities/task';
import {
  TaskId,
  ProjectId,
  TaskStatusVO,
} from '../value-objects';

/**
 * Task Dependency Interface
 */
export interface TaskDependency {
  taskId: TaskId;
  dependsOnTaskId: TaskId;
  dependencyType: 'FINISH_TO_START' | 'START_TO_START' | 'FINISH_TO_FINISH' | 'START_TO_FINISH';
  createdAt: Date;
}

/**
 * Task Aggregate Props interface
 */
export interface TaskAggregateProps extends AggregateProps {
  projectId: ProjectId;
  tasks: Map<string, Task>;
}

/**
 * Task Aggregate
 * Manages tasks within a project with business rule enforcement
 */
export class TaskAggregate extends AggregateRoot<TaskAggregateProps> {
  constructor(props: TaskAggregateProps) {
    super(props);
    this.validate();
  }

  /**
   * Create a new task aggregate for a project
   */
  static create(
    projectId: ProjectId,
    tasks: Task[] = []
  ): TaskAggregate {
    const now = new Date();
    const taskMap = new Map<string, Task>();

    // Initialize tasks
    tasks.forEach(task => {
      taskMap.set(task.id.value, task);
    });

    return new TaskAggregate({
      id: projectId.value,
      projectId,
      tasks: taskMap,
      createdAt: now,
      updatedAt: now,
    });
  }

  /**
   * Load from persistence
   */
  static fromPersistence(props: TaskAggregateProps): TaskAggregate {
    return new TaskAggregate(props);
  }

  /**
   * Get project ID
   */
  get projectId(): ProjectId {
    return this.props.projectId;
  }

  /**
   * Get all tasks
   */
  get tasks(): Task[] {
    return Array.from(this.props.tasks.values());
  }

  /**
   * Get task by ID
   */
  getTask(taskId: TaskId): Task | undefined {
    return this.props.tasks.get(taskId.value);
  }

  /**
   * Add a new task
   */
  addTask(task: Task): void {
    if (!task.projectId.equals(this.props.projectId)) {
      throw new Error(`Task ${task.id.value} does not belong to project ${this.props.projectId.value}`);
    }

    this.props.tasks.set(task.id.value, task);
    this.props.updatedAt = new Date();
  }

  /**
   * Update task
   */
  updateTask(task: Task): void {
    if (!this.props.tasks.has(task.id.value)) {
      throw new Error(`Task ${task.id.value} not found in project ${this.props.projectId.value}`);
    }

    if (!task.projectId.equals(this.props.projectId)) {
      throw new Error(`Task ${task.id.value} does not belong to project ${this.props.projectId.value}`);
    }

    this.props.tasks.set(task.id.value, task);
    this.props.updatedAt = new Date();
  }

  /**
   * Remove task
   */
  removeTask(taskId: TaskId): void {
    if (!this.props.tasks.has(taskId.value)) {
      throw new Error(`Task ${taskId.value} not found in project ${this.props.projectId.value}`);
    }

    this.props.tasks.delete(taskId.value);
    this.props.updatedAt = new Date();
  }

  /**
   * Get task count by status
   */
  getTaskCountByStatus(status: TaskStatusVO): number {
    return this.tasks.filter(task => task.status.equals(status)).length;
  }

  /**
   * Get overdue tasks
   */
  getOverdueTasks(): Task[] {
    const now = new Date();
    return this.tasks.filter(task => 
      task.dueDate && 
      task.dueDate < now && 
      !task.isCompleted()
    );
  }

  // Required abstract method implementations
  protected applyEvent(_event: any): void {
    // Handle event sourcing if needed
    // For now, we'll leave this empty as it's not being used
  }

  protected checkInvariants(): void {
    if (!this.props.projectId) {
      throw new Error('Project ID is required');
    }

    // Check that all tasks belong to the same project
    for (const task of this.props.tasks.values()) {
      if (!task.projectId.equals(this.props.projectId)) {
        throw new Error(`Task ${task.id.value} does not belong to project ${this.props.projectId.value}`);
      }
    }
  }

  createSnapshot(): Record<string, any> {
    return {
      id: this.id,
      projectId: this.props.projectId.value,
      tasks: Array.from(this.props.tasks.values()).map(task => ({
        id: task.id.value,
        projectId: task.projectId.value,
        title: task.title,
        status: task.status.value,
        // Add other task properties as needed
      })),
      createdAt: this.props.createdAt.toISOString(),
      updatedAt: this.props.updatedAt.toISOString(),
    };
  }

  restoreFromSnapshot(_snapshot: Record<string, any>): void {
    // Implement snapshot restoration if needed for event sourcing
    // For now, we'll leave this empty as it's not being used
  }

  getValidationErrors(): string[] {
    const errors: string[] = [];
    
    try {
      this.checkInvariants();
    } catch (error) {
      if (error instanceof Error) {
        errors.push(error.message);
      }
    }
    
    return errors;
  }
}
