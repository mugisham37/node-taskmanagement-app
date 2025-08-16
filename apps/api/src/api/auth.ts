import {
  changePasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from '@taskmanagement/shared/schemas';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { AuthApplicationService } from '../application/services/auth-application-service';
import { UserRegistrationService } from '../application/services/UserRegistrationService';
import { SERVICE_TOKENS } from '../shared/container/types';
import { protectedProcedure, publicProcedure, router } from '../trpc/router';

export const authRouter = router({
  login: publicProcedure.input(loginSchema).mutation(async ({ input, ctx }) => {
    const authService = ctx.container.resolve<AuthApplicationService>(
      SERVICE_TOKENS.AUTH_APPLICATION_SERVICE
    );

    const result = await authService.authenticate({
      email: input.email,
      password: input.password,
    });

    if (!result.isSuccess) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: result.error || 'Invalid credentials',
      });
    }

    return {
      user: result.data?.user,
      token: result.data?.token,
      refreshToken: result.data?.refreshToken,
    };
  }),

  register: publicProcedure.input(registerSchema).mutation(async ({ input, ctx }) => {
    const registrationService =
      ctx.container.resolve<UserRegistrationService>('UserRegistrationService');

    const result = await registrationService.registerUser({
      email: input.email,
      password: input.password,
      firstName: input.firstName,
      lastName: input.lastName,
    });

    if (!result.isSuccess) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: result.error || 'Registration failed',
      });
    }

    return {
      user: result.data?.user,
      message: 'Registration successful. Please verify your email.',
    };
  }),

  me: protectedProcedure.query(async ({ ctx }) => {
    return {
      user: ctx.user,
    };
  }),

  changePassword: protectedProcedure
    .input(changePasswordSchema)
    .mutation(async ({ input, ctx }) => {
      const authService = ctx.container.resolve<AuthApplicationService>(
        SERVICE_TOKENS.AUTH_APPLICATION_SERVICE
      );

      const result = await authService.changePasswordAPI({
        userId: ctx.user.id,
        currentPassword: input.currentPassword,
        newPassword: input.newPassword,
      });

      if (!result.isSuccess) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: result.error || 'Password change failed',
        });
      }

      return {
        message: 'Password changed successfully',
      };
    }),

  resetPassword: publicProcedure.input(resetPasswordSchema).mutation(async ({ input, ctx }) => {
    const authService = ctx.container.resolve<AuthApplicationService>(
      SERVICE_TOKENS.AUTH_APPLICATION_SERVICE
    );

    const result = await authService.resetPassword({
      email: input.email,
    });

    if (!result.isSuccess) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: result.error || 'Password reset failed',
      });
    }

    return {
      message: 'Password reset email sent',
    };
  }),

  verifyEmail: publicProcedure.input(verifyEmailSchema).mutation(async ({ input, ctx }) => {
    const authService = ctx.container.resolve<AuthApplicationService>(
      SERVICE_TOKENS.AUTH_APPLICATION_SERVICE
    );

    const result = await authService.verifyEmailAPI({
      token: input.token,
    });

    if (!result.isSuccess) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: result.error || 'Email verification failed',
      });
    }

    return {
      message: 'Email verified successfully',
    };
  }),

  refreshToken: publicProcedure
    .input(z.object({ refreshToken: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const authService = ctx.container.resolve<AuthApplicationService>(
        SERVICE_TOKENS.AUTH_APPLICATION_SERVICE
      );

      const result = await authService.refreshTokenAPI({
        refreshToken: input.refreshToken,
      });

      if (!result.isSuccess) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: result.error || 'Token refresh failed',
        });
      }

      return {
        token: result.data?.token,
        refreshToken: result.data?.refreshToken,
      };
    }),

  logout: protectedProcedure.mutation(async ({ ctx }) => {
    const authService = ctx.container.resolve<AuthApplicationService>(
      SERVICE_TOKENS.AUTH_APPLICATION_SERVICE
    );

    await authService.logoutAPI({
      userId: ctx.user.id,
    });

    return {
      message: 'Logged out successfully',
    };
  }),
});
