export enum MetricType {
  COUNTER = 'counter',
  GAUGE = 'gauge',
  HISTOGRAM = 'histogram',
  SUMMARY = 'summary',
}

export type MetricValue = number | string | boolean;

export interface MetricTags {
  [key: string]: string;
}

export interface MetricAggregation {
  sum: number;
  count: number;
  min: number;
  max: number;
  avg: number;
  p50: number;
  p90: number;
  p95: number;
  p99: number;
}

export interface MetricTimeSeriesPoint {
  timestamp: Date;
  value: number;
  tags?: MetricTags;
}

export interface MetricTimeSeries {
  name: string;
  points: MetricTimeSeriesPoint[];
  aggregation?: MetricAggregation;
}

export class MetricCalculator {
  public static calculateAggregation(values: number[]): MetricAggregation {
    if (values.length === 0) {
      return {
        sum: 0,
        count: 0,
        min: 0,
        max: 0,
        avg: 0,
        p50: 0,
        p90: 0,
        p95: 0,
        p99: 0,
      };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const sum = values.reduce((acc, val) => acc + val, 0);
    const count = values.length;
    const avg = sum / count;

    return {
      sum,
      count,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg,
      p50: this.percentile(sorted, 50),
      p90: this.percentile(sorted, 90),
      p95: this.percentile(sorted, 95),
      p99: this.percentile(sorted, 99),
    };
  }

  public static percentile(sortedValues: number[], percentile: number): number {
    if (sortedValues.length === 0) return 0;
    if (percentile <= 0) return sortedValues[0];
    if (percentile >= 100) return sortedValues[sortedValues.length - 1];

    const index = (percentile / 100) * (sortedValues.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);

    if (lower === upper) {
      return sortedValues[lower];
    }

    const weight = index - lower;
    return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
  }

  public static aggregateTimeSeries(
    timeSeries: MetricTimeSeries[],
    groupBy: 'hour' | 'day' | 'week' | 'month' = 'day'
  ): MetricTimeSeries {
    if (timeSeries.length === 0) {
      return { name: 'aggregated', points: [] };
    }

    const allPoints = timeSeries.flatMap(ts => ts.points);
    const groupedPoints = new Map<string, number[]>();

    allPoints.forEach(point => {
      const key = this.getTimeGroupKey(point.timestamp, groupBy);
      if (!groupedPoints.has(key)) {
        groupedPoints.set(key, []);
      }
      groupedPoints.get(key)!.push(point.value);
    });

    const aggregatedPoints: MetricTimeSeriesPoint[] = [];
    groupedPoints.forEach((values, timeKey) => {
      const aggregation = this.calculateAggregation(values);
      aggregatedPoints.push({
        timestamp: this.parseTimeGroupKey(timeKey, groupBy),
        value: aggregation.avg,
        tags: { aggregation_type: 'avg', count: values.length.toString() },
      });
    });

    // Sort by timestamp
    aggregatedPoints.sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
    );

    return {
      name: 'aggregated',
      points: aggregatedPoints,
      aggregation: this.calculateAggregation(
        aggregatedPoints.map(p => p.value)
      ),
    };
  }

  private static getTimeGroupKey(
    timestamp: Date,
    groupBy: 'hour' | 'day' | 'week' | 'month'
  ): string {
    const date = new Date(timestamp);

    switch (groupBy) {
      case 'hour':
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}-${String(date.getHours()).padStart(2, '0')}`;
      case 'day':
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      case 'week':
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        return `${weekStart.getFullYear()}-W${String(Math.ceil(weekStart.getDate() / 7)).padStart(2, '0')}`;
      case 'month':
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      default:
        return date.toISOString().split('T')[0];
    }
  }

  private static parseTimeGroupKey(
    key: string,
    groupBy: 'hour' | 'day' | 'week' | 'month'
  ): Date {
    switch (groupBy) {
      case 'hour':
        const [year, month, day, hour] = key.split('-');
        return new Date(
          parseInt(year),
          parseInt(month) - 1,
          parseInt(day),
          parseInt(hour)
        );
      case 'day':
        const [dayYear, dayMonth, dayDay] = key.split('-');
        return new Date(
          parseInt(dayYear),
          parseInt(dayMonth) - 1,
          parseInt(dayDay)
        );
      case 'week':
        const [weekYear, weekPart] = key.split('-W');
        const weekNum = parseInt(weekPart);
        const date = new Date(parseInt(weekYear), 0, 1);
        date.setDate(date.getDate() + (weekNum - 1) * 7);
        return date;
      case 'month':
        const [monthYear, monthMonth] = key.split('-');
        return new Date(parseInt(monthYear), parseInt(monthMonth) - 1, 1);
      default:
        return new Date(key);
    }
  }
}

export interface MetricDefinition {
  name: string;
  type: MetricType;
  description: string;
  unit?: string;
  tags?: string[];
  retention?: number; // days
  aggregationMethods?: ('sum' | 'avg' | 'min' | 'max' | 'count')[];
}

export class MetricRegistry {
  private static readonly STANDARD_METRICS: Record<string, MetricDefinition> = {
    // User metrics
    'user.login.count': {
      name: 'user.login.count',
      type: MetricType.COUNTER,
      description: 'Number of user logins',
      tags: ['user_id', 'workspace_id'],
      retention: 90,
      aggregationMethods: ['sum', 'count'],
    },
    'user.session.duration': {
      name: 'user.session.duration',
      type: MetricType.HISTOGRAM,
      description: 'User session duration in seconds',
      unit: 'seconds',
      tags: ['user_id', 'workspace_id'],
      retention: 30,
      aggregationMethods: ['avg', 'p95', 'p99'],
    },
    'user.productivity.score': {
      name: 'user.productivity.score',
      type: MetricType.GAUGE,
      description: 'User productivity score (0-100)',
      unit: 'score',
      tags: ['user_id', 'workspace_id'],
      retention: 365,
      aggregationMethods: ['avg', 'min', 'max'],
    },

    // Task metrics
    'task.created.count': {
      name: 'task.created.count',
      type: MetricType.COUNTER,
      description: 'Number of tasks created',
      tags: ['workspace_id', 'project_id', 'creator_id'],
      retention: 365,
      aggregationMethods: ['sum', 'count'],
    },
    'task.completed.count': {
      name: 'task.completed.count',
      type: MetricType.COUNTER,
      description: 'Number of tasks completed',
      tags: ['workspace_id', 'project_id', 'assignee_id'],
      retention: 365,
      aggregationMethods: ['sum', 'count'],
    },
    'task.completion.time': {
      name: 'task.completion.time',
      type: MetricType.HISTOGRAM,
      description: 'Task completion time in hours',
      unit: 'hours',
      tags: ['workspace_id', 'project_id', 'priority', 'assignee_id'],
      retention: 90,
      aggregationMethods: ['avg', 'p50', 'p90', 'p95'],
    },
    'task.overdue.count': {
      name: 'task.overdue.count',
      type: MetricType.GAUGE,
      description: 'Number of overdue tasks',
      tags: ['workspace_id', 'project_id', 'assignee_id'],
      retention: 30,
      aggregationMethods: ['sum', 'avg'],
    },

    // Project metrics
    'project.created.count': {
      name: 'project.created.count',
      type: MetricType.COUNTER,
      description: 'Number of projects created',
      tags: ['workspace_id', 'owner_id'],
      retention: 365,
      aggregationMethods: ['sum', 'count'],
    },
    'project.completion.rate': {
      name: 'project.completion.rate',
      type: MetricType.GAUGE,
      description: 'Project completion rate percentage',
      unit: 'percentage',
      tags: ['workspace_id', 'project_id'],
      retention: 90,
      aggregationMethods: ['avg', 'min', 'max'],
    },

    // Workspace metrics
    'workspace.active.users': {
      name: 'workspace.active.users',
      type: MetricType.GAUGE,
      description: 'Number of active users in workspace',
      tags: ['workspace_id'],
      retention: 90,
      aggregationMethods: ['avg', 'max'],
    },
    'workspace.storage.usage': {
      name: 'workspace.storage.usage',
      type: MetricType.GAUGE,
      description: 'Workspace storage usage in bytes',
      unit: 'bytes',
      tags: ['workspace_id'],
      retention: 90,
      aggregationMethods: ['avg', 'max'],
    },

    // Performance metrics
    'api.request.duration': {
      name: 'api.request.duration',
      type: MetricType.HISTOGRAM,
      description: 'API request duration in milliseconds',
      unit: 'milliseconds',
      tags: ['endpoint', 'method', 'status_code'],
      retention: 7,
      aggregationMethods: ['avg', 'p95', 'p99'],
    },
    'api.request.count': {
      name: 'api.request.count',
      type: MetricType.COUNTER,
      description: 'Number of API requests',
      tags: ['endpoint', 'method', 'status_code'],
      retention: 30,
      aggregationMethods: ['sum', 'count'],
    },
    'database.query.duration': {
      name: 'database.query.duration',
      type: MetricType.HISTOGRAM,
      description: 'Database query duration in milliseconds',
      unit: 'milliseconds',
      tags: ['query_type', 'table'],
      retention: 7,
      aggregationMethods: ['avg', 'p95', 'p99'],
    },

    // Collaboration metrics
    'collaboration.comment.count': {
      name: 'collaboration.comment.count',
      type: MetricType.COUNTER,
      description: 'Number of comments added',
      tags: ['workspace_id', 'project_id', 'author_id'],
      retention: 90,
      aggregationMethods: ['sum', 'count'],
    },
    'collaboration.real_time.sessions': {
      name: 'collaboration.real_time.sessions',
      type: MetricType.GAUGE,
      description: 'Number of active real-time collaboration sessions',
      tags: ['workspace_id', 'project_id'],
      retention: 7,
      aggregationMethods: ['avg', 'max'],
    },
  };

  public static getMetricDefinition(
    name: string
  ): MetricDefinition | undefined {
    return this.STANDARD_METRICS[name];
  }

  public static getAllMetricDefinitions(): Record<string, MetricDefinition> {
    return { ...this.STANDARD_METRICS };
  }

  public static isValidMetricName(name: string): boolean {
    return name in this.STANDARD_METRICS;
  }

  public static getMetricsByCategory(category: string): MetricDefinition[] {
    return Object.values(this.STANDARD_METRICS).filter(metric =>
      metric.name.startsWith(category + '.')
    );
  }

  public static registerCustomMetric(definition: MetricDefinition): void {
    this.STANDARD_METRICS[definition.name] = definition;
  }
}
