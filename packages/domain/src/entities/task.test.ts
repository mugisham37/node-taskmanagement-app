import { TaskStatus } from '@taskmanagement/core';
import { beforeEach, describe, expect, it } from 'vitest';
import { Priority, ProjectId, TaskId, UserId } from '../value-objects';
import { Task } from './task';

describe('Task Entity', () => {
  let task: Task;
  let taskId: TaskId;
  let userId: UserId;
  let projectId: ProjectId;

  beforeEach(() => {
    taskId = new TaskId('task-123');
    userId = new UserId('user-456');
    projectId = new ProjectId('project-789');
  });

  describe('creation', () => {
    it('should create a task with valid properties', () => {
      task = new Task({
        id: taskId,
        title: 'Test Task',
        description: 'Test Description',
        projectId,
        status: TaskStatus.TODO,
        priority: new Priority('HIGH'),
        createdAt: new Date(),
        updatedAt: new Date()
      });

      expect(task.id).toEqual(taskId);
      expect(task.title).toBe('Test Task');
      expect(task.description).toBe('Test Description');
      expect(task.projectId).toEqual(projectId);
      expect(task.status).toBe(TaskStatus.TODO);
    });

    it('should throw error with invalid title', () => {
      expect(() => {
        task = new Task({
          id: taskId,
          title: '', // Invalid empty title
          description: 'Test Description',
          projectId,
          status: TaskStatus.TODO,
          priority: new Priority('HIGH'),
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }).toThrow();
    });
  });

  describe('business rules', () => {
    beforeEach(() => {
      task = new Task({
        id: taskId,
        title: 'Test Task',
        description: 'Test Description',
        projectId,
        status: TaskStatus.TODO,
        priority: new Priority('HIGH'),
        createdAt: new Date(),
        updatedAt: new Date()
      });
    });

    it('should allow assignment when task is not completed', () => {
      expect(() => {
        task.assignTo(userId);
      }).not.toThrow();

      expect(task.assigneeId).toEqual(userId);
    });

    it('should not allow assignment when task is completed', () => {
      task.complete();

      expect(() => {
        task.assignTo(userId);
      }).toThrow('Cannot assign completed task');
    });

    it('should update priority correctly', () => {
      const newPriority = new Priority('LOW');
      task.updatePriority(newPriority);

      expect(task.priority).toEqual(newPriority);
    });
  });

  describe('status management', () => {
    beforeEach(() => {
      task = new Task({
        id: taskId,
        title: 'Test Task',
        description: 'Test Description',
        projectId,
        status: TaskStatus.TODO,
        priority: new Priority('HIGH'),
        createdAt: new Date(),
        updatedAt: new Date()
      });
    });

    it('should start task correctly', () => {
      task.start();
      expect(task.status).toBe(TaskStatus.IN_PROGRESS);
    });

    it('should complete task correctly', () => {
      task.start();
      task.complete();
      expect(task.status).toBe(TaskStatus.COMPLETED);
    });

    it('should not allow completing task that is not in progress', () => {
      expect(() => {
        task.complete();
      }).toThrow();
    });
  });
});