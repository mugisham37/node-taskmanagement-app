import { describe, it, expect, beforeEach } from 'vitest';
import { Task } from '@/domain/entities/task';
import { TaskId } from '@/domain/value-objects/task-id';
import { TaskTitle } from '@/domain/value-objects/task-title';
import { TaskDescription } from '@/domain/value-objects/task-description';
import { TaskStatus } from '@/domain/value-objects/task-status';
import { Priority } from '@/domain/value-objects/priority';
import { UserId } from '@/domain/value-objects/user-id';
import { WorkspaceId } from '@/domain/value-objects/workspace-id';
import { ProjectId } from '@/domain/value-objects/project-id';
import { TaskCreatedEvent } from '@/domain/events/task-created-event';
import { TaskAssignedEvent } from '@/domain/events/task-assigned-event';
import { TaskStatusUpdatedEvent } from '@/domain/events/task-status-updated-event';
import { TaskCompletedEvent } from '@/domain/events/task-completed-event';
import { DomainError } from '@/shared/errors/domain-error';

describe('Task Entity', () => {
  let taskId: TaskId;
  let title: TaskTitle;
  let description: TaskDescription;
  let workspaceId: WorkspaceId;
  let projectId: ProjectId;
  let creatorId: UserId;
  let assigneeId: UserId;

  beforeEach(() => {
    taskId = TaskId.create();
    title = TaskTitle.create('Test Task');
    description = TaskDescription.create('This is a test task description');
    workspaceId = WorkspaceId.create();
    projectId = ProjectId.create();
    creatorId = UserId.create();
    assigneeId = UserId.create();
  });

  describe('creation', () => {
    it('should create a new task with valid properties', () => {
      const task = Task.create({
        title,
        description,
        workspaceId,
        projectId,
        creatorId,
        priority: Priority.MEDIUM,
      });

      expect(task.id).toBeDefined();
      expect(task.title).toBe(title);
      expect(task.description).toBe(description);
      expect(task.workspaceId).toBe(workspaceId);
      expect(task.projectId).toBe(projectId);
      expect(task.creatorId).toBe(creatorId);
      expect(task.status).toBe(TaskStatus.TODO);
      expect(task.priority).toBe(Priority.MEDIUM);
      expect(task.assigneeId).toBeNull();
      expect(task.dueDate).toBeNull();
      expect(task.estimatedHours).toBeNull();
      expect(task.actualHours).toBeNull();
      expect(task.storyPoints).toBeNull();
      expect(task.tags).toEqual([]);
      expect(task.labels).toEqual([]);
      expect(task.watchers).toEqual([]);
      expect(task.position).toBe(0);
      expect(task.createdAt).toBeInstanceOf(Date);
      expect(task.updatedAt).toBeInstanceOf(Date);
      expect(task.lastActivityAt).toBeInstanceOf(Date);
    });

    it('should publish TaskCreatedEvent when task is created', () => {
      const task = Task.create({
        title,
        description,
        workspaceId,
        projectId,
        creatorId,
        priority: Priority.MEDIUM,
      });

      const events = task.getDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(TaskCreatedEvent);
      expect(events[0].aggregateId).toBe(task.id.value);
    });

    it('should throw error when creating task with empty title', () => {
      expect(() => {
        Task.create({
          title: TaskTitle.create(''),
          description,
          workspaceId,
          projectId,
          creatorId,
          priority: Priority.MEDIUM,
        });
      }).toThrow(DomainError);
    });

    it('should create task with optional assignee', () => {
      const task = Task.create({
        title,
        description,
        workspaceId,
        projectId,
        creatorId,
        assigneeId,
        priority: Priority.HIGH,
      });

      expect(task.assigneeId).toBe(assigneeId);
    });
  });

  describe('assignment', () => {
    let task: Task;

    beforeEach(() => {
      task = Task.create({
        title,
        description,
        workspaceId,
        projectId,
        creatorId,
        priority: Priority.MEDIUM,
      });
      task.clearDomainEvents();
    });

    it('should assign task to user', () => {
      task.assignTo(assigneeId, creatorId);

      expect(task.assigneeId).toBe(assigneeId);

      const events = task.getDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(TaskAssignedEvent);
      expect(events[0].assigneeId).toBe(assigneeId.value);
      expect(events[0].assignedBy).toBe(creatorId.value);
    });

    it('should not assign task to same user twice', () => {
      task.assignTo(assigneeId, creatorId);
      task.clearDomainEvents();

      task.assignTo(assigneeId, creatorId);

      expect(task.getDomainEvents()).toHaveLength(0);
    });

    it('should reassign task to different user', () => {
      const firstAssignee = assigneeId;
      const secondAssignee = UserId.create();

      task.assignTo(firstAssignee, creatorId);
      task.clearDomainEvents();

      task.assignTo(secondAssignee, creatorId);

      expect(task.assigneeId).toBe(secondAssignee);

      const events = task.getDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(TaskAssignedEvent);
      expect(events[0].previousAssigneeId).toBe(firstAssignee.value);
    });

    it('should unassign task', () => {
      task.assignTo(assigneeId, creatorId);
      task.clearDomainEvents();

      task.unassign(creatorId);

      expect(task.assigneeId).toBeNull();

      const events = task.getDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(TaskAssignedEvent);
      expect(events[0].assigneeId).toBeNull();
      expect(events[0].previousAssigneeId).toBe(assigneeId.value);
    });
  });

  describe('status management', () => {
    let task: Task;

    beforeEach(() => {
      task = Task.create({
        title,
        description,
        workspaceId,
        projectId,
        creatorId,
        priority: Priority.MEDIUM,
      });
      task.clearDomainEvents();
    });

    it('should update task status', () => {
      task.updateStatus(TaskStatus.IN_PROGRESS, creatorId);

      expect(task.status).toBe(TaskStatus.IN_PROGRESS);

      const events = task.getDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(TaskStatusUpdatedEvent);
      expect(events[0].newStatus).toBe(TaskStatus.IN_PROGRESS.value);
      expect(events[0].previousStatus).toBe(TaskStatus.TODO.value);
    });

    it('should not update to same status', () => {
      task.updateStatus(TaskStatus.TODO, creatorId);

      expect(task.getDomainEvents()).toHaveLength(0);
    });

    it('should complete task and publish completion event', () => {
      task.updateStatus(TaskStatus.DONE, creatorId);

      expect(task.status).toBe(TaskStatus.DONE);
      expect(task.completedAt).toBeInstanceOf(Date);

      const events = task.getDomainEvents();
      expect(events).toHaveLength(2);
      expect(events[0]).toBeInstanceOf(TaskStatusUpdatedEvent);
      expect(events[1]).toBeInstanceOf(TaskCompletedEvent);
    });

    it('should reopen completed task', () => {
      task.updateStatus(TaskStatus.DONE, creatorId);
      task.clearDomainEvents();

      task.updateStatus(TaskStatus.IN_PROGRESS, creatorId);

      expect(task.status).toBe(TaskStatus.IN_PROGRESS);
      expect(task.completedAt).toBeNull();
    });
  });

  describe('priority management', () => {
    let task: Task;

    beforeEach(() => {
      task = Task.create({
        title,
        description,
        workspaceId,
        projectId,
        creatorId,
        priority: Priority.MEDIUM,
      });
      task.clearDomainEvents();
    });

    it('should update task priority', () => {
      task.updatePriority(Priority.HIGH, creatorId);

      expect(task.priority).toBe(Priority.HIGH);
    });

    it('should not update to same priority', () => {
      task.updatePriority(Priority.MEDIUM, creatorId);

      expect(task.getDomainEvents()).toHaveLength(0);
    });
  });

  describe('due date management', () => {
    let task: Task;

    beforeEach(() => {
      task = Task.create({
        title,
        description,
        workspaceId,
        projectId,
        creatorId,
        priority: Priority.MEDIUM,
      });
      task.clearDomainEvents();
    });

    it('should set due date', () => {
      const dueDate = new Date('2024-12-31');

      task.setDueDate(dueDate, creatorId);

      expect(task.dueDate).toBe(dueDate);
    });

    it('should clear due date', () => {
      const dueDate = new Date('2024-12-31');
      task.setDueDate(dueDate, creatorId);

      task.clearDueDate(creatorId);

      expect(task.dueDate).toBeNull();
    });

    it('should throw error for past due date', () => {
      const pastDate = new Date('2020-01-01');

      expect(() => {
        task.setDueDate(pastDate, creatorId);
      }).toThrow(DomainError);
    });

    it('should check if task is overdue', () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // Yesterday
      task.setDueDate(pastDate, creatorId);

      expect(task.isOverdue()).toBe(true);
    });

    it('should check if task is due soon', () => {
      const soonDate = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours from now
      task.setDueDate(soonDate, creatorId);

      expect(task.isDueSoon(4)).toBe(true); // Within 4 hours
      expect(task.isDueSoon(1)).toBe(false); // Not within 1 hour
    });
  });

  describe('time tracking', () => {
    let task: Task;

    beforeEach(() => {
      task = Task.create({
        title,
        description,
        workspaceId,
        projectId,
        creatorId,
        priority: Priority.MEDIUM,
      });
      task.clearDomainEvents();
    });

    it('should set estimated hours', () => {
      task.setEstimatedHours(8, creatorId);

      expect(task.estimatedHours).toBe(8);
    });

    it('should log actual hours', () => {
      task.logActualHours(6, creatorId);

      expect(task.actualHours).toBe(6);
    });

    it('should throw error for negative hours', () => {
      expect(() => {
        task.setEstimatedHours(-1, creatorId);
      }).toThrow(DomainError);

      expect(() => {
        task.logActualHours(-1, creatorId);
      }).toThrow(DomainError);
    });

    it('should calculate time variance', () => {
      task.setEstimatedHours(8, creatorId);
      task.logActualHours(10, creatorId);

      expect(task.getTimeVariance()).toBe(2); // 2 hours over estimate
    });

    it('should return null variance when no estimate', () => {
      task.logActualHours(6, creatorId);

      expect(task.getTimeVariance()).toBeNull();
    });
  });

  describe('story points', () => {
    let task: Task;

    beforeEach(() => {
      task = Task.create({
        title,
        description,
        workspaceId,
        projectId,
        creatorId,
        priority: Priority.MEDIUM,
      });
      task.clearDomainEvents();
    });

    it('should set story points', () => {
      task.setStoryPoints(5, creatorId);

      expect(task.storyPoints).toBe(5);
    });

    it('should throw error for invalid story points', () => {
      expect(() => {
        task.setStoryPoints(0, creatorId);
      }).toThrow(DomainError);

      expect(() => {
        task.setStoryPoints(101, creatorId);
      }).toThrow(DomainError);
    });
  });

  describe('tags and labels', () => {
    let task: Task;

    beforeEach(() => {
      task = Task.create({
        title,
        description,
        workspaceId,
        projectId,
        creatorId,
        priority: Priority.MEDIUM,
      });
      task.clearDomainEvents();
    });

    it('should add tags', () => {
      task.addTag('bug', creatorId);
      task.addTag('urgent', creatorId);

      expect(task.tags).toContain('bug');
      expect(task.tags).toContain('urgent');
      expect(task.tags).toHaveLength(2);
    });

    it('should not add duplicate tags', () => {
      task.addTag('bug', creatorId);
      task.addTag('bug', creatorId);

      expect(task.tags).toHaveLength(1);
    });

    it('should remove tags', () => {
      task.addTag('bug', creatorId);
      task.addTag('urgent', creatorId);

      task.removeTag('bug', creatorId);

      expect(task.tags).not.toContain('bug');
      expect(task.tags).toContain('urgent');
      expect(task.tags).toHaveLength(1);
    });

    it('should add labels', () => {
      task.addLabel('frontend', creatorId);
      task.addLabel('api', creatorId);

      expect(task.labels).toContain('frontend');
      expect(task.labels).toContain('api');
      expect(task.labels).toHaveLength(2);
    });

    it('should remove labels', () => {
      task.addLabel('frontend', creatorId);
      task.addLabel('api', creatorId);

      task.removeLabel('frontend', creatorId);

      expect(task.labels).not.toContain('frontend');
      expect(task.labels).toContain('api');
      expect(task.labels).toHaveLength(1);
    });
  });

  describe('watchers', () => {
    let task: Task;

    beforeEach(() => {
      task = Task.create({
        title,
        description,
        workspaceId,
        projectId,
        creatorId,
        priority: Priority.MEDIUM,
      });
      task.clearDomainEvents();
    });

    it('should add watchers', () => {
      const watcherId = UserId.create();

      task.addWatcher(watcherId, creatorId);

      expect(task.watchers).toContain(watcherId.value);
      expect(task.watchers).toHaveLength(1);
    });

    it('should not add duplicate watchers', () => {
      const watcherId = UserId.create();

      task.addWatcher(watcherId, creatorId);
      task.addWatcher(watcherId, creatorId);

      expect(task.watchers).toHaveLength(1);
    });

    it('should remove watchers', () => {
      const watcherId = UserId.create();

      task.addWatcher(watcherId, creatorId);
      task.removeWatcher(watcherId, creatorId);

      expect(task.watchers).not.toContain(watcherId.value);
      expect(task.watchers).toHaveLength(0);
    });

    it('should check if user is watching', () => {
      const watcherId = UserId.create();

      expect(task.isWatchedBy(watcherId)).toBe(false);

      task.addWatcher(watcherId, creatorId);

      expect(task.isWatchedBy(watcherId)).toBe(true);
    });
  });

  describe('positioning', () => {
    let task: Task;

    beforeEach(() => {
      task = Task.create({
        title,
        description,
        workspaceId,
        projectId,
        creatorId,
        priority: Priority.MEDIUM,
      });
      task.clearDomainEvents();
    });

    it('should update position', () => {
      task.updatePosition(100, creatorId);

      expect(task.position).toBe(100);
    });

    it('should throw error for negative position', () => {
      expect(() => {
        task.updatePosition(-1, creatorId);
      }).toThrow(DomainError);
    });
  });

  describe('entity behavior', () => {
    let task: Task;

    beforeEach(() => {
      task = Task.create({
        title,
        description,
        workspaceId,
        projectId,
        creatorId,
        priority: Priority.MEDIUM,
      });
    });

    it('should increment version on changes', () => {
      const initialVersion = task.version;

      task.updateStatus(TaskStatus.IN_PROGRESS, creatorId);

      expect(task.version).toBe(initialVersion + 1);
    });

    it('should update lastActivityAt on changes', () => {
      const initialActivityAt = task.lastActivityAt;

      setTimeout(() => {
        task.updateStatus(TaskStatus.IN_PROGRESS, creatorId);
        expect(task.lastActivityAt.getTime()).toBeGreaterThan(
          initialActivityAt.getTime()
        );
      }, 10);
    });

    it('should be equal to another task with same id', () => {
      const sameTask = Task.fromPersistence({
        id: task.id.value,
        title: task.title.value,
        description: task.description.value,
        status: task.status.value,
        priority: task.priority.value,
        workspaceId: task.workspaceId.value,
        projectId: task.projectId.value,
        creatorId: task.creatorId.value,
        assigneeId: task.assigneeId?.value || null,
        dueDate: task.dueDate,
        startDate: task.startDate,
        completedAt: task.completedAt,
        estimatedHours: task.estimatedHours,
        actualHours: task.actualHours,
        storyPoints: task.storyPoints,
        tags: task.tags,
        labels: task.labels,
        watchers: task.watchers,
        position: task.position,
        lastActivityAt: task.lastActivityAt,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
      });

      expect(task.equals(sameTask)).toBe(true);
    });

    it('should not be equal to task with different id', () => {
      const differentTask = Task.create({
        title: TaskTitle.create('Different Task'),
        description: TaskDescription.create('Different description'),
        workspaceId,
        projectId,
        creatorId,
        priority: Priority.LOW,
      });

      expect(task.equals(differentTask)).toBe(false);
    });
  });
});
