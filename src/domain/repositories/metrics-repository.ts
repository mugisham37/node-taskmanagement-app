import { Metrics, MetricType } from '../entities/metrics';

export interface IMetricsRepository {
  save(metric: Metrics): Promise<void>;
  findById(id: string): Promise<Metrics | null>;
  findByName(name: string, limit?: number, offset?: number): Promise<Metrics[]>;
  findByType(
    type: MetricType,
    limit?: number,
    offset?: number
  ): Promise<Metrics[]>;
  findByUserId(
    userId: string,
    limit?: number,
    offset?: number
  ): Promise<Metrics[]>;
  findByWorkspaceId(
    workspaceId: string,
    limit?: number,
    offset?: number
  ): Promise<Metrics[]>;
  findByProjectId(
    projectId: string,
    limit?: number,
    offset?: number
  ): Promise<Metrics[]>;
  findByTags(
    tags: Record<string, string>,
    limit?: number,
    offset?: number
  ): Promise<Metrics[]>;
  findByDateRange(
    startDate: Date,
    endDate: Date,
    limit?: number,
    offset?: number
  ): Promise<Metrics[]>;
  findExpired(): Promise<Metrics[]>;
  getAggregatedMetrics(
    name: string,
    aggregation: 'sum' | 'avg' | 'min' | 'max' | 'count',
    startDate?: Date,
    endDate?: Date,
    groupBy?: 'hour' | 'day' | 'week' | 'month'
  ): Promise<Array<{ timestamp: Date; value: number }>>;
  getMetricsSummary(
    workspaceId?: string,
    userId?: string
  ): Promise<{
    totalMetrics: number;
    uniqueNames: number;
    typeDistribution: Record<MetricType, number>;
    recentActivity: number;
  }>;
  delete(id: string): Promise<void>;
  deleteExpired(): Promise<number>;
  deleteByName(name: string): Promise<number>;
  deleteOlderThan(date: Date): Promise<number>;
}
