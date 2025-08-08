import {
  DomainService,
  IDomainValidator,
  ValidationResult,
  ValidationError,
} from '../../shared/base/domain-service';
import { Task } from '../entities/Task';
import { TaskId } from '../value-objects/TaskId';
import { UserId } from '../../authentication/value-objects/UserId';
import { ProjectId } from '../value-objects/ProjectId';
import { WorkspaceId } from '../value-objects/WorkspaceId';
import { TaskStatus } from '../value-objects/TaskStatus';
import { Priority } from '../value-objects/Priority';
import { TaskRepository } from '../repositories/TaskRepository';

export interface TaskDependencyValidation {
  canAddDependency: boolean;
  reason?: string;
  wouldCreateCycle: boolean;
}

export interface TaskAssignmentValidation {
  canAssign: boolean;
  reason?: string;
  userHasCapacity: boolean;
  userHasPermission: boolean;
}

export interface BulkTaskOperation {
  taskId: TaskId;
  operation:
    | 'update_status'
    | 'assign'
    | 'update_priority'
    | 'add_tags'
    | 'move_project';
  parameters: Record<string, any>;
}

export interface BulkOperationResult {
  successful: TaskId[];
  failed: Array<{ taskId: TaskId; error: string }>;
  totalProcessed: number;
}

/**
 * Domain service for complex task management operations that span multiple aggregates
 * or require coordination between different domain concepts.
 */
export class TaskManagementDomainService
  extends DomainService
  implements IDomainValidator<Task>
{
  constructor(private readonly taskRepository: TaskRepository) {
    super();
  }

  /**
   * Validates a task entity against all business rules
   */
  async validate(task: Task): Promise<ValidationResult> {
    return this.executeOperation(async () => {
      const errors: ValidationError[] = [];

      // Basic validation
      if (!task.title || task.title.trim().length === 0) {
        errors.push({
          field: 'title',
          message: 'Task title cannot be empty',
          code: 'TITLE_REQUIRED',
        });
      }

      if (task.title && task.title.length > 500) {
        errors.push({
          field: 'title',
          message: 'Task title cannot exceed 500 characters',
          code: 'TITLE_TOO_LONG',
        });
      }

      // Timeline validation
      if (task.startDate && task.dueDate && task.startDate > task.dueDate) {
        errors.push({
          field: 'timeline',
          message: 'Start date cannot be after due date',
          code: 'INVALID_TIMELINE',
        });
      }

      // Hierarchy validation
      if (task.parentTaskId) {
        const hierarchyValidation = await this.validateTaskHierarchy(task);
        if (!hierarchyValidation.isValid) {
          errors.push(...hierarchyValidation.errors);
        }
      }

      // Dependency validation
      const dependencies = await this.taskRepository.getTaskDependencies(
        task.id
      );
      for (const dependency of dependencies.dependsOn) {
        const depValidation = await this.validateTaskDependency(
          task.id,
          dependency.id
        );
        if (!depValidation.canAddDependency) {
          errors.push({
            field: 'dependencies',
            message: depValidation.reason || 'Invalid dependency',
            code: 'INVALID_DEPENDENCY',
          });
        }
      }

      return {
        isValid: errors.length === 0,
        errors,
      };
    }, 'validateTask');
  }

  /**
   * Validates if a dependency can be added between two tasks
   */
  async validateTaskDependency(
    taskId: TaskId,
    dependsOnId: TaskId
  ): Promise<TaskDependencyValidation> {
    return this.executeOperation(async () => {
      // Check if tasks exist
      const [task, dependsOnTask] = await Promise.all([
        this.taskRepository.findById(taskId),
        this.taskRepository.findById(dependsOnId),
      ]);

      if (!task || !dependsOnTask) {
        return {
          canAddDependency: false,
          reason: 'One or both tasks do not exist',
          wouldCreateCycle: false,
        };
      }

      // Check if tasks are in the same project
      if (
        task.projectId &&
        dependsOnTask.projectId &&
        !task.projectId.equals(dependsOnTask.projectId)
      ) {
        return {
          canAddDependency: false,
          reason: 'Tasks must be in the same project to have dependencies',
          wouldCreateCycle: false,
        };
      }

      // Check for circular dependencies
      const wouldCreateCycle = await this.wouldCreateCircularDependency(
        taskId,
        dependsOnId
      );
      if (wouldCreateCycle) {
        return {
          canAddDependency: false,
          reason: 'Adding this dependency would create a circular dependency',
          wouldCreateCycle: true,
        };
      }

      return {
        canAddDependency: true,
        wouldCreateCycle: false,
      };
    }, 'validateTaskDependency');
  }

  /**
   * Validates if a user can be assigned to a task
   */
  async validateTaskAssignment(
    taskId: TaskId,
    assigneeId: UserId
  ): Promise<TaskAssignmentValidation> {
    return this.executeOperation(async () => {
      const task = await this.taskRepository.findById(taskId);
      if (!task) {
        return {
          canAssign: false,
          reason: 'Task does not exist',
          userHasCapacity: false,
          userHasPermission: false,
        };
      }

      // Check user capacity (simplified - in real implementation would check workload)
      const userTasks = await this.taskRepository.findByAssignee(assigneeId, {
        filters: { status: [TaskStatus.todo(), TaskStatus.inProgress()] },
      });

      const userHasCapacity = userTasks.length < 20; // Configurable limit

      // Check user permission (simplified - in real implementation would check workspace membership)
      const userHasPermission = true; // Would integrate with authorization service

      return {
        canAssign: userHasCapacity && userHasPermission,
        reason: !userHasCapacity
          ? 'User has too many active tasks'
          : !userHasPermission
            ? 'User does not have permission to be assigned tasks in this workspace'
            : undefined,
        userHasCapacity,
        userHasPermission,
      };
    }, 'validateTaskAssignment');
  }

  /**
   * Performs bulk operations on multiple tasks
   */
  async performBulkOperation(
    operations: BulkTaskOperation[],
    performedBy: UserId
  ): Promise<BulkOperationResult> {
    return this.executeOperation(async () => {
      const result: BulkOperationResult = {
        successful: [],
        failed: [],
        totalProcessed: operations.length,
      };

      for (const operation of operations) {
        try {
          const task = await this.taskRepository.findById(operation.taskId);
          if (!task) {
            result.failed.push({
              taskId: operation.taskId,
              error: 'Task not found',
            });
            continue;
          }

          await this.applyBulkOperation(task, operation, performedBy);
          await this.taskRepository.save(task);
          result.successful.push(operation.taskId);
        } catch (error) {
          result.failed.push({
            taskId: operation.taskId,
            error: error.message,
          });
        }
      }

      return result;
    }, 'performBulkOperation');
  }

  /**
   * Calculates task completion metrics for a project
   */
  async calculateProjectTaskMetrics(projectId: ProjectId): Promise<{
    totalTasks: number;
    completedTasks: number;
    completionRate: number;
    averageCompletionTime: number; // in hours
    tasksByStatus: Record<string, number>;
    tasksByPriority: Record<string, number>;
    overdueTasksCount: number;
  }> {
    return this.executeOperation(async () => {
      const tasks = await this.taskRepository.findByProject(projectId);

      const totalTasks = tasks.length;
      const completedTasks = tasks.filter(t => t.status.isCompleted()).length;
      const completionRate =
        totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

      // Calculate average completion time
      const completedTasksWithTime = tasks.filter(
        t => t.status.isCompleted() && t.completedAt && t.createdAt
      );

      const totalCompletionTime = completedTasksWithTime.reduce((sum, task) => {
        const completionTime =
          task.completedAt!.getTime() - task.createdAt.getTime();
        return sum + completionTime / (1000 * 60 * 60); // Convert to hours
      }, 0);

      const averageCompletionTime =
        completedTasksWithTime.length > 0
          ? totalCompletionTime / completedTasksWithTime.length
          : 0;

      // Group by status
      const tasksByStatus = tasks.reduce(
        (acc, task) => {
          const status = task.status.value;
          acc[status] = (acc[status] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

      // Group by priority
      const tasksByPriority = tasks.reduce(
        (acc, task) => {
          const priority = task.priority.value;
          acc[priority] = (acc[priority] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

      // Count overdue tasks
      const overdueTasksCount = tasks.filter(t => t.isOverdue()).length;

      return {
        totalTasks,
        completedTasks,
        completionRate,
        averageCompletionTime,
        tasksByStatus,
        tasksByPriority,
        overdueTasksCount,
      };
    }, 'calculateProjectTaskMetrics');
  }

  /**
   * Suggests optimal task assignments based on workload and skills
   */
  async suggestTaskAssignments(
    workspaceId: WorkspaceId,
    unassignedTaskIds: TaskId[]
  ): Promise<
    Array<{
      taskId: TaskId;
      suggestedAssigneeId: UserId;
      confidence: number;
      reason: string;
    }>
  > {
    return this.executeOperation(async () => {
      const suggestions = [];

      for (const taskId of unassignedTaskIds) {
        const task = await this.taskRepository.findById(taskId);
        if (!task) continue;

        // Simplified assignment logic - in real implementation would consider:
        // - User skills and expertise
        // - Current workload
        // - Past performance
        // - Availability
        // - Team dynamics

        const suggestion = await this.calculateBestAssignee(task);
        if (suggestion) {
          suggestions.push({
            taskId,
            suggestedAssigneeId: suggestion.userId,
            confidence: suggestion.confidence,
            reason: suggestion.reason,
          });
        }
      }

      return suggestions;
    }, 'suggestTaskAssignments');
  }

  // Private helper methods

  private async validateTaskHierarchy(task: Task): Promise<ValidationResult> {
    const errors: ValidationError[] = [];

    if (task.parentTaskId) {
      const parent = await this.taskRepository.findById(task.parentTaskId);
      if (!parent) {
        errors.push({
          field: 'parentTaskId',
          message: 'Parent task does not exist',
          code: 'PARENT_NOT_FOUND',
        });
      } else if (!parent.workspaceId.equals(task.workspaceId)) {
        errors.push({
          field: 'parentTaskId',
          message: 'Parent task must be in the same workspace',
          code: 'PARENT_DIFFERENT_WORKSPACE',
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  private async wouldCreateCircularDependency(
    taskId: TaskId,
    dependsOnId: TaskId
  ): Promise<boolean> {
    // Simplified circular dependency check
    // In real implementation, would use graph traversal algorithm
    const visited = new Set<string>();
    const stack = [dependsOnId.value];

    while (stack.length > 0) {
      const currentId = stack.pop()!;
      if (visited.has(currentId)) continue;

      if (currentId === taskId.value) {
        return true; // Circular dependency found
      }

      visited.add(currentId);

      const currentTask = await this.taskRepository.findById(
        new TaskId(currentId)
      );
      if (currentTask) {
        const dependencies = await this.taskRepository.getTaskDependencies(
          currentTask.id
        );
        for (const dep of dependencies.dependsOn) {
          stack.push(dep.id.value);
        }
      }
    }

    return false;
  }

  private async applyBulkOperation(
    task: Task,
    operation: BulkTaskOperation,
    performedBy: UserId
  ): Promise<void> {
    switch (operation.operation) {
      case 'update_status':
        const newStatus = TaskStatus.fromString(operation.parameters.status);
        task.changeStatus(newStatus, performedBy);
        break;

      case 'assign':
        const assigneeId = new UserId(operation.parameters.assigneeId);
        task.assignTo(assigneeId, performedBy);
        break;

      case 'update_priority':
        const newPriority = Priority.fromString(operation.parameters.priority);
        task.updatePriority(newPriority, performedBy);
        break;

      case 'add_tags':
        const tags = operation.parameters.tags as string[];
        const currentTags = task.tags;
        task.updateTags([...currentTags, ...tags], performedBy);
        break;

      default:
        throw new Error(`Unsupported bulk operation: ${operation.operation}`);
    }
  }

  private async calculateBestAssignee(task: Task): Promise<{
    userId: UserId;
    confidence: number;
    reason: string;
  } | null> {
    // Simplified assignment algorithm
    // In real implementation would be much more sophisticated

    // For now, just return null to indicate no suggestion
    // Real implementation would analyze user skills, workload, etc.
    return null;
  }

  protected beforeOperation(operationName: string): void {
    console.log(`Starting domain operation: ${operationName}`);
  }

  protected afterOperation(
    operationName: string,
    success: boolean,
    error?: any
  ): void {
    if (success) {
      console.log(`Completed domain operation: ${operationName}`);
    } else {
      console.error(`Failed domain operation: ${operationName}`, error);
    }
  }
}
