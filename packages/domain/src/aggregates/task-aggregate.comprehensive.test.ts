import { beforeEach, describe, expect, it } from 'vitest';
import { Task } from '../entities/task';
import { Priority, ProjectId, TaskId, TaskStatusVO, UserId } from '../value-objects';
import { TaskAggregate } from './task-aggregate';

describe('TaskAggregate - Comprehensive Tests', () => {
  let projectId: ProjectId;
  let userId: UserId;
  let taskAggregate: TaskAggregate;

  beforeEach(() => {
    projectId = new ProjectId('project-123');
    userId = new UserId('user-456');
    taskAggregate = TaskAggregate.create(projectId);
  });

  describe('Aggregate Creation', () => {
    it('should create empty task aggregate for project', () => {
      expect(taskAggregate.projectId).toEqual(projectId);
      expect(taskAggregate.tasks).toHaveLength(0);
    });

    it('should create task aggregate with initial tasks', () => {
      const task1 = Task.create({
        id: new TaskId('task-1'),
        title: 'Task 1',
        projectId,
        status: TaskStatusVO.TODO,
        priority: Priority.MEDIUM
      });

      const task2 = Task.create({
        id: new TaskId('task-2'),
        title: 'Task 2',
        projectId,
        status: TaskStatusVO.TODO,
        priority: Priority.HIGH
      });

      const aggregateWithTasks = TaskAggregate.create(projectId, [task1, task2]);

      expect(aggregateWithTasks.tasks).toHaveLength(2);
      expect(aggregateWithTasks.getTask(task1.id)).toEqual(task1);
      expect(aggregateWithTasks.getTask(task2.id)).toEqual(task2);
    });
  });

  describe('Task Management', () => {
    let task: Task;

    beforeEach(() => {
      task = Task.create({
        id: new TaskId('task-1'),
        title: 'Test Task',
        projectId,
        status: TaskStatusVO.TODO,
        priority: Priority.MEDIUM
      });
    });

    it('should add task to aggregate', () => {
      taskAggregate.addTask(task);

      expect(taskAggregate.tasks).toHaveLength(1);
      expect(taskAggregate.getTask(task.id)).toEqual(task);
    });

    it('should update existing task', () => {
      taskAggregate.addTask(task);
      
      const updatedTask = Task.create({
        id: task.id,
        title: 'Updated Task',
        projectId,
        status: TaskStatusVO.IN_PROGRESS,
        priority: Priority.HIGH
      });

      taskAggregate.updateTask(updatedTask);

      const retrievedTask = taskAggregate.getTask(task.id);
      expect(retrievedTask?.title).toBe('Updated Task');
      expect(retrievedTask?.status).toEqual(TaskStatusVO.IN_PROGRESS);
    });

    it('should remove task from aggregate', () => {
      taskAggregate.addTask(task);
      taskAggregate.removeTask(task.id);

      expect(taskAggregate.tasks).toHaveLength(0);
      expect(taskAggregate.getTask(task.id)).toBeUndefined();
    });

    it('should throw error when adding task from different project', () => {
      const differentProjectId = new ProjectId('different-project');
      const taskFromDifferentProject = Task.create({
        id: new TaskId('task-2'),
        title: 'Different Project Task',
        projectId: differentProjectId,
        status: TaskStatusVO.TODO,
        priority: Priority.MEDIUM
      });

      expect(() => {
        taskAggregate.addTask(taskFromDifferentProject);
      }).toThrow('Task task-2 does not belong to project project-123');
    });

    it('should throw error when updating non-existent task', () => {
      const nonExistentTask = Task.create({
        id: new TaskId('non-existent'),
        title: 'Non-existent Task',
        projectId,
        status: TaskStatusVO.TODO,
        priority: Priority.MEDIUM
      });

      expect(() => {
        taskAggregate.updateTask(nonExistentTask);
      }).toThrow('Task non-existent not found in project project-123');
    });

    it('should throw error when removing non-existent task', () => {
      const nonExistentTaskId = new TaskId('non-existent');

      expect(() => {
        taskAggregate.removeTask(nonExistentTaskId);
      }).toThrow('Task non-existent not found in project project-123');
    });
  });

  describe('Task Statistics and Queries', () => {
    beforeEach(() => {
      // Add multiple tasks with different statuses
      const tasks = [
        Task.create({
          id: new TaskId('task-1'),
          title: 'Todo Task 1',
          projectId,
          status: TaskStatusVO.TODO,
          priority: Priority.MEDIUM
        }),
        Task.create({
          id: new TaskId('task-2'),
          title: 'Todo Task 2',
          projectId,
          status: TaskStatusVO.TODO,
          priority: Priority.HIGH
        }),
        Task.create({
          id: new TaskId('task-3'),
          title: 'In Progress Task',
          projectId,
          status: TaskStatusVO.IN_PROGRESS,
          priority: Priority.MEDIUM
        }),
        Task.create({
          id: new TaskId('task-4'),
          title: 'Completed Task',
          projectId,
          status: TaskStatusVO.COMPLETED,
          priority: Priority.LOW
        }),
        Task.create({
          id: new TaskId('task-5'),
          title: 'Overdue Task',
          projectId,
          status: TaskStatusVO.TODO,
          priority: Priority.HIGH,
          dueDate: new Date('2020-01-01') // Past date
        })
      ];

      tasks.forEach(task => taskAggregate.addTask(task));
    });

    it('should count tasks by status', () => {
      expect(taskAggregate.getTaskCountByStatus(TaskStatusVO.TODO)).toBe(3); // Including overdue
      expect(taskAggregate.getTaskCountByStatus(TaskStatusVO.IN_PROGRESS)).toBe(1);
      expect(taskAggregate.getTaskCountByStatus(TaskStatusVO.COMPLETED)).toBe(1);
    });

    it('should get overdue tasks', () => {
      const overdueTasks = taskAggregate.getOverdueTasks();
      
      expect(overdueTasks).toHaveLength(1);
      expect(overdueTasks[0].id.value).toBe('task-5');
    });

    it('should calculate completion percentage', () => {
      const completionPercentage = taskAggregate.getCompletionPercentage();
      
      expect(completionPercentage).toBe(20); // 1 completed out of 5 total = 20%
    });

    it('should get tasks by priority', () => {
      const highPriorityTasks = taskAggregate.getTasksByPriority(Priority.HIGH);
      
      expect(highPriorityTasks).toHaveLength(2);
      expect(highPriorityTasks.every(task => task.priority.equals(Priority.HIGH))).toBe(true);
    });

    it('should get tasks assigned to user', () => {
      // Assign some tasks to user
      const task1 = taskAggregate.getTask(new TaskId('task-1'));
      const task2 = taskAggregate.getTask(new TaskId('task-2'));
      
      task1?.assignTo(userId);
      task2?.assignTo(userId);

      const userTasks = taskAggregate.getTasksAssignedTo(userId);
      
      expect(userTasks).toHaveLength(2);
      expect(userTasks.every(task => task.assigneeId?.equals(userId))).toBe(true);
    });
  });

  describe('Business Rules and Invariants', () => {
    it('should maintain project consistency', () => {
      const task = Task.create({
        id: new TaskId('task-1'),
        title: 'Test Task',
        projectId,
        status: TaskStatusVO.TODO,
        priority: Priority.MEDIUM
      });

      taskAggregate.addTask(task);

      // Verify invariants are maintained
      const validationErrors = taskAggregate.getValidationErrors();
      expect(validationErrors).toHaveLength(0);
    });

    it('should detect invariant violations', () => {
      // This would be caught by the aggregate's invariant checking
      const differentProjectId = new ProjectId('different-project');
      
      expect(() => {
        TaskAggregate.fromPersistence({
          id: projectId.value,
          projectId,
          tasks: new Map([
            ['task-1', Task.create({
              id: new TaskId('task-1'),
              title: 'Invalid Task',
              projectId: differentProjectId, // Wrong project!
              status: TaskStatusVO.TODO,
              priority: Priority.MEDIUM
            })]
          ]),
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }).toThrow('Task task-1 does not belong to project project-123');
    });
  });

  describe('Aggregate Persistence', () => {
    it('should create snapshot for persistence', () => {
      const task = Task.create({
        id: new TaskId('task-1'),
        title: 'Test Task',
        projectId,
        status: TaskStatusVO.TODO,
        priority: Priority.MEDIUM
      });

      taskAggregate.addTask(task);

      const snapshot = taskAggregate.createSnapshot();

      expect(snapshot.id).toBe(projectId.value);
      expect(snapshot.projectId).toBe(projectId.value);
      expect(snapshot.tasks).toHaveLength(1);
      expect(snapshot.tasks[0].id).toBe('task-1');
      expect(snapshot.createdAt).toBeDefined();
      expect(snapshot.updatedAt).toBeDefined();
    });

    it('should restore from snapshot', () => {
      const task = Task.create({
        id: new TaskId('task-1'),
        title: 'Test Task',
        projectId,
        status: TaskStatusVO.TODO,
        priority: Priority.MEDIUM
      });

      taskAggregate.addTask(task);

      const snapshot = taskAggregate.createSnapshot();
      
      // Create new aggregate from snapshot
      const restoredAggregate = TaskAggregate.fromPersistence({
        id: snapshot.id,
        projectId: new ProjectId(snapshot.projectId),
        tasks: new Map([
          [task.id.value, task]
        ]),
        createdAt: new Date(snapshot.createdAt),
        updatedAt: new Date(snapshot.updatedAt)
      });

      expect(restoredAggregate.projectId.value).toBe(projectId.value);
      expect(restoredAggregate.tasks).toHaveLength(1);
      expect(restoredAggregate.getTask(task.id)).toBeDefined();
    });
  });

  describe('Task Dependencies Management', () => {
    let task1: Task;
    let task2: Task;
    let task3: Task;

    beforeEach(() => {
      task1 = Task.create({
        id: new TaskId('task-1'),
        title: 'Foundation Task',
        projectId,
        status: TaskStatusVO.TODO,
        priority: Priority.HIGH
      });

      task2 = Task.create({
        id: new TaskId('task-2'),
        title: 'Dependent Task',
        projectId,
        status: TaskStatusVO.TODO,
        priority: Priority.MEDIUM
      });

      task3 = Task.create({
        id: new TaskId('task-3'),
        title: 'Final Task',
        projectId,
        status: TaskStatusVO.TODO,
        priority: Priority.LOW
      });

      taskAggregate.addTask(task1);
      taskAggregate.addTask(task2);
      taskAggregate.addTask(task3);
    });

    it('should manage task dependencies within aggregate', () => {
      // task2 depends on task1, task3 depends on task2
      task2.addDependency(task1.id, 'FINISH_TO_START');
      task3.addDependency(task2.id, 'FINISH_TO_START');

      taskAggregate.updateTask(task2);
      taskAggregate.updateTask(task3);

      // Only task1 should be startable initially
      expect(task1.canStart(taskAggregate.tasks)).toBe(true);
      expect(task2.canStart(taskAggregate.tasks)).toBe(false);
      expect(task3.canStart(taskAggregate.tasks)).toBe(false);

      // Complete task1, now task2 should be startable
      task1.start();
      task1.complete();
      taskAggregate.updateTask(task1);

      expect(task2.canStart(taskAggregate.tasks)).toBe(true);
      expect(task3.canStart(taskAggregate.tasks)).toBe(false);
    });

    it('should detect circular dependencies', () => {
      task1.addDependency(task2.id, 'FINISH_TO_START');
      task2.addDependency(task1.id, 'FINISH_TO_START');

      taskAggregate.updateTask(task1);
      taskAggregate.updateTask(task2);

      expect(taskAggregate.hasCircularDependencies()).toBe(true);
    });

    it('should get critical path', () => {
      task2.addDependency(task1.id, 'FINISH_TO_START');
      task3.addDependency(task2.id, 'FINISH_TO_START');

      // Set estimated hours
      task1.setEstimatedHours(8);
      task2.setEstimatedHours(4);
      task3.setEstimatedHours(2);

      taskAggregate.updateTask(task1);
      taskAggregate.updateTask(task2);
      taskAggregate.updateTask(task3);

      const criticalPath = taskAggregate.getCriticalPath();
      
      expect(criticalPath).toHaveLength(3);
      expect(criticalPath[0].id).toEqual(task1.id);
      expect(criticalPath[1].id).toEqual(task2.id);
      expect(criticalPath[2].id).toEqual(task3.id);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large number of tasks efficiently', () => {
      const startTime = Date.now();
      
      // Add 1000 tasks
      for (let i = 0; i < 1000; i++) {
        const task = Task.create({
          id: new TaskId(`task-${i}`),
          title: `Task ${i}`,
          projectId,
          status: TaskStatusVO.TODO,
          priority: Priority.MEDIUM
        });
        taskAggregate.addTask(task);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(taskAggregate.tasks).toHaveLength(1000);
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should efficiently query tasks by status', () => {
      // Add tasks with different statuses
      for (let i = 0; i < 100; i++) {
        const status = i % 3 === 0 ? TaskStatusVO.TODO : 
                      i % 3 === 1 ? TaskStatusVO.IN_PROGRESS : 
                      TaskStatusVO.COMPLETED;
        
        const task = Task.create({
          id: new TaskId(`task-${i}`),
          title: `Task ${i}`,
          projectId,
          status,
          priority: Priority.MEDIUM
        });
        taskAggregate.addTask(task);
      }

      const startTime = Date.now();
      const todoTasks = taskAggregate.getTaskCountByStatus(TaskStatusVO.TODO);
      const endTime = Date.now();

      expect(todoTasks).toBeGreaterThan(0);
      expect(endTime - startTime).toBeLessThan(10); // Should be very fast
    });
  });
});