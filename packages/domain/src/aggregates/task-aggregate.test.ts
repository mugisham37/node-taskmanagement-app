import { TaskStatus } from '@taskmanagement/core';
import { beforeEach, describe, expect, it } from 'vitest';
import { ProjectId, TaskId, UserId } from '../value-objects';
import { TaskAggregate } from './task-aggregate';

describe('TaskAggregate', () => {
  let taskAggregate: TaskAggregate;
  let taskId: TaskId;
  let userId: UserId;
  let projectId: ProjectId;

  beforeEach(() => {
    taskId = new TaskId('task-123');
    userId = new UserId('user-456');
    projectId = new ProjectId('project-789');
  });

  describe('creation', () => {
    it('should create a task aggregate with valid data', () => {
      const taskData = {
        title: 'Test Task',
        description: 'Test Description',
        projectId: projectId.value,
        assigneeId: userId.value,
        status: TaskStatus.TODO
      };

      expect(() => {
        taskAggregate = new TaskAggregate(taskId, taskData);
      }).not.toThrow();

      expect(taskAggregate.id).toEqual(taskId);
    });

    it('should throw error when creating task with invalid data', () => {
      const invalidTaskData = {
        title: '', // Invalid empty title
        description: 'Test Description',
        projectId: projectId.value,
        assigneeId: userId.value,
        status: TaskStatus.TODO
      };

      expect(() => {
        taskAggregate = new TaskAggregate(taskId, invalidTaskData);
      }).toThrow();
    });
  });

  describe('assignment', () => {
    beforeEach(() => {
      const taskData = {
        title: 'Test Task',
        description: 'Test Description',
        projectId: projectId.value,
        status: TaskStatus.TODO
      };
      taskAggregate = new TaskAggregate(taskId, taskData);
    });

    it('should assign task to user', () => {
      taskAggregate.assignTo(userId);
      
      expect(taskAggregate.assigneeId).toEqual(userId);
    });

    it('should emit domain event when task is assigned', () => {
      taskAggregate.assignTo(userId);
      
      const events = taskAggregate.getUncommittedEvents();
      expect(events).toHaveLength(1);
      expect(events[0].eventType).toBe('TaskAssignedEvent');
    });
  });

  describe('status transitions', () => {
    beforeEach(() => {
      const taskData = {
        title: 'Test Task',
        description: 'Test Description',
        projectId: projectId.value,
        status: TaskStatus.TODO
      };
      taskAggregate = new TaskAggregate(taskId, taskData);
    });

    it('should transition from TODO to IN_PROGRESS', () => {
      taskAggregate.start();
      
      expect(taskAggregate.status).toBe(TaskStatus.IN_PROGRESS);
    });

    it('should transition from IN_PROGRESS to COMPLETED', () => {
      taskAggregate.start();
      taskAggregate.complete();
      
      expect(taskAggregate.status).toBe(TaskStatus.COMPLETED);
    });

    it('should emit domain event when task is completed', () => {
      taskAggregate.start();
      taskAggregate.complete();
      
      const events = taskAggregate.getUncommittedEvents();
      expect(events.some(e => e.eventType === 'TaskCompletedEvent')).toBe(true);
    });
  });
});