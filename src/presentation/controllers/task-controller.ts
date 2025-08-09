import { FastifyRequest, FastifyReply } from 'fastify';
import { BaseController } from './base-controller';
import { LoggingService } from '../../infrastructure/monitoring/logging-service';
import { TaskApplicationService } from '../../application/services/task-application-service';
import {
  CreateTaskSchema,
  UpdateTaskSchema,
  AssignTaskSchema,
  CompleteTaskSchema,
  TaskQuerySchema,
  CreateTaskRequest,
  UpdateTaskRequest,
  AssignTaskRequest,
  CompleteTaskRequest,
  TaskQuery,
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

      const task = await this.taskService.createTask(userId, taskData);

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

      const task = await this.taskService.updateTask(userId, id, updateData);

      return task;
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

      const task = await this.taskService.assignTask(
        userId,
        id,
        assignData.assigneeId
      );

      return task;
    });
  };

  unassignTask = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    await this.handleRequest(request, reply, async () => {
      const userId = this.getUserId(request);
      const { id } = this.validateParams(request.params, ParamsSchema);

      const task = await this.taskService.unassignTask(userId, id);

      return task;
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

      const task = await this.taskService.completeTask(
        userId,
        id,
        completeData.actualHours
      );

      return task;
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
        result.tasks,
        result.total,
        query.page,
        query.limit
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
        result.tasks,
        result.total,
        query.page,
        query.limit
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
        result.tasks,
        result.total,
        query.page,
        query.limit
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

      const result = await this.taskService.getAssignedTasks(userId, query);

      await this.sendPaginated(
        reply,
        result.tasks,
        result.total,
        query.page,
        query.limit
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

      const result = await this.taskService.getOverdueTasks(userId, query);

      await this.sendPaginated(
        reply,
        result.tasks,
        result.total,
        query.page,
        query.limit
      );
    });
  };
}
