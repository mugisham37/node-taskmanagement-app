import { BaseEntity } from '../../shared/entities/BaseEntity';
import { DomainEvent } from '../../shared/events/DomainEvent';
import { WorkspaceId } from '../value-objects/WorkspaceId';
import { UserId } from '../../authentication/value-objects/UserId';

export interface WorkspaceSettings {
  theme?: string;
  defaultTaskView?: string;
  allowGuestAccess?: boolean;
  requireTaskApproval?: boolean;
  enableTimeTracking?: boolean;
  workingDays?: number[];
  workingHours?: {
    start: string;
    end: string;
  };
}

export interface WorkspaceBranding {
  logo?: string;
  primaryColor?: string;
  secondaryColor?: string;
  customCss?: string;
}

export interface WorkspaceSecuritySettings {
  enforcePasswordPolicy?: boolean;
  requireMfa?: boolean;
  sessionTimeout?: number;
  allowedDomains?: string[];
  ipWhitelist?: string[];
}

export enum SubscriptionTier {
  FREE = 'free',
  BASIC = 'basic',
  PROFESSIONAL = 'professional',
  ENTERPRISE = 'enterprise',
}

export interface WorkspaceProps {
  id: WorkspaceId;
  name: string;
  slug: string;
  description?: string;
  ownerId: UserId;
  subscriptionTier: SubscriptionTier;
  billingEmail?: string;
  settings: WorkspaceSettings;
  branding: WorkspaceBranding;
  securitySettings: WorkspaceSecuritySettings;
  isActive: boolean;
  memberLimit: number;
  projectLimit: number;
  storageLimitGb: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

// Domain Events
export class WorkspaceCreatedEvent extends DomainEvent {
  constructor(
    public readonly workspaceId: WorkspaceId,
    public readonly name: string,
    public readonly ownerId: UserId
  ) {
    super('WorkspaceCreated', {
      workspaceId: workspaceId.value,
      name,
      ownerId: ownerId.value,
    });
  }
}

export class WorkspaceUpdatedEvent extends DomainEvent {
  constructor(
    public readonly workspaceId: WorkspaceId,
    public readonly changes: Partial<WorkspaceProps>
  ) {
    super('WorkspaceUpdated', {
      workspaceId: workspaceId.value,
      changes,
    });
  }
}

export class WorkspaceDeactivatedEvent extends DomainEvent {
  constructor(
    public readonly workspaceId: WorkspaceId,
    public readonly reason: string
  ) {
    super('WorkspaceDeactivated', {
      workspaceId: workspaceId.value,
      reason,
    });
  }
}

export class WorkspaceDeletedEvent extends DomainEvent {
  constructor(
    public readonly workspaceId: WorkspaceId,
    public readonly deletedBy: UserId
  ) {
    super('WorkspaceDeleted', {
      workspaceId: workspaceId.value,
      deletedBy: deletedBy.value,
    });
  }
}

export class WorkspaceSubscriptionChangedEvent extends DomainEvent {
  constructor(
    public readonly workspaceId: WorkspaceId,
    public readonly oldTier: SubscriptionTier,
    public readonly newTier: SubscriptionTier
  ) {
    super('WorkspaceSubscriptionChanged', {
      workspaceId: workspaceId.value,
      oldTier,
      newTier,
    });
  }
}

export class Workspace extends BaseEntity<WorkspaceProps> {
  private constructor(props: WorkspaceProps) {
    super(props);
  }

  public static create(
    props: Omit<WorkspaceProps, 'id' | 'createdAt' | 'updatedAt'>
  ): Workspace {
    // Validate workspace name
    if (!props.name || props.name.trim().length === 0) {
      throw new Error('Workspace name cannot be empty');
    }

    if (props.name.length > 100) {
      throw new Error('Workspace name cannot exceed 100 characters');
    }

    // Validate slug
    if (!props.slug || props.slug.trim().length === 0) {
      throw new Error('Workspace slug cannot be empty');
    }

    if (!/^[a-z0-9-]+$/.test(props.slug)) {
      throw new Error(
        'Workspace slug can only contain lowercase letters, numbers, and hyphens'
      );
    }

    // Set default limits based on subscription tier
    const limits = this.getDefaultLimits(props.subscriptionTier);

    const workspace = new Workspace({
      ...props,
      id: WorkspaceId.generate(),
      memberLimit: props.memberLimit || limits.memberLimit,
      projectLimit: props.projectLimit || limits.projectLimit,
      storageLimitGb: props.storageLimitGb || limits.storageLimitGb,
      settings: {
        theme: 'light',
        defaultTaskView: 'list',
        allowGuestAccess: false,
        requireTaskApproval: false,
        enableTimeTracking: true,
        workingDays: [1, 2, 3, 4, 5], // Monday to Friday
        workingHours: { start: '09:00', end: '17:00' },
        ...props.settings,
      },
      branding: {
        primaryColor: '#3B82F6',
        secondaryColor: '#64748B',
        ...props.branding,
      },
      securitySettings: {
        enforcePasswordPolicy: false,
        requireMfa: false,
        sessionTimeout: 8 * 60 * 60 * 1000, // 8 hours
        allowedDomains: [],
        ipWhitelist: [],
        ...props.securitySettings,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    workspace.addDomainEvent(
      new WorkspaceCreatedEvent(workspace.id, workspace.name, workspace.ownerId)
    );

    return workspace;
  }

  public static fromPersistence(props: WorkspaceProps): Workspace {
    return new Workspace(props);
  }

  private static getDefaultLimits(tier: SubscriptionTier) {
    const limits = {
      [SubscriptionTier.FREE]: {
        memberLimit: 5,
        projectLimit: 3,
        storageLimitGb: 1,
      },
      [SubscriptionTier.BASIC]: {
        memberLimit: 25,
        projectLimit: 10,
        storageLimitGb: 10,
      },
      [SubscriptionTier.PROFESSIONAL]: {
        memberLimit: 100,
        projectLimit: 50,
        storageLimitGb: 100,
      },
      [SubscriptionTier.ENTERPRISE]: {
        memberLimit: -1,
        projectLimit: -1,
        storageLimitGb: 1000,
      }, // Unlimited
    };
    return limits[tier];
  }

  // Getters
  get id(): WorkspaceId {
    return this.props.id;
  }

  get name(): string {
    return this.props.name;
  }

  get slug(): string {
    return this.props.slug;
  }

  get description(): string | undefined {
    return this.props.description;
  }

  get ownerId(): UserId {
    return this.props.ownerId;
  }

  get subscriptionTier(): SubscriptionTier {
    return this.props.subscriptionTier;
  }

  get billingEmail(): string | undefined {
    return this.props.billingEmail;
  }

  get settings(): WorkspaceSettings {
    return { ...this.props.settings };
  }

  get branding(): WorkspaceBranding {
    return { ...this.props.branding };
  }

  get securitySettings(): WorkspaceSecuritySettings {
    return { ...this.props.securitySettings };
  }

  get isActive(): boolean {
    return this.props.isActive;
  }

  get memberLimit(): number {
    return this.props.memberLimit;
  }

  get projectLimit(): number {
    return this.props.projectLimit;
  }

  get storageLimitGb(): number {
    return this.props.storageLimitGb;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  get deletedAt(): Date | undefined {
    return this.props.deletedAt;
  }

  // Business methods
  public updateName(name: string): void {
    if (!name || name.trim().length === 0) {
      throw new Error('Workspace name cannot be empty');
    }

    if (name.length > 100) {
      throw new Error('Workspace name cannot exceed 100 characters');
    }

    const oldName = this.props.name;
    this.props.name = name.trim();
    this.props.updatedAt = new Date();

    this.addDomainEvent(
      new WorkspaceUpdatedEvent(this.id, { name: this.props.name })
    );
  }

  public updateDescription(description?: string): void {
    this.props.description = description;
    this.props.updatedAt = new Date();

    this.addDomainEvent(new WorkspaceUpdatedEvent(this.id, { description }));
  }

  public updateSettings(settings: Partial<WorkspaceSettings>): void {
    this.props.settings = {
      ...this.props.settings,
      ...settings,
    };
    this.props.updatedAt = new Date();

    this.addDomainEvent(
      new WorkspaceUpdatedEvent(this.id, { settings: this.props.settings })
    );
  }

  public updateBranding(branding: Partial<WorkspaceBranding>): void {
    this.props.branding = {
      ...this.props.branding,
      ...branding,
    };
    this.props.updatedAt = new Date();

    this.addDomainEvent(
      new WorkspaceUpdatedEvent(this.id, { branding: this.props.branding })
    );
  }

  public updateSecuritySettings(
    settings: Partial<WorkspaceSecuritySettings>
  ): void {
    this.props.securitySettings = {
      ...this.props.securitySettings,
      ...settings,
    };
    this.props.updatedAt = new Date();

    this.addDomainEvent(
      new WorkspaceUpdatedEvent(this.id, {
        securitySettings: this.props.securitySettings,
      })
    );
  }

  public changeSubscriptionTier(newTier: SubscriptionTier): void {
    const oldTier = this.props.subscriptionTier;
    this.props.subscriptionTier = newTier;

    // Update limits based on new tier
    const limits = Workspace.getDefaultLimits(newTier);
    this.props.memberLimit = limits.memberLimit;
    this.props.projectLimit = limits.projectLimit;
    this.props.storageLimitGb = limits.storageLimitGb;

    this.props.updatedAt = new Date();

    this.addDomainEvent(
      new WorkspaceSubscriptionChangedEvent(this.id, oldTier, newTier)
    );
  }

  public deactivate(reason: string): void {
    if (!this.props.isActive) {
      throw new Error('Workspace is already deactivated');
    }

    this.props.isActive = false;
    this.props.updatedAt = new Date();

    this.addDomainEvent(new WorkspaceDeactivatedEvent(this.id, reason));
  }

  public activate(): void {
    if (this.props.isActive) {
      throw new Error('Workspace is already active');
    }

    this.props.isActive = true;
    this.props.updatedAt = new Date();

    this.addDomainEvent(new WorkspaceUpdatedEvent(this.id, { isActive: true }));
  }

  public delete(deletedBy: UserId): void {
    if (this.props.deletedAt) {
      throw new Error('Workspace is already deleted');
    }

    this.props.deletedAt = new Date();
    this.props.isActive = false;
    this.props.updatedAt = new Date();

    this.addDomainEvent(new WorkspaceDeletedEvent(this.id, deletedBy));
  }

  public canAddMember(currentMemberCount: number): boolean {
    if (this.props.memberLimit === -1) return true; // Unlimited
    return currentMemberCount < this.props.memberLimit;
  }

  public canAddProject(currentProjectCount: number): boolean {
    if (this.props.projectLimit === -1) return true; // Unlimited
    return currentProjectCount < this.props.projectLimit;
  }

  public canUseStorage(
    currentStorageGb: number,
    additionalStorageGb: number
  ): boolean {
    return currentStorageGb + additionalStorageGb <= this.props.storageLimitGb;
  }

  public isDeleted(): boolean {
    return !!this.props.deletedAt;
  }

  public isOwner(userId: UserId): boolean {
    return this.props.ownerId.equals(userId);
  }

  public hasFeature(feature: string): boolean {
    const tierFeatures = {
      [SubscriptionTier.FREE]: ['basic_tasks', 'basic_projects'],
      [SubscriptionTier.BASIC]: [
        'basic_tasks',
        'basic_projects',
        'time_tracking',
        'file_attachments',
      ],
      [SubscriptionTier.PROFESSIONAL]: [
        'basic_tasks',
        'basic_projects',
        'time_tracking',
        'file_attachments',
        'advanced_analytics',
        'custom_fields',
      ],
      [SubscriptionTier.ENTERPRISE]: [
        'basic_tasks',
        'basic_projects',
        'time_tracking',
        'file_attachments',
        'advanced_analytics',
        'custom_fields',
        'sso',
        'audit_logs',
        'api_access',
      ],
    };

    return tierFeatures[this.props.subscriptionTier].includes(feature);
  }
}
