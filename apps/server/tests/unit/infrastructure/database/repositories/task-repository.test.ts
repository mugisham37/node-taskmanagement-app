import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TaskRepository } from '@/infrastructure/database/repositories/task-repository';
import { Task } from '@/domain/entities/task';
import { TaskId } from '@/domain/value-objects/task-id';
import { ProjectId } from '@/domain/value-objects/project-id';
import { UserId } from '@/domain/value-objects/user-id';
import { TaskStatus } from '@/domain/value-objects/task-status';
import {
  TestDataFactory,
  MockHelpers,
  DatabaseHelpers,
} from '../../../../helpers/test-helpers';

describe('TaskRepository', () => {
  let taskRepository: TaskRepository;
  let mockDatabase: any;
  let mockLogger: any;

  beforeEach(async () => {
    mockDatabase = {
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      returning: vi.fn().mockReturnThis(),
      execute: vi.fn(),
    };
    mockLogger = MockHelpers.createMockLogger();

    taskRepository = new TaskRepository(mockDatabase, mockLogger);

    // Clean up database before each test
    await DatabaseHelpers.cleanupDatabase();
  });

  describe('findById', () => {
    it('should return task when found', async () => {
      const taskId = new TaskId('task-123');
      const taskData = TestDataFactory.createTaskData(
        'project-123',
        'user-123',
        'creator-123',
        { id: taskId.getValue() }
      );

      mockDatabase.execute.mockResolvedValue([taskData]);

      const result = await taskRepository.findById(taskId);

      expect(result).toBeInstanceOf(Task);
      expect(result?.getId().getValue()).toBe(taskId.getValue());
      expect(mockDatabase.select).toHaveBeenCalled();
      expect(mockDatabase.from).toHaveBeenCalled();
      expect(mockDatabase.where).toHaveBeenCalled();
    });

    it('should return null when task not found', async () => {
      const taskId = new TaskId('task-123');

      mockDatabase.execute.mockResolvedValue([]);

      const result = await taskRepository.findById(taskId);

      expect(result).toBeNull();
    });

    it('should handle database errors', async () => {
      const taskId = new TaskId('task-123');

      mockDatabase.execute.mockRejectedValue(new Error('Database error'));

      await expect(taskRepository.findById(taskId)).rejects.toThrow(
        'Database error'
      );
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('findByProjectId', () => {
    it('should return tasks for project', async () => {
      const projectId = new ProjectId('project-123');
      const tasksData = [
        TestDataFactory.createTaskData(
          'project-123',
          'user-123',
          'creator-123'
        ),
        TestDataFactory.createTaskData(
          'project-123',
          'user-456',
          'creator-123'
        ),
      ];

      mockDatabase.execute.mockResolvedValue(tasksData);

      const result = await taskRepository.findByProjectId(projectId);

      expect(result).toHaveLength(2);
      expect(result[0]).toBeInstanceOf(Task);
      expect(result[1]).toBeInstanceOf(Task);
      expect(mockDatabase.where).toHaveBeenCalledWith(
        expect.objectContaining({ projectId: projectId.getValue() })
      );
    });

    it('should return empty array when no tasks found', async () => {
      const projectId = new ProjectId('project-123');

      mockDatabase.execute.mockResolvedValue([]);

      const result = await taskRepository.findByProjectId(projectId);

      expect(result).toHaveLength(0);
    });
  });

  describe('findByAssigneeId', () => {
    it('should return tasks for assignee', async () => {
      const assigneeId = new UserId('user-123');
      const tasksData = [
        TestDataFactory.createTaskData(
          'project-123',
          'user-123',
          'creator-123'
        ),
        TestDataFactory.createTaskData(
          'project-456',
          'user-123',
          'creator-123'
        ),
      ];

      mockDatabase.execute.mockResolvedValue(tasksData);

      const result = await taskRepository.findByAssigneeId(assigneeId);

      expect(result).toHaveLength(2);
      expect(result[0]).toBeInstanceOf(Task);
      expect(result[1]).toBeInstanceOf(Task);
      expect(mockDatabase.where).toHaveBeenCalledWith(
        expect.objectContaining({ assigneeId: assigneeId.getValue() })
      );
    });
  });

  describe('findByStatus', () => {
    it('should return tasks with specific status', async () => {
      const status = new TaskStatus('IN_PROGRESS');
      const tasksData = [
        TestDataFactory.createTaskData(
          'project-123',
          'user-123',
          'creator-123',
          {
            status: 'IN_PROGRESS',
          }
        ),
        TestDataFactory.createTaskData(
          'project-456',
          'user-456',
          'creator-123',
          {
            status: 'IN_PROGRESS',
          }
        ),
      ];

      mockDatabase.execute.mockResolvedValue(tasksData);

      const result = await taskRepository.findByStatus(status);

      expect(result).toHaveLength(2);
      expect(result[0].getStatus().getValue()).toBe('IN_PROGRESS');
      expect(result[1].getStatus().getValue()).toBe('IN_PROGRESS');
    });
  });

  describe('findOverdueTasks', () => {
    it('should return overdue tasks', async () => {
      const overdueDate = new Date('2020-01-01');
      const tasksData = [
        TestDataFactory.createTaskData(
          'project-123',
          'user-123',
          'creator-123',
          {
            dueDate: overdueDate,
            status: 'TODO',
          }
        ),
        TestDataFactory.createTaskData(
          'project-456',
          'user-456',
          'creator-123',
          {
            dueDate: overdueDate,
            status: 'IN_PROGRESS',
          }
        ),
      ];

      mockDatabase.execute.mockResolvedValue(tasksData);

      const result = await taskRepository.findOverdueTasks();

      expect(result).toHaveLength(2);
      expect(mockDatabase.where).toHaveBeenCalledWith(
        expect.stringContaining('due_date < NOW()')
      );
    });
  });

  describe('save', () => {
    it('should insert new task', async () => {
      const task = TestDataFactory.createTask(
        new ProjectId('project-123'),
        new UserId('user-123'),
        new UserId('creator-123')
      );

      mockDatabase.execute.mockResolvedValue([{ id: task.getId().getValue() }]);

      await taskRepository.save(task);

      expect(mockDatabase.insert).toHaveBeenCalled();
      expect(mockDatabase.values).toHaveBeenCalledWith(
        expect.objectContaining({
          id: task.getId().getValue(),
          projectId: task.getProjectId().getValue(),
          assigneeId: task.getAssigneeId().getValue(),
          creatorId: task.getCreatorId().getValue(),
          title: task.getTitle(),
          description: task.getDescription(),
          status: task.getStatus().getValue(),
          priority: task.getPriority().getValue(),
        })
      );
    });

    it('should update existing task', async () => {
      const task = TestDataFactory.createTask(
        new ProjectId('project-123'),
        new UserId('user-123'),
        new UserId('creator-123')
      );

      // Simulate existing task
      mockDatabase.execute
        .mockResolvedValueOnce([
          TestDataFactory.createTaskData(
            'project-123',
            'user-123',
            'creator-123',
            { id: task.getId().getValue() }
          ),
        ])
        .mockResolvedValueOnce([{ id: task.getId().getValue() }]);

      await taskRepository.save(task);

      expect(mockDatabase.update).toHaveBeenCalled();
      expect(mockDatabase.set).toHaveBeenCalledWith(
        expect.objectContaining({
          title: task.getTitle(),
          description: task.getDescription(),
          status: task.getStatus().getValue(),
          priority: task.getPriority().getValue(),
        })
      );
    });

    it('should handle save errors', async () => {
      const task = TestDataFactory.createTask(
        new ProjectId('project-123'),
        new UserId('user-123'),
        new UserId('creator-123')
      );

      mockDatabase.execute.mockRejectedValue(new Error('Database error'));

      await expect(taskRepository.save(task)).rejects.toThrow('Database error');
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should delete task successfully', async () => {
      const taskId = new TaskId('task-123');

      mockDatabase.execute.mockResolvedValue([{ id: taskId.getValue() }]);

      await taskRepository.delete(taskId);

      expect(mockDatabase.delete).toHaveBeenCalled();
      expect(mockDatabase.where).toHaveBeenCalledWith(
        expect.objectContaining({ id: taskId.getValue() })
      );
    });

    it('should handle delete errors', async () => {
      const taskId = new TaskId('task-123');

      mockDatabase.execute.mockRejectedValue(new Error('Database error'));

      await expect(taskRepository.delete(taskId)).rejects.toThrow(
        'Database error'
      );
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('exists', () => {
    it('should return true when task exists', async () => {
      const taskId = new TaskId('task-123');

      mockDatabase.execute.mockResolvedValue([{ count: 1 }]);

      const result = await taskRepository.exists(taskId);

      expect(result).toBe(true);
      expect(mockDatabase.select).toHaveBeenCalledWith(
        expect.stringContaining('COUNT(*)')
      );
    });

    it('should return false when task does not exist', async () => {
      const taskId = new TaskId('task-123');

      mockDatabase.execute.mockResolvedValue([{ count: 0 }]);

      const result = await taskRepository.exists(taskId);

      expect(result).toBe(false);
    });
  });

  describe('count', () => {
    it('should return total count of tasks', async () => {
      mockDatabase.execute.mockResolvedValue([{ count: 42 }]);

      const result = await taskRepository.count();

      expect(result).toBe(42);
      expect(mockDatabase.select).toHaveBeenCalledWith(
        expect.stringContaining('COUNT(*)')
      );
    });

    it('should return count with filters', async () => {
      const filters = { status: 'TODO', assigneeId: 'user-123' };

      mockDatabase.execute.mockResolvedValue([{ count: 5 }]);

      const result = await taskRepository.count(filters);

      expect(result).toBe(5);
      expect(mockDatabase.where).toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return all tasks with pagination', async () => {
      const tasksData = [
        TestDataFactory.createTaskData(
          'project-123',
          'user-123',
          'creator-123'
        ),
        TestDataFactory.createTaskData(
          'project-456',
          'user-456',
          'creator-123'
        ),
      ];

      mockDatabase.execute.mockResolvedValue(tasksData);

      const result = await taskRepository.findAll({ limit: 10, offset: 0 });

      expect(result).toHaveLength(2);
      expect(result[0]).toBeInstanceOf(Task);
      expect(result[1]).toBeInstanceOf(Task);
    });

    it('should apply filters correctly', async () => {
      const filters = {
        status: 'TODO',
        assigneeId: 'user-123',
        projectId: 'project-123',
      };

      mockDatabase.execute.mockResolvedValue([]);

      await taskRepository.findAll({ filters });

      expect(mockDatabase.where).toHaveBeenCalledWith(
        expect.objectContaining(filters)
      );
    });

    it('should apply sorting correctly', async () => {
      const sort = { field: 'createdAt', direction: 'DESC' };

      mockDatabase.execute.mockResolvedValue([]);

      await taskRepository.findAll({ sort });

      expect(mockDatabase.orderBy).toHaveBeenCalledWith('created_at', 'DESC');
    });
  });

  describe('Data Mapping', () => {
    it('should correctly map database data to domain entity', async () => {
      const taskData = TestDataFactory.createTaskData(
        'project-123',
        'user-123',
        'creator-123',
        {
          id: 'task-123',
          title: 'Test Task',
          description: 'Test Description',
          status: 'IN_PROGRESS',
          priority: 'HIGH',
          dueDate: new Date('2024-12-31'),
          estimatedHours: 8,
          actualHours: 4,
        }
      );

      mockDatabase.execute.mockResolvedValue([taskData]);

      const result = await taskRepository.findById(new TaskId('task-123'));

      expect(result).toBeInstanceOf(Task);
      expect(result?.getId().getValue()).toBe('task-123');
      expect(result?.getTitle()).toBe('Test Task');
      expect(result?.getDescription()).toBe('Test Description');
      expect(result?.getStatus().getValue()).toBe('IN_PROGRESS');
      expect(result?.getPriority().getValue()).toBe('HIGH');
      expect(result?.getEstimatedHours()).toBe(8);
      expect(result?.getActualHours()).toBe(4);
    });

    it('should correctly map domain entity to database data', async () => {
      const task = TestDataFactory.createTask(
        new ProjectId('project-123'),
        new UserId('user-123'),
        new UserId('creator-123'),
        {
          title: 'Test Task',
          description: 'Test Description',
          priority: 'HIGH',
          estimatedHours: 8,
        }
      );

      mockDatabase.execute.mockResolvedValue([{ id: task.getId().getValue() }]);

      await taskRepository.save(task);

      expect(mockDatabase.values).toHaveBeenCalledWith(
        expect.objectContaining({
          id: task.getId().getValue(),
          projectId: task.getProjectId().getValue(),
          assigneeId: task.getAssigneeId().getValue(),
          creatorId: task.getCreatorId().getValue(),
          title: 'Test Task',
          description: 'Test Description',
          status: task.getStatus().getValue(),
          priority: 'HIGH',
          estimatedHours: 8,
          actualHours: task.getActualHours(),
        })
      );
    });
  });
});
