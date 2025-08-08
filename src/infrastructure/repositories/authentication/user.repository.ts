/**
 * User Repository Implementation
 * Prisma-based implementation of IUserRepository interface
 */

import { PrismaClient, Prisma, User } from '@prisma/client';
import { BasePrismaRepository } from '../../database/base-repository';
import { IUserRepository } from '../../../domains/authentication/repositories/user.repository.interface';
import { UserAggregate } from '../../../domains/authentication/aggregates/user.aggregate';
import { UserId } from '../../../domains/authentication/value-objects/user-id';
import { Email } from '../../../domains/authentication/value-objects/email';
import { logger } from '../../logging/logger';

type UserWithRelations = User & {
  accounts?: any[];
  sessions?: any[];
  workspaceMembers?: any[];
};

export class PrismaUserRepository
  extends BasePrismaRepository<
    UserAggregate,
    string,
    UserWithRelations,
    PrismaClient['user']
  >
  implements IUserRepository
{
  constructor(client?: PrismaClient) {
    super('User', client);
  }

  protected toDomain(prismaUser: UserWithRelations): UserAggregate {
    return UserAggregate.fromPersistence({
      id: prismaUser.id,
      email: prismaUser.email,
      emailVerified: prismaUser.emailVerified,
      name: prismaUser.name,
      image: prismaUser.image,
      passwordHash: prismaUser.passwordHash,
      mfaEnabled: prismaUser.mfaEnabled,
      totpSecret: prismaUser.totpSecret,
      backupCodes: prismaUser.backupCodes,
      failedLoginAttempts: prismaUser.failedLoginAttempts,
      lockedUntil: prismaUser.lockedUntil,
      lastLoginAt: prismaUser.lastLoginAt,
      riskScore: prismaUser.riskScore,
      timezone: prismaUser.timezone,
      workHours: prismaUser.workHours as any,
      taskViewPreferences: prismaUser.taskViewPreferences as any,
      notificationSettings: prismaUser.notificationSettings as any,
      productivitySettings: prismaUser.productivitySettings as any,
      avatarColor: prismaUser.avatarColor,
      activeWorkspaceId: prismaUser.activeWorkspaceId,
      workspacePreferences: prismaUser.workspacePreferences as any,
      createdAt: prismaUser.createdAt,
      updatedAt: prismaUser.updatedAt,
      deletedAt: prismaUser.deletedAt,
    });
  }

  protected toPrisma(user: UserAggregate): Prisma.UserCreateInput {
    const userData = user.toPersistence();
    return {
      id: userData.id,
      email: userData.email,
      emailVerified: userData.emailVerified,
      name: userData.name,
      image: userData.image,
      passwordHash: userData.passwordHash,
      mfaEnabled: userData.mfaEnabled,
      totpSecret: userData.totpSecret,
      backupCodes: userData.backupCodes,
      failedLoginAttempts: userData.failedLoginAttempts,
      lockedUntil: userData.lockedUntil,
      lastLoginAt: userData.lastLoginAt,
      riskScore: userData.riskScore,
      timezone: userData.timezone,
      workHours: userData.workHours,
      taskViewPreferences: userData.taskViewPreferences,
      notificationSettings: userData.notificationSettings,
      productivitySettings: userData.productivitySettings,
      avatarColor: userData.avatarColor,
      activeWorkspaceId: userData.activeWorkspaceId,
      workspacePreferences: userData.workspacePreferences,
      createdAt: userData.createdAt,
      updatedAt: userData.updatedAt,
      deletedAt: userData.deletedAt,
    };
  }

  protected getDelegate(client: PrismaClient | Prisma.TransactionClient) {
    return client.user;
  }

  protected buildWhereClause(specification: any): Prisma.UserWhereInput {
    // Implementation would depend on the specification pattern used
    return {};
  }

  protected getDefaultInclude() {
    return {
      accounts: true,
      sessions: {
        where: {
          expiresAt: {
            gt: new Date(),
          },
        },
      },
      workspaceMembers: {
        include: {
          workspace: true,
        },
      },
    };
  }

  // IUserRepository specific methods
  async findByEmail(email: Email): Promise<UserAggregate | null> {
    try {
      const user = await this.client.user.findUnique({
        where: {
          email: email.value,
          deletedAt: null,
        },
        ...this.getDefaultInclude(),
      });

      if (!user) {
        return null;
      }

      return this.toDomain(user);
    } catch (error) {
      logger.error('Error finding user by email', {
        email: email.value,
        error,
      });
      throw error;
    }
  }

  async findByWorkspaceId(workspaceId: string): Promise<UserAggregate[]> {
    try {
      const users = await this.client.user.findMany({
        where: {
          workspaceMembers: {
            some: {
              workspaceId,
            },
          },
          deletedAt: null,
        },
        ...this.getDefaultInclude(),
        orderBy: { name: 'asc' },
      });

      return users.map(user => this.toDomain(user));
    } catch (error) {
      logger.error('Error finding users by workspace ID', {
        workspaceId,
        error,
      });
      throw error;
    }
  }

  async existsByEmail(email: Email): Promise<boolean> {
    try {
      const user = await this.client.user.findUnique({
        where: {
          email: email.value,
          deletedAt: null,
        },
        select: { id: true },
      });

      return user !== null;
    } catch (error) {
      logger.error('Error checking user existence by email', {
        email: email.value,
        error,
      });
      throw error;
    }
  }

  async findHighRiskUsers(threshold: number = 80): Promise<UserAggregate[]> {
    try {
      const users = await this.client.user.findMany({
        where: {
          riskScore: {
            gte: threshold,
          },
          deletedAt: null,
        },
        ...this.getDefaultInclude(),
        orderBy: { riskScore: 'desc' },
      });

      return users.map(user => this.toDomain(user));
    } catch (error) {
      logger.error('Error finding high risk users', { threshold, error });
      throw error;
    }
  }

  async findLockedUsers(): Promise<UserAggregate[]> {
    try {
      const users = await this.client.user.findMany({
        where: {
          lockedUntil: {
            gt: new Date(),
          },
          deletedAt: null,
        },
        ...this.getDefaultInclude(),
        orderBy: { lockedUntil: 'desc' },
      });

      return users.map(user => this.toDomain(user));
    } catch (error) {
      logger.error('Error finding locked users', { error });
      throw error;
    }
  }

  async findUsersWithoutMFA(): Promise<UserAggregate[]> {
    try {
      const users = await this.client.user.findMany({
        where: {
          mfaEnabled: false,
          deletedAt: null,
        },
        ...this.getDefaultInclude(),
        orderBy: { createdAt: 'desc' },
      });

      return users.map(user => this.toDomain(user));
    } catch (error) {
      logger.error('Error finding users without MFA', { error });
      throw error;
    }
  }

  async findInactiveUsers(daysThreshold: number): Promise<UserAggregate[]> {
    try {
      const thresholdDate = new Date();
      thresholdDate.setDate(thresholdDate.getDate() - daysThreshold);

      const users = await this.client.user.findMany({
        where: {
          OR: [
            {
              lastLoginAt: {
                lt: thresholdDate,
              },
            },
            {
              lastLoginAt: null,
              createdAt: {
                lt: thresholdDate,
              },
            },
          ],
          deletedAt: null,
        },
        ...this.getDefaultInclude(),
        orderBy: { lastLoginAt: 'asc' },
      });

      return users.map(user => this.toDomain(user));
    } catch (error) {
      logger.error('Error finding inactive users', { daysThreshold, error });
      throw error;
    }
  }

  async findByEmailDomain(domain: string): Promise<UserAggregate[]> {
    try {
      const users = await this.client.user.findMany({
        where: {
          email: {
            endsWith: `@${domain}`,
          },
          deletedAt: null,
        },
        ...this.getDefaultInclude(),
        orderBy: { email: 'asc' },
      });

      return users.map(user => this.toDomain(user));
    } catch (error) {
      logger.error('Error finding users by email domain', { domain, error });
      throw error;
    }
  }

  async countActive(daysThreshold: number): Promise<number> {
    try {
      const thresholdDate = new Date();
      thresholdDate.setDate(thresholdDate.getDate() - daysThreshold);

      return await this.client.user.count({
        where: {
          lastLoginAt: {
            gte: thresholdDate,
          },
          deletedAt: null,
        },
      });
    } catch (error) {
      logger.error('Error counting active users', { daysThreshold, error });
      throw error;
    }
  }

  async findWithPagination(
    offset: number,
    limit: number,
    filters?: {
      emailVerified?: boolean;
      mfaEnabled?: boolean;
      isLocked?: boolean;
      isDeleted?: boolean;
      workspaceId?: string;
    }
  ): Promise<{ users: UserAggregate[]; total: number }> {
    try {
      const whereClause: Prisma.UserWhereInput = {
        deletedAt: filters?.isDeleted ? { not: null } : null,
      };

      if (filters?.emailVerified !== undefined) {
        whereClause.emailVerified = filters.emailVerified;
      }

      if (filters?.mfaEnabled !== undefined) {
        whereClause.mfaEnabled = filters.mfaEnabled;
      }

      if (filters?.isLocked !== undefined) {
        if (filters.isLocked) {
          whereClause.lockedUntil = { gt: new Date() };
        } else {
          whereClause.OR = [
            { lockedUntil: null },
            { lockedUntil: { lte: new Date() } },
          ];
        }
      }

      if (filters?.workspaceId) {
        whereClause.workspaceMembers = {
          some: {
            workspaceId: filters.workspaceId,
          },
        };
      }

      const [users, total] = await Promise.all([
        this.client.user.findMany({
          where: whereClause,
          ...this.getDefaultInclude(),
          skip: offset,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        this.client.user.count({ where: whereClause }),
      ]);

      return {
        users: users.map(user => this.toDomain(user)),
        total,
      };
    } catch (error) {
      logger.error('Error finding users with pagination', {
        offset,
        limit,
        filters,
        error,
      });
      throw error;
    }
  }

  // Override save method to handle domain events
  async save(user: UserAggregate): Promise<void> {
    try {
      const userData = this.toPrisma(user);

      await this.client.user.upsert({
        where: { id: user.id.value },
        create: userData,
        update: userData,
        ...this.getDefaultInclude(),
      });

      logger.debug('User saved successfully', { userId: user.id.value });
    } catch (error) {
      logger.error('Error saving user', {
        userId: user.id.value,
        error,
      });
      throw error;
    }
  }

  // Override delete method for soft delete
  async delete(id: UserId): Promise<void> {
    try {
      await this.client.user.update({
        where: { id: id.value },
        data: {
          deletedAt: new Date(),
          email: `deleted_${Date.now()}_${id.value}@deleted.local`, // Ensure email uniqueness
        },
      });

      logger.info('User soft deleted', { userId: id.value });
    } catch (error) {
      logger.error('Error deleting user', { userId: id.value, error });
      throw error;
    }
  }
}
