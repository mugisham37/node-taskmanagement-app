import { beforeEach, describe, expect, it } from 'vitest';
import { Priority, ProjectId, TaskId, TaskStatusVO, UserId } from '../value-objects';
import { Task } from './task';

describe('Task Entity - Comprehensive Tests', () => {
  let taskId: TaskId;
  let projectId: ProjectId;
  let assigneeId: UserId;

  beforeEach(() => {
    taskId = new TaskId('task-123');
    projectId = new ProjectId('project-456');
    assigneeId = new UserId('user-789');
  });

  describe('Task Creation', () => {
    it('should create a task with valid properties', () => {
      const task = Task.create({
        id: taskId,
        title: 'Test Task',
        description: 'Test Description',
        projectId,
        status: TaskStatusVO.TODO,
        priority: Priority.MEDIUM,
        assigneeId,
        dueDate: new Date('2024-12-31'),
        estimatedHours: 8,
        tags: ['frontend', 'urgent']
      });

      expect(task.id).toEqual(taskId);
      expect(task.title).toBe('Test Task');
      expect(task.description).toBe('Test Description');
      expect(task.projectId).toEqual(projectId);
      expect(task.status).toEqual(TaskStatusVO.TODO);
      expect(task.priority).toEqual(Priority.MEDIUM);
      expect(task.assigneeId).toEqual(assigneeId);
      expect(task.estimatedHours).toBe(8);
      expect(task.tags).toEqual(['frontend', 'urgent']);
    });

    it('should create a task with minimal required properties', () => {
      const task = Task.create({
        id: taskId,
        title: 'Minimal Task',
        projectId,
        status: TaskStatusVO.TODO,
        priority: Priority.LOW
      });

      expect(task.id).toEqual(taskId);
      expect(task.title).toBe('Minimal Task');
      expect(task.projectId).toEqual(projectId);
      expect(task.status).toEqual(TaskStatusVO.TODO);
      expect(task.priority).toEqual(Priority.LOW);
      expect(task.assigneeId).toBeUndefined();
      expect(task.description).toBeUndefined();
      expect(task.dueDate).toBeUndefined();
    });

    it('should throw error when creating task with empty title', () => {
      expect(() => {
        Task.create({
          id: taskId,
          title: '',
          projectId,
          status: TaskStatusVO.TODO,
          priority: Priority.LOW
        });
      }).toThrow('Task title cannot be empty');
    });

    it('should throw error when creating task with title longer than 200 characters', () => {
      const longTitle = 'a'.repeat(201);
      
      expect(() => {
        Task.create({
          id: taskId,
          title: longTitle,
          projectId,
          status: TaskStatusVO.TODO,
          priority: Priority.LOW
        });
      }).toThrow('Task title cannot exceed 200 characters');
    });
  });

  describe('Task Assignment', () => {
    let task: Task;

    beforeEach(() => {
      task = Task.create({
        id: taskId,
        title: 'Test Task',
        projectId,
        status: TaskStatusVO.TODO,
        priority: Priority.MEDIUM
      });
    });

    it('should assign task to a user', () => {
      task.assignTo(assigneeId);
      
      expect(task.assigneeId).toEqual(assigneeId);
      expect(task.isAssigned()).toBe(true);
    });

    it('should unassign task', () => {
      task.assignTo(assigneeId);
      task.unassign();
      
      expect(task.assigneeId).toBeUndefined();
      expect(task.isAssigned()).toBe(false);
    });

    it('should reassign task to different user', () => {
      const newAssigneeId = new UserId('user-999');
      
      task.assignTo(assigneeId);
      task.assignTo(newAssigneeId);
      
      expect(task.assigneeId).toEqual(newAssigneeId);
    });
  });

  describe('Task Status Transitions', () => {
    let task: Task;

    beforeEach(() => {
      task = Task.create({
        id: taskId,
        title: 'Test Task',
        projectId,
        status: TaskStatusVO.TODO,
        priority: Priority.MEDIUM,
        assigneeId
      });
    });

    it('should transition from TODO to IN_PROGRESS', () => {
      task.start();
      
      expect(task.status).toEqual(TaskStatusVO.IN_PROGRESS);
      expect(task.startedAt).toBeDefined();
    });

    it('should transition from IN_PROGRESS to COMPLETED', () => {
      task.start();
      task.complete();
      
      expect(task.status).toEqual(TaskStatusVO.COMPLETED);
      expect(task.completedAt).toBeDefined();
    });

    it('should transition from any status to BLOCKED', () => {
      task.block('Waiting for dependencies');
      
      expect(task.status).toEqual(TaskStatusVO.BLOCKED);
      expect(task.blockReason).toBe('Waiting for dependencies');
    });

    it('should transition from BLOCKED back to previous status', () => {
      task.start();
      task.block('Temporary block');
      task.unblock();
      
      expect(task.status).toEqual(TaskStatusVO.IN_PROGRESS);
      expect(task.blockReason).toBeUndefined();
    });

    it('should not allow invalid status transitions', () => {
      expect(() => {
        task.complete(); // Cannot complete without starting
      }).toThrow('Cannot complete task that is not in progress');
    });

    it('should not allow starting completed task', () => {
      task.start();
      task.complete();
      
      expect(() => {
        task.start();
      }).toThrow('Cannot start completed task');
    });
  });

  describe('Task Priority Management', () => {
    let task: Task;

    beforeEach(() => {
      task = Task.create({
        id: taskId,
        title: 'Test Task',
        projectId,
        status: TaskStatusVO.TODO,
        priority: Priority.MEDIUM
      });
    });

    it('should update task priority', () => {
      task.updatePriority(Priority.HIGH);
      
      expect(task.priority).toEqual(Priority.HIGH);
    });

    it('should handle priority escalation', () => {
      task.escalatePriority();
      
      expect(task.priority).toEqual(Priority.HIGH);
    });

    it('should not escalate beyond highest priority', () => {
      task.updatePriority(Priority.CRITICAL);
      task.escalatePriority();
      
      expect(task.priority).toEqual(Priority.CRITICAL);
    });
  });

  describe('Task Due Date Management', () => {
    let task: Task;

    beforeEach(() => {
      task = Task.create({
        id: taskId,
        title: 'Test Task',
        projectId,
        status: TaskStatusVO.TODO,
        priority: Priority.MEDIUM
      });
    });

    it('should set due date', () => {
      const dueDate = new Date('2024-12-31');
      task.setDueDate(dueDate);
      
      expect(task.dueDate).toEqual(dueDate);
    });

    it('should clear due date', () => {
      const dueDate = new Date('2024-12-31');
      task.setDueDate(dueDate);
      task.clearDueDate();
      
      expect(task.dueDate).toBeUndefined();
    });

    it('should identify overdue tasks', () => {
      const pastDate = new Date('2020-01-01');
      task.setDueDate(pastDate);
      
      expect(task.isOverdue()).toBe(true);
    });

    it('should identify tasks due soon', () => {
      const soonDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // Tomorrow
      task.setDueDate(soonDate);
      
      expect(task.isDueSoon(2)).toBe(true); // Due within 2 days
    });

    it('should not allow setting due date in the past', () => {
      const pastDate = new Date('2020-01-01');
      
      expect(() => {
        task.setDueDate(pastDate);
      }).toThrow('Due date cannot be in the past');
    });
  });

  describe('Task Time Tracking', () => {
    let task: Task;

    beforeEach(() => {
      task = Task.create({
        id: taskId,
        title: 'Test Task',
        projectId,
        status: TaskStatusVO.TODO,
        priority: Priority.MEDIUM,
        estimatedHours: 8
      });
    });

    it('should track time spent on task', () => {
      task.addTimeEntry(2.5, 'Working on implementation');
      
      expect(task.actualHours).toBe(2.5);
      expect(task.timeEntries).toHaveLength(1);
    });

    it('should accumulate multiple time entries', () => {
      task.addTimeEntry(2.5, 'Implementation');
      task.addTimeEntry(1.5, 'Testing');
      
      expect(task.actualHours).toBe(4);
      expect(task.timeEntries).toHaveLength(2);
    });

    it('should calculate time variance', () => {
      task.addTimeEntry(10, 'Took longer than expected');
      
      expect(task.getTimeVariance()).toBe(2); // 10 actual - 8 estimated
    });

    it('should identify tasks over estimate', () => {
      task.addTimeEntry(10, 'Over estimate');
      
      expect(task.isOverEstimate()).toBe(true);
    });
  });

  describe('Task Dependencies', () => {
    let task: Task;
    let dependencyTask: Task;

    beforeEach(() => {
      task = Task.create({
        id: taskId,
        title: 'Dependent Task',
        projectId,
        status: TaskStatusVO.TODO,
        priority: Priority.MEDIUM
      });

      dependencyTask = Task.create({
        id: new TaskId('dependency-task'),
        title: 'Dependency Task',
        projectId,
        status: TaskStatusVO.TODO,
        priority: Priority.MEDIUM
      });
    });

    it('should add dependency', () => {
      task.addDependency(dependencyTask.id, 'FINISH_TO_START');
      
      expect(task.dependencies).toHaveLength(1);
      expect(task.hasDependencies()).toBe(true);
    });

    it('should remove dependency', () => {
      task.addDependency(dependencyTask.id, 'FINISH_TO_START');
      task.removeDependency(dependencyTask.id);
      
      expect(task.dependencies).toHaveLength(0);
      expect(task.hasDependencies()).toBe(false);
    });

    it('should check if task can start based on dependencies', () => {
      task.addDependency(dependencyTask.id, 'FINISH_TO_START');
      
      expect(task.canStart([dependencyTask])).toBe(false);
      
      dependencyTask.start();
      dependencyTask.complete();
      
      expect(task.canStart([dependencyTask])).toBe(true);
    });
  });

  describe('Task Validation', () => {
    it('should validate task business rules', () => {
      const task = Task.create({
        id: taskId,
        title: 'Test Task',
        projectId,
        status: TaskStatusVO.TODO,
        priority: Priority.MEDIUM
      });

      const validationErrors = task.validate();
      expect(validationErrors).toHaveLength(0);
    });

    it('should identify validation errors', () => {
      const task = Task.create({
        id: taskId,
        title: 'Test Task',
        projectId,
        status: TaskStatusVO.TODO,
        priority: Priority.MEDIUM,
        estimatedHours: -1 // Invalid
      });

      const validationErrors = task.validate();
      expect(validationErrors.length).toBeGreaterThan(0);
      expect(validationErrors).toContain('Estimated hours must be positive');
    });
  });

  describe('Task Equality and Comparison', () => {
    it('should compare tasks by ID', () => {
      const task1 = Task.create({
        id: taskId,
        title: 'Task 1',
        projectId,
        status: TaskStatusVO.TODO,
        priority: Priority.MEDIUM
      });

      const task2 = Task.create({
        id: taskId,
        title: 'Task 2', // Different title
        projectId,
        status: TaskStatusVO.TODO,
        priority: Priority.MEDIUM
      });

      expect(task1.equals(task2)).toBe(true); // Same ID
    });

    it('should sort tasks by priority', () => {
      const lowTask = Task.create({
        id: new TaskId('low-task'),
        title: 'Low Priority',
        projectId,
        status: TaskStatusVO.TODO,
        priority: Priority.LOW
      });

      const highTask = Task.create({
        id: new TaskId('high-task'),
        title: 'High Priority',
        projectId,
        status: TaskStatusVO.TODO,
        priority: Priority.HIGH
      });

      const tasks = [lowTask, highTask];
      tasks.sort((a, b) => b.priority.compareTo(a.priority));

      expect(tasks[0]).toBe(highTask);
      expect(tasks[1]).toBe(lowTask);
    });
  });
});