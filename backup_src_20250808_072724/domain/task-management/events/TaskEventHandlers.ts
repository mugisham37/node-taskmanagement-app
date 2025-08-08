import {
  BaseDomainEventHandler,
  DomainEventHandler,
} from '../../shared/events/DomainEventBus';
import {
  TaskCreatedEvent,
  TaskAssignedEvent,
  TaskCompletedEvent,
  TaskStatusChangedEvent,
} from '../entities/Task';

@DomainEventHandler('TaskCreated')
export class TaskCreatedEventHandler extends BaseDomainEventHandler<TaskCreatedEvent> {
  public async handle(event: TaskCreatedEvent): Promise<void> {
    this.logHandling(event);

    try {
      // Business logic for when a task is created
      await this.notifyProjectMembers(event);
      await this.updateProjectMetrics(event);
      await this.createInitialActivity(event);
    } catch (error) {
      this.logError(event, error as Error);
      throw error;
    }
  }

  private async notifyProjectMembers(event: TaskCreatedEvent): Promise<void> {
    // This would integrate with notification service
    console.log(`Notifying project members about new task: ${event.title}`);
  }

  private async updateProjectMetrics(event: TaskCreatedEvent): Promise<void> {
    // This would update project statistics
    console.log(
      `Updating project metrics for project: ${event.projectId?.value}`
    );
  }

  private async createInitialActivity(event: TaskCreatedEvent): Promise<void> {
    // This would create an activity log entry
    console.log(
      `Creating activity log for task creation: ${event.taskId.value}`
    );
  }
}

@DomainEventHandler('TaskAssigned')
export class TaskAssignedEventHandler extends BaseDomainEventHandler<TaskAssignedEvent> {
  public async handle(event: TaskAssignedEvent): Promise<void> {
    this.logHandling(event);

    try {
      await this.notifyAssignee(event);
      await this.updateWorkloadMetrics(event);
      await this.notifyPreviousAssignee(event);
    } catch (error) {
      this.logError(event, error as Error);
      throw error;
    }
  }

  private async notifyAssignee(event: TaskAssignedEvent): Promise<void> {
    console.log(
      `Notifying assignee ${event.assigneeId.value} about task assignment`
    );
  }

  private async updateWorkloadMetrics(event: TaskAssignedEvent): Promise<void> {
    console.log(
      `Updating workload metrics for user: ${event.assigneeId.value}`
    );
  }

  private async notifyPreviousAssignee(
    event: TaskAssignedEvent
  ): Promise<void> {
    if (event.previousAssigneeId) {
      console.log(
        `Notifying previous assignee ${event.previousAssigneeId.value} about reassignment`
      );
    }
  }
}

@DomainEventHandler('TaskCompleted')
export class TaskCompletedEventHandler extends BaseDomainEventHandler<TaskCompletedEvent> {
  public async handle(event: TaskCompletedEvent): Promise<void> {
    this.logHandling(event);

    try {
      await this.updateProjectProgress(event);
      await this.notifyStakeholders(event);
      await this.checkProjectCompletion(event);
      await this.updateUserProductivityMetrics(event);
    } catch (error) {
      this.logError(event, error as Error);
      throw error;
    }
  }

  private async updateProjectProgress(
    event: TaskCompletedEvent
  ): Promise<void> {
    console.log(
      `Updating project progress for completed task: ${event.taskId.value}`
    );
  }

  private async notifyStakeholders(event: TaskCompletedEvent): Promise<void> {
    console.log(
      `Notifying stakeholders about task completion: ${event.taskId.value}`
    );
  }

  private async checkProjectCompletion(
    event: TaskCompletedEvent
  ): Promise<void> {
    console.log(
      `Checking if project is complete after task: ${event.taskId.value}`
    );
  }

  private async updateUserProductivityMetrics(
    event: TaskCompletedEvent
  ): Promise<void> {
    console.log(
      `Updating productivity metrics for user: ${event.completedBy.value}`
    );
  }
}

@DomainEventHandler('TaskStatusChanged')
export class TaskStatusChangedEventHandler extends BaseDomainEventHandler<TaskStatusChangedEvent> {
  public async handle(event: TaskStatusChangedEvent): Promise<void> {
    this.logHandling(event);

    try {
      await this.updateDependentTasks(event);
      await this.notifyWatchers(event);
      await this.updateAnalytics(event);
    } catch (error) {
      this.logError(event, error as Error);
      throw error;
    }
  }

  private async updateDependentTasks(
    event: TaskStatusChangedEvent
  ): Promise<void> {
    if (event.newStatus.isCompleted()) {
      console.log(
        `Checking dependent tasks for completion of: ${event.taskId.value}`
      );
    }
  }

  private async notifyWatchers(event: TaskStatusChangedEvent): Promise<void> {
    console.log(
      `Notifying watchers about status change for task: ${event.taskId.value}`
    );
  }

  private async updateAnalytics(event: TaskStatusChangedEvent): Promise<void> {
    console.log(
      `Updating analytics for status change: ${event.oldStatus.value} -> ${event.newStatus.value}`
    );
  }
}
