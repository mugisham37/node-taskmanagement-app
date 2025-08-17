import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure, adminProcedure } from '../trpc/router';
import { UserApplicationService } from '../application/services/UserApplicationService';
import {
  updateUserSchema,
  userFilterSchema,
} from '@taskmanagement/shared/schemas';

export const usersRouter = router({
  list: adminProcedure
    .input(userFilterSchema.optional())
    .query(async ({ input, ctx }) => {
      const userService = ctx.container.resolve<UserApplicationService>(
        'UserApplicationService'
      );

      const result = await userService.getUsers({
        ...input,
        requestedBy: ctx.user.id,
      });

      if (!result.isSuccess) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: result.error || 'Failed to fetch users',
        });
      }

      return result.data;
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const userService = ctx.container.resolve<UserApplicationService>(
        'UserApplicationService'
      );

      // Users can only view their own profile unless they're admin
      if (input.id !== ctx.user.id && !ctx.user.isAdmin()) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Access denied',
        });
      }

      const result = await userService.getUserById({
        userId: input.id,
        requestedBy: ctx.user.id,
      });

      if (!result.isSuccess) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: result.error || 'User not found',
        });
      }

      return result.data;
    }),

  updateProfile: protectedProcedure
    .input(updateUserSchema)
    .mutation(async ({ input, ctx }) => {
      const userService = ctx.container.resolve<UserApplicationService>(
        'UserApplicationService'
      );

      const result = await userService.updateUser({
        userId: ctx.user.id,
        updates: input,
        updatedBy: ctx.user.id,
      });

      if (!result.isSuccess) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: result.error || 'Profile update failed',
        });
      }

      return result.data;
    }),

  updateUser: adminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: updateUserSchema,
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userService = ctx.container.resolve<UserApplicationService>(
        'UserApplicationService'
      );

      const result = await userService.updateUser({
        userId: input.id,
        updates: input.data,
        updatedBy: ctx.user.id,
      });

      if (!result.isSuccess) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: result.error || 'User update failed',
        });
      }

      return result.data;
    }),

  deactivateUser: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const userService = ctx.container.resolve<UserApplicationService>(
        'UserApplicationService'
      );

      const result = await userService.deactivateUser({
        userId: input.id,
        deactivatedBy: ctx.user.id,
      });

      if (!result.isSuccess) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: result.error || 'User deactivation failed',
        });
      }

      return {
        message: 'User deactivated successfully',
      };
    }),

  activateUser: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const userService = ctx.container.resolve<UserApplicationService>(
        'UserApplicationService'
      );

      const result = await userService.activateUser({
        userId: input.id,
        activatedBy: ctx.user.id,
      });

      if (!result.isSuccess) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: result.error || 'User activation failed',
        });
      }

      return {
        message: 'User activated successfully',
      };
    }),

  search: protectedProcedure
    .input(
      z.object({
        query: z.string().min(1),
        limit: z.number().min(1).max(50).default(10),
      })
    )
    .query(async ({ input, ctx }) => {
      const userService = ctx.container.resolve<UserApplicationService>(
        'UserApplicationService'
      );

      const result = await userService.searchUsers({
        query: input.query,
        limit: input.limit,
        requestedBy: ctx.user.id,
      });

      if (!result.isSuccess) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: result.error || 'User search failed',
        });
      }

      return result.data;
    }),

  getStats: adminProcedure.query(async ({ ctx }) => {
    const userService = ctx.container.resolve<UserApplicationService>(
      'UserApplicationService'
    );

    const result = await userService.getUserStats({
      requestedBy: ctx.user.id,
    });

    if (!result.isSuccess) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: result.error || 'Failed to fetch user statistics',
      });
    }

    return result.data;
  }),
});

