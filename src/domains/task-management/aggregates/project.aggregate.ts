import { AggregateRoot } from '../../../shared/domain/aggregate-root';
import { BaseDomainEvent } from '../../../shared/domain/domain-event';
import { ProjectId } from '../value-objects/project-id';
import { WorkspaceId } from '../value-objects/workspace-id';
import { UserId } from '../../authentication/value-objects/user-id';

export interface ProjectProps {
  id: ProjectId;
  workspaceId: WorkspaceId;
  name: string;
  description?: string;
  color: string;
  ownerId: UserId;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export class ProjectCreatedEvent extends BaseDomainEvent {
  constructor(
    projectId: ProjectId,
    workspaceId: WorkspaceId,
    name: string,
    ownerId: UserId
  ) {
    super(projectId.value, 'ProjectCreated', {
      projectId: projectId.value,
      workspaceId: workspaceId.value,
      name,
      ownerId: ownerId.value,
    });
  }
}

export class ProjectAggregate extends AggregateRoot<ProjectProps> {
  private constructor(props: ProjectProps) {
    super(props, props.id.value, props.createdAt, props.updatedAt);
  }

  public static create(
    props: Omit<ProjectProps, 'id' | 'createdAt' | 'updatedAt'>
  ): ProjectAggregate {
    const project = new ProjectAggregate({
      ...props,
      id: ProjectId.generate(),
      color: props.color || '#3B82F6',
      isArchived: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    project.addDomainEvent(
      new ProjectCreatedEvent(
        project.id,
        project.workspaceId,
        project.name,
        project.ownerId
      )
    );

    return project;
  }

  public static fromPersistence(props: ProjectProps): ProjectAggregate {
    return new ProjectAggregate(props);
  }

  // Getters
  get id(): ProjectId {
    return this.props.id;
  }

  get workspaceId(): WorkspaceId {
    return this.props.workspaceId;
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

  get ownerId(): UserId {
    return this.props.ownerId;
  }

  get isArchived(): boolean {
    return this.props.isArchived;
  }

  get isDeleted(): boolean {
    return !!this.props.deletedAt;
  }

  // Business methods
  public canAcceptTasks(): boolean {
    return !this.props.isArchived && !this.props.deletedAt;
  }

  public isOwner(userId: UserId): boolean {
    return this.props.ownerId.equals(userId);
  }

  // Aggregate root implementation
  protected validate(): void {
    if (!this.props.name || this.props.name.trim().length === 0) {
      throw new Error('Project name cannot be empty');
    }

    if (this.props.name.length > 200) {
      throw new Error('Project name cannot exceed 200 characters');
    }
  }

  protected applyBusinessRules(): void {
    // Update activity timestamp
    this.props.updatedAt = new Date();
  }
}
