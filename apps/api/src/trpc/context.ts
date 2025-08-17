import { User } from '@taskmanagement/domain';
import { FastifyReply, FastifyRequest } from 'fastify';
import { AuthApplicationService } from '../application/services/auth-application-service';
import { DIContainer } from '../shared/container/container';
import { SERVICE_TOKENS } from '../shared/container/types';

export interface CreateContextOptions {
  req: FastifyRequest;
  res: FastifyReply;
  container: DIContainer;
}

export interface Context {
  req: FastifyRequest;
  res: FastifyReply;
  container: DIContainer;
  user?: User;
}

export async function createContext({
  req,
  res,
  container,
}: CreateContextOptions): Promise<Context> {
  const authService = container.resolve<AuthApplicationService>(
    SERVICE_TOKENS.AUTH_APPLICATION_SERVICE
  );

  let user: User | undefined;

  // Extract token from Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);

    try {
      const authResult = await authService.validateToken(token);
      if (authResult.isSuccess) {
        user = authResult.data?.user;
      }
    } catch (error) {
      // Token validation failed, user remains undefined
      console.warn('Token validation failed:', error);
    }
  }

  return {
    req,
    res,
    container,
    user,
  };
}

export type TRPCContext = Context;
