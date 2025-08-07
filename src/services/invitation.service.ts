import { eq, and, or, desc, asc, count, ilike, isNull, isNotNull, gte, lte, inArray } from 'drizzle-orm';
import { BaseService, ServiceContext, NotFoundError, ValidationError, ForbiddenError, ConflictError } from './base.service';
import { 
  invitationRepository, 
  userRepository, 
  teamRepository,
  workspaceRepository
} from '../db/repositories';
import { Invitation, NewInvitation } from '../db/schema/invitations';
import { PaginationOptions, PaginatedResult } from '../db/repositories/base/interfaces';
import { emailService } from './email.service';
import { notificationService, NotificationType } from './notification.service';
import { activityService } from './activity.service';
import crypto from 'crypto';

export enum InvitationStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  DECLINED = 'declined',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled'
}

export enum InvitationRole {
  MEMBER = 'member',
  ADMIN = 'admin',
  OWNER = 'owner'
}

export interface InvitationFilters {
  status?: InvitationStatus | InvitationStatus[];
  role?: InvitationRole | InvitationRole[];
  teamId?: string;
  workspaceId?: string;
  invitedById?: string;
  email?: string;
  createdFrom?: Date;
  createdTo?: Date;
  expiresFrom?: Date;
  expiresTo?: Date;
}

export interface InvitationCreateData {
  email: string;
  role?: InvitationRole;
  teamId?: string;
  workspaceId?: string;
  message?: string;
  expiresInDays?: number;
}

export interface InvitationUpdateData {
  status?: InvitationStatus;
  role?: InvitationRole;
  message?: string;
  expiresAt?: Date;
}

export interface InvitationStats {
  total: number;
  pending: number;
  accepted: number;
  declined: number;
  expired: number;
  cancelled: number;
  acceptanceRate: number;
  averageResponseTime: number;
  byRole: Record<string, number>;
  recentInvitations: Invitation[];
}

export class InvitationService extends BaseService {
  private readonly DEFAULT_EXPIRY_DAYS = 7;
  private readonly MAX_EXPIRY_DAYS = 30;

  constructor() {
    super('InvitationService', {
      enableCache: true,
      cacheTimeout: 300,
      enableAudit: true,
      enableMetrics: true
    });
  }

  // Core CRUD Operations
  async createInvitation(data: InvitationCreateData, context?: ServiceContext): Promise<Invitation> {
    const ctx = this.createContext(context);
    this.logOperation('createInvitation', ctx, { 
      email: data.email, 
      role: data.role,
      teamId: data.teamId,
      workspaceId: data.workspaceId
    });

    try {
      // Validate input
      this.validateInvitationData(data);

      // Check if user is already registered
      const existingUser = await userRepository.findByEmail(data.email.toLowerCase());
      
      // Verify team/workspace access and permissions
      if (data.teamId) {
        await this.verifyTeamInvitePermissions(data.teamId, ctx.userId!);
        
        // Check if user is already a team member
        if (existingUser) {
          const team = await teamRepository.findById(data.teamId);
          if (team && await this.isUserTeamMember(existingUser.id, data.teamId)) {
            throw new ConflictError('User is already a member of this team');
          }
        }
      }

      if (data.workspaceId) {
        await this.verifyWorkspaceInvitePermissions(data.workspaceId, ctx.userId!);
        
        // Check if user is already a workspace member
        if (existingUser) {
          if (await this.isUserWorkspaceMember(existingUser.id, data.workspaceId)) {
            throw new ConflictError('User is already a member of this workspace');
          }
        }
      }

      // Check for existing pending invitation
      const existingInvitation = await this.findPendingInvitation(data.email, data.teamId, data.workspaceId);
      if (existingInvitation) {
        throw new ConflictError('A pending invitation already exists for this email');
      }

      // Calculate expiry date
      const expiryDays = Math.min(data.expiresInDays || this.DEFAULT_EXPIRY_DAYS, this.MAX_EXPIRY_DAYS);
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiryDays);

      // Generate invitation token
      const token = crypto.randomBytes(32).toString('hex');

      // Create invitation
      const newInvitation: NewInvitation = {
        email: data.email.toLowerCase(),
        type: data.teamId ? 'team' : 'workspace',
        role: data.role || InvitationRole.MEMBER,
        teamId: data.teamId || undefined,
        workspaceId: data.workspaceId || undefined,
        invitedById: ctx.userId!,
        status: InvitationStatus.PENDING,
        token,
        message: data.message,
        expiresAt
      };

      const invitation = await invitationRepository.create(newInvitation);

      // Send invitation email
      await this.sendInvitationEmail(invitation);

      // Log activity
      await activityService.createActivity({
        userId: ctx.userId!,
        type: 'team_member_added',
        teamId: data.teamId,
        workspaceId: data.workspaceId,
        data: {
          action: 'invitation_sent',
          invitationId: invitation.id,
          email: data.email,
          role: data.role || InvitationRole.MEMBER
        },
        metadata: {
          invitationId: invitation.id,
          expiresAt: expiresAt.toISOString()
        }
      }, ctx);

      await this.recordMetric('invitation.created', 1, { 
        role: invitation.role,
        hasTeam: invitation.teamId ? 'true' : 'false',
        hasWorkspace: invitation.workspaceId ? 'true' : 'false',
        userExists: existingUser ? 'true' : 'false'
      });

      return invitation;
    } catch (error) {
      this.handleError(error, 'createInvitation', ctx);
    }
  }

  async getInvitationById(id: string, context?: ServiceContext): Promise<Invitation> {
    const ctx = this.createContext(context);
    this.logOperation('getInvitationById', ctx, { invitationId: id });

    try {
      const invitation = await invitationRepository.findById(id);
      if (!invitation) {
        throw new NotFoundError('Invitation', id);
      }

      // Check access permissions
      await this.verifyInvitationAccess(invitation, ctx.userId!);

      return invitation;
    } catch (error) {
      this.handleError(error, 'getInvitationById', ctx);
    }
  }

  async getInvitationByToken(token: string, context?: ServiceContext): Promise<Invitation> {
    const ctx = this.createContext(context);
    this.logOperation('getInvitationByToken', ctx);

    try {
      const invitation = await invitationRepository.findByToken(token);
      if (!invitation) {
        throw new NotFoundError('Invitation', 'with provided token');
      }

      // Check if invitation is expired
      if (invitation.expiresAt && new Date() > invitation.expiresAt) {
        // Auto-expire the invitation
        await invitationRepository.update(invitation.id, { 
          status: InvitationStatus.EXPIRED,
          updatedAt: new Date()
        });
        throw new ValidationError('Invitation has expired');
      }

      return invitation;
    } catch (error) {
      this.handleError(error, 'getInvitationByToken', ctx);
    }
  }

  async getInvitations(
    filters: InvitationFilters = {},
    options: PaginationOptions = {},
    context?: ServiceContext
  ): Promise<PaginatedResult<Invitation>> {
    const ctx = this.createContext(context);
    this.logOperation('getInvitations', ctx, { filters, options });

    try {
      const paginationOptions = this.validatePagination(options);
      
      // Build where conditions
      const whereConditions = this.buildInvitationWhereConditions(filters, ctx.userId!, ctx.userRole);
      
      const result = await invitationRepository.findMany({
        ...paginationOptions,
        where: whereConditions,
        sortBy: 'createdAt',
        sortOrder: 'desc'
      });

      return result;
    } catch (error) {
      this.handleError(error, 'getInvitations', ctx);
    }
  }

  async acceptInvitation(token: string, context?: ServiceContext): Promise<{ message: string; teamId?: string; workspaceId?: string }> {
    const ctx = this.createContext(context);
    this.logOperation('acceptInvitation', ctx);

    try {
      const invitation = await this.getInvitationByToken(token);

      // Check if invitation is still pending
      if (invitation.status !== InvitationStatus.PENDING) {
        throw new ValidationError(`Invitation has already been ${invitation.status}`);
      }

      // Get user
      const user = await userRepository.findById(ctx.userId!);
      if (!user) {
        throw new NotFoundError('User', ctx.userId!);
      }

      // Check if user email matches invitation email
      if (user.email.toLowerCase() !== invitation.email.toLowerCase()) {
        throw new ValidationError('This invitation was sent to a different email address');
      }

      // Add user to team/workspace
      if (invitation.teamId) {
        await this.addUserToTeam(user.id, invitation.teamId, invitation.role);
      }

      if (invitation.workspaceId) {
        await this.addUserToWorkspace(user.id, invitation.workspaceId, invitation.role);
      }

      // Update invitation status
      await invitationRepository.update(invitation.id, {
        status: InvitationStatus.ACCEPTED,
        acceptedAt: new Date(),
        updatedAt: new Date()
      });

      // Log activity
      await activityService.createActivity({
        userId: ctx.userId!,
        type: 'team_member_added',
        teamId: invitation.teamId || undefined,
        workspaceId: invitation.workspaceId || undefined,
        data: {
          action: 'invitation_accepted',
          invitationId: invitation.id,
          role: invitation.role
        }
      }, ctx);

      await this.recordMetric('invitation.accepted', 1, { 
        role: invitation.role 
      });

      return {
        message: 'Invitation accepted successfully',
        teamId: invitation.teamId || undefined,
        workspaceId: invitation.workspaceId || undefined
      };
    } catch (error) {
      this.handleError(error, 'acceptInvitation', ctx);
    }
  }

  async declineInvitation(token: string, context?: ServiceContext): Promise<{ message: string }> {
    const ctx = this.createContext(context);
    this.logOperation('declineInvitation', ctx);

    try {
      const invitation = await this.getInvitationByToken(token);

      // Check if invitation is still pending
      if (invitation.status !== InvitationStatus.PENDING) {
        throw new ValidationError(`Invitation has already been ${invitation.status}`);
      }

      // Update invitation status
      await invitationRepository.update(invitation.id, {
        status: InvitationStatus.DECLINED,
        declinedAt: new Date(),
        updatedAt: new Date()
      });

      await this.recordMetric('invitation.declined', 1, { 
        role: invitation.role 
      });

      return {
        message: 'Invitation declined'
      };
    } catch (error) {
      this.handleError(error, 'declineInvitation', ctx);
    }
  }

  async cancelInvitation(id: string, context?: ServiceContext): Promise<void> {
    const ctx = this.createContext(context);
    this.logOperation('cancelInvitation', ctx, { invitationId: id });

    try {
      const invitation = await invitationRepository.findById(id);
      if (!invitation) {
        throw new NotFoundError('Invitation', id);
      }

      // Check permissions
      await this.verifyInvitationAccess(invitation, ctx.userId!);

      // Check if invitation can be cancelled
      if (invitation.status !== InvitationStatus.PENDING) {
        throw new ValidationError(`Cannot cancel invitation that has been ${invitation.status}`);
      }

      // Update invitation status
      await invitationRepository.update(id, {
        status: InvitationStatus.CANCELLED,
        updatedAt: new Date()
      });

      await this.recordMetric('invitation.cancelled', 1);
    } catch (error) {
      this.handleError(error, 'cancelInvitation', ctx);
    }
  }

  async resendInvitation(id: string, context?: ServiceContext): Promise<Invitation> {
    const ctx = this.createContext(context);
    this.logOperation('resendInvitation', ctx, { invitationId: id });

    try {
      const invitation = await invitationRepository.findById(id);
      if (!invitation) {
        throw new NotFoundError('Invitation', id);
      }

      // Check permissions
      await this.verifyInvitationAccess(invitation, ctx.userId!);

      // Check if invitation can be resent
      if (invitation.status !== InvitationStatus.PENDING) {
        throw new ValidationError(`Cannot resend invitation that has been ${invitation.status}`);
      }

      // Generate new token and extend expiry
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + this.DEFAULT_EXPIRY_DAYS);

      // Update invitation
      const updatedInvitation = await invitationRepository.update(id, {
        token,
        expiresAt,
        updatedAt: new Date()
      });

      if (!updatedInvitation) {
        throw new NotFoundError('Invitation', id);
      }

      // Send invitation email
      await this.sendInvitationEmail(updatedInvitation);

      await this.recordMetric('invitation.resent', 1);

      return updatedInvitation;
    } catch (error) {
      this.handleError(error, 'resendInvitation', ctx);
    }
  }

  // Statistics
  async getInvitationStats(
    filters: InvitationFilters = {},
    context?: ServiceContext
  ): Promise<InvitationStats> {
    const ctx = this.createContext(context);
    this.logOperation('getInvitationStats', ctx, { filters });

    try {
      const whereConditions = this.buildInvitationWhereConditions(filters, ctx.userId!, ctx.userRole);
      
      const allInvitations = await invitationRepository.findMany({
        where: whereConditions,
        limit: 10000
      });

      const invitations = allInvitations.data;

      // Calculate stats
      const byRole: Record<string, number> = {};
      let totalResponseTime = 0;
      let responsesCount = 0;

      invitations.forEach(invitation => {
        byRole[invitation.role] = (byRole[invitation.role] || 0) + 1;

        // Calculate response time for accepted/declined invitations
        if (invitation.acceptedAt || invitation.declinedAt) {
          const responseDate = invitation.acceptedAt || invitation.declinedAt!;
          const responseTime = responseDate.getTime() - invitation.createdAt.getTime();
          totalResponseTime += responseTime;
          responsesCount++;
        }
      });

      const pending = invitations.filter(i => i.status === InvitationStatus.PENDING).length;
      const accepted = invitations.filter(i => i.status === InvitationStatus.ACCEPTED).length;
      const declined = invitations.filter(i => i.status === InvitationStatus.DECLINED).length;
      const expired = invitations.filter(i => i.status === InvitationStatus.EXPIRED).length;
      const cancelled = invitations.filter(i => i.status === InvitationStatus.CANCELLED).length;

      const acceptanceRate = (accepted + declined) > 0 ? (accepted / (accepted + declined)) * 100 : 0;
      const averageResponseTime = responsesCount > 0 ? totalResponseTime / responsesCount / (1000 * 60 * 60) : 0; // Convert to hours

      const stats: InvitationStats = {
        total: invitations.length,
        pending,
        accepted,
        declined,
        expired,
        cancelled,
        acceptanceRate,
        averageResponseTime,
        byRole,
        recentInvitations: invitations.slice(0, 10)
      };

      return stats;
    } catch (error) {
      this.handleError(error, 'getInvitationStats', ctx);
    }
  }

  // Cleanup expired invitations
  async cleanupExpiredInvitations(context?: ServiceContext): Promise<{ updated: number }> {
    const ctx = this.createContext(context);
    this.logOperation('cleanupExpiredInvitations', ctx);

    try {
      const now = new Date();
      
      // Find expired pending invitations
      const expiredInvitations = await invitationRepository.findMany({
        where: and(
          eq(invitationRepository['table']?.status, InvitationStatus.PENDING),
          lte(invitationRepository['table']?.expiresAt, now)
        ),
        limit: 1000
      });

      let updated = 0;

      // Update each expired invitation
      for (const invitation of expiredInvitations.data) {
        const result = await invitationRepository.update(invitation.id, {
          status: InvitationStatus.EXPIRED,
          updatedAt: now
        });
        if (result) updated++;
      }

      await this.recordMetric('invitation.expired.cleanup', updated);

      return { updated };
    } catch (error) {
      this.handleError(error, 'cleanupExpiredInvitations', ctx);
    }
  }

  // Private Helper Methods
  private async verifyInvitationAccess(invitation: Invitation, userId: string): Promise<void> {
    // User can access invitation if they are:
    // 1. The inviter
    // 2. Admin of the team/workspace
    // 3. System admin
    
    if (invitation.invitedById === userId) {
      return;
    }

    // Check if user is admin
    const user = await userRepository.findById(userId);
    if (user?.role === 'admin') {
      return;
    }

    // Check team/workspace admin permissions
    if (invitation.teamId && await this.isTeamAdmin(userId, invitation.teamId)) {
      return;
    }

    if (invitation.workspaceId && await this.isWorkspaceAdmin(userId, invitation.workspaceId)) {
      return;
    }

    throw new ForbiddenError('You do not have access to this invitation');
  }

  private buildInvitationWhereConditions(filters: InvitationFilters, userId: string, userRole?: string): any {
    const conditions = [];

    // Non-admin users can only see invitations they sent or for teams/workspaces they manage
    if (userRole !== 'admin') {
      conditions.push(eq(invitationRepository['table']?.invitedById, userId));
    }

    if (filters.status) {
      if (Array.isArray(filters.status)) {
        conditions.push(inArray(invitationRepository['table']?.status, filters.status));
      } else {
        conditions.push(eq(invitationRepository['table']?.status, filters.status));
      }
    }

    if (filters.role) {
      if (Array.isArray(filters.role)) {
        conditions.push(inArray(invitationRepository['table']?.role, filters.role));
      } else {
        conditions.push(eq(invitationRepository['table']?.role, filters.role));
      }
    }

    if (filters.teamId) {
      conditions.push(eq(invitationRepository['table']?.teamId, filters.teamId));
    }

    if (filters.workspaceId) {
      conditions.push(eq(invitationRepository['table']?.workspaceId, filters.workspaceId));
    }

    if (filters.invitedById) {
      conditions.push(eq(invitationRepository['table']?.invitedById, filters.invitedById));
    }

    if (filters.email) {
      conditions.push(ilike(invitationRepository['table']?.email, `%${filters.email}%`));
    }

    if (filters.createdFrom) {
      conditions.push(gte(invitationRepository['table']?.createdAt, filters.createdFrom));
    }

    if (filters.createdTo) {
      conditions.push(lte(invitationRepository['table']?.createdAt, filters.createdTo));
    }

    if (filters.expiresFrom) {
      conditions.push(gte(invitationRepository['table']?.expiresAt, filters.expiresFrom));
    }

    if (filters.expiresTo) {
      conditions.push(lte(invitationRepository['table']?.expiresAt, filters.expiresTo));
    }

    return conditions.length > 0 ? and(...conditions) : undefined;
  }

  private validateInvitationData(data: InvitationCreateData): void {
    if (!data.email || !data.email.includes('@')) {
      throw new ValidationError('Valid email is required');
    }

    if (!data.teamId && !data.workspaceId) {
      throw new ValidationError('Either teamId or workspaceId must be provided');
    }

    if (data.role && !Object.values(InvitationRole).includes(data.role)) {
      throw new ValidationError('Invalid role');
    }

    if (data.expiresInDays && (data.expiresInDays < 1 || data.expiresInDays > this.MAX_EXPIRY_DAYS)) {
      throw new ValidationError(`Expiry days must be between 1 and ${this.MAX_EXPIRY_DAYS}`);
    }

    if (data.message && data.message.length > 500) {
      throw new ValidationError('Message must be less than 500 characters');
    }
  }

  private async verifyTeamInvitePermissions(teamId: string, userId: string): Promise<void> {
    const team = await teamRepository.findById(teamId);
    if (!team) {
      throw new NotFoundError('Team', teamId);
    }

    // Check if user is team admin or owner
    if (!await this.isTeamAdmin(userId, teamId)) {
      throw new ForbiddenError('You do not have permission to invite members to this team');
    }
  }

  private async verifyWorkspaceInvitePermissions(workspaceId: string, userId: string): Promise<void> {
    const workspace = await workspaceRepository.findById(workspaceId);
    if (!workspace) {
      throw new NotFoundError('Workspace', workspaceId);
    }

    // Check if user is workspace admin or owner
    if (!await this.isWorkspaceAdmin(userId, workspaceId)) {
      throw new ForbiddenError('You do not have permission to invite members to this workspace');
    }
  }

  private async isUserTeamMember(userId: string, teamId: string): Promise<boolean> {
    // This would check team membership - placeholder implementation
    return false;
  }

  private async isUserWorkspaceMember(userId: string, workspaceId: string): Promise<boolean> {
    // This would check workspace membership - placeholder implementation
    return false;
  }

  private async isTeamAdmin(userId: string, teamId: string): Promise<boolean> {
    // This would check if user is team admin - placeholder implementation
    return true;
  }

  private async isWorkspaceAdmin(userId: string, workspaceId: string): Promise<boolean> {
    // This would check if user is workspace admin - placeholder implementation
    return true;
  }

  private async findPendingInvitation(email: string, teamId?: string, workspaceId?: string): Promise<Invitation | null> {
    const conditions = [
      eq(invitationRepository['table']?.email, email.toLowerCase()),
      eq(invitationRepository['table']?.status, InvitationStatus.PENDING)
    ];

    if (teamId) {
      conditions.push(eq(invitationRepository['table']?.teamId, teamId));
    }

    if (workspaceId) {
      conditions.push(eq(invitationRepository['table']?.workspaceId, workspaceId));
    }

    const result = await invitationRepository.findMany({
      where: and(...conditions),
      limit: 1
    });

    return result.data[0] || null;
  }

  private async addUserToTeam(userId: string, teamId: string, role: string): Promise<void> {
    // This would add user to team - placeholder implementation
    console.log(`Adding user ${userId} to team ${teamId} with role ${role}`);
  }

  private async addUserToWorkspace(userId: string, workspaceId: string, role: string): Promise<void> {
    // This would add user to workspace - placeholder implementation
    console.log(`Adding user ${userId} to workspace ${workspaceId} with role ${role}`);
  }

  private async sendInvitationEmail(invitation: Invitation): Promise<void> {
    try {
      const inviter = await userRepository.findById(invitation.invitedById);
      const entityName = invitation.teamId ? 'team' : 'workspace';
      
      let entityDisplayName = entityName;
      if (invitation.teamId) {
        const team = await teamRepository.findById(invitation.teamId);
        entityDisplayName = team?.name || 'team';
      } else if (invitation.workspaceId) {
        const workspace = await workspaceRepository.findById(invitation.workspaceId);
        entityDisplayName = workspace?.name || 'workspace';
      }

      const invitationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/invitations/${invitation.token}`;

      await emailService.sendEmail({
        to: invitation.email,
        subject: `Invitation to join ${entityDisplayName}`,
        html: `
          <h2>You've been invited to join ${entityDisplayName}</h2>
          <p>${inviter?.firstName || 'Someone'} has invited you to join their ${entityName} on Task Management.</p>
          ${invitation.message ? `<p><strong>Message:</strong> ${invitation.message}</p>` : ''}
          <p><strong>Role:</strong> ${invitation.role}</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${invitationUrl}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Accept Invitation</a>
          </div>
          <p>This invitation will expire on ${invitation.expiresAt?.toLocaleDateString()}.</p>
          <p>If you don't have an account yet, you'll be able to create one after accepting the invitation.</p>
        `
      });
    } catch (error) {
      console.error('Failed to send invitation email:', error);
    }
  }
}

// Export singleton instance
export const invitationService = new InvitationService();
