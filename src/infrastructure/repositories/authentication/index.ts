/**
 * Authentication Domain Repository Implementations
 */

export { PrismaUserRepository } from './user.repository';

// Re-export interfaces for convenience
export type { IUserRepository } from '../../../domains/authentication/repositories/user.repository.interface';
