import { Injectable } from '../decorators/injectable';
import { WebhookId } from '../../domain/webhook/value-objects/webhook-id';
import { WorkspaceId } from '../../domain/task-management/value-objects/workspace-id';
import { WebhookEvent } from '../../domain/webhook/value-objects/webhook-event';
import { WebhookRepository } from '../../domain/webhook/repositories/webhook.repository';
import { WebhookDeliveryRepository } from '../../domain/webhook/repositories/webhook-delivery.repository';
import { Logger } from '../../infrastructure/logging/logger';

export interface WebhookAnalytics {
  overview: {
    totalWebhooks: number;
    activeWebhooks: number;
    totalDeliveries: number;
    successfulDeliveries: number;
    failedDeliveries: number;
    overallSuccessRate: number;
    averageResponseTime: number;
  };
  trends: {
    deliveriesOverTime: Array<{
      date: string;
      totalDeliveries: number;
      successfulDeliveries: number;
      failedDeliveries: number;
      successRate: number;
      averageResponseTime: number;
    }>;
    topEvents: Array<{
      event: string;
      deliveryCount: number;
      successRate: number;
    }>;
    topWebhooks: Array<{
      webhookId: string;
      webhookName: string;
      deliveryCount: number;
      successRate: number;
      averageResponseTime: number;
    }>;
  };
  performance: {
    responseTimeDistribution: Array<{
      range: string;
      count: number;
      percentage: number;
    }>;
    slowestWebhooks: Array<{
      webhookId: string;
      webhookName: string;
      averageResponseTime: number;
      url: string;
    }>;
    fastestWebhooks: Array<{
      webhookId: string;
      webhookName: string;
      averageResponseTime: number;
      url: string;
    }>;
  };
  reliability: {
    healthyWebhooks: number;
    degradedWebhooks: number;
    unhealthyWebhooks: number;
    mostReliableWebhooks: Array<{
      webhookId: string;
      webhookName: string;
      successRate: number;
      totalDeliveries: number;
    }>;
    leastReliableWebhooks: Array<{
      webhookId: string;
      webhookName: string;
      successRate: number;
      totalDeliveries: number;
      commonErrors: string[];
    }>;
  };
  errors: {
    totalErrors: number;
    errorsByType: Array<{
      errorType: string;
      count: number;
      percentage: number;
      affectedWebhooks: number;
    }>;
    errorsByStatusCode: Array<{
      statusCode: number;
      count: number;
      percentage: number;
    }>;
    recentErrors: Array<{
      timestamp: Date;
      webhookId: string;
      webhookName: string;
      event: string;
      errorMessage: string;
      statusCode?: number;
    }>;
  };
}

export interface WebhookHealthReport {
  webhookId: string;
  webhookName: string;
  url: string;
  status: string;
  healthScore: number; // 0-100
  healthStatus: 'healthy' | 'degraded' | 'unhealthy';
  metrics: {
    totalDeliveries: number;
    successfulDeliveries: number;
    failedDeliveries: number;
    successRate: number;
    averageResponseTime: number;
    lastDeliveryAt?: Date;
    consecutiveFailures: number;
  };
  issues: Array<{
    severity: 'low' | 'medium' | 'high';
    type: string;
    message: string;
    recommendation: string;
  }>;
  trends: {
    successRateTrend: 'improving' | 'stable' | 'declining';
    responseTimeTrend: 'improving' | 'stable' | 'declining';
    volumeTrend: 'increasing' | 'stable' | 'decreasing';
  };
  lastChecked: Date;
}

export interface WebhookUsageReport {
  workspaceId: string;
  reportPeriod: {
    from: Date;
    to: Date;
  };
  summary: {
    totalWebhooks: number;
    activeWebhooks: number;
    totalDeliveries: number;
    successfulDeliveries: number;
    dataTransferred: number; // bytes
    averageResponseTime: number;
  };
  usage: {
    deliveriesByDay: Array<{
      date: string;
      deliveries: number;
      dataTransferred: number;
    }>;
    deliveriesByEvent: Array<{
      event: string;
      deliveries: number;
      percentage: number;
    }>;
    deliveriesByWebhook: Array<{
      webhookId: string;
      webhookName: string;
      deliveries: number;
      dataTransferred: number;
      averageResponseTime: number;
    }>;
  };
  costs: {
    estimatedCost: number;
    costPerDelivery: number;
    costByWebhook: Array<{
      webhookId: string;
      webhookName: string;
      deliveries: number;
      estimatedCost: number;
    }>;
  };
}

export interface WebhookAlertRule {
  id: string;
  name: string;
  description: string;
  webhookId?: string; // If null, applies to all webhooks
  workspaceId: string;
  conditions: {
    metric:
      | 'success_rate'
      | 'response_time'
      | 'error_count'
      | 'delivery_volume';
    operator: 'less_than' | 'greater_than' | 'equals';
    threshold: number;
    timeWindow: number; // minutes
  };
  actions: {
    email?: string[];
    webhook?: string;
    slack?: string;
  };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastTriggered?: Date;
}

export interface WebhookAlert {
  id: string;
  ruleId: string;
  webhookId?: string;
  workspaceId: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  data: Record<string, any>;
  isResolved: boolean;
  resolvedAt?: Date;
  createdAt: Date;
}

@Injectable()
export class WebhookAnalyticsService {
  private alertRules = new Map<string, WebhookAlertRule>();
  private alerts = new Map<string, WebhookAlert>();

  constructor(
    private readonly webhookRepository: WebhookRepository,
    private readonly webhookDeliveryRepository: WebhookDeliveryRepository,
    private readonly logger: Logger
  ) {}

  // Analytics and Reporting
  async generateWebhookAnalytics(
    workspaceId?: WorkspaceId,
    dateRange?: { from: Date; to: Date }
  ): Promise<WebhookAnalytics> {
    this.logger.info('Generating webhook analytics', {
      workspaceId: workspaceId?.value,
      dateRange,
    });

    const [
      webhookStats,
      deliveryStats,
      topEvents,
      topWebhooks,
      responseTimeDistribution,
      slowestWebhooks,
      fastestWebhooks,
      errorAnalysis,
    ] = await Promise.all([
      this.webhookRepository.getStats(workspaceId, dateRange),
      this.webhookDeliveryRepository.getStats(
        undefined,
        workspaceId,
        dateRange
      ),
      this.getTopEvents(workspaceId, dateRange),
      this.getTopWebhooks(workspaceId, dateRange),
      this.getResponseTimeDistribution(workspaceId, dateRange),
      this.getSlowestWebhooks(workspaceId, dateRange, 5),
      this.getFastestWebhooks(workspaceId, dateRange, 5),
      this.webhookDeliveryRepository.getErrorAnalysis(
        undefined,
        workspaceId,
        dateRange
      ),
    ]);

    // Calculate health status
    const webhooks = workspaceId
      ? await this.webhookRepository.findByWorkspace(workspaceId)
      : [];

    const healthyWebhooks = webhooks.filter(w => w.deliveryRate >= 95).length;
    const degradedWebhooks = webhooks.filter(
      w => w.deliveryRate >= 80 && w.deliveryRate < 95
    ).length;
    const unhealthyWebhooks = webhooks.filter(w => w.deliveryRate < 80).length;

    const analytics: WebhookAnalytics = {
      overview: {
        totalWebhooks: webhookStats.totalWebhooks,
        activeWebhooks: webhookStats.activeWebhooks,
        totalDeliveries: deliveryStats.totalDeliveries,
        successfulDeliveries: deliveryStats.successfulDeliveries,
        failedDeliveries: deliveryStats.failedDeliveries,
        overallSuccessRate: deliveryStats.successRate,
        averageResponseTime: deliveryStats.averageResponseTime,
      },
      trends: {
        deliveriesOverTime: [], // Would be implemented with time-series queries
        topEvents,
        topWebhooks,
      },
      performance: {
        responseTimeDistribution,
        slowestWebhooks,
        fastestWebhooks,
      },
      reliability: {
        healthyWebhooks,
        degradedWebhooks,
        unhealthyWebhooks,
        mostReliableWebhooks: [], // Would be implemented with reliability queries
        leastReliableWebhooks: [], // Would be implemented with reliability queries
      },
      errors: {
        totalErrors: deliveryStats.failedDeliveries,
        errorsByType: errorAnalysis.map(error => ({
          errorType: error.errorMessage,
          count: error.count,
          percentage: error.percentage,
          affectedWebhooks: error.httpStatusCodes.length,
        })),
        errorsByStatusCode: [], // Would be implemented with status code analysis
        recentErrors: [], // Would be implemented with recent error queries
      },
    };

    this.logger.info('Webhook analytics generated', {
      workspaceId: workspaceId?.value,
      totalWebhooks: analytics.overview.totalWebhooks,
      totalDeliveries: analytics.overview.totalDeliveries,
      successRate: analytics.overview.overallSuccessRate,
    });

    return analytics;
  }

  async generateWebhookHealthReport(
    webhookId: WebhookId
  ): Promise<WebhookHealthReport> {
    const webhook = await this.webhookRepository.findById(webhookId);
    if (!webhook) {
      throw new Error(`Webhook not found: ${webhookId.value}`);
    }

    this.logger.info('Generating webhook health report', {
      webhookId: webhookId.value,
    });

    // Get delivery statistics for the last 30 days
    const dateRange = {
      from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      to: new Date(),
    };

    const deliveryStats = await this.webhookDeliveryRepository.getStats(
      webhookId,
      undefined,
      dateRange
    );

    // Calculate health score
    const healthScore = this.calculateWebhookHealthScore(
      webhook,
      deliveryStats
    );
    const healthStatus = this.determineHealthStatus(healthScore);

    // Identify issues
    const issues = this.identifyWebhookIssues(webhook, deliveryStats);

    // Analyze trends (simplified)
    const trends = {
      successRateTrend: 'stable' as const,
      responseTimeTrend: 'stable' as const,
      volumeTrend: 'stable' as const,
    };

    const healthReport: WebhookHealthReport = {
      webhookId: webhookId.value,
      webhookName: webhook.name,
      url: webhook.url.value,
      status: webhook.status.value,
      healthScore,
      healthStatus,
      metrics: {
        totalDeliveries: deliveryStats.totalDeliveries,
        successfulDeliveries: deliveryStats.successfulDeliveries,
        failedDeliveries: deliveryStats.failedDeliveries,
        successRate: deliveryStats.successRate,
        averageResponseTime: deliveryStats.averageResponseTime,
        lastDeliveryAt: webhook.lastDeliveryAt,
        consecutiveFailures: 0, // Would be calculated from delivery history
      },
      issues,
      trends,
      lastChecked: new Date(),
    };

    this.logger.info('Webhook health report generated', {
      webhookId: webhookId.value,
      healthScore,
      healthStatus,
      issueCount: issues.length,
    });

    return healthReport;
  }

  async generateUsageReport(
    workspaceId: WorkspaceId,
    dateRange: { from: Date; to: Date }
  ): Promise<WebhookUsageReport> {
    this.logger.info('Generating webhook usage report', {
      workspaceId: workspaceId.value,
      dateRange,
    });

    const [webhookStats, deliveryStats] = await Promise.all([
      this.webhookRepository.getStats(workspaceId, dateRange),
      this.webhookDeliveryRepository.getStats(
        undefined,
        workspaceId,
        dateRange
      ),
    ]);

    // Estimate data transferred (simplified calculation)
    const estimatedDataTransferred = deliveryStats.totalDeliveries * 1024; // 1KB per delivery estimate

    // Calculate costs (simplified)
    const costPerDelivery = 0.001; // $0.001 per delivery
    const estimatedCost = deliveryStats.totalDeliveries * costPerDelivery;

    const usageReport: WebhookUsageReport = {
      workspaceId: workspaceId.value,
      reportPeriod: dateRange,
      summary: {
        totalWebhooks: webhookStats.totalWebhooks,
        activeWebhooks: webhookStats.activeWebhooks,
        totalDeliveries: deliveryStats.totalDeliveries,
        successfulDeliveries: deliveryStats.successfulDeliveries,
        dataTransferred: estimatedDataTransferred,
        averageResponseTime: deliveryStats.averageResponseTime,
      },
      usage: {
        deliveriesByDay: [], // Would be implemented with daily aggregation
        deliveriesByEvent: Object.entries(deliveryStats.deliveriesByEvent).map(
          ([event, count]) => ({
            event,
            deliveries: count,
            percentage: (count / deliveryStats.totalDeliveries) * 100,
          })
        ),
        deliveriesByWebhook: [], // Would be implemented with webhook-specific queries
      },
      costs: {
        estimatedCost,
        costPerDelivery,
        costByWebhook: [], // Would be implemented with webhook-specific cost calculation
      },
    };

    this.logger.info('Webhook usage report generated', {
      workspaceId: workspaceId.value,
      totalDeliveries: usageReport.summary.totalDeliveries,
      estimatedCost: usageReport.costs.estimatedCost,
    });

    return usageReport;
  }

  // Alert Management
  async createAlertRule(
    rule: Omit<WebhookAlertRule, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<WebhookAlertRule> {
    const alertRule: WebhookAlertRule = {
      ...rule,
      id: this.generateId(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.alertRules.set(alertRule.id, alertRule);

    this.logger.info('Created webhook alert rule', {
      ruleId: alertRule.id,
      name: alertRule.name,
      webhookId: alertRule.webhookId,
      workspaceId: alertRule.workspaceId,
    });

    return alertRule;
  }

  async updateAlertRule(
    ruleId: string,
    updates: Partial<
      Pick<
        WebhookAlertRule,
        'name' | 'description' | 'conditions' | 'actions' | 'isActive'
      >
    >
  ): Promise<WebhookAlertRule> {
    const rule = this.alertRules.get(ruleId);
    if (!rule) {
      throw new Error(`Alert rule not found: ${ruleId}`);
    }

    Object.assign(rule, updates, { updatedAt: new Date() });

    this.logger.info('Updated webhook alert rule', {
      ruleId,
      updates: Object.keys(updates),
    });

    return rule;
  }

  async deleteAlertRule(ruleId: string): Promise<void> {
    const deleted = this.alertRules.delete(ruleId);
    if (!deleted) {
      throw new Error(`Alert rule not found: ${ruleId}`);
    }

    this.logger.info('Deleted webhook alert rule', { ruleId });
  }

  async getAlertRules(workspaceId: WorkspaceId): Promise<WebhookAlertRule[]> {
    return Array.from(this.alertRules.values()).filter(
      rule => rule.workspaceId === workspaceId.value
    );
  }

  async checkAlertRules(workspaceId: WorkspaceId): Promise<WebhookAlert[]> {
    const rules = await this.getAlertRules(workspaceId);
    const triggeredAlerts: WebhookAlert[] = [];

    for (const rule of rules) {
      if (!rule.isActive) continue;

      try {
        const shouldTrigger = await this.evaluateAlertRule(rule);
        if (shouldTrigger) {
          const alert = await this.createAlert(rule);
          triggeredAlerts.push(alert);
        }
      } catch (error) {
        this.logger.error('Failed to evaluate alert rule', {
          ruleId: rule.id,
          error: error.message,
        });
      }
    }

    return triggeredAlerts;
  }

  async getActiveAlerts(workspaceId: WorkspaceId): Promise<WebhookAlert[]> {
    return Array.from(this.alerts.values()).filter(
      alert => alert.workspaceId === workspaceId.value && !alert.isResolved
    );
  }

  async resolveAlert(alertId: string): Promise<WebhookAlert> {
    const alert = this.alerts.get(alertId);
    if (!alert) {
      throw new Error(`Alert not found: ${alertId}`);
    }

    alert.isResolved = true;
    alert.resolvedAt = new Date();

    this.logger.info('Resolved webhook alert', {
      alertId,
      ruleId: alert.ruleId,
    });

    return alert;
  }

  // Private helper methods
  private async getTopEvents(
    workspaceId?: WorkspaceId,
    dateRange?: { from: Date; to: Date }
  ): Promise<
    Array<{
      event: string;
      deliveryCount: number;
      successRate: number;
    }>
  > {
    const deliveryStats = await this.webhookDeliveryRepository.getStats(
      undefined,
      workspaceId,
      dateRange
    );

    return Object.entries(deliveryStats.deliveriesByEvent)
      .map(([event, count]) => ({
        event,
        deliveryCount: count,
        successRate: 95, // Simplified - would calculate actual success rate per event
      }))
      .sort((a, b) => b.deliveryCount - a.deliveryCount)
      .slice(0, 10);
  }

  private async getTopWebhooks(
    workspaceId?: WorkspaceId,
    dateRange?: { from: Date; to: Date }
  ): Promise<
    Array<{
      webhookId: string;
      webhookName: string;
      deliveryCount: number;
      successRate: number;
      averageResponseTime: number;
    }>
  > {
    // This would require more complex queries to get per-webhook statistics
    // For now, return empty array
    return [];
  }

  private async getResponseTimeDistribution(
    workspaceId?: WorkspaceId,
    dateRange?: { from: Date; to: Date }
  ): Promise<
    Array<{
      range: string;
      count: number;
      percentage: number;
    }>
  > {
    // This would require histogram queries on response times
    // For now, return sample data
    return [
      { range: '0-100ms', count: 1000, percentage: 40 },
      { range: '100-500ms', count: 800, percentage: 32 },
      { range: '500ms-1s', count: 400, percentage: 16 },
      { range: '1s-5s', count: 200, percentage: 8 },
      { range: '5s+', count: 100, percentage: 4 },
    ];
  }

  private async getSlowestWebhooks(
    workspaceId?: WorkspaceId,
    dateRange?: { from: Date; to: Date },
    limit: number = 5
  ): Promise<
    Array<{
      webhookId: string;
      webhookName: string;
      averageResponseTime: number;
      url: string;
    }>
  > {
    // This would require complex queries to calculate average response times per webhook
    // For now, return empty array
    return [];
  }

  private async getFastestWebhooks(
    workspaceId?: WorkspaceId,
    dateRange?: { from: Date; to: Date },
    limit: number = 5
  ): Promise<
    Array<{
      webhookId: string;
      webhookName: string;
      averageResponseTime: number;
      url: string;
    }>
  > {
    // This would require complex queries to calculate average response times per webhook
    // For now, return empty array
    return [];
  }

  private calculateWebhookHealthScore(
    webhook: any,
    deliveryStats: any
  ): number {
    let score = 100;

    // Success rate impact (50% of score)
    const successRateImpact = (deliveryStats.successRate / 100) * 50;
    score = score - 50 + successRateImpact;

    // Response time impact (25% of score)
    const responseTimeScore = Math.max(
      0,
      25 - (deliveryStats.averageResponseTime / 1000) * 5
    );
    score = score - 25 + responseTimeScore;

    // Configuration impact (25% of score)
    let configScore = 25;
    if (!webhook.secret) configScore -= 5;
    if (webhook.url.value.startsWith('http://')) configScore -= 5;
    if (webhook.timeout > 30000) configScore -= 5;

    score = score - 25 + configScore;

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  private determineHealthStatus(
    healthScore: number
  ): 'healthy' | 'degraded' | 'unhealthy' {
    if (healthScore >= 80) return 'healthy';
    if (healthScore >= 60) return 'degraded';
    return 'unhealthy';
  }

  private identifyWebhookIssues(
    webhook: any,
    deliveryStats: any
  ): Array<{
    severity: 'low' | 'medium' | 'high';
    type: string;
    message: string;
    recommendation: string;
  }> {
    const issues: Array<{
      severity: 'low' | 'medium' | 'high';
      type: string;
      message: string;
      recommendation: string;
    }> = [];

    // Check success rate
    if (deliveryStats.successRate < 50) {
      issues.push({
        severity: 'high',
        type: 'reliability',
        message: 'Very low success rate (<50%)',
        recommendation: 'Check webhook endpoint implementation and fix errors',
      });
    } else if (deliveryStats.successRate < 80) {
      issues.push({
        severity: 'medium',
        type: 'reliability',
        message: 'Low success rate (<80%)',
        recommendation: 'Investigate and fix common delivery failures',
      });
    }

    // Check response time
    if (deliveryStats.averageResponseTime > 10000) {
      issues.push({
        severity: 'high',
        type: 'performance',
        message: 'Very slow response times (>10s)',
        recommendation: 'Optimize webhook endpoint performance',
      });
    } else if (deliveryStats.averageResponseTime > 5000) {
      issues.push({
        severity: 'medium',
        type: 'performance',
        message: 'Slow response times (>5s)',
        recommendation: 'Consider optimizing webhook endpoint',
      });
    }

    // Check security
    if (!webhook.secret) {
      issues.push({
        severity: 'medium',
        type: 'security',
        message: 'No webhook secret configured',
        recommendation: 'Add a secret for signature verification',
      });
    }

    if (webhook.url.value.startsWith('http://')) {
      issues.push({
        severity: 'medium',
        type: 'security',
        message: 'Using HTTP instead of HTTPS',
        recommendation: 'Use HTTPS for better security',
      });
    }

    return issues;
  }

  private async evaluateAlertRule(rule: WebhookAlertRule): Promise<boolean> {
    // Get metrics for the specified time window
    const timeWindow = new Date(
      Date.now() - rule.conditions.timeWindow * 60 * 1000
    );
    const dateRange = { from: timeWindow, to: new Date() };

    let currentValue: number;

    switch (rule.conditions.metric) {
      case 'success_rate':
        const stats = await this.webhookDeliveryRepository.getStats(
          rule.webhookId ? WebhookId.fromString(rule.webhookId) : undefined,
          WorkspaceId.fromString(rule.workspaceId),
          dateRange
        );
        currentValue = stats.successRate;
        break;

      case 'response_time':
        const responseStats = await this.webhookDeliveryRepository.getStats(
          rule.webhookId ? WebhookId.fromString(rule.webhookId) : undefined,
          WorkspaceId.fromString(rule.workspaceId),
          dateRange
        );
        currentValue = responseStats.averageResponseTime;
        break;

      case 'error_count':
        const errorStats = await this.webhookDeliveryRepository.getStats(
          rule.webhookId ? WebhookId.fromString(rule.webhookId) : undefined,
          WorkspaceId.fromString(rule.workspaceId),
          dateRange
        );
        currentValue = errorStats.failedDeliveries;
        break;

      case 'delivery_volume':
        const volumeStats = await this.webhookDeliveryRepository.getStats(
          rule.webhookId ? WebhookId.fromString(rule.webhookId) : undefined,
          WorkspaceId.fromString(rule.workspaceId),
          dateRange
        );
        currentValue = volumeStats.totalDeliveries;
        break;

      default:
        return false;
    }

    // Evaluate condition
    switch (rule.conditions.operator) {
      case 'less_than':
        return currentValue < rule.conditions.threshold;
      case 'greater_than':
        return currentValue > rule.conditions.threshold;
      case 'equals':
        return currentValue === rule.conditions.threshold;
      default:
        return false;
    }
  }

  private async createAlert(rule: WebhookAlertRule): Promise<WebhookAlert> {
    const alert: WebhookAlert = {
      id: this.generateId(),
      ruleId: rule.id,
      webhookId: rule.webhookId,
      workspaceId: rule.workspaceId,
      severity: this.determineSeverity(rule),
      title: `Webhook Alert: ${rule.name}`,
      message: `Alert condition met for rule: ${rule.name}`,
      data: {
        metric: rule.conditions.metric,
        threshold: rule.conditions.threshold,
        operator: rule.conditions.operator,
      },
      isResolved: false,
      createdAt: new Date(),
    };

    this.alerts.set(alert.id, alert);

    // Update rule's last triggered time
    rule.lastTriggered = new Date();

    this.logger.warn('Webhook alert triggered', {
      alertId: alert.id,
      ruleId: rule.id,
      severity: alert.severity,
      webhookId: rule.webhookId,
    });

    return alert;
  }

  private determineSeverity(
    rule: WebhookAlertRule
  ): 'low' | 'medium' | 'high' | 'critical' {
    // Determine severity based on metric and threshold
    switch (rule.conditions.metric) {
      case 'success_rate':
        if (rule.conditions.threshold < 50) return 'critical';
        if (rule.conditions.threshold < 80) return 'high';
        return 'medium';
      case 'response_time':
        if (rule.conditions.threshold > 10000) return 'high';
        if (rule.conditions.threshold > 5000) return 'medium';
        return 'low';
      case 'error_count':
        if (rule.conditions.threshold > 100) return 'high';
        if (rule.conditions.threshold > 50) return 'medium';
        return 'low';
      default:
        return 'medium';
    }
  }

  private generateId(): string {
    return `analytics-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
