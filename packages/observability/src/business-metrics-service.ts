import { Counter, Gauge, Histogram, register } from 'prom-client';
import { Logger } from 'winston';
import { ILoggingService } from './logging-service';

export interface BusinessMetrics {
  // User engagement metrics
  userLoginTotal: Counter<string>;
  userRegistrationTotal: Counter<string>;
  userSessionDuration: Histogram<string>;
  activeUsers: Gauge<string>;
  
  // Task management metrics
  tasksCreatedTotal: Counter<string>;
  tasksCompletedTotal: Counter<string>;
  taskCompletionTime: Histogram<string>;
  activeTasks: Gauge<string>;
  
  // Project metrics
  projectsCreatedTotal: Counter<string>;
  projectCompletionRate: Gauge<string>;
  
  // Feature usage metrics
  featureUsageTotal: Counter<string>;
  apiEndpointUsage: Counter<string>;
  
  // Business KPIs
  conversionRate: Gauge<string>;
  retentionRate: Gauge<string>;
  churnRate: Gauge<string>;
}

export interface BusinessMetricsConfig {
  enabled: boolean;
  prefix: string;
  labels: Record<string, string>;
}

export class BusinessMetricsService {
  private metrics: BusinessMetrics;
  private logger: Logger;
  private config: BusinessMetricsConfig;

  constructor(
    private loggingService: ILoggingService,
    config: Partial<BusinessMetricsConfig> = {}
  ) {
    this.config = {
      enabled: true,
      prefix: 'taskmanagement_business',
      labels: {},
      ...config,
    };

    this.logger = this.loggingService.getLogger('BusinessMetrics');
    this.initializeMetrics();
  }

  private initializeMetrics(): void {
    const { prefix } = this.config;

    this.metrics = {
      // User engagement metrics
      userLoginTotal: new Counter({
        name: `${prefix}_user_login_total`,
        help: 'Total number of user logins',
        labelNames: ['method', 'success', 'workspace_id'],
      }),

      userRegistrationTotal: new Counter({
        name: `${prefix}_user_registration_total`,
        help: 'Total number of user registrations',
        labelNames: ['method', 'success', 'source'],
      }),

      userSessionDuration: new Histogram({
        name: `${prefix}_user_session_duration_seconds`,
        help: 'Duration of user sessions in seconds',
        labelNames: ['workspace_id', 'user_role'],
        buckets: [60, 300, 900, 1800, 3600, 7200, 14400], // 1min to 4hours
      }),

      activeUsers: new Gauge({
        name: `${prefix}_active_users`,
        help: 'Number of currently active users',
        labelNames: ['workspace_id', 'time_window'],
      }),

      // Task management metrics
      tasksCreatedTotal: new Counter({
        name: `${prefix}_tasks_created_total`,
        help: 'Total number of tasks created',
        labelNames: ['workspace_id', 'project_id', 'priority', 'created_by_role'],
      }),

      tasksCompletedTotal: new Counter({
        name: `${prefix}_tasks_completed_total`,
        help: 'Total number of tasks completed',
        labelNames: ['workspace_id', 'project_id', 'priority', 'completion_method'],
      }),

      taskCompletionTime: new Histogram({
        name: `${prefix}_task_completion_time_hours`,
        help: 'Time taken to complete tasks in hours',
        labelNames: ['workspace_id', 'priority', 'task_type'],
        buckets: [1, 4, 8, 24, 72, 168, 336], // 1hour to 2weeks
      }),

      activeTasks: new Gauge({
        name: `${prefix}_active_tasks`,
        help: 'Number of currently active tasks',
        labelNames: ['workspace_id', 'status', 'priority'],
      }),

      // Project metrics
      projectsCreatedTotal: new Counter({
        name: `${prefix}_projects_created_total`,
        help: 'Total number of projects created',
        labelNames: ['workspace_id', 'template_used', 'created_by_role'],
      }),

      projectCompletionRate: new Gauge({
        name: `${prefix}_project_completion_rate`,
        help: 'Project completion rate percentage',
        labelNames: ['workspace_id', 'project_type'],
      }),

      // Feature usage metrics
      featureUsageTotal: new Counter({
        name: `${prefix}_feature_usage_total`,
        help: 'Total feature usage count',
        labelNames: ['feature_name', 'workspace_id', 'user_role', 'platform'],
      }),

      apiEndpointUsage: new Counter({
        name: `${prefix}_api_endpoint_usage_total`,
        help: 'API endpoint usage count',
        labelNames: ['endpoint', 'method', 'workspace_id', 'user_role'],
      }),

      // Business KPIs
      conversionRate: new Gauge({
        name: `${prefix}_conversion_rate`,
        help: 'Conversion rate percentage',
        labelNames: ['conversion_type', 'time_period'],
      }),

      retentionRate: new Gauge({
        name: `${prefix}_retention_rate`,
        help: 'User retention rate percentage',
        labelNames: ['time_period', 'cohort'],
      }),

      churnRate: new Gauge({
        name: `${prefix}_churn_rate`,
        help: 'User churn rate percentage',
        labelNames: ['time_period', 'reason'],
      }),
    };

    // Register all metrics
    Object.values(this.metrics).forEach(metric => {
      register.registerMetric(metric);
    });

    this.logger.info('Business metrics initialized', {
      metricsCount: Object.keys(this.metrics).length,
      prefix: this.config.prefix,
    });
  }

  // User engagement tracking
  trackUserLogin(method: string, success: boolean, workspaceId?: string): void {
    if (!this.config.enabled) return;

    this.metrics.userLoginTotal.inc({
      method,
      success: success.toString(),
      workspace_id: workspaceId || 'unknown',
    });

    this.logger.debug('User login tracked', { method, success, workspaceId });
  }

  trackUserRegistration(method: string, success: boolean, source?: string): void {
    if (!this.config.enabled) return;

    this.metrics.userRegistrationTotal.inc({
      method,
      success: success.toString(),
      source: source || 'direct',
    });

    this.logger.debug('User registration tracked', { method, success, source });
  }

  trackUserSession(durationSeconds: number, workspaceId: string, userRole: string): void {
    if (!this.config.enabled) return;

    this.metrics.userSessionDuration.observe(
      { workspace_id: workspaceId, user_role: userRole },
      durationSeconds
    );

    this.logger.debug('User session tracked', { durationSeconds, workspaceId, userRole });
  }

  setActiveUsers(count: number, workspaceId: string, timeWindow: string): void {
    if (!this.config.enabled) return;

    this.metrics.activeUsers.set(
      { workspace_id: workspaceId, time_window: timeWindow },
      count
    );
  }

  // Task management tracking
  trackTaskCreated(workspaceId: string, projectId: string, priority: string, createdByRole: string): void {
    if (!this.config.enabled) return;

    this.metrics.tasksCreatedTotal.inc({
      workspace_id: workspaceId,
      project_id: projectId,
      priority,
      created_by_role: createdByRole,
    });

    this.logger.debug('Task creation tracked', { workspaceId, projectId, priority, createdByRole });
  }

  trackTaskCompleted(
    workspaceId: string,
    projectId: string,
    priority: string,
    completionMethod: string,
    completionTimeHours?: number
  ): void {
    if (!this.config.enabled) return;

    this.metrics.tasksCompletedTotal.inc({
      workspace_id: workspaceId,
      project_id: projectId,
      priority,
      completion_method: completionMethod,
    });

    if (completionTimeHours !== undefined) {
      this.metrics.taskCompletionTime.observe(
        { workspace_id: workspaceId, priority, task_type: 'standard' },
        completionTimeHours
      );
    }

    this.logger.debug('Task completion tracked', {
      workspaceId,
      projectId,
      priority,
      completionMethod,
      completionTimeHours,
    });
  }

  setActiveTasks(count: number, workspaceId: string, status: string, priority: string): void {
    if (!this.config.enabled) return;

    this.metrics.activeTasks.set(
      { workspace_id: workspaceId, status, priority },
      count
    );
  }

  // Project tracking
  trackProjectCreated(workspaceId: string, templateUsed: boolean, createdByRole: string): void {
    if (!this.config.enabled) return;

    this.metrics.projectsCreatedTotal.inc({
      workspace_id: workspaceId,
      template_used: templateUsed.toString(),
      created_by_role: createdByRole,
    });

    this.logger.debug('Project creation tracked', { workspaceId, templateUsed, createdByRole });
  }

  setProjectCompletionRate(rate: number, workspaceId: string, projectType: string): void {
    if (!this.config.enabled) return;

    this.metrics.projectCompletionRate.set(
      { workspace_id: workspaceId, project_type: projectType },
      rate
    );
  }

  // Feature usage tracking
  trackFeatureUsage(featureName: string, workspaceId: string, userRole: string, platform: string): void {
    if (!this.config.enabled) return;

    this.metrics.featureUsageTotal.inc({
      feature_name: featureName,
      workspace_id: workspaceId,
      user_role: userRole,
      platform,
    });

    this.logger.debug('Feature usage tracked', { featureName, workspaceId, userRole, platform });
  }

  trackApiEndpointUsage(endpoint: string, method: string, workspaceId: string, userRole: string): void {
    if (!this.config.enabled) return;

    this.metrics.apiEndpointUsage.inc({
      endpoint,
      method,
      workspace_id: workspaceId,
      user_role: userRole,
    });
  }

  // Business KPI tracking
  setConversionRate(rate: number, conversionType: string, timePeriod: string): void {
    if (!this.config.enabled) return;

    this.metrics.conversionRate.set(
      { conversion_type: conversionType, time_period: timePeriod },
      rate
    );

    this.logger.info('Conversion rate updated', { rate, conversionType, timePeriod });
  }

  setRetentionRate(rate: number, timePeriod: string, cohort: string): void {
    if (!this.config.enabled) return;

    this.metrics.retentionRate.set(
      { time_period: timePeriod, cohort },
      rate
    );

    this.logger.info('Retention rate updated', { rate, timePeriod, cohort });
  }

  setChurnRate(rate: number, timePeriod: string, reason: string): void {
    if (!this.config.enabled) return;

    this.metrics.churnRate.set(
      { time_period: timePeriod, reason },
      rate
    );

    this.logger.info('Churn rate updated', { rate, timePeriod, reason });
  }

  // Utility methods
  getMetrics(): BusinessMetrics {
    return this.metrics;
  }

  async getMetricsSnapshot(): Promise<Record<string, any>> {
    const snapshot: Record<string, any> = {};
    
    for (const [name, metric] of Object.entries(this.metrics)) {
      try {
        snapshot[name] = await metric.get();
      } catch (error) {
        this.logger.error(`Failed to get metric snapshot for ${name}`, { error });
      }
    }

    return snapshot;
  }

  reset(): void {
    Object.values(this.metrics).forEach(metric => {
      if ('reset' in metric && typeof metric.reset === 'function') {
        metric.reset();
      }
    });

    this.logger.info('Business metrics reset');
  }

  destroy(): void {
    Object.values(this.metrics).forEach(metric => {
      register.removeSingleMetric(metric);
    });

    this.logger.info('Business metrics service destroyed');
  }
}

export default BusinessMetricsService;