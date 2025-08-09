import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TaskDomainService } from '@/domain/services/task-domain-service';
import { Task } from '@/domain/entities/task';
import { User } from '@/domain/entities/user';
import { Project } from '@/domain/entities/project';
import { TestDataFactory, MockHelpers } from '../../../helpers/test-helpers';
import { TaskId } from '@/domain/value-objects/task-id';
import { ProjectId } from '@/domain/value-objects/project-id';
import { UserId } from '@/domain/value-objects/user-id';
import { WorkspaceId } from '@/domain/value-objects/workspace-id';

describe('TaskDomainService', () => {
  let taskDomainService: TaskDomainService;
  let mockTaskRepository: any;
  let mockUserRepository: any;
  let mockProjectRepository: any;
  let mockLogger: any;

  beforeEach(() => {
    mockTaskRepository = MockHelpers.createMockRepository();
    mockUserRepository = MockHelpers.createMockRepository();
    mockProjectRepository = MockHelpers.createMockRepository();
    mockLogger = MockHelpers.createMockLogger();

    taskDomainService = new TaskDomainService(
      mockTaskRepository,
      mockUserRepository,
      mockProjectRepository,
      mockLogger
    );
  });

  describe('canAssignTask', () => {
    it('should return true when user can be assigned to task', async () => {
      const projectId = new ProjectId('project-123');
      const assigneeId = new UserId('user-123');
      const workspaceId = new WorkspaceId('workspace-123');
      const ownerId = new UserId('owner-123');

      const user = TestDataFactory.createUser({ id: assigneeId });
      const project = TestDataFactory.createProject(workspaceId, ownerId, {
        id: projectId,
      });
      project.addTeamMember(assigneeId, 'DEVELOPER');

      mockUserRepository.findById.mockResolvedValue(user);
      mockProjectRepository.findById.mockResolvedValue(project);

      const result = await taskDomainService.canAssignTask(
        projectId,
        assigneeId
      );

      expect(result).toBe(true);
      expect(mockUserRepository.findById).toHaveBeenCalledWith(assigneeId);
      expect(mockProjectRepository.findById).toHaveBeenCalledWith(projectId);
    });

    it('should return false when user is not found', async () => {
      const projectId = new ProjectId('project-123');
      const assigneeId = new UserId('user-123');

      mockUserRepository.findById.mockResolvedValue(null);

      const result = await taskDomainService.canAssignTask(
        projectId,
        assigneeId
      );

      expect(result).toBe(false);
    });

    it('should return false when project is not found', async () => {
      const projectId = new ProjectId('project-123');
      const assigneeId = new UserId('user-123');

      const user = TestDataFactory.createUser({ id: assigneeId });
      mockUserRepository.findById.mockResolvedValue(user);
      mockProjectRepository.findById.mockResolvedValue(null);

      const result = await taskDomainService.canAssignTask(
        projectId,
        assigneeId
      );

      expect(result).toBe(false);
    });

    it('should return false when user is not active', async () => {
      const projectId = new ProjectId('project-123');
      const assigneeId = new UserId('user-123');
      const workspaceId = new WorkspaceId('workspace-123');
      const ownerId = new UserId('owner-123');

      const user = TestDataFactory.createUser({ id: assigneeId });
      user.deactivate();
      const project = TestDataFactory.createProject(workspaceId, ownerId, {
        id: projectId,
      });

      mockUserRepository.findById.mockResolvedValue(user);
      mockProjectRepository.findById.mockResolvedValue(project);

      const result = await taskDomainService.canAssignTask(
        projectId,
        assigneeId
      );

      expect(result).toBe(false);
    });

    it('should return false when user is not a team member', async () => {
      const projectId = new ProjectId('project-123');
      const assigneeId = new UserId('user-123');
      const workspaceId = new WorkspaceId('workspace-123');
      const ownerId = new UserId('owner-123');

      const user = TestDataFactory.createUser({ id: assigneeId });
      const project = TestDataFactory.createProject(workspaceId, ownerId, {
        id: projectId,
      });

      mockUserRepository.findById.mockResolvedValue(user);
      mockProjectRepository.findById.mockResolvedValue(project);

      const result = await taskDomainService.canAssignTask(
        projectId,
        assigneeId
      );

      expect(result).toBe(false);
    });
  });

  describe('calculateTaskPriority', () => {
    it('should return HIGH priority for overdue tasks', () => {
      const overdueDate = new Date('2020-01-01');
      const task = TestDataFactory.createTask(
        new ProjectId('project-123'),
        new UserId('user-123'),
        new UserId('creator-123'),
        { dueDate: overdueDate }
      );

      const priority = taskDomainService.calculateTaskPriority(task);

      expect(priority.getValue()).toBe('HIGH');
    });

    it('should return MEDIUM priority for tasks due within 3 days', () => {
      const soonDate = new Date();
      soonDate.setDate(soonDate.getDate() + 2);

      const task = TestDataFactory.createTask(
        new ProjectId('project-123'),
        new UserId('user-123'),
        new UserId('creator-123'),
        { dueDate: soonDate }
      );

      const priority = taskDomainService.calculateTaskPriority(task);

      expect(priority.getValue()).toBe('MEDIUM');
    });

    it('should return LOW priority for tasks due in more than 7 days', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 10);

      const task = TestDataFactory.createTask(
        new ProjectId('project-123'),
        new UserId('user-123'),
        new UserId('creator-123'),
        { dueDate: futureDate }
      );

      const priority = taskDomainService.calculateTaskPriority(task);

      expect(priority.getValue()).toBe('LOW');
    });

    it('should return MEDIUM priority for tasks with no due date', () => {
      const task = TestDataFactory.createTask(
        new ProjectId('project-123'),
        new UserId('user-123'),
        new UserId('creator-123'),
        { dueDate: null }
      );

      const priority = taskDomainService.calculateTaskPriority(task);

      expect(priority.getValue()).toBe('MEDIUM');
    });
  });

  describe('validateTaskDependencies', () => {
    it('should return true when all dependencies are completed', async () => {
      const taskId = new TaskId('task-123');
      const dependencyId1 = new TaskId('dep-1');
      const dependencyId2 = new TaskId('dep-2');

      const completedTask1 = TestDataFactory.createTask(
        new ProjectId('project-123'),
        new UserId('user-123'),
        new UserId('creator-123'),
        { id: dependencyId1 }
      );
      completedTask1.start();
      completedTask1.complete();

      const completedTask2 = TestDataFactory.createTask(
        new ProjectId('project-123'),
        new UserId('user-123'),
        new UserId('creator-123'),
        { id: dependencyId2 }
      );
      completedTask2.start();
      completedTask2.complete();

      mockTaskRepository.findById
        .mockResolvedValueOnce(completedTask1)
        .mockResolvedValueOnce(completedTask2);

      const result = await taskDomainService.validateTaskDependencies(taskId, [
        dependencyId1,
        dependencyId2,
      ]);

      expect(result).toBe(true);
    });

    it('should return false when some dependencies are not completed', async () => {
      const taskId = new TaskId('task-123');
      const dependencyId1 = new TaskId('dep-1');
      const dependencyId2 = new TaskId('dep-2');

      const completedTask = TestDataFactory.createTask(
        new ProjectId('project-123'),
        new UserId('user-123'),
        new UserId('creator-123'),
        { id: dependencyId1 }
      );
      completedTask.start();
      completedTask.complete();

      const incompleteTask = TestDataFactory.createTask(
        new ProjectId('project-123'),
        new UserId('user-123'),
        new UserId('creator-123'),
        { id: dependencyId2 }
      );

      mockTaskRepository.findById
        .mockResolvedValueOnce(completedTask)
        .mockResolvedValueOnce(incompleteTask);

      const result = await taskDomainService.validateTaskDependencies(taskId, [
        dependencyId1,
        dependencyId2,
      ]);

      expect(result).toBe(false);
    });

    it('should return false when dependency task is not found', async () => {
      const taskId = new TaskId('task-123');
      const dependencyId = new TaskId('dep-1');

      mockTaskRepository.findById.mockResolvedValue(null);

      const result = await taskDomainService.validateTaskDependencies(taskId, [
        dependencyId,
      ]);

      expect(result).toBe(false);
    });
  });

  describe('canDeleteTask', () => {
    it('should return true when task can be deleted', async () => {
      const taskId = new TaskId('task-123');
      const userId = new UserId('user-123');
      const projectId = new ProjectId('project-123');
      const workspaceId = new WorkspaceId('workspace-123');

      const task = TestDataFactory.createTask(projectId, userId, userId, {
        id: taskId,
      });
      const user = TestDataFactory.createUser({ id: userId });
      const project = TestDataFactory.createProject(workspaceId, userId, {
        id: projectId,
      });

      mockTaskRepository.findById.mockResolvedValue(task);
      mockUserRepository.findById.mockResolvedValue(user);
      mockProjectRepository.findById.mockResolvedValue(project);

      const result = await taskDomainService.canDeleteTask(taskId, userId);

      expect(result).toBe(true);
    });

    it('should return false when task is not found', async () => {
      const taskId = new TaskId('task-123');
      const userId = new UserId('user-123');

      mockTaskRepository.findById.mockResolvedValue(null);

      const result = await taskDomainService.canDeleteTask(taskId, userId);

      expect(result).toBe(false);
    });

    it('should return false when user is not the creator or project owner', async () => {
      const taskId = new TaskId('task-123');
      const userId = new UserId('user-123');
      const creatorId = new UserId('creator-123');
      const ownerId = new UserId('owner-123');
      const projectId = new ProjectId('project-123');
      const workspaceId = new WorkspaceId('workspace-123');

      const task = TestDataFactory.createTask(projectId, userId, creatorId, {
        id: taskId,
      });
      const user = TestDataFactory.createUser({ id: userId });
      const project = TestDataFactory.createProject(workspaceId, ownerId, {
        id: projectId,
      });

      mockTaskRepository.findById.mockResolvedValue(task);
      mockUserRepository.findById.mockResolvedValue(user);
      mockProjectRepository.findById.mockResolvedValue(project);

      const result = await taskDomainService.canDeleteTask(taskId, userId);

      expect(result).toBe(false);
    });

    it('should return true when user is project owner', async () => {
      const taskId = new TaskId('task-123');
      const ownerId = new UserId('owner-123');
      const creatorId = new UserId('creator-123');
      const projectId = new ProjectId('project-123');
      const workspaceId = new WorkspaceId('workspace-123');

      const task = TestDataFactory.createTask(projectId, ownerId, creatorId, {
        id: taskId,
      });
      const user = TestDataFactory.createUser({ id: ownerId });
      const project = TestDataFactory.createProject(workspaceId, ownerId, {
        id: projectId,
      });

      mockTaskRepository.findById.mockResolvedValue(task);
      mockUserRepository.findById.mockResolvedValue(user);
      mockProjectRepository.findById.mockResolvedValue(project);

      const result = await taskDomainService.canDeleteTask(taskId, ownerId);

      expect(result).toBe(true);
    });
  });

  describe('getTaskWorkload', () => {
    it('should calculate user workload correctly', async () => {
      const userId = new UserId('user-123');
      const projectId = new ProjectId('project-123');

      const tasks = [
        TestDataFactory.createTask(projectId, userId, userId, {
          estimatedHours: 8,
        }),
        TestDataFactory.createTask(projectId, userId, userId, {
          estimatedHours: 4,
        }),
        TestDataFactory.createTask(projectId, userId, userId, {
          estimatedHours: 6,
        }),
      ];

      mockTaskRepository.findByAssigneeId.mockResolvedValue(tasks);

      const workload = await taskDomainService.getTaskWorkload(userId);

      expect(workload.totalTasks).toBe(3);
      expect(workload.totalEstimatedHours).toBe(18);
      expect(workload.averageHoursPerTask).toBe(6);
      expect(mockTaskRepository.findByAssigneeId).toHaveBeenCalledWith(userId);
    });

    it('should handle empty task list', async () => {
      const userId = new UserId('user-123');

      mockTaskRepository.findByAssigneeId.mockResolvedValue([]);

      const workload = await taskDomainService.getTaskWorkload(userId);

      expect(workload.totalTasks).toBe(0);
      expect(workload.totalEstimatedHours).toBe(0);
      expect(workload.averageHoursPerTask).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle repository errors gracefully', async () => {
      const projectId = new ProjectId('project-123');
      const assigneeId = new UserId('user-123');

      mockUserRepository.findById.mockRejectedValue(
        new Error('Database error')
      );

      const result = await taskDomainService.canAssignTask(
        projectId,
        assigneeId
      );

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should log errors appropriately', async () => {
      const taskId = new TaskId('task-123');
      const userId = new UserId('user-123');

      mockTaskRepository.findById.mockRejectedValue(
        new Error('Database error')
      );

      const result = await taskDomainService.canDeleteTask(taskId, userId);

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error checking task deletion permissions'),
        expect.any(Object)
      );
    });
  });
});
