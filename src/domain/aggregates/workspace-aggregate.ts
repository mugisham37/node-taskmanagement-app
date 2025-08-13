import { AggregateRoot, AggregateProps } from './aggregate-root';
import { Workspace, WorkspaceSettings } from '../entities/workspace';
import {
  UserId,
  ProjectId,
} from '../value-objects';

/**
 * Workspace Aggregate Props interface
 */
export interface WorkspaceAggregateProps extends AggregateProps {
  workspace: Workspace;
  memberCount: number;
  projectCount: number;
}

/**
 * Workspace Aggregate
 * Manages workspace lifecycle, member management, and workspace-level business rules
 */
export class WorkspaceAggregate extends AggregateRoot<WorkspaceAggregateProps> {
  constructor(props: WorkspaceAggregateProps) {
    super(props);
    this.validate();
  }

  /**
   * Create a new workspace aggregate
   */
  static create(
    workspace: Workspace,
    memberCount: number = 1,
    projectCount: number = 0
  ): WorkspaceAggregate {
    const now = new Date();
    return new WorkspaceAggregate({
      id: workspace.id.value,
      workspace,
      memberCount,
      projectCount,
      createdAt: now,
      updatedAt: now,
    });
  }

  /**
   * Load from persistence
   */
  static fromPersistence(props: WorkspaceAggregateProps): WorkspaceAggregate {
    return new WorkspaceAggregate(props);
  }

  /**
   * Get the workspace entity
   */
  get workspace(): Workspace {
    return this.props.workspace;
  }

  /**
   * Get member count
   */
  get memberCount(): number {
    return this.props.memberCount;
  }

  /**
   * Get project count
   */
  get projectCount(): number {
    return this.props.projectCount;
  }

  /**
   * Update workspace details
   */
  updateDetails(updates: Partial<{
    name: string;
    description: string;
    settings: WorkspaceSettings;
  }>, updatedBy: UserId): void {
    if (updates.name) {
      this.props.workspace.updateName(updates.name, updatedBy);
    }
    if (updates.description) {
      this.props.workspace.updateDescription(updates.description, updatedBy);
    }
    if (updates.settings) {
      this.props.workspace.updateSettings(updates.settings, updatedBy);
    }
    this.props.updatedAt = new Date();
  }

  /**
   * Add member to workspace
   */
  addMember(userId: UserId, role: 'OWNER' | 'ADMIN' | 'MEMBER'): void {
    this.props.workspace.addMember(userId, role);
    this.props.memberCount++;
    this.props.updatedAt = new Date();
  }

  /**
   * Remove member from workspace
   */
  removeMember(userId: UserId): void {
    this.props.workspace.removeMember(userId);
    this.props.memberCount--;
    this.props.updatedAt = new Date();
  }

  /**
   * Add project to workspace
   */
  addProject(projectId: ProjectId): void {
    this.props.workspace.addProject(projectId);
    this.props.projectCount++;
    this.props.updatedAt = new Date();
  }

  /**
   * Remove project from workspace
   */
  removeProject(projectId: ProjectId): void {
    this.props.workspace.removeProject(projectId);
    this.props.projectCount--;
    this.props.updatedAt = new Date();
  }

  /**
   * Deactivate workspace
   */
  deactivate(): void {
    this.props.workspace.deactivate();
    this.props.updatedAt = new Date();
  }

  /**
   * Activate workspace
   */
  activate(): void {
    this.props.workspace.activate();
    this.props.updatedAt = new Date();
  }

  // Required abstract method implementations
  protected applyEvent(_event: any): void {
    // Handle event sourcing if needed
    // For now, we'll leave this empty as it's not being used
  }

  protected checkInvariants(): void {
    if (!this.props.workspace) {
      throw new Error('Workspace is required');
    }
    
    if (this.props.memberCount < 0) {
      throw new Error('Member count cannot be negative');
    }
    
    if (this.props.projectCount < 0) {
      throw new Error('Project count cannot be negative');
    }
  }

  createSnapshot(): Record<string, any> {
    return {
      id: this.id,
      workspace: {
        id: this.props.workspace.id.value,
        name: this.props.workspace.name,
        slug: this.props.workspace.slug,
        description: this.props.workspace.description,
        ownerId: this.props.workspace.ownerId.value,
        // Add other workspace properties as needed
      },
      memberCount: this.props.memberCount,
      projectCount: this.props.projectCount,
      createdAt: this.props.createdAt.toISOString(),
      updatedAt: this.props.updatedAt.toISOString(),
    };
  }

  restoreFromSnapshot(_snapshot: Record<string, any>): void {
    // Implement snapshot restoration if needed for event sourcing
    // For now, we'll leave this empty as it's not being used
  }

  getValidationErrors(): string[] {
    const errors: string[] = [];
    
    try {
      this.checkInvariants();
    } catch (error) {
      if (error instanceof Error) {
        errors.push(error.message);
      }
    }
    
    return errors;
  }
}
