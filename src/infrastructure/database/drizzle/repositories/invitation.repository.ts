import { eq, and, or, ilike, isNull, isNotNull, desc, asc, inArray, count, lte } from 'drizzle-orm';
import { BaseRepository } from './base/base.repository';
import { invitations, Invitation, NewInvitation } from '../schema/invitations';
import { PaginationOptions, PaginatedResult, SearchOptions } from './base/interfaces';
import { RepositoryException } from './base/types';

export class InvitationRepository extends BaseRepository<Invitation, NewInvitation> {
  protected table = invitations;
  protected primaryKey = 'id';

  constructor() {
    super(
      { enabled: true, ttl: 120, keyPrefix: 'invitation' }, // Enable caching for invitations
      { enabled: true, trackChanges: true } // Enable audit logging
    );
  }

  // Invitation-specific methods
  async findByEmail(email: string, options: PaginationOptions = {}): Promise<PaginatedResult<Invitation>> {
    try {
      return await this.findMany({
        where: eq(invitations.email, email),
        ...options,
        sortBy: 'createdAt',
        sortOrder: 'desc'
      });
    } catch (error) {
      throw this.handleError(error, 'findByEmail');
    }
  }

  async findByToken(token: string): Promise<Invitation | null> {
    try {
      const result = await this.findMany({
        where: eq(invitations.token, token),
        limit: 1
      });
      return result.data[0] || null;
    } catch (error) {
      throw this.handleError(error, 'findByToken');
    }
  }

  async findByInviter(inviterId: string, options: PaginationOptions = {}): Promise<PaginatedResult<Invitation>> {
    try {
      return await this.findMany({
        where: eq(invitations.invitedById, inviterId),
        ...options,
        sortBy: 'createdAt',
        sortOrder: 'desc'
      });
    } catch (error) {
      throw this.handleError(error, 'findByInviter');
    }
  }

  async findByStatus(status: string, options: PaginationOptions = {}): Promise<PaginatedResult<Invitation>> {
    try {
      return await this.findMany({
        where: eq(invitations.status, status),
        ...options,
        sortBy: 'createdAt',
        sortOrder: 'desc'
      });
    } catch (error) {
      throw this.handleError(error, 'findByStatus');
    }
  }

  async findByType(type: string, options: PaginationOptions = {}): Promise<PaginatedResult<Invitation>> {
    try {
      return await this.findMany({
        where: eq(invitations.type, type),
        ...options,
        sortBy: 'createdAt',
        sortOrder: 'desc'
      });
    } catch (error) {
      throw this.handleError(error, 'findByType');
    }
  }

  async findByTeam(teamId: string, options: PaginationOptions = {}): Promise<PaginatedResult<Invitation>> {
    try {
      return await this.findMany({
        where: eq(invitations.teamId, teamId),
        ...options,
        sortBy: 'createdAt',
        sortOrder: 'desc'
      });
    } catch (error) {
      throw this.handleError(error, 'findByTeam');
    }
  }

  async findByWorkspace(workspaceId: string, options: PaginationOptions = {}): Promise<PaginatedResult<Invitation>> {
    try {
      return await this.findMany({
        where: eq(invitations.workspaceId, workspaceId),
        ...options,
        sortBy: 'createdAt',
        sortOrder: 'desc'
      });
    } catch (error) {
      throw this.handleError(error, 'findByWorkspace');
    }
  }

  async findPendingInvitations(options: PaginationOptions = {}): Promise<PaginatedResult<Invitation>> {
    try {
      return await this.findMany({
        where: eq(invitations.status, 'pending'),
        ...options,
        sortBy: 'createdAt',
        sortOrder: 'desc'
      });
    } catch (error) {
      throw this.handleError(error, 'findPendingInvitations');
    }
  }

  async findExpiredInvitations(options: PaginationOptions = {}): Promise<PaginatedResult<Invitation>> {
    try {
      const now = new Date();
      return await this.findMany({
        where: and(
          eq(invitations.status, 'pending'),
          lte(invitations.expiresAt, now)
        ),
        ...options,
        sortBy: 'expiresAt',
        sortOrder: 'asc'
      });
    } catch (error) {
      throw this.handleError(error, 'findExpiredInvitations');
    }
  }

  async acceptInvitation(invitationId: string): Promise<Invitation | null> {
    try {
      return await this.update(invitationId, {
        status: 'accepted',
        acceptedAt: new Date()
      } as any);
    } catch (error) {
      throw this.handleError(error, 'acceptInvitation');
    }
  }

  async declineInvitation(invitationId: string): Promise<Invitation | null> {
    try {
      return await this.update(invitationId, {
        status: 'declined',
        declinedAt: new Date()
      } as any);
    } catch (error) {
      throw this.handleError(error, 'declineInvitation');
    }
  }

  async expireInvitation(invitationId: string): Promise<Invitation | null> {
    try {
      return await this.update(invitationId, {
        status: 'expired'
      } as any);
    } catch (error) {
      throw this.handleError(error, 'expireInvitation');
    }
  }

  async markExpiredInvitations(): Promise<{ success: boolean; count: number }> {
    try {
      const now = new Date();
      const expiredInvitations = await this.findMany({
        where: and(
          eq(invitations.status, 'pending'),
          lte(invitations.expiresAt, now)
        ),
        limit: 1000
      });

      const invitationIds = expiredInvitations.data.map(invitation => invitation.id);
      
      if (invitationIds.length === 0) {
        return { success: true, count: 0 };
      }

      return await this.updateMany(invitationIds, { status: 'expired' } as any);
    } catch (error) {
      throw this.handleError(error, 'markExpiredInvitations');
    }
  }

  async getInvitationStats(inviterId?: string): Promise<{
    total: number;
    pending: number;
    accepted: number;
    declined: number;
    expired: number;
    byType: Record<string, number>;
  }> {
    try {
      const baseWhere = inviterId ? eq(invitations.invitedById, inviterId) : undefined;

      const [
        total,
        pending,
        accepted,
        declined,
        expired
      ] = await Promise.all([
        this.count({ where: baseWhere }),
        this.count({ 
          where: baseWhere ? and(baseWhere, eq(invitations.status, 'pending')) : eq(invitations.status, 'pending')
        }),
        this.count({ 
          where: baseWhere ? and(baseWhere, eq(invitations.status, 'accepted')) : eq(invitations.status, 'accepted')
        }),
        this.count({ 
          where: baseWhere ? and(baseWhere, eq(invitations.status, 'declined')) : eq(invitations.status, 'declined')
        }),
        this.count({ 
          where: baseWhere ? and(baseWhere, eq(invitations.status, 'expired')) : eq(invitations.status, 'expired')
        })
      ]);

      // For byType stats, we'd need to group by type
      const byType: Record<string, number> = {}; // Placeholder

      return {
        total,
        pending,
        accepted,
        declined,
        expired,
        byType
      };
    } catch (error) {
      throw this.handleError(error, 'getInvitationStats');
    }
  }

  async resendInvitation(invitationId: string, newExpiryDate?: Date): Promise<Invitation | null> {
    try {
      const updateData: any = {
        status: 'pending'
      };

      if (newExpiryDate) {
        updateData.expiresAt = newExpiryDate;
      }

      return await this.update(invitationId, updateData);
    } catch (error) {
      throw this.handleError(error, 'resendInvitation');
    }
  }

  async bulkInvite(invitations: NewInvitation[]): Promise<Invitation[]> {
    try {
      return await this.createMany(invitations);
    } catch (error) {
      throw this.handleError(error, 'bulkInvite');
    }
  }

  async cancelInvitation(invitationId: string): Promise<boolean> {
    try {
      return await this.delete(invitationId);
    } catch (error) {
      throw this.handleError(error, 'cancelInvitation');
    }
  }

  async bulkCancelInvitations(invitationIds: string[]): Promise<{ success: boolean; count: number }> {
    try {
      return await this.deleteMany(invitationIds);
    } catch (error) {
      throw this.handleError(error, 'bulkCancelInvitations');
    }
  }

  async findTeamInvitationByEmail(teamId: string, email: string): Promise<Invitation | null> {
    try {
      const result = await this.findMany({
        where: and(
          eq(invitations.teamId, teamId),
          eq(invitations.email, email),
          eq(invitations.status, 'pending')
        ),
        limit: 1
      });
      return result.data[0] || null;
    } catch (error) {
      throw this.handleError(error, 'findTeamInvitationByEmail');
    }
  }

  async findWorkspaceInvitationByEmail(workspaceId: string, email: string): Promise<Invitation | null> {
    try {
      const result = await this.findMany({
        where: and(
          eq(invitations.workspaceId, workspaceId),
          eq(invitations.email, email),
          eq(invitations.status, 'pending')
        ),
        limit: 1
      });
      return result.data[0] || null;
    } catch (error) {
      throw this.handleError(error, 'findWorkspaceInvitationByEmail');
    }
  }

  async deleteOldInvitations(days: number = 30): Promise<{ success: boolean; count: number }> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      // Note: You'd need to implement proper date comparison here with Drizzle
      // For now, we'll just return a placeholder
      return { success: true, count: 0 };
    } catch (error) {
      throw this.handleError(error, 'deleteOldInvitations');
    }
  }

  async search(options: SearchOptions): Promise<PaginatedResult<Invitation>> {
    try {
      const { query, page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = options;
      const searchPattern = `%${query}%`;

      const whereCondition = or(
        ilike(invitations.email, searchPattern),
        ilike(invitations.message, searchPattern)
      );

      return await this.findMany({
        where: whereCondition,
        page,
        limit,
        sortBy,
        sortOrder
      });
    } catch (error) {
      throw this.handleError(error, 'search');
    }
  }

  // Override create to add validation
  async create(data: NewInvitation): Promise<Invitation> {
    try {
      // Add any invitation-specific validation here
      if (!data.email || data.email.trim().length === 0) {
        throw new RepositoryException('VALIDATION_ERROR', 'Invitation email cannot be empty');
      }

      if (!data.token || data.token.trim().length === 0) {
        throw new RepositoryException('VALIDATION_ERROR', 'Invitation token cannot be empty');
      }

      if (!data.expiresAt || data.expiresAt <= new Date()) {
        throw new RepositoryException('VALIDATION_ERROR', 'Invitation expiry date must be in the future');
      }

      return await super.create(data);
    } catch (error) {
      if (error instanceof RepositoryException) {
        throw error;
      }
      throw this.handleError(error, 'create');
    }
  }
}

// Export singleton instance
export const invitationRepository = new InvitationRepository();
