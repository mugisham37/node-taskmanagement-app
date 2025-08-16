import { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { AuthApplicationService } from '../../application/services/auth-application-service';
import { LoggingService } from '../../infrastructure/monitoring/logging-service';
import {
  ChangePasswordSchema,
  LoginSchema,
  RefreshTokenSchema,
  RegisterSchema,
  UpdateUserSchema,
} from '../dto/user-dto';
import { BaseController } from './base-controller';

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

  register = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    await this.handleRequest(request, reply, async () => {
      const registerData = this.validateBody(request.body, RegisterSchema);

      const result = await this.authService.register(registerData);

      return result;
    });
  };

  login = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    await this.handleRequest(request, reply, async () => {
      const loginData = this.validateBody(request.body, LoginSchema);
      const ipAddress = request.ip || '0.0.0.0';
      const userAgent = request.headers['user-agent'] || 'Unknown';

      const result = await this.authService.login(loginData, ipAddress, userAgent);

      return result;
    });
  };

  refreshToken = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    await this.handleRequest(request, reply, async () => {
      const refreshData = this.validateBody(request.body, RefreshTokenSchema);

      const result = await this.authService.refreshToken(refreshData.refreshToken);

      return result;
    });
  };

  logout = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    await this.handleRequest(request, reply, async () => {
      const userId = this.getUserId(request);

      await this.authService.logout(userId);

      await this.sendNoContent(reply);
    });
  };

  getProfile = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    await this.handleRequest(request, reply, async () => {
      const userId = this.getUserId(request);

      const profile = await this.authService.getProfile(userId);

      return profile;
    });
  };

  updateProfile = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    await this.handleRequest(request, reply, async () => {
      const userId = this.getUserId(request);
      const updateData = this.validateBody(request.body, UpdateUserSchema);

      // Filter out undefined values for the service call
      const filteredUpdateData: Partial<{
        firstName: string;
        lastName: string;
        email: string;
      }> = {};

      if (updateData.firstName !== undefined) {
        filteredUpdateData.firstName = updateData.firstName;
      }
      if (updateData.lastName !== undefined) {
        filteredUpdateData.lastName = updateData.lastName;
      }
      if (updateData.email !== undefined) {
        filteredUpdateData.email = updateData.email;
      }

      const updatedProfile = await this.authService.updateProfile(userId, filteredUpdateData);

      return updatedProfile;
    });
  };

  changePassword = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    await this.handleRequest(request, reply, async () => {
      const userId = this.getUserId(request);
      const passwordData = this.validateBody(request.body, ChangePasswordSchema);

      await this.authService.changePassword(
        userId,
        passwordData.currentPassword,
        passwordData.newPassword
      );

      await this.sendNoContent(reply);
    });
  };

  deactivateAccount = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    await this.handleRequest(request, reply, async () => {
      const userId = this.getUserId(request);

      await this.authService.deactivateAccount(userId);

      await this.sendNoContent(reply);
    });
  };

  activateAccount = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    await this.handleRequest(request, reply, async () => {
      const { id } = this.validateParams(request.params, ParamsSchema);

      await this.authService.activateAccount(id);

      await this.sendNoContent(reply);
    });
  };
}
