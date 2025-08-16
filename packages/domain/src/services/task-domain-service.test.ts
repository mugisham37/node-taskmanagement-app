import { beforeEach, describe, expect, it } from 'vitest';
import { Project } from '../entities/project';
import { Task } from '../entities/task';
import { User } from '../entities/user';
import {
  Email,
  Priority,
  ProjectId,
  ProjectStatusVO,
  TaskId,
  TaskStatusVO,
  UserId
} from '../value-objects';
import { TaskDomainService } from './task-domain-service';

describe('TaskDomainService', () => {
  let taskDomainService: TaskDomainService;
  let project: Project;
  let user: User;
  let task: Task;

  beforeEach(() => {
    taskDomainService = new TaskDomainService();
    
    project = Project.create({
      id: new ProjectId('project-123'),
      name: 'Test Project',
      description: 'Test Description',
      workspaceId: new WorkspaceId('workspace-456'),
      status: ProjectStatusVO.ACTIVE,
      ownerId: new UserId('owner-789')
    });

    user = User.create({
      id: new UserId('user-123'),
      email: new Email('test@example.com'),
      firstName: 'John',
      lastName: 'Doe'
    });

    task = Task.create({
      id: new TaskId('task-123'),
      title: 'Test Task',
      projectId: project.id,
      status: TaskStatusVO.TODO,
      priority: Priority.MEDIUM
    });
  });

  describe('Task Assignment Validation', () => {
    it('should validate task assignment to project member', () => {
      // Add user as project member
      project.addMember(user.id, ProjectRoleVO.MEMBER);

      const canAssign = taskDomainService.canAssignTaskToUser(task, user, project);
      
      expect(canAssign).toBe(true);
    });

    it('should reject task assignment to non-project member', () => {
      // User is not a member of the project
      const canAssign = taskDomainService.canAssignTaskToUser(task, user, project);
      
      expect(canAssign).toBe(false);
    });

    it('should allow project owner to assign tasks', () => {
      const owner = User.create({
        id: project.ownerId,
        email: new Email('owner@example.com'),
        firstName: 'Project',
        lastName: 'Owner'
      });

      const canAssign = taskDomainService.canAssignTaskToUser(task, owner, project);
      
      expect(canAssign).toBe(true);
    });
  });

  describe('Task Status Transition Validation', () => {
    it('should validate valid status transitions', () => {
      const canTransition = taskDomainService.canTransitionTaskStatus(
        task,
        TaskStatusVO.TODO,
        TaskStatusVO.IN_PROGRESS
      );
      
      expect(canTransition).toBe(true);
    });

    it('should reject invalid status transitions', () => {
      const canTransition = taskDomainService.canTransitionTaskStatus(
        task,
        TaskStatusVO.TODO,
        TaskStatusVO.COMPLETED
      );
      
      expect(canTransition).toBe(false);
    });

    it('should allow transition to blocked from any status', () => {
      const canTransitionFromTodo = taskDomainService.canTransitionTaskStatus(
        task,
        TaskStatusVO.TODO,
        TaskStatusVO.BLOCKED
      );

      const canTransitionFromInProgress = taskDomainService.canTransitionTaskStatus(
        task,
        TaskStatusVO.IN_PROGRESS,
        TaskStatusVO.BLOCKED
      );
      
      expect(canTransitionFromTodo).toBe(true);
      expect(canTransitionFromInProgress).toBe(true);
    });
  });

  describe('Task Priority Management', () => {
    it('should calculate task priority score', () => {
      const highPriorityTask = Task.create({
        id: new TaskId('high-task'),
        title: 'High Priority Task',
        projectId: project.id,
        status: TaskStatusVO.TODO,
        priority: Priority.HIGH,
        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000) // Due tomorrow
      });

      const score = taskDomainService.calculateTaskPriorityScore(highPriorityTask);
      
      expect(score).toBeGreaterThan(0);
    });

    it('should give higher scores to overdue tasks', () => {
      const overdueTask = Task.create({
        id: new TaskId('overdue-task'),
        title: 'Overdue Task',
        projectId: project.id,
        status: TaskStatusVO.TODO,
        priority: Priority.MEDIUM,
        dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000) // Due yesterday
      });

      const normalTask = Task.create({
        id: new TaskId('normal-task'),
        title: 'Normal Task',
        projectId: project.id,
        status: TaskStatusVO.TODO,
        priority: Priority.MEDIUM,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // Due next week
      });

      const overdueScore = taskDomainService.calculateTaskPriorityScore(overdueTask);
      const normalScore = taskDomainService.calculateTaskPriorityScore(normalTask);
      
      expect(overdueScore).toBeGreaterThan(normalScore);
    });
  });

  describe('Task Dependencies Validation', () => {
    it('should validate task dependency creation', () => {
      const dependentTask = Task.create({
        id: new TaskId('dependent-task'),
        title: 'Dependent Task',
        projectId: project.id,
        status: TaskStatusVO.TODO,
        priority: Priority.MEDIUM
      });

      const canCreateDependency = taskDomainService.canCreateTaskDependency(
        dependentTask,
        task,
        'FINISH_TO_START'
      );
      
      expect(canCreateDependency).toBe(true);
    });

    it('should prevent circular dependencies', () => {
      const task1 = Task.create({
        id: new TaskId('task-1'),
        title: 'Task 1',
        projectId: project.id,
        status: TaskStatusVO.TODO,
        priority: Priority.MEDIUM
      });

      const task2 = Task.create({
        id: new TaskId('task-2'),
        title: 'Task 2',
        projectId: project.id,
        status: TaskStatusVO.TODO,
        priority: Priority.MEDIUM
      });

      // Create dependency: task2 depends on task1
      task2.addDependency(task1.id, 'FINISH_TO_START');

      // Try to create circular dependency: task1 depends on task2
      const canCreateCircular = taskDomainService.canCreateTaskDependency(
        task1,
        task2,
        'FINISH_TO_START'
      );
      
      expect(canCreateCircular).toBe(false);
    });

    it('should prevent self-dependency', () => {
      const canCreateSelfDependency = taskDomainService.canCreateTaskDependency(
        task,
        task,
        'FINISH_TO_START'
      );
      
      expect(canCreateSelfDependency).toBe(false);
    });
  });

  describe('Task Completion Validation', () => {
    it('should validate task completion when all dependencies are met', () => {
      const prerequisiteTask = Task.create({
        id: new TaskId('prerequisite-task'),
        title: 'Prerequisite Task',
        projectId: project.id,
        status: TaskStatusVO.COMPLETED,
        priority: Priority.MEDIUM
      });

      task.addDependency(prerequisiteTask.id, 'FINISH_TO_START');

      const canComplete = taskDomainService.canCompleteTask(task, [prerequisiteTask]);
      
      expect(canComplete).toBe(true);
    });

    it('should prevent task completion when dependencies are not met', () => {
      const prerequisiteTask = Task.create({
        id: new TaskId('prerequisite-task'),
        title: 'Prerequisite Task',
        projectId: project.id,
        status: TaskStatusVO.TODO, // Not completed
        priority: Priority.MEDIUM
      });

      task.addDependency(prerequisiteTask.id, 'FINISH_TO_START');

      const canComplete = taskDomainService.canCompleteTask(task, [prerequisiteTask]);
      
      expect(canComplete).toBe(false);
    });

    it('should validate task completion for tasks without dependencies', () => {
      const canComplete = taskDomainService.canCompleteTask(task, []);
      
      expect(canComplete).toBe(true);
    });
  });

  describe('Task Estimation and Time Tracking', () => {
    it('should validate time estimates', () => {
      const isValidEstimate = taskDomainService.isValidTimeEstimate(8); // 8 hours
      
      expect(isValidEstimate).toBe(true);
    });

    it('should reject negative time estimates', () => {
      const isValidEstimate = taskDomainService.isValidTimeEstimate(-1);
      
      expect(isValidEstimate).toBe(false);
    });

    it('should reject unreasonably large time estimates', () => {
      const isValidEstimate = taskDomainService.isValidTimeEstimate(1000); // 1000 hours
      
      expect(isValidEstimate).toBe(false);
    });

    it('should calculate task completion percentage based on time', () => {
      const taskWithTime = Task.create({
        id: new TaskId('timed-task'),
        title: 'Timed Task',
        projectId: project.id,
        status: TaskStatusVO.IN_PROGRESS,
        priority: Priority.MEDIUM,
        estimatedHours: 10
      });

      taskWithTime.addTimeEntry(5, 'Half way done');

      const completionPercentage = taskDomainService.calculateTaskCompletionPercentage(taskWithTime);
      
      expect(completionPercentage).toBe(50);
    });
  });

  describe('Task Business Rules', () => {
    it('should enforce task title length limits', () => {
      const longTitle = 'a'.repeat(201);
      
      const isValidTitle = taskDomainService.isValidTaskTitle(longTitle);
      
      expect(isValidTitle).toBe(false);
    });

    it('should enforce task description length limits', () => {
      const longDescription = 'a'.repeat(2001);
      
      const isValidDescription = taskDomainService.isValidTaskDescription(longDescription);
      
      expect(isValidDescription).toBe(false);
    });

    it('should validate due date is not in the past', () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      const isValidDueDate = taskDomainService.isValidDueDate(pastDate);
      
      expect(isValidDueDate).toBe(false);
    });

    it('should validate future due dates', () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
      
      const isValidDueDate = taskDomainService.isValidDueDate(futureDate);
      
      expect(isValidDueDate).toBe(true);
    });
  });

  describe('Task Sorting and Filtering', () => {
    it('should sort tasks by priority and due date', () => {
      const tasks = [
        Task.create({
          id: new TaskId('low-task'),
          title: 'Low Priority Task',
          projectId: project.id,
          status: TaskStatusVO.TODO,
          priority: Priority.LOW,
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        }),
        Task.create({
          id: new TaskId('high-task'),
          title: 'High Priority Task',
          projectId: project.id,
          status: TaskStatusVO.TODO,
          priority: Priority.HIGH,
          dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
        }),
        Task.create({
          id: new TaskId('medium-task'),
          title: 'Medium Priority Task',
          projectId: project.id,
          status: TaskStatusVO.TODO,
          priority: Priority.MEDIUM,
          dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000)
        })
      ];

      const sortedTasks = taskDomainService.sortTasksByPriorityAndDueDate(tasks);
      
      // Should be sorted by priority first, then by due date
      expect(sortedTasks[0].priority).toEqual(Priority.HIGH);
      expect(sortedTasks[1].priority).toEqual(Priority.MEDIUM);
      expect(sortedTasks[2].priority).toEqual(Priority.LOW);
    });

    it('should filter overdue tasks', () => {
      const tasks = [
        Task.create({
          id: new TaskId('overdue-task'),
          title: 'Overdue Task',
          projectId: project.id,
          status: TaskStatusVO.TODO,
          priority: Priority.MEDIUM,
          dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000)
        }),
        Task.create({
          id: new TaskId('future-task'),
          title: 'Future Task',
          projectId: project.id,
          status: TaskStatusVO.TODO,
          priority: Priority.MEDIUM,
          dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000)
        })
      ];

      const overdueTasks = taskDomainService.filterOverdueTasks(tasks);
      
      expect(overdueTasks).toHaveLength(1);
      expect(overdueTasks[0].id.value).toBe('overdue-task');
    });
  });
});