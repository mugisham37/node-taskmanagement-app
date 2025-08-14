import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TaskRepository } from '@/infrastructure/database/repositories/task-repository';
import { Task } from '@/domain/entities/task';
import { TaskId } from '@/domain/value-objects/task-id';
import { ProjectId } from '@/domain/value-objects/project-id';
import { UserId } from '@/domain/value-objects/user-id';
import { TaskStatus } from '@/domain/value-objects/task-status';
import { Priority } from '@/domain/value-objects/priority';
import { TestDataFactory, DatabaseHelpers } from '../../helpers/test-helpers';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

describe('TaskRepository Integration Tests', () => {
  let taskRepository: TaskRepository;
  let database: any;
  let connection: any;

  beforeEach(async () => {
    // Setup test database connection
    connection = postgres(
      process.env.TEST_DATABASE_URL ||
        'postgresql://test:test@localhost:5432/test_db'
    );
    database = drizzle(connection);

    taskRepository = new TaskRepository(database, console);

    // Clean database before each test
    await DatabaseHelpers.cleanupDatabase();
    await DatabaseHelpers.seedTestData();
  });

  afterEach(async () => {
    await DatabaseHelpers.cleanupDatabase();
    await connection.end();
  });

  describe('CRUD Operations', () => {
    it('should create and retrieve a task', async () => {
      const task = TestDataFactory.createTask(
        new ProjectId('project-123'),
        new UserId('user-123'),
        new UserId('creator-123'),
        {
          title: 'Integration Test Task',
          description: 'This is a test task for integration testing',
          priority: 'HIGH',
          estimatedHours: 8,
        }
      );

      // Save the task
      await taskRepository.save(task);

      // Retrieve the task
      const retrievedTask = await taskRepository.findById(task.getId());

      expect(retrievedTask).not.toBeNull();
      expect(retrievedTask?.getId().getValue()).toBe(task.getId().getValue());
      expect(retrievedTask?.getTitle()).toBe('Integration Test Task');
      expect(retrievedTask?.getDescription()).toBe(
        'This is a test task for integration testing'
      );
      expect(retrievedTask?.getPriority().getValue()).toBe('HIGH');
      expect(retrievedTask?.getEstimatedHours()).toBe(8);
    });

    it('should update an existing task', async () => {
      const task = TestDataFactory.createTask(
        new ProjectId('project-123'),
        new UserId('user-123'),
        new UserId('creator-123')
      );

      // Save the task
      await taskRepository.save(task);

      // Update the task
      task.updateDetails('Updated Title', 'Updated Description');
      task.updatePriority(new Priority('CRITICAL'));

      await taskRepository.save(task);

      // Retrieve the updated task
      const updatedTask = await taskRepository.findById(task.getId());

      expect(updatedTask?.getTitle()).toBe('Updated Title');
      expect(updatedTask?.getDescription()).toBe('Updated Description');
      expect(updatedTask?.getPriority().getValue()).toBe('CRITICAL');
    });

    it('should delete a task', async () => {
      const task = TestDataFactory.createTask(
        new ProjectId('project-123'),
        new UserId('user-123'),
        new UserId('creator-123')
      );

      // Save the task
      await taskRepository.save(task);

      // Verify task exists
      const existsBefore = await taskRepository.exists(task.getId());
      expect(existsBefore).toBe(true);

      // Delete the task
      await taskRepository.delete(task.getId());

      // Verify task no longer exists
      const existsAfter = await taskRepository.exists(task.getId());
      expect(existsAfter).toBe(false);

      const deletedTask = await taskRepository.findById(task.getId());
      expect(deletedTask).toBeNull();
    });
  });

  describe('Query Operations', () => {
    beforeEach(async () => {
      // Create test data
      const tasks = [
        TestDataFactory.createTask(
          new ProjectId('project-123'),
          new UserId('user-123'),
          new UserId('creator-123'),
          { title: 'Task 1', status: 'TODO', priority: 'HIGH' }
        ),
        TestDataFactory.createTask(
          new ProjectId('project-123'),
          new UserId('user-456'),
          new UserId('creator-123'),
          { title: 'Task 2', status: 'IN_PROGRESS', priority: 'MEDIUM' }
        ),
        TestDataFactory.createTask(
          new ProjectId('project-456'),
          new UserId('user-123'),
          new UserId('creator-123'),
          { title: 'Task 3', status: 'COMPLETED', priority: 'LOW' }
        ),
      ];

      for (const task of tasks) {
        await taskRepository.save(task);
      }
    });

    it('should find tasks by project ID', async () => {
      const projectId = new ProjectId('project-123');
      const tasks = await taskRepository.findByProjectId(projectId);

      expect(tasks).toHaveLength(2);
      expect(
        tasks.every(task => task.getProjectId().getValue() === 'project-123')
      ).toBe(true);
    });

    it('should find tasks by assignee ID', async () => {
      const assigneeId = new UserId('user-123');
      const tasks = await taskRepository.findByAssigneeId(assigneeId);

      expect(tasks).toHaveLength(2);
      expect(
        tasks.every(task => task.getAssigneeId().getValue() === 'user-123')
      ).toBe(true);
    });

    it('should find tasks by status', async () => {
      const status = new TaskStatus('TODO');
      const tasks = await taskRepository.findByStatus(status);

      expect(tasks).toHaveLength(1);
      expect(tasks[0].getStatus().getValue()).toBe('TODO');
    });

    it('should count tasks correctly', async () => {
      const totalCount = await taskRepository.count();
      expect(totalCount).toBe(3);

      const todoCount = await taskRepository.count({ status: 'TODO' });
      expect(todoCount).toBe(1);

      const user123Count = await taskRepository.count({
        assigneeId: 'user-123',
      });
      expect(user123Count).toBe(2);
    });

    it('should find all tasks with pagination', async () => {
      const firstPage = await taskRepository.findAll({ limit: 2, offset: 0 });
      expect(firstPage).toHaveLength(2);

      const secondPage = await taskRepository.findAll({ limit: 2, offset: 2 });
      expect(secondPage).toHaveLength(1);
    });

    it('should find all tasks with filters', async () => {
      const filteredTasks = await taskRepository.findAll({
        filters: { projectId: 'project-123', status: 'TODO' },
      });

      expect(filteredTasks).toHaveLength(1);
      expect(filteredTasks[0].getProjectId().getValue()).toBe('project-123');
      expect(filteredTasks[0].getStatus().getValue()).toBe('TODO');
    });

    it('should find all tasks with sorting', async () => {
      const sortedTasks = await taskRepository.findAll({
        sort: { field: 'title', direction: 'ASC' },
      });

      expect(sortedTasks).toHaveLength(3);
      expect(sortedTasks[0].getTitle()).toBe('Task 1');
      expect(sortedTasks[1].getTitle()).toBe('Task 2');
      expect(sortedTasks[2].getTitle()).toBe('Task 3');
    });
  });

  describe('Complex Queries', () => {
    beforeEach(async () => {
      // Create overdue tasks
      const overdueDate = new Date('2020-01-01');
      const futureDate = new Date('2030-01-01');

      const tasks = [
        TestDataFactory.createTask(
          new ProjectId('project-123'),
          new UserId('user-123'),
          new UserId('creator-123'),
          {
            title: 'Overdue Task 1',
            status: 'TODO',
            dueDate: overdueDate,
          }
        ),
        TestDataFactory.createTask(
          new ProjectId('project-123'),
          new UserId('user-456'),
          new UserId('creator-123'),
          {
            title: 'Overdue Task 2',
            status: 'IN_PROGRESS',
            dueDate: overdueDate,
          }
        ),
        TestDataFactory.createTask(
          new ProjectId('project-456'),
          new UserId('user-123'),
          new UserId('creator-123'),
          {
            title: 'Future Task',
            status: 'TODO',
            dueDate: futureDate,
          }
        ),
        TestDataFactory.createTask(
          new ProjectId('project-456'),
          new UserId('user-123'),
          new UserId('creator-123'),
          {
            title: 'Completed Task',
            status: 'COMPLETED',
            dueDate: overdueDate,
          }
        ),
      ];

      for (const task of tasks) {
        await taskRepository.save(task);
      }
    });

    it('should find overdue tasks', async () => {
      const overdueTasks = await taskRepository.findOverdueTasks();

      expect(overdueTasks).toHaveLength(2);
      expect(
        overdueTasks.every(
          task =>
            task.getDueDate() &&
            task.getDueDate()! < new Date() &&
            task.getStatus().getValue() !== 'COMPLETED'
        )
      ).toBe(true);
    });

    it('should find tasks by multiple criteria', async () => {
      const tasks = await taskRepository.findAll({
        filters: {
          assigneeId: 'user-123',
          status: 'TODO',
        },
      });

      expect(tasks).toHaveLength(2);
      expect(
        tasks.every(
          task =>
            task.getAssigneeId().getValue() === 'user-123' &&
            task.getStatus().getValue() === 'TODO'
        )
      ).toBe(true);
    });
  });

  describe('Transaction Handling', () => {
    it('should handle concurrent updates correctly', async () => {
      const task = TestDataFactory.createTask(
        new ProjectId('project-123'),
        new UserId('user-123'),
        new UserId('creator-123')
      );

      await taskRepository.save(task);

      // Simulate concurrent updates
      const task1 = await taskRepository.findById(task.getId());
      const task2 = await taskRepository.findById(task.getId());

      task1!.updateDetails('Update 1', 'Description 1');
      task2!.updateDetails('Update 2', 'Description 2');

      await taskRepository.save(task1!);
      await taskRepository.save(task2!);

      // The last update should win
      const finalTask = await taskRepository.findById(task.getId());
      expect(finalTask?.getTitle()).toBe('Update 2');
      expect(finalTask?.getDescription()).toBe('Description 2');
    });
  });

  describe('Performance Tests', () => {
    it('should handle bulk operations efficiently', async () => {
      const startTime = Date.now();
      const tasks: Task[] = [];

      // Create 100 tasks
      for (let i = 0; i < 100; i++) {
        const task = TestDataFactory.createTask(
          new ProjectId(`project-${i % 10}`),
          new UserId(`user-${i % 20}`),
          new UserId('creator-123'),
          { title: `Bulk Task ${i}` }
        );
        tasks.push(task);
      }

      // Save all tasks
      for (const task of tasks) {
        await taskRepository.save(task);
      }

      const saveTime = Date.now() - startTime;
      console.log(`Bulk save took ${saveTime}ms`);

      // Query all tasks
      const queryStartTime = Date.now();
      const allTasks = await taskRepository.findAll({ limit: 1000 });
      const queryTime = Date.now() - queryStartTime;

      console.log(`Bulk query took ${queryTime}ms`);

      expect(allTasks).toHaveLength(100);
      expect(saveTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(queryTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle complex queries efficiently', async () => {
      // Create test data with various combinations
      const tasks: Task[] = [];
      for (let i = 0; i < 50; i++) {
        const task = TestDataFactory.createTask(
          new ProjectId(`project-${i % 5}`),
          new UserId(`user-${i % 10}`),
          new UserId('creator-123'),
          {
            title: `Task ${i}`,
            status: ['TODO', 'IN_PROGRESS', 'COMPLETED'][i % 3] as any,
            priority: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'][i % 4] as any,
          }
        );
        tasks.push(task);
      }

      for (const task of tasks) {
        await taskRepository.save(task);
      }

      const startTime = Date.now();

      // Complex query with multiple filters and sorting
      const complexQuery = await taskRepository.findAll({
        filters: {
          status: 'TODO',
          priority: 'HIGH',
        },
        sort: { field: 'createdAt', direction: 'DESC' },
        limit: 10,
        offset: 0,
      });

      const queryTime = Date.now() - startTime;
      console.log(`Complex query took ${queryTime}ms`);

      expect(queryTime).toBeLessThan(500); // Should complete within 500ms
      expect(
        complexQuery.every(
          task =>
            task.getStatus().getValue() === 'TODO' &&
            task.getPriority().getValue() === 'HIGH'
        )
      ).toBe(true);
    });
  });

  describe('Data Integrity', () => {
    it('should maintain referential integrity', async () => {
      const task = TestDataFactory.createTask(
        new ProjectId('project-123'),
        new UserId('user-123'),
        new UserId('creator-123')
      );

      await taskRepository.save(task);

      // Verify the task was saved with correct relationships
      const savedTask = await taskRepository.findById(task.getId());

      expect(savedTask?.getProjectId().getValue()).toBe('project-123');
      expect(savedTask?.getAssigneeId().getValue()).toBe('user-123');
      expect(savedTask?.getCreatorId().getValue()).toBe('creator-123');
    });

    it('should handle null values correctly', async () => {
      const task = TestDataFactory.createTask(
        new ProjectId('project-123'),
        new UserId('user-123'),
        new UserId('creator-123'),
        {
          description: null,
          dueDate: null,
        }
      );

      await taskRepository.save(task);

      const savedTask = await taskRepository.findById(task.getId());

      expect(savedTask?.getDescription()).toBeNull();
      expect(savedTask?.getDueDate()).toBeNull();
    });
  });
});
