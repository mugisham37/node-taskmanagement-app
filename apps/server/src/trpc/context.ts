import { FastifyRequest, FastifyReply } from 'fastify';
import { Container } from '../shared/container/Container';
import { AuthenticationService } from '../application/services/AuthenticationService';
import { User } from '../domain/entities/User';

export interface CreateContextOptions {
  req: FastifyRequest;
  res: FastifyReply;
  container: Container;
}

export interface Context {
  req: FastifyRequest;
  res: FastifyReply;
  container: Container;
  user?: User;
}

export async function createContext({
  req,
  res,
  container,
}: CreateContextOptions): Promise<Context> {
  const authService = container.resolve<AuthenticationService>(
    'AuthenticationService'
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
