import { describe, it, expect, beforeEach } from 'vitest';
import { Task } from '@/domain/entities/task';
import { TaskId } from '@/domain/value-objects/task-id';
import { ProjectId } from '@/domain/value-objects/project-id';
import { UserId } from '@/domain/value-objects/user-id';
import { TaskStatus } from '@/domain/value-objects/task-status';
import { Priority } from '@/domain/value-objects/priority';
import { TestDataFactory } from '../../../helpers/test-helpers';

describe('Task Entity', () => {
  let taskId: TaskId;
  let projectId: ProjectId;
  let assigneeId: UserId;
  let creatorId: UserId;
  let taskStatus: TaskStatus;
  let priority: Priority;

  beforeEach(() => {
    taskId = new TaskId('task-123');
    projectId = new ProjectId('project-123');
    assigneeId = new UserId('user-123');
    creatorId = new UserId('user-456');
    taskStatus = new TaskStatus('TODO');
    priority = new Priority('MEDIUM');
  });

  describe('Constructor', () => {
    it('should create a task with valid properties', () => {
      const dueDate = new Date('2024-12-31');
      const task = new Task(
        taskId,
        projectId,
        assigneeId,
        creatorId,
        'Test Task',
        'Task description',
        taskStatus,
        priority,
        dueDate,
        8,
        0
      );

      expect(task.getId()).toBe(taskId);
      expect(task.getProjectId()).toBe(projectId);
      expect(task.getAssigneeId()).toBe(assigneeId);
      expect(task.getCreatorId()).toBe(creatorId);
      expect(task.getTitle()).toBe('Test Task');
      expect(task.getDescription()).toBe('Task description');
      expect(task.getStatus()).toBe(taskStatus);
      expect(task.getPriority()).toBe(priority);
      expect(task.getDueDate()).toBe(dueDate);
      expect(task.getEstimatedHours()).toBe(8);
      expect(task.getActualHours()).toBe(0);
    });

    it('should throw error for empty title', () => {
      expect(() => {
        new Task(
          taskId,
          projectId,
          assigneeId,
          creatorId,
          '',
          'Task description',
          taskStatus,
          priority,
          new Date(),
          8,
          0
        );
      }).toThrow();
    });

    it('should throw error for negative estimated hours', () => {
      expect(() => {
        new Task(
          taskId,
          projectId,
          assigneeId,
          creatorId,
          'Test Task',
          'Task description',
          taskStatus,
          priority,
          new Date(),
          -1,
          0
        );
      }).toThrow();
    });

    it('should throw error for negative actual hours', () => {
      expect(() => {
        new Task(
          taskId,
          projectId,
          assigneeId,
          creatorId,
          'Test Task',
          'Task description',
          taskStatus,
          priority,
          new Date(),
          8,
          -1
        );
      }).toThrow();
    });
  });

  describe('Business Logic', () => {
    let task: Task;

    beforeEach(() => {
      task = TestDataFactory.createTask(projectId, assigneeId, creatorId);
    });

    it('should start task', () => {
      task.start();
      expect(task.getStatus().getValue()).toBe('IN_PROGRESS');
    });

    it('should complete task', () => {
      task.start();
      task.complete();
      expect(task.getStatus().getValue()).toBe('COMPLETED');
    });

    it('should not complete task that is not in progress', () => {
      expect(() => task.complete()).toThrow();
    });

    it('should block task', () => {
      task.block('Waiting for dependencies');
      expect(task.getStatus().getValue()).toBe('BLOCKED');
    });

    it('should unblock task', () => {
      task.block('Waiting for dependencies');
      task.unblock();
      expect(task.getStatus().getValue()).toBe('TODO');
    });

    it('should update task details', () => {
      task.updateDetails('New Title', 'New Description');
      expect(task.getTitle()).toBe('New Title');
      expect(task.getDescription()).toBe('New Description');
    });

    it('should update priority', () => {
      const highPriority = new Priority('HIGH');
      task.updatePriority(highPriority);
      expect(task.getPriority()).toBe(highPriority);
    });

    it('should update due date', () => {
      const newDueDate = new Date('2025-01-15');
      task.updateDueDate(newDueDate);
      expect(task.getDueDate()).toBe(newDueDate);
    });

    it('should reassign task', () => {
      const newAssigneeId = new UserId('user-789');
      task.reassign(newAssigneeId);
      expect(task.getAssigneeId()).toBe(newAssigneeId);
    });

    it('should log time', () => {
      task.logTime(4);
      expect(task.getActualHours()).toBe(4);
    });

    it('should not log negative time', () => {
      expect(() => task.logTime(-1)).toThrow();
    });

    it('should check if task is overdue', () => {
      const pastDate = new Date('2020-01-01');
      const futureDate = new Date('2030-01-01');

      const overdueTask = TestDataFactory.createTask(
        projectId,
        assigneeId,
        creatorId,
        {
          dueDate: pastDate,
        }
      );
      const notOverdueTask = TestDataFactory.createTask(
        projectId,
        assigneeId,
        creatorId,
        {
          dueDate: futureDate,
        }
      );

      expect(overdueTask.isOverdue()).toBe(true);
      expect(notOverdueTask.isOverdue()).toBe(false);
    });

    it('should check if task is completed', () => {
      expect(task.isCompleted()).toBe(false);

      task.start();
      task.complete();
      expect(task.isCompleted()).toBe(true);
    });

    it('should calculate progress percentage', () => {
      task.updateEstimatedHours(10);
      task.logTime(5);
      expect(task.getProgressPercentage()).toBe(50);
    });
  });

  describe('Domain Events', () => {
    let task: Task;

    beforeEach(() => {
      task = TestDataFactory.createTask(projectId, assigneeId, creatorId);
    });

    it('should publish task created event', () => {
      const events = task.getUncommittedEvents();
      expect(events).toHaveLength(1);
      expect(events[0].getEventType()).toBe('TaskCreated');
    });

    it('should publish task started event', () => {
      task.clearEvents();
      task.start();

      const events = task.getUncommittedEvents();
      expect(events).toHaveLength(1);
      expect(events[0].getEventType()).toBe('TaskStarted');
    });

    it('should publish task completed event', () => {
      task.clearEvents();
      task.start();
      task.complete();

      const events = task.getUncommittedEvents();
      expect(events).toHaveLength(2);
      expect(events[0].getEventType()).toBe('TaskStarted');
      expect(events[1].getEventType()).toBe('TaskCompleted');
    });

    it('should publish task reassigned event', () => {
      task.clearEvents();
      const newAssigneeId = new UserId('user-789');
      task.reassign(newAssigneeId);

      const events = task.getUncommittedEvents();
      expect(events).toHaveLength(1);
      expect(events[0].getEventType()).toBe('TaskReassigned');
    });

    it('should publish task updated event', () => {
      task.clearEvents();
      task.updateDetails('New Title', 'New Description');

      const events = task.getUncommittedEvents();
      expect(events).toHaveLength(1);
      expect(events[0].getEventType()).toBe('TaskUpdated');
    });
  });

  describe('Validation', () => {
    it('should validate task status transitions', () => {
      const task = TestDataFactory.createTask(projectId, assigneeId, creatorId);

      // Valid transitions
      expect(() => task.start()).not.toThrow();
      expect(() => task.complete()).not.toThrow();

      // Invalid transitions
      const todoTask = TestDataFactory.createTask(
        projectId,
        assigneeId,
        creatorId
      );
      expect(() => todoTask.complete()).toThrow();
    });

    it('should validate priority values', () => {
      expect(() => new Priority('LOW')).not.toThrow();
      expect(() => new Priority('MEDIUM')).not.toThrow();
      expect(() => new Priority('HIGH')).not.toThrow();
      expect(() => new Priority('CRITICAL')).not.toThrow();
      expect(() => new Priority('INVALID' as any)).toThrow();
    });

    it('should validate task status values', () => {
      expect(() => new TaskStatus('TODO')).not.toThrow();
      expect(() => new TaskStatus('IN_PROGRESS')).not.toThrow();
      expect(() => new TaskStatus('COMPLETED')).not.toThrow();
      expect(() => new TaskStatus('BLOCKED')).not.toThrow();
      expect(() => new TaskStatus('INVALID' as any)).toThrow();
    });

    it('should validate estimated hours', () => {
      expect(() => {
        TestDataFactory.createTask(projectId, assigneeId, creatorId, {
          estimatedHours: 8,
        });
      }).not.toThrow();

      expect(() => {
        TestDataFactory.createTask(projectId, assigneeId, creatorId, {
          estimatedHours: -1,
        });
      }).toThrow();
    });
  });
});
