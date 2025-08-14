import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TaskApplicationService } from '@/application/services/task-application-service';
import { CreateTaskCommand } from '@/application/commands/task-commands';
import { TestDataFactory, MockHelpers } from '../../../helpers/test-helpers';
import { TaskId } from '@/domain/value-objects/task-id';
import { ProjectId } from '@/domain/value-objects/project-id';
import { UserId } from '@/domain/value-objects/user-id';
import { TaskStatus } from '@/domain/value-objects/task-status';
import { Priority } from '@/domain/value-objects/priority';

describe('TaskApplicationService', () => {
  let taskApplicationService: TaskApplicationService;
  let mockTaskRepository: any;
  let mockProjectRepository: any;
  let mockUserRepository: any;
  let mockTaskDomainService: any;
  let mockEventBus: any;
  let mockTransactionManager: any;
  let mockLogger: any;

  beforeEach(() => {
    mockTaskRepository = MockHelpers.createMockRepository();
    mockProjectRepository = MockHelpers.createMockRepository();
    mockUserRepository = MockHelpers.createMockRepository();
    mockTaskDomainService = MockHelpers.createMockService();
    mockEventBus = MockHelpers.createMockEventBus();
    mockTransactionManager = {
      executeInTransaction: vi.fn(),
    };
    mockLogger = MockHelpers.createMockLogger();

    taskApplicationService = new TaskApplicationService(
      mockTaskRepository,
      mockProjectRepository,
      mockUserRepository,
      mockTaskDomainService,
      mockEventBus,
      mockTransactionManager,
      mockLogger
    );
  });

  describe('createTask', () => {
    it('should create a task successfully', async () => {
      const projectId = new ProjectId('project-123');
      const assigneeId = new UserId('user-123');
      const creatorId = new UserId('creator-123');

      const command = new CreateTaskCommand(
        projectId.getValue(),
        assigneeId.getValue(),
        creatorId.getValue(),
        'Test Task',
        'Task description',
        'MEDIUM',
        new Date('2024-12-31'),
        8
      );

      const project = TestDataFactory.createProject(
        TestDataFactory.createWorkspace().getId(),
        creatorId,
        { id: projectId }
      );
      const assignee = TestDataFactory.createUser({ id: assigneeId });
      const creator = TestDataFactory.createUser({ id: creatorId });

      mockProjectRepository.findById.mockResolvedValue(project);
      mockUserRepository.findById
        .mockResolvedValueOnce(assignee)
        .mockResolvedValueOnce(creator);
      mockTaskDomainService.canAssignTask.mockResolvedValue(true);
      mockTaskRepository.save.mockResolvedValue(undefined);
      mockTransactionManager.executeInTransaction.mockImplementation(
        async (callback: Function) => await callback()
      );

      const result = await taskApplicationService.createTask(command);

      expect(result).toBeDefined();
      expect(result.title).toBe('Test Task');
      expect(result.description).toBe('Task description');
      expect(mockTaskRepository.save).toHaveBeenCalled();
      expect(mockEventBus.publish).toHaveBeenCalled();
    });

    it('should throw error when project is not found', async () => {
      const command = new CreateTaskCommand(
        'project-123',
        'user-123',
        'creator-123',
        'Test Task',
        'Task description',
        'MEDIUM',
        new Date('2024-12-31'),
        8
      );

      mockProjectRepository.findById.mockResolvedValue(null);

      await expect(taskApplicationService.createTask(command)).rejects.toThrow(
        'Project not found'
      );
    });

    it('should throw error when assignee is not found', async () => {
      const projectId = new ProjectId('project-123');
      const creatorId = new UserId('creator-123');

      const command = new CreateTaskCommand(
        'project-123',
        'user-123',
        'creator-123',
        'Test Task',
        'Task description',
        'MEDIUM',
        new Date('2024-12-31'),
        8
      );

      const project = TestDataFactory.createProject(
        TestDataFactory.createWorkspace().getId(),
        creatorId,
        { id: projectId }
      );

      mockProjectRepository.findById.mockResolvedValue(project);
      mockUserRepository.findById.mockResolvedValueOnce(null);

      await expect(taskApplicationService.createTask(command)).rejects.toThrow(
        'Assignee not found'
      );
    });

    it('should throw error when creator is not found', async () => {
      const projectId = new ProjectId('project-123');
      const assigneeId = new UserId('user-123');
      const creatorId = new UserId('creator-123');

      const command = new CreateTaskCommand(
        'project-123',
        'user-123',
        'creator-123',
        'Test Task',
        'Task description',
        'MEDIUM',
        new Date('2024-12-31'),
        8
      );

      const project = TestDataFactory.createProject(
        TestDataFactory.createWorkspace().getId(),
        creatorId,
        { id: projectId }
      );
      const assignee = TestDataFactory.createUser({ id: assigneeId });

      mockProjectRepository.findById.mockResolvedValue(project);
      mockUserRepository.findById
        .mockResolvedValueOnce(assignee)
        .mockResolvedValueOnce(null);

      await expect(taskApplicationService.createTask(command)).rejects.toThrow(
        'Creator not found'
      );
    });

    it('should throw error when user cannot be assigned to task', async () => {
      const projectId = new ProjectId('project-123');
      const assigneeId = new UserId('user-123');
      const creatorId = new UserId('creator-123');

      const command = new CreateTaskCommand(
        'project-123',
        'user-123',
        'creator-123',
        'Test Task',
        'Task description',
        'MEDIUM',
        new Date('2024-12-31'),
        8
      );

      const project = TestDataFactory.createProject(
        TestDataFactory.createWorkspace().getId(),
        creatorId,
        { id: projectId }
      );
      const assignee = TestDataFactory.createUser({ id: assigneeId });
      const creator = TestDataFactory.createUser({ id: creatorId });

      mockProjectRepository.findById.mockResolvedValue(project);
      mockUserRepository.findById
        .mockResolvedValueOnce(assignee)
        .mockResolvedValueOnce(creator);
      mockTaskDomainService.canAssignTask.mockResolvedValue(false);

      await expect(taskApplicationService.createTask(command)).rejects.toThrow(
        'User cannot be assigned to this task'
      );
    });
  });

  describe('updateTask', () => {
    it('should update task successfully', async () => {
      const taskId = new TaskId('task-123');
      const projectId = new ProjectId('project-123');
      const assigneeId = new UserId('user-123');
      const creatorId = new UserId('creator-123');

      const existingTask = TestDataFactory.createTask(
        projectId,
        assigneeId,
        creatorId,
        {
          id: taskId,
        }
      );

      mockTaskRepository.findById.mockResolvedValue(existingTask);
      mockTaskRepository.save.mockResolvedValue(undefined);
      mockTransactionManager.executeInTransaction.mockImplementation(
        async (callback: Function) => await callback()
      );

      const result = await taskApplicationService.updateTask(
        taskId.getValue(),
        {
          title: 'Updated Task',
          description: 'Updated description',
          priority: 'HIGH',
        }
      );

      expect(result).toBeDefined();
      expect(result.title).toBe('Updated Task');
      expect(result.description).toBe('Updated description');
      expect(mockTaskRepository.save).toHaveBeenCalled();
      expect(mockEventBus.publish).toHaveBeenCalled();
    });

    it('should throw error when task is not found', async () => {
      const taskId = 'task-123';

      mockTaskRepository.findById.mockResolvedValue(null);

      await expect(
        taskApplicationService.updateTask(taskId, {
          title: 'Updated Task',
        })
      ).rejects.toThrow('Task not found');
    });
  });

  describe('assignTask', () => {
    it('should assign task successfully', async () => {
      const taskId = new TaskId('task-123');
      const projectId = new ProjectId('project-123');
      const oldAssigneeId = new UserId('old-user-123');
      const newAssigneeId = new UserId('new-user-123');
      const creatorId = new UserId('creator-123');

      const existingTask = TestDataFactory.createTask(
        projectId,
        oldAssigneeId,
        creatorId,
        {
          id: taskId,
        }
      );

      mockTaskRepository.findById.mockResolvedValue(existingTask);
      mockTaskDomainService.canAssignTask.mockResolvedValue(true);
      mockTaskRepository.save.mockResolvedValue(undefined);
      mockTransactionManager.executeInTransaction.mockImplementation(
        async (callback: Function) => await callback()
      );

      const result = await taskApplicationService.assignTask(
        taskId.getValue(),
        newAssigneeId.getValue()
      );

      expect(result).toBeDefined();
      expect(result.assigneeId).toBe(newAssigneeId.getValue());
      expect(mockTaskRepository.save).toHaveBeenCalled();
      expect(mockEventBus.publish).toHaveBeenCalled();
    });

    it('should throw error when task cannot be assigned', async () => {
      const taskId = new TaskId('task-123');
      const projectId = new ProjectId('project-123');
      const assigneeId = new UserId('user-123');
      const creatorId = new UserId('creator-123');

      const existingTask = TestDataFactory.createTask(
        projectId,
        assigneeId,
        creatorId,
        {
          id: taskId,
        }
      );

      mockTaskRepository.findById.mockResolvedValue(existingTask);
      mockTaskDomainService.canAssignTask.mockResolvedValue(false);

      await expect(
        taskApplicationService.assignTask(taskId.getValue(), 'new-user-123')
      ).rejects.toThrow('User cannot be assigned to this task');
    });
  });

  describe('startTask', () => {
    it('should start task successfully', async () => {
      const taskId = new TaskId('task-123');
      const projectId = new ProjectId('project-123');
      const assigneeId = new UserId('user-123');
      const creatorId = new UserId('creator-123');

      const existingTask = TestDataFactory.createTask(
        projectId,
        assigneeId,
        creatorId,
        {
          id: taskId,
        }
      );

      mockTaskRepository.findById.mockResolvedValue(existingTask);
      mockTaskRepository.save.mockResolvedValue(undefined);
      mockTransactionManager.executeInTransaction.mockImplementation(
        async (callback: Function) => await callback()
      );

      const result = await taskApplicationService.startTask(taskId.getValue());

      expect(result).toBeDefined();
      expect(result.status).toBe('IN_PROGRESS');
      expect(mockTaskRepository.save).toHaveBeenCalled();
      expect(mockEventBus.publish).toHaveBeenCalled();
    });

    it('should throw error when task is not found', async () => {
      const taskId = 'task-123';

      mockTaskRepository.findById.mockResolvedValue(null);

      await expect(taskApplicationService.startTask(taskId)).rejects.toThrow(
        'Task not found'
      );
    });
  });

  describe('completeTask', () => {
    it('should complete task successfully', async () => {
      const taskId = new TaskId('task-123');
      const projectId = new ProjectId('project-123');
      const assigneeId = new UserId('user-123');
      const creatorId = new UserId('creator-123');

      const existingTask = TestDataFactory.createTask(
        projectId,
        assigneeId,
        creatorId,
        {
          id: taskId,
        }
      );
      existingTask.start(); // Task must be started before it can be completed

      mockTaskRepository.findById.mockResolvedValue(existingTask);
      mockTaskRepository.save.mockResolvedValue(undefined);
      mockTransactionManager.executeInTransaction.mockImplementation(
        async (callback: Function) => await callback()
      );

      const result = await taskApplicationService.completeTask(
        taskId.getValue()
      );

      expect(result).toBeDefined();
      expect(result.status).toBe('COMPLETED');
      expect(mockTaskRepository.save).toHaveBeenCalled();
      expect(mockEventBus.publish).toHaveBeenCalled();
    });

    it('should throw error when task cannot be completed', async () => {
      const taskId = new TaskId('task-123');
      const projectId = new ProjectId('project-123');
      const assigneeId = new UserId('user-123');
      const creatorId = new UserId('creator-123');

      const existingTask = TestDataFactory.createTask(
        projectId,
        assigneeId,
        creatorId,
        {
          id: taskId,
        }
      );
      // Task is in TODO status, cannot be completed directly

      mockTaskRepository.findById.mockResolvedValue(existingTask);

      await expect(
        taskApplicationService.completeTask(taskId.getValue())
      ).rejects.toThrow();
    });
  });

  describe('deleteTask', () => {
    it('should delete task successfully', async () => {
      const taskId = new TaskId('task-123');
      const userId = new UserId('user-123');
      const projectId = new ProjectId('project-123');
      const creatorId = new UserId('creator-123');

      const existingTask = TestDataFactory.createTask(
        projectId,
        userId,
        creatorId,
        {
          id: taskId,
        }
      );

      mockTaskRepository.findById.mockResolvedValue(existingTask);
      mockTaskDomainService.canDeleteTask.mockResolvedValue(true);
      mockTaskRepository.delete.mockResolvedValue(undefined);
      mockTransactionManager.executeInTransaction.mockImplementation(
        async (callback: Function) => await callback()
      );

      await taskApplicationService.deleteTask(
        taskId.getValue(),
        userId.getValue()
      );

      expect(mockTaskRepository.delete).toHaveBeenCalledWith(taskId);
      expect(mockEventBus.publish).toHaveBeenCalled();
    });

    it('should throw error when user cannot delete task', async () => {
      const taskId = new TaskId('task-123');
      const userId = new UserId('user-123');
      const projectId = new ProjectId('project-123');
      const creatorId = new UserId('creator-123');

      const existingTask = TestDataFactory.createTask(
        projectId,
        userId,
        creatorId,
        {
          id: taskId,
        }
      );

      mockTaskRepository.findById.mockResolvedValue(existingTask);
      mockTaskDomainService.canDeleteTask.mockResolvedValue(false);

      await expect(
        taskApplicationService.deleteTask(taskId.getValue(), userId.getValue())
      ).rejects.toThrow('User cannot delete this task');
    });
  });

  describe('getTasksByProject', () => {
    it('should return tasks for project', async () => {
      const projectId = 'project-123';
      const tasks = [
        TestDataFactory.createTask(
          new ProjectId(projectId),
          new UserId('user-123'),
          new UserId('creator-123')
        ),
        TestDataFactory.createTask(
          new ProjectId(projectId),
          new UserId('user-456'),
          new UserId('creator-123')
        ),
      ];

      mockTaskRepository.findByProjectId.mockResolvedValue(tasks);

      const result = await taskApplicationService.getTasksByProject(projectId);

      expect(result).toHaveLength(2);
      expect(mockTaskRepository.findByProjectId).toHaveBeenCalledWith(
        new ProjectId(projectId)
      );
    });
  });

  describe('getTasksByAssignee', () => {
    it('should return tasks for assignee', async () => {
      const assigneeId = 'user-123';
      const tasks = [
        TestDataFactory.createTask(
          new ProjectId('project-123'),
          new UserId(assigneeId),
          new UserId('creator-123')
        ),
        TestDataFactory.createTask(
          new ProjectId('project-456'),
          new UserId(assigneeId),
          new UserId('creator-123')
        ),
      ];

      mockTaskRepository.findByAssigneeId.mockResolvedValue(tasks);

      const result =
        await taskApplicationService.getTasksByAssignee(assigneeId);

      expect(result).toHaveLength(2);
      expect(mockTaskRepository.findByAssigneeId).toHaveBeenCalledWith(
        new UserId(assigneeId)
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle repository errors gracefully', async () => {
      const command = new CreateTaskCommand(
        'project-123',
        'user-123',
        'creator-123',
        'Test Task',
        'Task description',
        'MEDIUM',
        new Date('2024-12-31'),
        8
      );

      mockProjectRepository.findById.mockRejectedValue(
        new Error('Database error')
      );

      await expect(taskApplicationService.createTask(command)).rejects.toThrow(
        'Database error'
      );
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should rollback transaction on error', async () => {
      const command = new CreateTaskCommand(
        'project-123',
        'user-123',
        'creator-123',
        'Test Task',
        'Task description',
        'MEDIUM',
        new Date('2024-12-31'),
        8
      );

      mockTransactionManager.executeInTransaction.mockRejectedValue(
        new Error('Transaction failed')
      );

      await expect(taskApplicationService.createTask(command)).rejects.toThrow(
        'Transaction failed'
      );
    });
  });
});
