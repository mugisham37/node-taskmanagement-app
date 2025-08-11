import { BaseEntity } from './base-entity';

export enum MetricType {
  COUNTER = 'counter',
  GAUGE = 'gauge',
  HISTOGRAM = 'histogram',
  SUMMARY = 'summary',
}

export type MetricValue = number | string;
export type MetricTags = Record<string, string>;

export interface MetricsProps {
  id: string;
  name: string;
  type: MetricType;
  value: MetricValue;
  tags: MetricTags;
  workspaceId?: string;
  projectId?: string;
  userId?: string;
  timestamp: Date;
  expiresAt?: Date;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export class Metrics extends BaseEntity<MetricsProps> {
  constructor(props: MetricsProps) {
    super(props.id, props.createdAt, props.updatedAt);
    this.props = props;
  }

  get name(): string {
    return this.props.name;
  }

  get type(): MetricType {
    return this.props.type;
  }

  get value(): MetricValue {
    return this.props.value;
  }

  get tags(): MetricTags {
    return this.props.tags;
  }

  get workspaceId(): string | undefined {
    return this.props.workspaceId;
  }

  get projectId(): string | undefined {
    return this.props.projectId;
  }

  get userId(): string | undefined {
    return this.props.userId;
  }

  get timestamp(): Date {
    return this.props.timestamp;
  }

  get expiresAt(): Date | undefined {
    return this.props.expiresAt;
  }

  get metadata(): Record<string, any> {
    return this.props.metadata;
  }

  // Business logic methods
  public isExpired(): boolean {
    if (!this.props.expiresAt) return false;
    return new Date() > this.props.expiresAt;
  }

  public isCounter(): boolean {
    return this.props.type === MetricType.COUNTER;
  }

  public isGauge(): boolean {
    return this.props.type === MetricType.GAUGE;
  }

  public isHistogram(): boolean {
    return this.props.type === MetricType.HISTOGRAM;
  }

  public isSummary(): boolean {
    return this.props.type === MetricType.SUMMARY;
  }

  public hasWorkspaceContext(): boolean {
    return !!this.props.workspaceId;
  }

  public hasProjectContext(): boolean {
    return !!this.props.projectId;
  }

  public hasUserContext(): boolean {
    return !!this.props.userId;
  }

  public getNumericValue(): number {
    if (typeof this.props.value === 'number') {
      return this.props.value;
    }
    if (typeof this.props.value === 'string') {
      const parsed = parseFloat(this.props.value);
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  }

  public getStringValue(): string {
    return String(this.props.value);
  }

  public addTag(key: string, value: string): void {
    this.props.tags[key] = value;
    this.props.updatedAt = new Date();
  }

  public removeTag(key: string): void {
    delete this.props.tags[key];
    this.props.updatedAt = new Date();
  }

  public updateValue(value: MetricValue): void {
    this.props.value = value;
    this.props.timestamp = new Date();
    this.props.updatedAt = new Date();
  }

  public updateMetadata(metadata: Record<string, any>): void {
    this.props.metadata = { ...this.props.metadata, ...metadata };
    this.props.updatedAt = new Date();
  }

  public toAnalyticsData(): Record<string, any> {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      value: this.value,
      numericValue: this.getNumericValue(),
      tags: this.tags,
      workspaceId: this.workspaceId,
      projectId: this.projectId,
      userId: this.userId,
      timestamp: this.timestamp,
      expiresAt: this.expiresAt,
      metadata: this.metadata,
      isExpired: this.isExpired(),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  public static create(
    props: Omit<MetricsProps, 'id' | 'createdAt' | 'updatedAt'>
  ): Metrics {
    const now = new Date();
    return new Metrics({
      ...props,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    });
  }

  public static createCounter(
    name: string,
    value: number = 1,
    tags: MetricTags = {},
    options: {
      workspaceId?: string;
      projectId?: string;
      userId?: string;
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
      workspaceId?: string;
      projectId?: string;
      userId?: string;
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
      workspaceId?: string;
      projectId?: string;
      userId?: string;
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

  protected validate(): void {
    // Metrics validation will be handled by the infrastructure layer
    // This is a legacy entity that needs refactoring
  }

  getValidationErrors(): string[] {
    return [];
  }
}
