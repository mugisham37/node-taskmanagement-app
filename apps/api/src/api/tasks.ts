import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc/router';
import { TaskApplicationService } from '../application/services/TaskApplicationService';
import {
  createTaskSchema,
  updateTaskSchema,
  taskFilterSchema,
} from '@taskmanagement/shared/schemas';

export const tasksRouter = router({
  create: protectedProcedure
    .input(createTaskSchema)
    .mutation(async ({ input, ctx }) => {
      const taskService = ctx.container.resolve<TaskApplicationService>(
        'TaskApplicationService'
      );

      const result = await taskService.createTask({
        ...input,
        createdBy: ctx.user.id,
      });

      if (!result.isSuccess) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: result.error || 'Task creation failed',
        });
      }

      return result.data;
    }),

  list: protectedProcedure
    .input(taskFilterSchema.optional())
    .query(async ({ input, ctx }) => {
      const taskService = ctx.container.resolve<TaskApplicationService>(
        'TaskApplicationService'
      );

      const result = await taskService.getTasks({
        ...input,
        userId: ctx.user.id,
      });

      if (!result.isSuccess) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: result.error || 'Failed to fetch tasks',
        });
      }

      return result.data;
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const taskService = ctx.container.resolve<TaskApplicationService>(
        'TaskApplicationService'
      );

      const result = await taskService.getTaskById({
        taskId: input.id,
        userId: ctx.user.id,
      });

      if (!result.isSuccess) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: result.error || 'Task not found',
        });
      }

      return result.data;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: updateTaskSchema,
      })
    )
    .mutation(async ({ input, ctx }) => {
      const taskService = ctx.container.resolve<TaskApplicationService>(
        'TaskApplicationService'
      );

      const result = await taskService.updateTask({
        taskId: input.id,
        updates: input.data,
        userId: ctx.user.id,
      });

      if (!result.isSuccess) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: result.error || 'Task update failed',
        });
      }

      return result.data;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const taskService = ctx.container.resolve<TaskApplicationService>(
        'TaskApplicationService'
      );

      const result = await taskService.deleteTask({
        taskId: input.id,
        userId: ctx.user.id,
      });

      if (!result.isSuccess) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: result.error || 'Task deletion failed',
        });
      }

      return {
        message: 'Task deleted successfully',
      };
    }),

  updateStatus: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        status: z.enum(['todo', 'in-progress', 'done']),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const taskService = ctx.container.resolve<TaskApplicationService>(
        'TaskApplicationService'
      );

      const result = await taskService.updateTaskStatus({
        taskId: input.id,
        status: input.status,
        userId: ctx.user.id,
      });

      if (!result.isSuccess) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: result.error || 'Status update failed',
        });
      }

      return result.data;
    }),

  assign: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        assigneeId: z.string().uuid(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const taskService = ctx.container.resolve<TaskApplicationService>(
        'TaskApplicationService'
      );

      const result = await taskService.assignTask({
        taskId: input.id,
        assigneeId: input.assigneeId,
        userId: ctx.user.id,
      });

      if (!result.isSuccess) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: result.error || 'Task assignment failed',
        });
      }

      return result.data;
    }),

  getByProject: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        filters: taskFilterSchema.optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const taskService = ctx.container.resolve<TaskApplicationService>(
        'TaskApplicationService'
      );

      const result = await taskService.getTasksByProject({
        projectId: input.projectId,
        userId: ctx.user.id,
        filters: input.filters,
      });

      if (!result.isSuccess) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: result.error || 'Failed to fetch project tasks',
        });
      }

      return result.data;
    }),
});
