import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc/router';
import { ProjectApplicationService } from '../application/services/ProjectApplicationService';
import {
  createProjectSchema,
  updateProjectSchema,
  projectFilterSchema,
} from '@taskmanagement/shared/schemas';

export const projectsRouter = router({
  create: protectedProcedure
    .input(createProjectSchema)
    .mutation(async ({ input, ctx }) => {
      const projectService = ctx.container.resolve<ProjectApplicationService>(
        'ProjectApplicationService'
      );

      const result = await projectService.createProject({
        ...input,
        ownerId: ctx.user.id,
      });

      if (!result.isSuccess) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: result.error || 'Project creation failed',
        });
      }

      return result.data;
    }),

  list: protectedProcedure
    .input(projectFilterSchema.optional())
    .query(async ({ input, ctx }) => {
      const projectService = ctx.container.resolve<ProjectApplicationService>(
        'ProjectApplicationService'
      );

      const result = await projectService.getProjects({
        ...input,
        userId: ctx.user.id,
      });

      if (!result.isSuccess) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: result.error || 'Failed to fetch projects',
        });
      }

      return result.data;
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const projectService = ctx.container.resolve<ProjectApplicationService>(
        'ProjectApplicationService'
      );

      const result = await projectService.getProjectById({
        projectId: input.id,
        userId: ctx.user.id,
      });

      if (!result.isSuccess) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: result.error || 'Project not found',
        });
      }

      return result.data;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: updateProjectSchema,
      })
    )
    .mutation(async ({ input, ctx }) => {
      const projectService = ctx.container.resolve<ProjectApplicationService>(
        'ProjectApplicationService'
      );

      const result = await projectService.updateProject({
        projectId: input.id,
        updates: input.data,
        userId: ctx.user.id,
      });

      if (!result.isSuccess) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: result.error || 'Project update failed',
        });
      }

      return result.data;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const projectService = ctx.container.resolve<ProjectApplicationService>(
        'ProjectApplicationService'
      );

      const result = await projectService.deleteProject({
        projectId: input.id,
        userId: ctx.user.id,
      });

      if (!result.isSuccess) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: result.error || 'Project deletion failed',
        });
      }

      return {
        message: 'Project deleted successfully',
      };
    }),

  addMember: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        userId: z.string().uuid(),
        role: z.enum(['member', 'admin']).default('member'),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const projectService = ctx.container.resolve<ProjectApplicationService>(
        'ProjectApplicationService'
      );

      const result = await projectService.addProjectMember({
        projectId: input.id,
        userId: input.userId,
        role: input.role,
        addedBy: ctx.user.id,
      });

      if (!result.isSuccess) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: result.error || 'Failed to add project member',
        });
      }

      return result.data;
    }),

  removeMember: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        userId: z.string().uuid(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const projectService = ctx.container.resolve<ProjectApplicationService>(
        'ProjectApplicationService'
      );

      const result = await projectService.removeProjectMember({
        projectId: input.id,
        userId: input.userId,
        removedBy: ctx.user.id,
      });

      if (!result.isSuccess) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: result.error || 'Failed to remove project member',
        });
      }

      return {
        message: 'Project member removed successfully',
      };
    }),

  getMembers: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const projectService = ctx.container.resolve<ProjectApplicationService>(
        'ProjectApplicationService'
      );

      const result = await projectService.getProjectMembers({
        projectId: input.id,
        userId: ctx.user.id,
      });

      if (!result.isSuccess) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: result.error || 'Failed to fetch project members',
        });
      }

      return result.data;
    }),
});
