import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, publicProcedure, protectedProcedure } from '../trpc/router';
import { AuthenticationService } from '../application/services/AuthenticationService';
import { UserRegistrationService } from '../application/services/UserRegistrationService';
import {
  loginSchema,
  registerSchema,
  changePasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from '@taskmanagement/shared/schemas';

export const authRouter = router({
  login: publicProcedure.input(loginSchema).mutation(async ({ input, ctx }) => {
    const authService = ctx.container.resolve<AuthenticationService>(
      'AuthenticationService'
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

  register: publicProcedure
    .input(registerSchema)
    .mutation(async ({ input, ctx }) => {
      const registrationService =
        ctx.container.resolve<UserRegistrationService>(
          'UserRegistrationService'
        );

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
      const authService = ctx.container.resolve<AuthenticationService>(
        'AuthenticationService'
      );

      const result = await authService.changePassword({
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

  resetPassword: publicProcedure
    .input(resetPasswordSchema)
    .mutation(async ({ input, ctx }) => {
      const authService = ctx.container.resolve<AuthenticationService>(
        'AuthenticationService'
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

  verifyEmail: publicProcedure
    .input(verifyEmailSchema)
    .mutation(async ({ input, ctx }) => {
      const authService = ctx.container.resolve<AuthenticationService>(
        'AuthenticationService'
      );

      const result = await authService.verifyEmail({
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
      const authService = ctx.container.resolve<AuthenticationService>(
        'AuthenticationService'
      );

      const result = await authService.refreshToken({
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
    const authService = ctx.container.resolve<AuthenticationService>(
      'AuthenticationService'
    );

    await authService.logout({
      userId: ctx.user.id,
    });

    return {
      message: 'Logged out successfully',
    };
  }),
});
