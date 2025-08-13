/**
 * Workspace Application Service
 *
 * Handles workspace management, tenant isolation, billing integration, and user limits
 */

import {
  BaseApplicationService,
  ValidationResult,
  ValidationRule,
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
import { Email } from '../../domain/value-objects/email';
import { Workspace } from '../../domain/entities/workspace';
import { WorkspaceMember } from '../../domain/entities/workspace-member';
import { WorkspacePlan } from '../../domain/value-objects/workspace-plan';
import { injectable } from '../../shared/decorators/injectable.decorator';

export interface CreateWorkspaceRequest {
  name: string;
  slug: string;
  description?: string;
  ownerId: string;
  plan?: string;
  settings?: WorkspaceSettings;
}

export interface UpdateWorkspaceRequest {
  workspaceId: string;
  name?: string;
  description?: string;
  settings?: Partial<WorkspaceSettings>;
  updatedBy: string;
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
    private readonly emailService: EmailService
  ) {
    super(logger, eventPublisher);
  }

  /**
   * Create a new workspace
   */
  async createWorkspace(request: CreateWorkspaceRequest): Promise<WorkspaceId> {
    return await this.executeWithMonitoring('createWorkspace', async () => {
      // Validate input
      const validation = this.validateCreateWorkspaceRequest(request);
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }

      const ownerId = new UserId(request.ownerId);

      // Verify owner exists
      const owner = await this.userRepository.findById(ownerId);
      if (!owner) {
        throw new Error('Owner not found');
      }

      // Check if slug is available
      const existingWorkspace = await this.workspaceRepository.findBySlug(
        request.slug
      );
      if (existingWorkspace) {
        throw new Error('Workspace slug is already taken');
      }

      // Check user's workspace limits (if any)
      await this.checkUserWorkspaceLimit(ownerId);

      // Create workspace with default settings
      const defaultSettings: WorkspaceSettings = {
        allowPublicProjects: false,
        requireApprovalForMembers: true,
        maxProjects: this.getPlanLimits(request.plan || 'free').maxProjects,
        maxMembers: this.getPlanLimits(request.plan || 'free').maxMembers,
        maxStorageGB: this.getPlanLimits(request.plan || 'free').maxStorageGB,
        enableIntegrations: request.plan !== 'free',
        enableCustomFields: request.plan === 'enterprise',
        enableTimeTracking: request.plan !== 'free',
        enableReporting: request.plan !== 'free',
        defaultProjectVisibility: 'private',
        allowedEmailDomains: [],
        ssoEnabled: false,
        customBranding: {},
      };

      const workspace = Workspace.create({
        name: request.name,
        slug: request.slug,
        description: request.description || '',
        ownerId,
        plan: WorkspacePlan.fromString(request.plan || 'free'),
        settings: { ...defaultSettings, ...request.settings },
      });

      await this.workspaceRepository.save(workspace);

      // Add owner as admin member
      const ownerMember = WorkspaceMember.create({
        workspaceId: workspace.id,
        userId: ownerId,
        role: 'OWNER',
        addedBy: ownerId,
      });

      await this.workspaceRepository.addMember(ownerMember);

      // Initialize billing if not free plan
      if (request.plan && request.plan !== 'free') {
        await this.initializeBilling(workspace.id, request.plan);
      }

      this.logInfo('Workspace created successfully', {
        workspaceId: workspace.id.value,
        name: request.name,
        slug: request.slug,
        ownerId: request.ownerId,
        plan: request.plan || 'free',
      });

      return workspace.id;
    });
  }

  /**
   * Update workspace details
   */
  async updateWorkspace(request: UpdateWorkspaceRequest): Promise<void> {
    return await this.executeWithMonitoring('updateWorkspace', async () => {
      const validation = this.validateUpdateWorkspaceRequest(request);
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }

      const workspaceId = new WorkspaceId(request.workspaceId);
      const updatedBy = new UserId(request.updatedBy);

      const workspace = await this.workspaceRepository.findById(workspaceId);
      if (!workspace) {
        throw new Error('Workspace not found');
      }

      // Check permissions
      const canUpdate = await this.canUserUpdateWorkspace(
        updatedBy,
        workspaceId
      );
      if (!canUpdate) {
        throw new Error('Insufficient permissions to update workspace');
      }

      // Update workspace fields
      if (request.name !== undefined) {
        workspace.updateName(request.name, updatedBy);
      }
      if (request.description !== undefined) {
        workspace.updateDescription(request.description, updatedBy);
      }
      if (request.settings !== undefined) {
        workspace.updateSettings({
          ...workspace.settings,
          ...request.settings,
        }, updatedBy);
      }

      await this.workspaceRepository.save(workspace);

      // Clear cache
      await this.clearWorkspaceCaches(workspaceId);

      this.logInfo('Workspace updated successfully', {
        workspaceId: request.workspaceId,
        updatedBy: request.updatedBy,
      });
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
  async getUserWorkspaces(userId: string): Promise<WorkspaceDto[]> {
    return await this.executeWithMonitoring('getUserWorkspaces', async () => {
      const userIdVO = new UserId(userId);

      const workspaces = await this.workspaceRepository.findByUserId(userIdVO);
      const workspaceDtos: WorkspaceDto[] = [];

      for (const workspace of workspaces) {
        const dto = await this.mapWorkspaceToDto(workspace);
        workspaceDtos.push(dto);
      }

      return workspaceDtos;
    });
  }

  /**
   * Invite member to workspace
   */
  async inviteMember(request: InviteMemberRequest): Promise<void> {
    return await this.executeWithMonitoring('inviteMember', async () => {
      const workspaceId = new WorkspaceId(request.workspaceId);
      const invitedBy = new UserId(request.invitedBy);
      const email = new Email(request.email);

      const workspace = await this.workspaceRepository.findById(workspaceId);
      if (!workspace) {
        throw new Error('Workspace not found');
      }

      // Check permissions
      const canInvite = await this.canUserInviteMembers(invitedBy, workspaceId);
      if (!canInvite) {
        throw new Error('Insufficient permissions to invite members');
      }

      // Check workspace member limits
      const usage = await this.getWorkspaceUsage(workspaceId);
      if (usage.members.current >= usage.members.limit) {
        throw new Error('Workspace member limit reached');
      }

      // Check if user is already a member
      const existingUser = await this.userRepository.findByEmail(email);
      if (existingUser) {
        const existingMember = await this.workspaceRepository.findMember(
          workspaceId,
          existingUser.id
        );
        if (existingMember) {
          throw new Error('User is already a member of this workspace');
        }
      }

      // Check for existing invitation
      const existingInvitation = await this.getActiveInvitation(
        workspaceId,
        email.value
      );
      if (existingInvitation) {
        throw new Error('User already has a pending invitation');
      }

      // Create invitation
      const invitation: WorkspaceInvitation = {
        id: `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        workspaceId: workspaceId.value,
        email: email.value,
        role: request.role,
        invitedBy: invitedBy.value,
        message: request.message || '',
        token: this.generateInvitationToken(),
        expiresAt: new Date(Date.now() + this.INVITATION_EXPIRY),
        createdAt: new Date(),
      };

      // Store invitation
      await this.storeInvitation(invitation);

      // Send invitation email
      const inviter = await this.userRepository.findById(invitedBy);
      await this.emailService.sendWorkspaceInvitation({
        recipientEmail: email.value,
        workspaceName: workspace.name,
        inviterName: inviter
          ? `${inviter.firstName} ${inviter.lastName}`
          : 'Team Member',
        invitationLink: `${process.env['APP_URL']}/workspaces/join?token=${invitation.token}`,
      });

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
      const userIdVO = new UserId(userId);
      const removedByVO = new UserId(removedBy);

      const workspace = await this.workspaceRepository.findById(workspaceIdVO);
      if (!workspace) {
        throw new Error('Workspace not found');
      }

      // Check permissions
      const canRemove = await this.canUserManageMembers(
        removedByVO,
        workspaceIdVO
      );
      if (!canRemove) {
        throw new Error('Insufficient permissions to remove members');
      }

      // Cannot remove workspace owner
      if (workspace.ownerId.equals(userIdVO)) {
        throw new Error('Cannot remove workspace owner');
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

      this.logInfo('Member removed from workspace', {
        workspaceId,
        userId,
        removedBy,
      });
    });
  }

  /**
   * Get workspace members
   */
  async getWorkspaceMembers(
    workspaceId: string,
    userId: string
  ): Promise<WorkspaceMemberDto[]> {
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
        return cachedMembers;
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

      return memberDtos;
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

  // Private helper methods
  private validateCreateWorkspaceRequest(
    request: CreateWorkspaceRequest
  ): ValidationResult {
    return this.validateInput(request, [
      new RequiredFieldValidationRule('name', 'Workspace Name'),
      new RequiredFieldValidationRule('slug', 'Workspace Slug'),
      new RequiredFieldValidationRule('ownerId', 'Owner ID'),
      new LengthValidationRule('name', 1, 100, 'Workspace Name'),
      new LengthValidationRule('slug', 3, 50, 'Workspace Slug'),
    ]);
  }

  private validateUpdateWorkspaceRequest(
    request: UpdateWorkspaceRequest
  ): ValidationResult {
    const rules: ValidationRule<UpdateWorkspaceRequest>[] = [
      new RequiredFieldValidationRule('workspaceId', 'Workspace ID'),
      new RequiredFieldValidationRule('updatedBy', 'Updated By'),
    ];

    if (request.name !== undefined) {
      rules.push(new LengthValidationRule('name', 1, 100, 'Workspace Name'));
    }

    return this.validateInput(request, rules);
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
