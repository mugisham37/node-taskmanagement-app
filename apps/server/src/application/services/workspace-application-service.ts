/**
 * Workspace Application Service
 *
 * Handles workspace management, tenant isolation, billing integration, and user limits
 */

import {
  BaseApplicationService,
  ValidationResult,
  RequiredFieldValidationRule,
  LengthValidationRule,
} from './base-application-service';
import { LoggingService } from '../../infrastructure/monitoring/logging-service';
import { DomainEventPublisher } from '../../domain/events/domain-event-publisher';
import { IWorkspaceRepository } from '../../domain/repositories/workspace-repository';
import { IUserRepository } from '../../domain/repositories/user-repository';
import { CacheService } from '../../infrastructure/caching/cache-service';
import { EmailService } from '../../infrastructure/external-services/email-service';
import { WorkspaceId } from '../../domain/value-objects/workspace-id';
import { UserId } from '../../domain/value-objects/user-id';
import { Workspace } from '../../domain/entities/workspace';
import { WorkspaceMember } from '../../domain/entities/workspace-member';
import { injectable } from '../../shared/decorators/injectable.decorator';
import { ICommandBus } from '../cqrs/command';
import {
  CreateWorkspaceCommand,
  UpdateWorkspaceCommand,
  InviteUserToWorkspaceCommand,
  RemoveUserFromWorkspaceCommand,
  TransferWorkspaceOwnershipCommand,
  ArchiveWorkspaceCommand
} from '../commands/workspace-commands';

export interface CreateWorkspaceRequest {
  name: string;
  slug?: string | undefined;
  description?: string | null | undefined;
  ownerId?: string | undefined;
  plan?: string | undefined;
  settings?: WorkspaceSettings | undefined;
}

export interface UpdateWorkspaceRequest {
  workspaceId?: string | undefined;
  name?: string | undefined;
  description?: string | null | undefined;
  settings?: Partial<WorkspaceSettings> | undefined;
  updatedBy?: string | undefined;
}

export interface WorkspaceSettings {
  allowPublicProjects: boolean;
  requireApprovalForMembers: boolean;
  maxProjects: number;
  maxMembers: number;
  maxStorageGB: number;
  enableIntegrations: boolean;
  enableCustomFields: boolean;
  enableTimeTracking: boolean;
  enableReporting: boolean;
  defaultProjectVisibility: 'private' | 'internal' | 'public';
  allowedEmailDomains: string[];
  ssoEnabled: boolean;
  ssoProvider?: string;
  customBranding: {
    logoUrl?: string;
    primaryColor?: string;
    secondaryColor?: string;
  };
}

export interface WorkspaceDto {
  id: string;
  name: string;
  slug: string;
  description?: string;
  ownerId: string;
  plan: string;
  settings: WorkspaceSettings;
  memberCount: number;
  projectCount: number;
  storageUsedGB: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  owner: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

export interface WorkspaceMemberDto {
  id: string;
  workspaceId: string;
  userId: string;
  role: string;
  permissions: string[];
  joinedAt: Date;
  lastActiveAt?: Date | undefined;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

export interface InviteMemberRequest {
  workspaceId: string;
  email: string;
  role: string;
  invitedBy: string;
  message?: string;
}

export interface WorkspaceInvitation {
  id: string;
  workspaceId: string;
  email: string;
  role: string;
  invitedBy: string;
  message?: string;
  token: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface WorkspaceUsage {
  projects: {
    current: number;
    limit: number;
  };
  members: {
    current: number;
    limit: number;
  };
  storage: {
    currentGB: number;
    limitGB: number;
  };
  apiCalls: {
    currentMonth: number;
    limit: number;
  };
}

export interface BillingInfo {
  plan: string;
  status: 'active' | 'past_due' | 'canceled' | 'trialing';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  nextBillingDate?: Date;
  amount: number;
  currency: string;
  paymentMethod?: {
    type: string;
    last4: string;
    expiryMonth: number;
    expiryYear: number;
  };
}

@injectable()
export class WorkspaceApplicationService extends BaseApplicationService {
  private readonly WORKSPACE_CACHE_TTL = 3600; // 1 hour
  private readonly MEMBER_CACHE_TTL = 1800; // 30 minutes
  private readonly INVITATION_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 days

  constructor(
    logger: LoggingService,
    eventPublisher: DomainEventPublisher,
    private readonly workspaceRepository: IWorkspaceRepository,
    private readonly userRepository: IUserRepository,
    private readonly cacheService: CacheService,
    private readonly emailService: EmailService,
    private readonly commandBus: ICommandBus
  ) {
    super(logger, eventPublisher);
  }

  /**
   * Create a new workspace
   */
  async createWorkspace(userId: string, request: CreateWorkspaceRequest): Promise<WorkspaceId> {
    return await this.executeWithMonitoring('createWorkspace', async () => {
      // Validate input
      const validation = this.validateCreateWorkspaceRequest({
        ...request,
        ownerId: userId,
      });
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }

      const ownerId = new UserId(userId);

      // Check user workspace limits
      await this.checkUserWorkspaceLimit(ownerId);

      // Validate and get plan limits
      const plan = request.plan || 'free';
      const planLimits = this.getPlanLimits(plan);
      if (!planLimits) {
        throw new Error(`Invalid workspace plan: ${plan}`);
      }

      // Use command pattern for workspace creation
      const command = new CreateWorkspaceCommand(
        request.name,
        request.description || '',
        ownerId,
        ownerId
      );

      const workspaceId = await this.commandBus.send<WorkspaceId>(command);

      // Initialize billing for the workspace
      await this.initializeBilling(workspaceId, request.plan || 'free');

      this.logInfo('Workspace created successfully', {
        workspaceId: workspaceId.value,
        name: request.name,
        ownerId: userId,
      });

      return workspaceId;
    });
  }

  /**
   * Update workspace details
   */
  async updateWorkspace(userId: string, workspaceId: string, request: UpdateWorkspaceRequest): Promise<WorkspaceDto> {
    return await this.executeWithMonitoring('updateWorkspace', async () => {
      const workspaceIdVO = new WorkspaceId(workspaceId);
      const updatedBy = new UserId(userId);

      // Use command pattern for workspace update
      const command = new UpdateWorkspaceCommand(
        workspaceIdVO,
        updatedBy,
        request.name,
        request.description || undefined
      );

      await this.commandBus.send(command);

      // Clear cache
      await this.clearWorkspaceCaches(workspaceIdVO);

      this.logInfo('Workspace updated successfully', {
        workspaceId,
        updatedBy: userId,
      });

      // Return updated workspace
      const workspace = await this.workspaceRepository.findById(workspaceIdVO);
      if (!workspace) {
        throw new Error('Workspace not found after update');
      }

      return await this.mapWorkspaceToDto(workspace);
    });
  }

  /**
   * Get workspace by ID
   */
  async getWorkspaceById(
    workspaceId: string,
    userId: string
  ): Promise<WorkspaceDto> {
    return await this.executeWithMonitoring('getWorkspaceById', async () => {
      const workspaceIdVO = new WorkspaceId(workspaceId);
      const userIdVO = new UserId(userId);

      // Check cache first
      const cacheKey = `workspace:${workspaceId}`;
      const cachedWorkspace =
        await this.cacheService.get<WorkspaceDto>(cacheKey);
      if (cachedWorkspace) {
        // Verify user still has access
        const hasAccess = await this.canUserAccessWorkspace(
          userIdVO,
          workspaceIdVO
        );
        if (hasAccess) {
          return cachedWorkspace;
        }
      }

      const workspace = await this.workspaceRepository.findById(workspaceIdVO);
      if (!workspace) {
        throw new Error('Workspace not found');
      }

      // Check permissions
      const canView = await this.canUserAccessWorkspace(
        userIdVO,
        workspaceIdVO
      );
      if (!canView) {
        throw new Error('Insufficient permissions to access workspace');
      }

      const workspaceDto = await this.mapWorkspaceToDto(workspace);

      // Cache the result
      await this.cacheService.set(
        cacheKey,
        workspaceDto,
        this.WORKSPACE_CACHE_TTL
      );

      return workspaceDto;
    });
  }

  /**
   * Get user's workspaces
   */
  async getUserWorkspaces(userId: string, _query?: any): Promise<{ workspaces: WorkspaceDto[]; total: number }> {
    return await this.executeWithMonitoring('getUserWorkspaces', async () => {
      const userIdVO = new UserId(userId);

      const workspaces = await this.workspaceRepository.findByUserId(userIdVO);
      const workspaceDtos: WorkspaceDto[] = [];

      for (const workspace of workspaces) {
        const dto = await this.mapWorkspaceToDto(workspace);
        workspaceDtos.push(dto);
      }

      return {
        workspaces: workspaceDtos,
        total: workspaceDtos.length,
      };
    });
  }

  /**
   * Delete workspace
   */
  async deleteWorkspace(userId: string, workspaceId: string): Promise<void> {
    return await this.executeWithMonitoring('deleteWorkspace', async () => {
      const workspaceIdVO = new WorkspaceId(workspaceId);
      const userIdVO = new UserId(userId);

      const workspace = await this.workspaceRepository.findById(workspaceIdVO);
      if (!workspace) {
        throw new Error('Workspace not found');
      }

      // Only owner can delete workspace
      if (!workspace.ownerId.equals(userIdVO)) {
        throw new Error('Only workspace owner can delete the workspace');
      }

      await this.workspaceRepository.delete(workspaceIdVO);

      // Clear cache
      await this.clearWorkspaceCaches(workspaceIdVO);

      this.logInfo('Workspace deleted successfully', {
        workspaceId,
        deletedBy: userId,
      });
    });
  }

  /**
   * Deactivate workspace
   */
  async deactivateWorkspace(userId: string, workspaceId: string): Promise<WorkspaceDto> {
    return await this.executeWithMonitoring('deactivateWorkspace', async () => {
      const workspaceIdVO = new WorkspaceId(workspaceId);
      const userIdVO = new UserId(userId);

      const workspace = await this.workspaceRepository.findById(workspaceIdVO);
      if (!workspace) {
        throw new Error('Workspace not found');
      }

      // Check permissions
      const canDeactivate = await this.canUserUpdateWorkspace(userIdVO, workspaceIdVO);
      if (!canDeactivate) {
        throw new Error('Insufficient permissions to deactivate workspace');
      }

      workspace.deactivate();
      await this.workspaceRepository.save(workspace);

      // Clear cache
      await this.clearWorkspaceCaches(workspaceIdVO);

      return await this.mapWorkspaceToDto(workspace);
    });
  }

  /**
   * Activate workspace
   */
  async activateWorkspace(userId: string, workspaceId: string): Promise<WorkspaceDto> {
    return await this.executeWithMonitoring('activateWorkspace', async () => {
      const workspaceIdVO = new WorkspaceId(workspaceId);
      const userIdVO = new UserId(userId);

      const workspace = await this.workspaceRepository.findById(workspaceIdVO);
      if (!workspace) {
        throw new Error('Workspace not found');
      }

      // Check permissions
      const canActivate = await this.canUserUpdateWorkspace(userIdVO, workspaceIdVO);
      if (!canActivate) {
        throw new Error('Insufficient permissions to activate workspace');
      }

      workspace.activate();
      await this.workspaceRepository.save(workspace);

      // Clear cache
      await this.clearWorkspaceCaches(workspaceIdVO);

      return await this.mapWorkspaceToDto(workspace);
    });
  }

  /**
   * Get workspace statistics
   */
  async getWorkspaceStats(userId: string, workspaceId: string): Promise<any> {
    return await this.executeWithMonitoring('getWorkspaceStats', async () => {
      const workspaceIdVO = new WorkspaceId(workspaceId);
      const userIdVO = new UserId(userId);

      // Check permissions
      const canView = await this.canUserAccessWorkspace(userIdVO, workspaceIdVO);
      if (!canView) {
        throw new Error('Insufficient permissions to view workspace stats');
      }

      const usage = await this.getWorkspaceUsage(workspaceIdVO);
      const memberCount = await this.workspaceRepository.getMemberCount(workspaceIdVO);
      const projectCount = await this.workspaceRepository.getProjectCount(workspaceIdVO);

      return {
        memberCount,
        projectCount,
        storageUsage: usage,
        tasksCount: 0, // TODO: Implement when task service is available
        completedTasksCount: 0, // TODO: Implement when task service is available
      };
    });
  }

  /**
   * Invite member to workspace
   */
  async inviteMember(request: InviteMemberRequest): Promise<void> {
    return await this.executeWithMonitoring('inviteMember', async () => {
      const workspaceId = new WorkspaceId(request.workspaceId);
      const invitedBy = new UserId(request.invitedBy);

      // Use command pattern for workspace invitation
      const command = new InviteUserToWorkspaceCommand(
        workspaceId,
        request.email,
        invitedBy,
        invitedBy
      );

      await this.commandBus.send(command);

      this.logInfo('Workspace invitation sent', {
        workspaceId: request.workspaceId,
        email: request.email,
        role: request.role,
        invitedBy: request.invitedBy,
      });
    });
  }

  /**
   * Accept workspace invitation
   */
  async acceptInvitation(token: string, userId: string): Promise<void> {
    return await this.executeWithMonitoring('acceptInvitation', async () => {
      const userIdVO = new UserId(userId);

      const invitation = await this.getInvitationByToken(token);
      if (!invitation) {
        throw new Error('Invalid or expired invitation');
      }

      if (invitation.expiresAt < new Date()) {
        throw new Error('Invitation has expired');
      }

      const workspaceId = new WorkspaceId(invitation.workspaceId);
      const workspace = await this.workspaceRepository.findById(workspaceId);
      if (!workspace) {
        throw new Error('Workspace not found');
      }

      const user = await this.userRepository.findById(userIdVO);
      if (!user) {
        throw new Error('User not found');
      }

      // Verify email matches
      if (user.email.value !== invitation.email) {
        throw new Error('Email mismatch');
      }

      // Check if already a member
      const existingMember = await this.workspaceRepository.findMember(
        workspaceId,
        userIdVO
      );
      if (existingMember) {
        throw new Error('User is already a member of this workspace');
      }

      // Add member
      const member = WorkspaceMember.create({
        workspaceId,
        userId: userIdVO,
        role: invitation.role as 'OWNER' | 'ADMIN' | 'MEMBER',
        addedBy: new UserId(invitation.invitedBy),
      });

      await this.workspaceRepository.addMember(member);

      // Remove invitation
      await this.removeInvitation(token);

      // Clear member cache
      await this.clearMemberCaches(workspaceId);

      this.logInfo('Workspace invitation accepted', {
        workspaceId: invitation.workspaceId,
        userId: userId,
        role: invitation.role,
      });
    });
  }

  /**
   * Remove member from workspace
   */
  async removeMember(
    workspaceId: string,
    userId: string,
    removedBy: string
  ): Promise<void> {
    return await this.executeWithMonitoring('removeMember', async () => {
      const workspaceIdVO = new WorkspaceId(workspaceId);
      const userToRemoveVO = new UserId(userId);
      const removedByVO = new UserId(removedBy);

      // Use command pattern for removing workspace member
      const command = new RemoveUserFromWorkspaceCommand(
        workspaceIdVO,
        userToRemoveVO,
        removedByVO,
        removedByVO
      );

      await this.commandBus.send(command);

      // Clear member cache
      await this.clearMemberCaches(workspaceIdVO);

      this.logInfo('Member removed from workspace', {
        workspaceId,
        userId,
        removedBy,
      });
    });
  }

  /**
   * Get workspace members with pagination
   */
  async getWorkspaceMembers(
    userId: string,
    workspaceId: string,
    _query: any
  ): Promise<{ members: WorkspaceMemberDto[]; total: number }> {
    return await this.executeWithMonitoring('getWorkspaceMembers', async () => {
      const workspaceIdVO = new WorkspaceId(workspaceId);
      const userIdVO = new UserId(userId);

      // Check permissions
      const canView = await this.canUserAccessWorkspace(
        userIdVO,
        workspaceIdVO
      );
      if (!canView) {
        throw new Error('Insufficient permissions to view workspace members');
      }

      // Check cache first
      const cacheKey = `workspace-members:${workspaceId}`;
      const cachedMembers =
        await this.cacheService.get<WorkspaceMemberDto[]>(cacheKey);
      if (cachedMembers) {
        return {
          members: cachedMembers,
          total: cachedMembers.length,
        };
      }

      const members =
        await this.workspaceRepository.getWorkspaceMembers(workspaceIdVO);
      const memberDtos: WorkspaceMemberDto[] = [];

      for (const member of members) {
        const user = await this.userRepository.findById(member.userId);
        if (user) {
          memberDtos.push({
            id: member.id,
            workspaceId: member.workspaceId.value,
            userId: member.userId.value,
            role: member.role,
            permissions: member.getPermissions(),
            joinedAt: member.joinedAt,
            lastActiveAt: member.lastActiveAt,
            user: {
              id: user.id.value,
              firstName: user.firstName,
              lastName: user.lastName,
              email: user.email.value,
            },
          });
        }
      }

      // Cache the result
      await this.cacheService.set(cacheKey, memberDtos, this.MEMBER_CACHE_TTL);

      return {
        members: memberDtos,
        total: memberDtos.length,
      };
    });
  }

  /**
   * Invite member to workspace
   */
  async inviteWorkspaceMember(
    userId: string,
    workspaceId: string,
    request: any
  ): Promise<any> {
    return await this.executeWithMonitoring('inviteWorkspaceMember', async () => {
      const workspaceIdVO = new WorkspaceId(workspaceId);
      const invitedBy = new UserId(userId);

      const workspace = await this.workspaceRepository.findById(workspaceIdVO);
      if (!workspace) {
        throw new Error('Workspace not found');
      }

      // Check permissions
      const canInvite = await this.canUserInviteMembers(invitedBy, workspaceIdVO);
      if (!canInvite) {
        throw new Error('Insufficient permissions to invite members');
      }

      // Check for existing active invitation
      const existingInvitation = await this.getActiveInvitation(workspaceIdVO, request.email);
      if (existingInvitation) {
        throw new Error('User already has a pending invitation to this workspace');
      }

      // Check if user is already a member
      const existingUser = await this.userRepository.findByEmail(request.email);
      if (existingUser) {
        const existingMember = await this.workspaceRepository.findMember(workspaceIdVO, existingUser.id);
        if (existingMember) {
          throw new Error('User is already a member of this workspace');
        }
      }

      // Generate invitation token
      const token = this.generateInvitationToken();
      const invitation: WorkspaceInvitation = {
        id: `inv_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`,
        token,
        workspaceId: workspaceId,
        email: request.email,
        role: request.role,
        invitedBy: userId,
        expiresAt: new Date(Date.now() + this.INVITATION_EXPIRY),
        createdAt: new Date(),
      };

      await this.storeInvitation(invitation);

      // Send invitation email
      await this.emailService.sendWorkspaceInvitation({
        recipientEmail: request.email,
        workspaceName: workspace.name,
        inviterName: 'User', // TODO: Get actual user name
        invitationLink: `${process.env['FRONTEND_URL'] || 'http://localhost:3000'}/invitations/${token}`,
      });

      return invitation;
    });
  }

  /**
   * Remove workspace member
   */
  async removeWorkspaceMember(
    userId: string,
    workspaceId: string,
    memberId: string
  ): Promise<void> {
    return await this.executeWithMonitoring('removeWorkspaceMember', async () => {
      const workspaceIdVO = new WorkspaceId(workspaceId);
      const userIdVO = new UserId(userId);
      const memberUserIdVO = new UserId(memberId);

      const workspace = await this.workspaceRepository.findById(workspaceIdVO);
      if (!workspace) {
        throw new Error('Workspace not found');
      }

      // Check permissions
      const canRemove = await this.canUserManageMembers(userIdVO, workspaceIdVO);
      if (!canRemove) {
        throw new Error('Insufficient permissions to remove members');
      }

      // Cannot remove workspace owner
      if (workspace.ownerId.equals(memberUserIdVO)) {
        throw new Error('Cannot remove workspace owner');
      }

      const member = await this.workspaceRepository.findMember(
        workspaceIdVO,
        memberUserIdVO
      );
      if (!member) {
        throw new Error('User is not a member of this workspace');
      }

      await this.workspaceRepository.removeMember(workspaceIdVO, memberUserIdVO);

      // Clear member cache
      await this.clearMemberCaches(workspaceIdVO);

      this.logInfo('Member removed from workspace', {
        workspaceId,
        memberId,
        removedBy: userId,
      });
    });
  }

  /**
   * Update workspace member
   */
  async updateWorkspaceMember(
    userId: string,
    workspaceId: string,
    memberId: string,
    request: any
  ): Promise<WorkspaceMemberDto> {
    return await this.executeWithMonitoring('updateWorkspaceMember', async () => {
      const workspaceIdVO = new WorkspaceId(workspaceId);
      const userIdVO = new UserId(userId);
      const memberUserIdVO = new UserId(memberId);

      const workspace = await this.workspaceRepository.findById(workspaceIdVO);
      if (!workspace) {
        throw new Error('Workspace not found');
      }

      // Check permissions
      const canUpdate = await this.canUserManageMembers(userIdVO, workspaceIdVO);
      if (!canUpdate) {
        throw new Error('Insufficient permissions to update members');
      }

      const member = await this.workspaceRepository.findMember(
        workspaceIdVO,
        memberUserIdVO
      );
      if (!member) {
        throw new Error('User is not a member of this workspace');
      }

      // Update member role
      if (request.role) {
        member.updateRole(request.role);
      }

      await this.workspaceRepository.addMember(member); // Use addMember to update

      // Clear member cache
      await this.clearMemberCaches(workspaceIdVO);

      // Return updated member DTO
      const user = await this.userRepository.findById(member.userId);
      return {
        id: member.id,
        workspaceId: member.workspaceId.value,
        userId: member.userId.value,
        role: member.role,
        permissions: member.getPermissions(),
        joinedAt: member.joinedAt,
        lastActiveAt: member.lastActiveAt,
        user: user ? {
          id: user.id.value,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email.value,
        } : {
          id: '',
          firstName: 'Unknown',
          lastName: 'User',
          email: '',
        },
      };
    });
  }

  /**
   * Leave workspace
   */
  async leaveWorkspace(userId: string, workspaceId: string): Promise<void> {
    return await this.executeWithMonitoring('leaveWorkspace', async () => {
      const workspaceIdVO = new WorkspaceId(workspaceId);
      const userIdVO = new UserId(userId);

      const workspace = await this.workspaceRepository.findById(workspaceIdVO);
      if (!workspace) {
        throw new Error('Workspace not found');
      }

      // Cannot leave if user is the owner
      if (workspace.ownerId.equals(userIdVO)) {
        throw new Error('Workspace owner cannot leave the workspace');
      }

      const member = await this.workspaceRepository.findMember(
        workspaceIdVO,
        userIdVO
      );
      if (!member) {
        throw new Error('User is not a member of this workspace');
      }

      await this.workspaceRepository.removeMember(workspaceIdVO, userIdVO);

      // Clear member cache
      await this.clearMemberCaches(workspaceIdVO);

      this.logInfo('User left workspace', {
        workspaceId,
        userId,
      });
    });
  }

  /**
   * Get workspace invitations
   */
  async getWorkspaceInvitations(userId: string, workspaceId: string): Promise<any[]> {
    return await this.executeWithMonitoring('getWorkspaceInvitations', async () => {
      const workspaceIdVO = new WorkspaceId(workspaceId);
      const userIdVO = new UserId(userId);

      // Check permissions
      const canView = await this.canUserManageMembers(userIdVO, workspaceIdVO);
      if (!canView) {
        throw new Error('Insufficient permissions to view invitations');
      }

      // This would typically query a database for invitations
      // For now, return empty array as invitations are stored in cache
      return [];
    });
  }

  /**
   * Cancel workspace invitation
   */
  async cancelWorkspaceInvitation(
    userId: string,
    workspaceId: string,
    invitationId: string
  ): Promise<void> {
    return await this.executeWithMonitoring('cancelWorkspaceInvitation', async () => {
      const workspaceIdVO = new WorkspaceId(workspaceId);
      const userIdVO = new UserId(userId);

      // Check permissions
      const canCancel = await this.canUserManageMembers(userIdVO, workspaceIdVO);
      if (!canCancel) {
        throw new Error('Insufficient permissions to cancel invitations');
      }

      await this.removeInvitation(invitationId);

      this.logInfo('Workspace invitation cancelled', {
        workspaceId,
        invitationId,
        cancelledBy: userId,
      });
    });
  }

  /**
   * Accept workspace invitation
   */
  async acceptWorkspaceInvitation(userId: string, invitationId: string): Promise<any> {
    return await this.executeWithMonitoring('acceptWorkspaceInvitation', async () => {
      const invitation = await this.getInvitationByToken(invitationId);
      if (!invitation) {
        throw new Error('Invalid or expired invitation');
      }

      const userIdVO = new UserId(userId);
      const workspaceId = new WorkspaceId(invitation.workspaceId);

      // Check if already a member
      const existingMember = await this.workspaceRepository.findMember(
        workspaceId,
        userIdVO
      );
      if (existingMember) {
        throw new Error('User is already a member of this workspace');
      }

      // Add member
      const member = WorkspaceMember.create({
        workspaceId,
        userId: userIdVO,
        role: invitation.role as 'OWNER' | 'ADMIN' | 'MEMBER',
        addedBy: new UserId(invitation.invitedBy),
      });

      await this.workspaceRepository.addMember(member);

      // Remove invitation
      await this.removeInvitation(invitationId);

      // Clear member cache
      await this.clearMemberCaches(workspaceId);

      this.logInfo('Workspace invitation accepted', {
        workspaceId: invitation.workspaceId,
        userId: userId,
        role: invitation.role,
      });

      // Return member DTO
      const user = await this.userRepository.findById(userIdVO);
      return {
        id: member.id,
        workspaceId: member.workspaceId.value,
        userId: member.userId.value,
        role: member.role,
        permissions: member.getPermissions(),
        joinedAt: member.joinedAt,
        lastActiveAt: member.lastActiveAt,
        user: user ? {
          id: user.id.value,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email.value,
        } : {
          id: '',
          firstName: 'Unknown',
          lastName: 'User',
          email: '',
        },
      };
    });
  }

  /**
   * Decline workspace invitation
   */
  async declineWorkspaceInvitation(userId: string, invitationId: string): Promise<void> {
    return await this.executeWithMonitoring('declineWorkspaceInvitation', async () => {
      const invitation = await this.getInvitationByToken(invitationId);
      if (!invitation) {
        throw new Error('Invalid or expired invitation');
      }

      await this.removeInvitation(invitationId);

      this.logInfo('Workspace invitation declined', {
        workspaceId: invitation.workspaceId,
        userId,
        invitationId,
      });
    });
  }

  /**
   * Get user's invitations
   */
  async getMyInvitations(_userId: string): Promise<any[]> {
    return await this.executeWithMonitoring('getMyInvitations', async () => {
      // This would typically query a database for user's pending invitations
      // For now, return empty array as invitations are stored in cache
      return [];
    });
  }

  /**
   * Get workspace usage statistics
   */
  async getWorkspaceUsage(workspaceId: WorkspaceId): Promise<WorkspaceUsage> {
    return await this.executeWithMonitoring('getWorkspaceUsage', async () => {
      const cacheKey = `workspace-usage:${workspaceId.value}`;
      const cachedUsage = await this.cacheService.get<WorkspaceUsage>(cacheKey);
      if (cachedUsage) {
        return cachedUsage;
      }

      const workspace = await this.workspaceRepository.findById(workspaceId);
      if (!workspace) {
        throw new Error('Workspace not found');
      }

      const usage =
        await this.workspaceRepository.getUsageStatistics(workspaceId);

      // Cache for 5 minutes
      await this.cacheService.set(cacheKey, usage, 300);

      return usage;
    });
  }

  /**
   * Archive workspace
   */
  async archiveWorkspace(workspaceId: string, archivedBy: string): Promise<void> {
    return await this.executeWithMonitoring('archiveWorkspace', async () => {
      const workspaceIdVO = new WorkspaceId(workspaceId);
      const archivedByVO = new UserId(archivedBy);

      // Use command pattern for archiving workspace
      const command = new ArchiveWorkspaceCommand(
        workspaceIdVO,
        archivedByVO,
        archivedByVO
      );

      await this.commandBus.send(command);

      this.logInfo('Workspace archived successfully', {
        workspaceId,
        archivedBy,
      });
    });
  }

  /**
   * Transfer workspace ownership
   */
  async transferOwnership(
    workspaceId: string,
    newOwnerId: string,
    currentOwnerId: string
  ): Promise<void> {
    return await this.executeWithMonitoring('transferOwnership', async () => {
      const workspaceIdVO = new WorkspaceId(workspaceId);
      const newOwnerIdVO = new UserId(newOwnerId);
      const currentOwnerIdVO = new UserId(currentOwnerId);

      // Use command pattern for transferring workspace ownership
      const command = new TransferWorkspaceOwnershipCommand(
        workspaceIdVO,
        newOwnerIdVO,
        currentOwnerIdVO,
        currentOwnerIdVO
      );

      await this.commandBus.send(command);

      // Clear caches
      await this.clearWorkspaceCaches(workspaceIdVO);

      this.logInfo('Workspace ownership transferred successfully', {
        workspaceId,
        newOwnerId,
        currentOwnerId,
      });
    });
  }

  // Private helper methods
  private validateCreateWorkspaceRequest(
    request: CreateWorkspaceRequest
  ): ValidationResult {
    return this.validateInput(request, [
      new RequiredFieldValidationRule('name', 'Workspace Name'),
      new RequiredFieldValidationRule('ownerId', 'Owner ID'),
      new LengthValidationRule('name', 1, 100, 'Workspace Name'),
    ]);
  }

  private getPlanLimits(plan: string) {
    const limits = {
      free: { maxProjects: 3, maxMembers: 5, maxStorageGB: 1 },
      pro: { maxProjects: 50, maxMembers: 25, maxStorageGB: 10 },
      enterprise: { maxProjects: -1, maxMembers: -1, maxStorageGB: 100 },
    };
    return limits[plan as keyof typeof limits] || limits.free;
  }

  private async checkUserWorkspaceLimit(userId: UserId): Promise<void> {
    const userWorkspaces = await this.workspaceRepository.findByUserId(userId);
    const ownedWorkspaces = userWorkspaces.filter(w =>
      w.ownerId.equals(userId)
    );

    // Free users can own max 1 workspace
    if (ownedWorkspaces.length >= 1) {
      throw new Error('User has reached workspace ownership limit');
    }
  }

  private async canUserUpdateWorkspace(
    userId: UserId,
    workspaceId: WorkspaceId
  ): Promise<boolean> {
    const member = await this.workspaceRepository.findMember(
      workspaceId,
      userId
    );
    return !!member && (member.role === 'ADMIN' || member.role === 'OWNER');
  }

  private async canUserAccessWorkspace(
    userId: UserId,
    workspaceId: WorkspaceId
  ): Promise<boolean> {
    const member = await this.workspaceRepository.findMember(
      workspaceId,
      userId
    );
    return member !== null;
  }

  private async canUserInviteMembers(
    userId: UserId,
    workspaceId: WorkspaceId
  ): Promise<boolean> {
    const member = await this.workspaceRepository.findMember(
      workspaceId,
      userId
    );
    return !!member && (member.role === 'ADMIN' || member.role === 'OWNER');
  }

  private async canUserManageMembers(
    userId: UserId,
    workspaceId: WorkspaceId
  ): Promise<boolean> {
    const member = await this.workspaceRepository.findMember(
      workspaceId,
      userId
    );
    return !!member && (member.role === 'ADMIN' || member.role === 'OWNER');
  }

  private async mapWorkspaceToDto(workspace: Workspace): Promise<WorkspaceDto> {
    const owner = await this.userRepository.findById(workspace.ownerId);
    const memberCount = await this.workspaceRepository.getMemberCount(
      workspace.id
    );
    const projectCount = await this.workspaceRepository.getProjectCount(
      workspace.id
    );
    const storageUsed = await this.workspaceRepository.getStorageUsed(
      workspace.id
    );

    return {
      id: workspace.id.value,
      name: workspace.name,
      slug: workspace.slug,
      description: workspace.description,
      ownerId: workspace.ownerId.value,
      plan: workspace.plan.getValue(),
      settings: workspace.settings,
      memberCount,
      projectCount,
      storageUsedGB: storageUsed,
      isActive: workspace.isActive,
      createdAt: workspace.createdAt,
      updatedAt: workspace.updatedAt,
      owner: owner
        ? {
            id: owner.id.value,
            firstName: owner.firstName,
            lastName: owner.lastName,
            email: owner.email.value,
          }
        : {
            id: '',
            firstName: 'Unknown',
            lastName: 'User',
            email: '',
          },
    };
  }

  private generateInvitationToken(): string {
    return `inv_${Date.now()}_${Math.random().toString(36).substr(2, 16)}`;
  }

  private async storeInvitation(
    invitation: WorkspaceInvitation
  ): Promise<void> {
    const tokenKey = `invitation:${invitation.token}`;
    const emailKey = `invitation-email:${invitation.workspaceId}:${invitation.email}`;

    await Promise.all([
      this.cacheService.set(
        tokenKey,
        invitation,
        this.INVITATION_EXPIRY / 1000
      ),
      this.cacheService.set(
        emailKey,
        invitation,
        this.INVITATION_EXPIRY / 1000
      ),
    ]);
  }

  private async getInvitationByToken(
    token: string
  ): Promise<WorkspaceInvitation | null> {
    const tokenKey = `invitation:${token}`;
    return await this.cacheService.get<WorkspaceInvitation>(tokenKey);
  }

  private async getActiveInvitation(
    workspaceId: WorkspaceId,
    email: string
  ): Promise<WorkspaceInvitation | null> {
    const emailKey = `invitation-email:${workspaceId.value}:${email}`;
    return await this.cacheService.get<WorkspaceInvitation>(emailKey);
  }

  private async removeInvitation(token: string): Promise<void> {
    const invitation = await this.getInvitationByToken(token);
    if (invitation) {
      const tokenKey = `invitation:${token}`;
      const emailKey = `invitation-email:${invitation.workspaceId}:${invitation.email}`;

      await Promise.all([
        this.cacheService.delete(tokenKey),
        this.cacheService.delete(emailKey),
      ]);
    }
  }

  private async initializeBilling(
    workspaceId: WorkspaceId,
    plan: string
  ): Promise<void> {
    // This would integrate with a billing service like Stripe
    this.logInfo('Billing initialized for workspace', {
      workspaceId: workspaceId.value,
      plan,
    });
  }

  private async clearWorkspaceCaches(workspaceId: WorkspaceId): Promise<void> {
    await Promise.all([
      this.cacheService.delete(`workspace:${workspaceId.value}`),
      this.cacheService.delete(`workspace-usage:${workspaceId.value}`),
      this.clearMemberCaches(workspaceId),
    ]);
  }

  private async clearMemberCaches(workspaceId: WorkspaceId): Promise<void> {
    await this.cacheService.delete(`workspace-members:${workspaceId.value}`);
  }
}
