import { BaseEntity } from '../../shared/entities/BaseEntity';
import { DomainEvent } from '../../shared/events/DomainEvent';
import { TeamId } from '../value-objects/TeamId';
import { WorkspaceId } from '../value-objects/WorkspaceId';
import { ProjectId } from '../value-objects/ProjectId';
import { UserId } from '../../authentication/value-objects/UserId';

export enum TeamMemberRole {
  LEAD = 'LEAD',
  MEMBER = 'MEMBER',
}

export interface TeamMember {
  userId: UserId;
  role: TeamMemberRole;
  joinedAt: Date;
}

export interface TeamSettings {
  allowMemberInvites?: boolean;
  requireApprovalForTasks?: boolean;
  enableNotifications?: boolean;
  defaultTaskAssignment?: 'round_robin' | 'manual' | 'workload_based';
  maxTasksPerMember?: number;
  workingHours?: {
    start: string;
    end: string;
    days: number[];
  };
}

export interface TeamProps {
  id: TeamId;
  workspaceId: WorkspaceId;
  projectId?: ProjectId;
  name: string;
  description?: string;
  color: string;
  settings: TeamSettings;
  members: TeamMember[];
  createdAt: Date;
  updatedAt: Date;
}

// Domain Events
export class TeamCreatedEvent extends DomainEvent {
  constructor(
    public readonly teamId: TeamId,
    public readonly workspaceId: WorkspaceId,
    public readonly name: string,
    public readonly createdBy: UserId
  ) {
    super('TeamCreated', {
      teamId: teamId.value,
      workspaceId: workspaceId.value,
      name,
      createdBy: createdBy.value,
    });
  }
}

export class TeamUpdatedEvent extends DomainEvent {
  constructor(
    public readonly teamId: TeamId,
    public readonly changes: Partial<TeamProps>
  ) {
    super('TeamUpdated', {
      teamId: teamId.value,
      changes,
    });
  }
}

export class TeamMemberAddedEvent extends DomainEvent {
  constructor(
    public readonly teamId: TeamId,
    public readonly memberId: UserId,
    public readonly role: TeamMemberRole,
    public readonly addedBy: UserId
  ) {
    super('TeamMemberAdded', {
      teamId: teamId.value,
      memberId: memberId.value,
      role,
      addedBy: addedBy.value,
    });
  }
}

export class TeamMemberRemovedEvent extends DomainEvent {
  constructor(
    public readonly teamId: TeamId,
    public readonly memberId: UserId,
    public readonly removedBy: UserId
  ) {
    super('TeamMemberRemoved', {
      teamId: teamId.value,
      memberId: memberId.value,
      removedBy: removedBy.value,
    });
  }
}

export class TeamMemberRoleChangedEvent extends DomainEvent {
  constructor(
    public readonly teamId: TeamId,
    public readonly memberId: UserId,
    public readonly oldRole: TeamMemberRole,
    public readonly newRole: TeamMemberRole,
    public readonly changedBy: UserId
  ) {
    super('TeamMemberRoleChanged', {
      teamId: teamId.value,
      memberId: memberId.value,
      oldRole,
      newRole,
      changedBy: changedBy.value,
    });
  }
}

export class Team extends BaseEntity<TeamProps> {
  private constructor(props: TeamProps) {
    super(props);
  }

  public static create(
    props: Omit<TeamProps, 'id' | 'createdAt' | 'updatedAt'>,
    createdBy: UserId
  ): Team {
    // Validate team name
    if (!props.name || props.name.trim().length === 0) {
      throw new Error('Team name cannot be empty');
    }

    if (props.name.length > 100) {
      throw new Error('Team name cannot exceed 100 characters');
    }

    const team = new Team({
      ...props,
      id: TeamId.generate(),
      name: props.name.trim(),
      color: props.color || '#3B82F6',
      settings: {
        allowMemberInvites: true,
        requireApprovalForTasks: false,
        enableNotifications: true,
        defaultTaskAssignment: 'manual',
        maxTasksPerMember: 10,
        workingHours: {
          start: '09:00',
          end: '17:00',
          days: [1, 2, 3, 4, 5], // Monday to Friday
        },
        ...props.settings,
      },
      members: props.members || [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    team.addDomainEvent(
      new TeamCreatedEvent(team.id, team.workspaceId, team.name, createdBy)
    );

    return team;
  }

  public static fromPersistence(props: TeamProps): Team {
    return new Team(props);
  }

  // Getters
  get id(): TeamId {
    return this.props.id;
  }

  get workspaceId(): WorkspaceId {
    return this.props.workspaceId;
  }

  get projectId(): ProjectId | undefined {
    return this.props.projectId;
  }

  get name(): string {
    return this.props.name;
  }

  get description(): string | undefined {
    return this.props.description;
  }

  get color(): string {
    return this.props.color;
  }

  get settings(): TeamSettings {
    return { ...this.props.settings };
  }

  get members(): TeamMember[] {
    return [...this.props.members];
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  // Business methods
  public updateName(name: string): void {
    if (!name || name.trim().length === 0) {
      throw new Error('Team name cannot be empty');
    }

    if (name.length > 100) {
      throw new Error('Team name cannot exceed 100 characters');
    }

    this.props.name = name.trim();
    this.props.updatedAt = new Date();

    this.addDomainEvent(
      new TeamUpdatedEvent(this.id, { name: this.props.name })
    );
  }

  public updateDescription(description?: string): void {
    this.props.description = description;
    this.props.updatedAt = new Date();

    this.addDomainEvent(new TeamUpdatedEvent(this.id, { description }));
  }

  public updateColor(color: string): void {
    if (!color || !/^#[0-9A-F]{6}$/i.test(color)) {
      throw new Error('Invalid color format. Use hex format like #3B82F6');
    }

    this.props.color = color;
    this.props.updatedAt = new Date();

    this.addDomainEvent(new TeamUpdatedEvent(this.id, { color }));
  }

  public updateSettings(settings: Partial<TeamSettings>): void {
    this.props.settings = {
      ...this.props.settings,
      ...settings,
    };
    this.props.updatedAt = new Date();

    this.addDomainEvent(
      new TeamUpdatedEvent(this.id, { settings: this.props.settings })
    );
  }

  public addMember(
    userId: UserId,
    role: TeamMemberRole,
    addedBy: UserId
  ): void {
    if (this.isMember(userId)) {
      throw new Error('User is already a member of this team');
    }

    const member: TeamMember = {
      userId,
      role,
      joinedAt: new Date(),
    };

    this.props.members.push(member);
    this.props.updatedAt = new Date();

    this.addDomainEvent(
      new TeamMemberAddedEvent(this.id, userId, role, addedBy)
    );
  }

  public removeMember(userId: UserId, removedBy: UserId): void {
    const memberIndex = this.props.members.findIndex(m =>
      m.userId.equals(userId)
    );

    if (memberIndex === -1) {
      throw new Error('User is not a member of this team');
    }

    // Ensure at least one lead remains
    const member = this.props.members[memberIndex];
    if (member.role === TeamMemberRole.LEAD) {
      const leadCount = this.props.members.filter(
        m => m.role === TeamMemberRole.LEAD
      ).length;
      if (leadCount <= 1) {
        throw new Error('Cannot remove the last team lead');
      }
    }

    this.props.members.splice(memberIndex, 1);
    this.props.updatedAt = new Date();

    this.addDomainEvent(new TeamMemberRemovedEvent(this.id, userId, removedBy));
  }

  public changeMemberRole(
    userId: UserId,
    newRole: TeamMemberRole,
    changedBy: UserId
  ): void {
    const member = this.props.members.find(m => m.userId.equals(userId));

    if (!member) {
      throw new Error('User is not a member of this team');
    }

    if (member.role === newRole) {
      return; // No change needed
    }

    // Ensure at least one lead remains
    if (
      member.role === TeamMemberRole.LEAD &&
      newRole === TeamMemberRole.MEMBER
    ) {
      const leadCount = this.props.members.filter(
        m => m.role === TeamMemberRole.LEAD
      ).length;
      if (leadCount <= 1) {
        throw new Error('Cannot demote the last team lead');
      }
    }

    const oldRole = member.role;
    member.role = newRole;
    this.props.updatedAt = new Date();

    this.addDomainEvent(
      new TeamMemberRoleChangedEvent(
        this.id,
        userId,
        oldRole,
        newRole,
        changedBy
      )
    );
  }

  // Query methods
  public isMember(userId: UserId): boolean {
    return this.props.members.some(m => m.userId.equals(userId));
  }

  public isLead(userId: UserId): boolean {
    const member = this.props.members.find(m => m.userId.equals(userId));
    return member?.role === TeamMemberRole.LEAD;
  }

  public getMember(userId: UserId): TeamMember | undefined {
    return this.props.members.find(m => m.userId.equals(userId));
  }

  public getLeads(): TeamMember[] {
    return this.props.members.filter(m => m.role === TeamMemberRole.LEAD);
  }

  public getRegularMembers(): TeamMember[] {
    return this.props.members.filter(m => m.role === TeamMemberRole.MEMBER);
  }

  public getMemberCount(): number {
    return this.props.members.length;
  }

  public canUserManageTeam(userId: UserId): boolean {
    return this.isLead(userId);
  }

  public canUserInviteMembers(userId: UserId): boolean {
    if (!this.props.settings.allowMemberInvites) {
      return this.isLead(userId);
    }
    return this.isMember(userId);
  }

  public getNextAssignee(
    currentAssignments: Map<string, number>
  ): UserId | null {
    if (this.props.members.length === 0) {
      return null;
    }

    const assignmentStrategy = this.props.settings.defaultTaskAssignment;

    switch (assignmentStrategy) {
      case 'round_robin':
        return this.getNextRoundRobinAssignee();

      case 'workload_based':
        return this.getNextWorkloadBasedAssignee(currentAssignments);

      case 'manual':
      default:
        return null; // Manual assignment required
    }
  }

  private getNextRoundRobinAssignee(): UserId {
    // Simple round-robin based on member order
    // In a real implementation, you'd track the last assigned member
    const randomIndex = Math.floor(Math.random() * this.props.members.length);
    return this.props.members[randomIndex].userId;
  }

  private getNextWorkloadBasedAssignee(
    currentAssignments: Map<string, number>
  ): UserId {
    // Find member with least current assignments
    let minAssignments = Infinity;
    let selectedMember: UserId | null = null;

    for (const member of this.props.members) {
      const assignments = currentAssignments.get(member.userId.value) || 0;
      const maxTasks = this.props.settings.maxTasksPerMember || 10;

      if (assignments < maxTasks && assignments < minAssignments) {
        minAssignments = assignments;
        selectedMember = member.userId;
      }
    }

    return selectedMember || this.props.members[0].userId;
  }

  public isWithinWorkingHours(date: Date = new Date()): boolean {
    const workingHours = this.props.settings.workingHours;
    if (!workingHours) return true;

    const dayOfWeek = date.getDay();
    if (!workingHours.days.includes(dayOfWeek)) {
      return false;
    }

    const timeString = date.toTimeString().substring(0, 5); // HH:MM format
    return timeString >= workingHours.start && timeString <= workingHours.end;
  }
}
