import { BaseEntity } from './base-entity';
import { MetricsId } from '../value-objects/metrics-id';
import { WorkspaceId } from '../value-objects/workspace-id';
import { ProjectId } from '../value-objects/project-id';
import { UserId } from '../value-objects/user-id';

export enum MetricType {
  COUNTER = 'counter',
  GAUGE = 'gauge',
  HISTOGRAM = 'histogram',
  SUMMARY = 'summary',
}

export type MetricValue = number | string;
export type MetricTags = Record<string, string>;

export interface MetricsProps {
  name: string;
  type: MetricType;
  value: MetricValue;
  tags: MetricTags;
  workspaceId?: WorkspaceId;
  projectId?: ProjectId;
  userId?: UserId;
  timestamp: Date;
  expiresAt?: Date;
  metadata: Record<string, any>;
}

export class Metrics extends BaseEntity<MetricsId> {
  private _name: string;
  private _type: MetricType;
  private _value: MetricValue;
  private _tags: MetricTags;
  private _workspaceId: WorkspaceId | undefined;
  private _projectId: ProjectId | undefined;
  private _userId: UserId | undefined;
  private _timestamp: Date;
  private _expiresAt: Date | undefined;
  private _metadata: Record<string, any>;

  constructor(
    id: MetricsId,
    props: MetricsProps,
    createdAt?: Date,
    updatedAt?: Date
  ) {
    super(id, createdAt, updatedAt);
    this._name = props.name;
    this._type = props.type;
    this._value = props.value;
    this._tags = props.tags;
    this._workspaceId = props.workspaceId;
    this._projectId = props.projectId;
    this._userId = props.userId;
    this._timestamp = props.timestamp;
    this._expiresAt = props.expiresAt;
    this._metadata = props.metadata;
    this.validate();
  }

  get name(): string {
    return this._name;
  }

  get type(): MetricType {
    return this._type;
  }

  get value(): MetricValue {
    return this._value;
  }

  get tags(): MetricTags {
    return this._tags;
  }

  get workspaceId(): WorkspaceId | undefined {
    return this._workspaceId;
  }

  get projectId(): ProjectId | undefined {
    return this._projectId;
  }

  get userId(): UserId | undefined {
    return this._userId;
  }

  get timestamp(): Date {
    return this._timestamp;
  }

  get expiresAt(): Date | undefined {
    return this._expiresAt;
  }

  get metadata(): Record<string, any> {
    return this._metadata;
  }

  // Business logic methods
  public isExpired(): boolean {
    if (!this._expiresAt) return false;
    return new Date() > this._expiresAt;
  }

  public isCounter(): boolean {
    return this._type === MetricType.COUNTER;
  }

  public isGauge(): boolean {
    return this._type === MetricType.GAUGE;
  }

  public isHistogram(): boolean {
    return this._type === MetricType.HISTOGRAM;
  }

  public isSummary(): boolean {
    return this._type === MetricType.SUMMARY;
  }

  public hasWorkspaceContext(): boolean {
    return !!this._workspaceId;
  }

  public hasProjectContext(): boolean {
    return !!this._projectId;
  }

  public hasUserContext(): boolean {
    return !!this._userId;
  }

  public getNumericValue(): number {
    if (typeof this._value === 'number') {
      return this._value;
    }
    if (typeof this._value === 'string') {
      const parsed = parseFloat(this._value);
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  }

  public getStringValue(): string {
    return String(this._value);
  }

  public addTag(key: string, value: string): void {
    this._tags[key] = value;
    this.markAsUpdated();
  }

  public removeTag(key: string): void {
    delete this._tags[key];
    this.markAsUpdated();
  }

  public updateValue(value: MetricValue): void {
    this._value = value;
    this._timestamp = new Date();
    this.markAsUpdated();
  }

  public updateMetadata(metadata: Record<string, any>): void {
    this._metadata = { ...this._metadata, ...metadata };
    this.markAsUpdated();
  }

  public toAnalyticsData(): Record<string, any> {
    return {
      id: this.id.value,
      name: this.name,
      type: this.type,
      value: this.value,
      numericValue: this.getNumericValue(),
      tags: this.tags,
      workspaceId: this._workspaceId?.value,
      projectId: this._projectId?.value,
      userId: this._userId?.value,
      timestamp: this.timestamp,
      expiresAt: this.expiresAt,
      metadata: this.metadata,
      isExpired: this.isExpired(),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  protected validate(): void {
    if (!this._name || this._name.trim().length === 0) {
      throw new Error('Metric name is required');
    }
    
    if (!Object.values(MetricType).includes(this._type)) {
      throw new Error('Invalid metric type');
    }
    
    if (this._value == null) {
      throw new Error('Metric value is required');
    }
  }

  getValidationErrors(): string[] {
    const errors: string[] = [];
    
    try {
      this.validate();
    } catch (error) {
      if (error instanceof Error) {
        errors.push(error.message);
      }
    }
    
    return errors;
  }

  public static create(props: MetricsProps): Metrics {
    const id = MetricsId.create();
    return new Metrics(id, props);
  }

  public static createCounter(
    name: string,
    value: number = 1,
    tags: MetricTags = {},
    options: {
      workspaceId?: WorkspaceId;
      projectId?: ProjectId;
      userId?: UserId;
      metadata?: Record<string, any>;
      expiresAt?: Date;
    } = {}
  ): Metrics {
    return Metrics.create({
      name,
      type: MetricType.COUNTER,
      value,
      tags,
      timestamp: new Date(),
      metadata: options.metadata || {},
      ...options,
    });
  }

  public static createGauge(
    name: string,
    value: number,
    tags: MetricTags = {},
    options: {
      workspaceId?: WorkspaceId;
      projectId?: ProjectId;
      userId?: UserId;
      metadata?: Record<string, any>;
      expiresAt?: Date;
    } = {}
  ): Metrics {
    return Metrics.create({
      name,
      type: MetricType.GAUGE,
      value,
      tags,
      timestamp: new Date(),
      metadata: options.metadata || {},
      ...options,
    });
  }

  public static createHistogram(
    name: string,
    value: number,
    tags: MetricTags = {},
    options: {
      workspaceId?: WorkspaceId;
      projectId?: ProjectId;
      userId?: UserId;
      metadata?: Record<string, any>;
      expiresAt?: Date;
    } = {}
  ): Metrics {
    return Metrics.create({
      name,
      type: MetricType.HISTOGRAM,
      value,
      tags,
      timestamp: new Date(),
      metadata: options.metadata || {},
      ...options,
    });
  }

  public static createSummary(
    name: string,
    value: number,
    tags: MetricTags = {},
    options: {
      workspaceId?: WorkspaceId;
      projectId?: ProjectId;
      userId?: UserId;
      metadata?: Record<string, any>;
      expiresAt?: Date;
    } = {}
  ): Metrics {
    return Metrics.create({
      name,
      type: MetricType.SUMMARY,
      value,
      tags,
      timestamp: new Date(),
      metadata: options.metadata || {},
      ...options,
    });
  }
}
