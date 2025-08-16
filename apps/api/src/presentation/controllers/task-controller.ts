import { FastifyRequest, FastifyReply } from 'fastify';
import { BaseController } from './base-controller';
import { LoggingService } from '../../infrastructure/monitoring/logging-service';
import { TaskApplicationService } from '../../application/services/task-application-service';
import { TaskId } from '../../domain/value-objects/task-id';
import { UserId } from '../../domain/value-objects/user-id';
import { ProjectId } from '../../domain/value-objects/project-id';
import { Priority } from '../../domain/value-objects/priority';
import {
  CreateTaskSchema,
  UpdateTaskSchema,
  AssignTaskSchema,
  CompleteTaskSchema,
  TaskQuerySchema,
} from '../dto/task-dto';
import { z } from 'zod';

const ParamsSchema = z.object({
  id: z.string(),
});

const ProjectParamsSchema = z.object({
  projectId: z.string(),
});

export class TaskController extends BaseController {
  constructor(
    logger: LoggingService,
    private readonly taskService: TaskApplicationService
  ) {
    super(logger);
  }

  createTask = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    await this.handleRequest(request, reply, async () => {
      const userId = this.getUserId(request);
      const taskData = this.validateBody(request.body, CreateTaskSchema);

      const task = await this.taskService.createTask({
        projectId: new ProjectId(taskData.projectId),
        title: taskData.title,
        priority: Priority.fromString(taskData.priority),
        createdById: new UserId(userId),
        description: taskData.description || '',
        assigneeId: taskData.assigneeId ? new UserId(taskData.assigneeId) : undefined,
        dueDate: taskData.dueDate || undefined,
        estimatedHours: taskData.estimatedHours || undefined
      });

      await this.sendCreated(reply, task);
    });
  };

  getTask = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    await this.handleRequest(request, reply, async () => {
      const userId = this.getUserId(request);
      const { id } = this.validateParams(request.params, ParamsSchema);

      const task = await this.taskService.getTask(userId, id);

      return task;
    });
  };

  updateTask = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    await this.handleRequest(request, reply, async () => {
      const userId = this.getUserId(request);
      const { id } = this.validateParams(request.params, ParamsSchema);
      const updateData = this.validateBody(request.body, UpdateTaskSchema);

      await this.taskService.updateTask({
        taskId: new TaskId(id),
        userId: new UserId(userId),
        ...(updateData.title && { title: updateData.title }),
        ...(updateData.description && { description: updateData.description }),
        ...(updateData.priority && { priority: Priority.fromString(updateData.priority) }),
        ...(updateData.assigneeId && { assigneeId: new UserId(updateData.assigneeId) }),
        ...(updateData.dueDate && { dueDate: updateData.dueDate }),
        ...(updateData.estimatedHours && { estimatedHours: updateData.estimatedHours })
      });

      return { success: true, message: 'Task updated successfully' };
    });
  };

  deleteTask = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    await this.handleRequest(request, reply, async () => {
      const userId = this.getUserId(request);
      const { id } = this.validateParams(request.params, ParamsSchema);

      await this.taskService.deleteTask(userId, id);

      await this.sendNoContent(reply);
    });
  };

  assignTask = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    await this.handleRequest(request, reply, async () => {
      const userId = this.getUserId(request);
      const { id } = this.validateParams(request.params, ParamsSchema);
      const assignData = this.validateBody(request.body, AssignTaskSchema);

      await this.taskService.assignTask({
        taskId: new TaskId(id),
        assigneeId: new UserId(assignData.assigneeId),
        assignedBy: new UserId(userId)
      });

      return { success: true, message: 'Task assigned successfully' };
    });
  };

  unassignTask = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    await this.handleRequest(request, reply, async () => {
      const userId = this.getUserId(request);
      const { id } = this.validateParams(request.params, ParamsSchema);

      await this.taskService.unassignTask(userId, id);

      return { success: true, message: 'Task unassigned successfully' };
    });
  };

  completeTask = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    await this.handleRequest(request, reply, async () => {
      const userId = this.getUserId(request);
      const { id } = this.validateParams(request.params, ParamsSchema);
      const completeData = this.validateBody(request.body, CompleteTaskSchema);

      await this.taskService.completeTask({
        taskId: new TaskId(id),
        completedBy: new UserId(userId),
        actualHours: completeData.actualHours || 0
      });

      return { success: true, message: 'Task completed successfully' };
    });
  };

  reopenTask = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    await this.handleRequest(request, reply, async () => {
      const userId = this.getUserId(request);
      const { id } = this.validateParams(request.params, ParamsSchema);

      const task = await this.taskService.reopenTask(userId, id);

      return task;
    });
  };

  startTask = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    await this.handleRequest(request, reply, async () => {
      const userId = this.getUserId(request);
      const { id } = this.validateParams(request.params, ParamsSchema);

      const task = await this.taskService.startTask(userId, id);

      return task;
    });
  };

  submitForReview = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    await this.handleRequest(request, reply, async () => {
      const userId = this.getUserId(request);
      const { id } = this.validateParams(request.params, ParamsSchema);

      const task = await this.taskService.submitForReview(userId, id);

      return task;
    });
  };

  cancelTask = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    await this.handleRequest(request, reply, async () => {
      const userId = this.getUserId(request);
      const { id } = this.validateParams(request.params, ParamsSchema);

      const task = await this.taskService.cancelTask(userId, id);

      return task;
    });
  };

  getTasks = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    await this.handleRequest(request, reply, async () => {
      const userId = this.getUserId(request);
      const query = this.validateQuery(request.query, TaskQuerySchema);

      const result = await this.taskService.getTasks(userId, query);

      await this.sendPaginated(
        reply,
        result.data || [],
        result.total || 0,
        query.page || 1,
        query.limit || 20
      );
    });
  };

  getProjectTasks = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    await this.handleRequest(request, reply, async () => {
      const userId = this.getUserId(request);
      const { projectId } = this.validateParams(
        request.params,
        ProjectParamsSchema
      );
      const query = this.validateQuery(request.query, TaskQuerySchema);

      const result = await this.taskService.getProjectTasks(
        userId,
        projectId,
        query
      );

      await this.sendPaginated(
        reply,
        result.data,
        result.total,
        query.page || 1,
        query.limit || 20
      );
    });
  };

  getMyTasks = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    await this.handleRequest(request, reply, async () => {
      const userId = this.getUserId(request);
      const query = this.validateQuery(request.query, TaskQuerySchema);

      const result = await this.taskService.getMyTasks(userId, query);

      await this.sendPaginated(
        reply,
        result.data,
        result.total,
        query.page || 1,
        query.limit || 20
      );
    });
  };

  getAssignedTasks = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    await this.handleRequest(request, reply, async () => {
      const userId = this.getUserId(request);
      const query = this.validateQuery(request.query, TaskQuerySchema);

      const result = await this.taskService.getAssignedTasks(userId, userId, query);

      await this.sendPaginated(
        reply,
        result.data,
        result.total,
        query.page || 1,
        query.limit || 20
      );
    });
  };

  getOverdueTasks = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    await this.handleRequest(request, reply, async () => {
      const userId = this.getUserId(request);
      const query = this.validateQuery(request.query, TaskQuerySchema);

      const result = await this.taskService.getOverdueTasksForUser(userId, query);

      await this.sendPaginated(
        reply,
        result.data,
        result.total,
        query.page || 1,
        query.limit || 20
      );
    });
  };
}
