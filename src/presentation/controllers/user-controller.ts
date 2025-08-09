import { FastifyRequest, FastifyReply } from 'fastify';
import { BaseController } from './base-controller';
import { LoggingService } from '../../infrastructure/monitoring/logging-service';
import { UserApplicationService } from '../../application/services/user-application-service';
import {
  UpdateUserSchema,
  UserQuerySchema,
  UpdateUserRequest,
  UserQuery,
} from '../dto/user-dto';
import { z } from 'zod';

const ParamsSchema = z.object({
  id: z.string(),
});

export class UserController extends BaseController {
  constructor(
    logger: LoggingService,
    private readonly userService: UserApplicationService
  ) {
    super(logger);
  }

  getUser = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    await this.handleRequest(request, reply, async () => {
      const currentUserId = this.getUserId(request);
      const { id } = this.validateParams(request.params, ParamsSchema);

      const user = await this.userService.getUser(currentUserId, id);

      return user;
    });
  };

  updateUser = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    await this.handleRequest(request, reply, async () => {
      const currentUserId = this.getUserId(request);
      const { id } = this.validateParams(request.params, ParamsSchema);
      const updateData = this.validateBody(request.body, UpdateUserSchema);

      const user = await this.userService.updateUser(
        currentUserId,
        id,
        updateData
      );

      return user;
    });
  };

  deactivateUser = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    await this.handleRequest(request, reply, async () => {
      const currentUserId = this.getUserId(request);
      const { id } = this.validateParams(request.params, ParamsSchema);

      await this.userService.deactivateUser(currentUserId, id);

      await this.sendNoContent(reply);
    });
  };

  activateUser = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    await this.handleRequest(request, reply, async () => {
      const currentUserId = this.getUserId(request);
      const { id } = this.validateParams(request.params, ParamsSchema);

      await this.userService.activateUser(currentUserId, id);

      await this.sendNoContent(reply);
    });
  };

  getUsers = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    await this.handleRequest(request, reply, async () => {
      const currentUserId = this.getUserId(request);
      const query = this.validateQuery(request.query, UserQuerySchema);

      const result = await this.userService.getUsers(currentUserId, query);

      await this.sendPaginated(
        reply,
        result.users,
        result.total,
        query.page,
        query.limit
      );
    });
  };

  searchUsers = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    await this.handleRequest(request, reply, async () => {
      const currentUserId = this.getUserId(request);
      const query = this.validateQuery(
        request.query,
        UserQuerySchema.extend({
          search: z.string().min(1, 'Search term is required'),
        })
      );

      const result = await this.userService.searchUsers(currentUserId, query);

      await this.sendPaginated(
        reply,
        result.users,
        result.total,
        query.page,
        query.limit
      );
    });
  };

  getUserStats = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    await this.handleRequest(request, reply, async () => {
      const currentUserId = this.getUserId(request);
      const { id } = this.validateParams(request.params, ParamsSchema);

      const stats = await this.userService.getUserStats(currentUserId, id);

      return stats;
    });
  };

  getMyStats = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    await this.handleRequest(request, reply, async () => {
      const userId = this.getUserId(request);

      const stats = await this.userService.getMyStats(userId);

      return stats;
    });
  };
}
