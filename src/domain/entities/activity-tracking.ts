import { BaseEntity } from './base-entity';

export enum ActivityType {
  USER_ACTION = 'user_action',
  SYSTEM_EVENT = 'system_event',
  API_CALL = 'api_call',
  BACKGROUND_JOB = 'background_job',
}

export interface ActivityMetadata {
  browser?: string;
  os?: string;
  device?: string;
  referrer?: string;
  [key: string]: any;
}

export interface ActivityContext {
  feature?: string;
  module?: string;
  component?: string;
  version?: string;
  [key: string]: any;
}

export interface ActivityTrackingProps {
  id: string;
  userId: string;
  workspaceId?: string;
  projectId?: string;
  taskId?: string;
  type: ActivityType;
  action: string;
  description: string;
  metadata: ActivityMetadata;
  context: ActivityContext;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  duration?: number; // in milliseconds
  createdAt: Date;
  updatedAt: Date;
}

export class ActivityTracking extends BaseEntity<ActivityTrackingProps> {
  constructor(props: ActivityTrackingProps) {
    super(props.id, props.createdAt, props.updatedAt);
    this.props = props;
  }

  get userId(): string {
    return this.props.userId;
  }

  get workspaceId(): string | undefined {
    return this.props.workspaceId;
  }

  get projectId(): string | undefined {
    return this.props.projectId;
  }

  get taskId(): string | undefined {
    return this.props.taskId;
  }

  get type(): ActivityType {
    return this.props.type;
  }

  get action(): string {
    return this.props.action;
  }

  get description(): string {
    return this.props.description;
  }

  get metadata(): ActivityMetadata {
    return this.props.metadata;
  }

  get context(): ActivityContext {
    return this.props.context;
  }

  get ipAddress(): string | undefined {
    return this.props.ipAddress;
  }

  get userAgent(): string | undefined {
    return this.props.userAgent;
  }

  get sessionId(): string | undefined {
    return this.props.sessionId;
  }

  get duration(): number | undefined {
    return this.props.duration;
  }

  // Business logic methods
  public isUserActivity(): boolean {
    return this.props.type === ActivityType.USER_ACTION;
  }

  public isSystemActivity(): boolean {
    return this.props.type === ActivityType.SYSTEM_EVENT;
  }

  public isTaskRelated(): boolean {
    return !!this.props.taskId;
  }

  public isProjectRelated(): boolean {
    return !!this.props.projectId;
  }

  public isWorkspaceRelated(): boolean {
    return !!this.props.workspaceId;
  }

  public hasPerformanceData(): boolean {
    return !!this.props.duration;
  }

  public getPerformanceScore(): number {
    if (!this.props.duration) return 0;

    // Calculate performance score based on action type and duration
    const baselineMap: Record<string, number> = {
      task_create: 5000,
      task_update: 3000,
      task_complete: 2000,
      project_create: 10000,
      project_update: 5000,
      comment_add: 2000,
      file_upload: 15000,
    };

    const baseline = baselineMap[this.props.action] || 5000;
    const score = Math.max(
      0,
      100 - ((this.props.duration - baseline) / baseline) * 100
    );
    return Math.round(score);
  }

  public toAnalyticsData(): Record<string, any> {
    return {
      id: this.id,
      userId: this.userId,
      workspaceId: this.workspaceId,
      projectId: this.projectId,
      taskId: this.taskId,
      type: this.type,
      action: this.action,
      description: this.description,
      metadata: this.metadata,
      context: this.context,
      performanceScore: this.getPerformanceScore(),
      duration: this.duration,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  public static create(
    props: Omit<ActivityTrackingProps, 'id' | 'createdAt' | 'updatedAt'>
  ): ActivityTracking {
    const now = new Date();
    return new ActivityTracking({
      ...props,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    });
  }

  public update(
    updates: Partial<
      Pick<ActivityTrackingProps, 'metadata' | 'duration' | 'description'>
    >
  ): void {
    this.props = {
      ...this.props,
      ...updates,
      updatedAt: new Date(),
    };
  }

  protected validate(): void {
    // ActivityTracking validation will be handled by the infrastructure layer
    // This is a legacy entity that needs refactoring
  }

  getValidationErrors(): string[] {
    return [];
  }
}
