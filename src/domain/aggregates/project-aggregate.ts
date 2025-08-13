import { AggregateRoot, AggregateProps } from './aggregate-root';
import { Project, ProjectMember } from '../entities/project';
import { UserId } from '../value-objects';

/**
 * Create Project Data interface
 */
export interface CreateProjectData {
  name: string;
  description: string;
  managerId: UserId;
  startDate?: Date;
  endDate?: Date;
}

/**
 * Project Statistics interface
 */
export interface ProjectStatistics {
  memberCount: number;
  taskCount: number;
  completedTaskCount: number;
  overdueTasks: number;
  completionPercentage: number;
}

/**
 * Project Aggregate Props interface
 */
export interface ProjectAggregateProps extends AggregateProps {
  project: Project;
  taskCount: number;
  completedTaskCount: number;
  overdueTaskCount: number;
}

/**
 * Project Aggregate
 * Manages project lifecycle, member management, and project-level business rules
 */
export class ProjectAggregate extends AggregateRoot<ProjectAggregateProps> {
  constructor(props: ProjectAggregateProps) {
    super(props);
    this.validate();
  }

  /**
   * Create a new project aggregate
   */
  static create(
    project: Project,
    taskCount: number = 0,
    completedTaskCount: number = 0,
    overdueTaskCount: number = 0
  ): ProjectAggregate {
    const now = new Date();
    return new ProjectAggregate({
      id: project.id.value,
      project,
      taskCount,
      completedTaskCount,
      overdueTaskCount,
      createdAt: now,
      updatedAt: now,
    });
  }

  /**
   * Load from persistence
   */
  static fromPersistence(props: ProjectAggregateProps): ProjectAggregate {
    return new ProjectAggregate(props);
  }

  /**
   * Get the project entity
   */
  get project(): Project {
    return this.props.project;
  }

  /**
   * Get project statistics
   */
  get statistics(): ProjectStatistics {
    return {
      memberCount: this.props.project.getMemberCount(),
      taskCount: this.props.taskCount,
      completedTaskCount: this.props.completedTaskCount,
      overdueTasks: this.props.overdueTaskCount,
      completionPercentage: this.props.taskCount > 0 
        ? Math.round((this.props.completedTaskCount / this.props.taskCount) * 100)
        : 0,
    };
  }

  /**
   * Update project details
   */
  updateProject(
    _updatedBy: UserId,
    updates: Partial<{
      name: string;
      description: string;
      startDate: Date;
      endDate: Date;
    }>
  ): void {
    if (updates.name) {
      this.props.project.updateName(updates.name);
    }
    if (updates.description) {
      this.props.project.updateDescription(updates.description);
    }
    if (updates.startDate) {
      this.props.project.updateStartDate(updates.startDate);
    }
    if (updates.endDate) {
      this.props.project.updateEndDate(updates.endDate);
    }
    this.props.updatedAt = new Date();
  }

  /**
   * Add member to project
   */
  addMember(member: ProjectMember, _addedBy: UserId): void {
    this.props.project.addMember(member.userId, member.role);
    this.props.updatedAt = new Date();
  }

  /**
   * Remove member from project
   */
  removeMember(memberUserId: UserId, _removedBy: UserId): void {
    this.props.project.removeMember(memberUserId);
    this.props.updatedAt = new Date();
  }

  /**
   * Update task statistics
   */
  updateTaskStatistics(
    taskCount: number,
    completedTaskCount: number,
    overdueTaskCount: number
  ): void {
    this.props.taskCount = taskCount;
    this.props.completedTaskCount = completedTaskCount;
    this.props.overdueTaskCount = overdueTaskCount;
    this.props.updatedAt = new Date();
  }

  // Required abstract method implementations
  protected applyEvent(_event: any): void {
    // Handle event sourcing if needed
    // For now, we'll leave this empty as it's not being used
  }

  protected checkInvariants(): void {
    if (!this.props.project) {
      throw new Error('Project is required');
    }
    
    if (this.props.taskCount < 0) {
      throw new Error('Task count cannot be negative');
    }
    
    if (this.props.completedTaskCount < 0) {
      throw new Error('Completed task count cannot be negative');
    }
    
    if (this.props.completedTaskCount > this.props.taskCount) {
      throw new Error('Completed task count cannot exceed total task count');
    }
  }

  createSnapshot(): Record<string, any> {
    return {
      id: this.id,
      project: {
        id: this.props.project.id.value,
        workspaceId: this.props.project.workspaceId.value,
        name: this.props.project.name,
        description: this.props.project.description,
        // Add other project properties as needed
      },
      taskCount: this.props.taskCount,
      completedTaskCount: this.props.completedTaskCount,
      overdueTaskCount: this.props.overdueTaskCount,
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
