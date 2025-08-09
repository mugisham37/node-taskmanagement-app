import { FastifyRequest, FastifyReply } from 'fastify';
import { BaseController } from './base-controller';
import { LoggingService } from '../../infrastructure/monitoring/logging-service';
import { AuthApplicationService } from '../../application/services/auth-application-service';
import {
  LoginSchema,
  RefreshTokenSchema,
  ChangePasswordSchema,
  CreateUserSchema,
  LoginRequest,
  RefreshTokenRequest,
  ChangePasswordRequest,
  CreateUserRequest,
} from '../dto/user-dto';
import { z } from 'zod';

const ParamsSchema = z.object({
  id: z.string(),
});

export class AuthController extends BaseController {
  constructor(
    logger: LoggingService,
    private readonly authService: AuthApplicationService
  ) {
    super(logger);
  }

  register = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    await this.handleRequest(request, reply, async () => {
      const registerData = this.validateBody(request.body, CreateUserSchema);

      const result = await this.authService.register(registerData);

      return result;
    });
  };

  login = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    await this.handleRequest(request, reply, async () => {
      const loginData = this.validateBody(request.body, LoginSchema);

      const result = await this.authService.login(loginData);

      return result;
    });
  };

  refreshToken = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    await this.handleRequest(request, reply, async () => {
      const refreshData = this.validateBody(request.body, RefreshTokenSchema);

      const result = await this.authService.refreshToken(
        refreshData.refreshToken
      );

      return result;
    });
  };

  logout = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    await this.handleRequest(request, reply, async () => {
      const userId = this.getUserId(request);

      await this.authService.logout(userId);

      await this.sendNoContent(reply);
    });
  };

  getProfile = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    await this.handleRequest(request, reply, async () => {
      const userId = this.getUserId(request);

      const profile = await this.authService.getProfile(userId);

      return profile;
    });
  };

  updateProfile = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    await this.handleRequest(request, reply, async () => {
      const userId = this.getUserId(request);
      const updateData = this.validateBody(
        request.body,
        CreateUserSchema.partial()
      );

      const updatedProfile = await this.authService.updateProfile(
        userId,
        updateData
      );

      return updatedProfile;
    });
  };

  changePassword = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    await this.handleRequest(request, reply, async () => {
      const userId = this.getUserId(request);
      const passwordData = this.validateBody(
        request.body,
        ChangePasswordSchema
      );

      await this.authService.changePassword(
        userId,
        passwordData.currentPassword,
        passwordData.newPassword
      );

      await this.sendNoContent(reply);
    });
  };

  deactivateAccount = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    await this.handleRequest(request, reply, async () => {
      const userId = this.getUserId(request);

      await this.authService.deactivateAccount(userId);

      await this.sendNoContent(reply);
    });
  };

  activateAccount = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    await this.handleRequest(request, reply, async () => {
      const { id } = this.validateParams(request.params, ParamsSchema);

      await this.authService.activateAccount(id);

      await this.sendNoContent(reply);
    });
  };
}
