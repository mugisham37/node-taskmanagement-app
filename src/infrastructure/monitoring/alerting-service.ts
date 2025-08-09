import { EventEmitter } from 'events';
import { LoggingService, LogContext } from './logging-service';
import { MetricsService } from './metrics-service';

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  condition: AlertCondition;
  severity: AlertSeverity;
  enabled: boolean;
  cooldownPeriod: number; // milliseconds
  actions: AlertAction[];
  tags: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}

export interface AlertCondition {
  type: 'threshold' | 'anomaly' | 'pattern' | 'composite';
  metric: string;
  operator: '>' | '<' | '>=' | '<=' | '==' | '!=' | 'contains' | 'matches';
  value: number | string;
  timeWindow?: number; // milliseconds
  aggregation?: 'avg' | 'sum' | 'min' | 'max' | 'count';
  threshold?: number;
  // For composite conditions
  conditions?: AlertCondition[];
  logicalOperator?: 'AND' | 'OR';
}

export type AlertSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface AlertAction {
  type: 'email' | 'webhook' | 'slack' | 'log' | 'metric';
  config: Record<string, any>;
  enabled: boolean;
}

export interface Alert {
  id: string;
  ruleId: string;
  ruleName: string;
  severity: AlertSeverity;
  message: string;
  description?: string;
  source: string;
  timestamp: Date;
  resolvedAt?: Date;
  status: 'active' | 'resolved' | 'suppressed';
  value?: number | string;
  threshold?: number | string;
  metadata: Record<string, any>;
  tags: Record<string, string>;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
}

export interface AlertingConfig {
  enabled: boolean;
  evaluationInterval: number; // milliseconds
  maxActiveAlerts: number;
  retentionPeriod: number; // days
  defaultCooldownPeriod: number; // milliseconds
  enableAutoResolution: boolean;
  autoResolutionTimeout: number; // milliseconds
}

export class AlertingService extends EventEmitter {
  private rules: Map<string, AlertRule> = new Map();
  private alerts: Map<string, Alert> = new Map();
  private lastEvaluationTime: Map<string, number> = new Map();
  private lastAlertTime: Map<string, number> = new Map();
  private evaluationInterval: NodeJS.Timeout | null = null;
  private metricValues: Map<
    string,
    Array<{ timestamp: number; value: number }>
  > = new Map();

  constructor(
    private readonly config: AlertingConfig,
    private readonly loggingService: LoggingService,
    private readonly metricsService: MetricsService
  ) {
    super();
    this.startEvaluation();
    this.setupDefaultRules();
  }

  /**
   * Add an alert rule
   */
  addRule(rule: Omit<AlertRule, 'id' | 'createdAt' | 'updatedAt'>): AlertRule {
    const alertRule: AlertRule = {
      ...rule,
      id: this.generateId(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.rules.set(alertRule.id, alertRule);
    this.loggingService.info('Alert rule added', {
      ruleId: alertRule.id,
      ruleName: alertRule.name,
      severity: alertRule.severity,
    });

    return alertRule;
  }

  /**
   * Update an alert rule
   */
  updateRule(ruleId: string, updates: Partial<AlertRule>): AlertRule | null {
    const rule = this.rules.get(ruleId);
    if (!rule) {
      return null;
    }

    const updatedRule = {
      ...rule,
      ...updates,
      updatedAt: new Date(),
    };

    this.rules.set(ruleId, updatedRule);
    this.loggingService.info('Alert rule updated', {
      ruleId,
      ruleName: updatedRule.name,
    });

    return updatedRule;
  }

  /**
   * Remove an alert rule
   */
  removeRule(ruleId: string): boolean {
    const rule = this.rules.get(ruleId);
    if (!rule) {
      return false;
    }

    this.rules.delete(ruleId);
    this.loggingService.info('Alert rule removed', {
      ruleId,
      ruleName: rule.name,
    });

    return true;
  }

  /**
   * Get all alert rules
   */
  getRules(): AlertRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Get alert rule by ID
   */
  getRule(ruleId: string): AlertRule | null {
    return this.rules.get(ruleId) || null;
  }

  /**
   * Record a metric value for alerting
   */
  recordMetricValue(metric: string, value: number): void {
    if (!this.metricValues.has(metric)) {
      this.metricValues.set(metric, []);
    }

    const values = this.metricValues.get(metric)!;
    values.push({ timestamp: Date.now(), value });

    // Keep only recent values (last hour)
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const recentValues = values.filter(v => v.timestamp > oneHourAgo);
    this.metricValues.set(metric, recentValues);
  }

  /**
   * Create an alert
   */
  createAlert(
    ruleId: string,
    message: string,
    value?: number | string,
    metadata: Record<string, any> = {}
  ): Alert {
    const rule = this.rules.get(ruleId);
    if (!rule) {
      throw new Error(`Alert rule not found: ${ruleId}`);
    }

    const alert: Alert = {
      id: this.generateId(),
      ruleId,
      ruleName: rule.name,
      severity: rule.severity,
      message,
      description: rule.description,
      source: 'alerting-service',
      timestamp: new Date(),
      status: 'active',
      value,
      threshold: rule.condition.value,
      metadata,
      tags: rule.tags,
    };

    this.alerts.set(alert.id, alert);
    this.lastAlertTime.set(ruleId, Date.now());

    // Emit alert event
    this.emit('alert', alert);

    // Execute alert actions
    this.executeAlertActions(rule, alert);

    // Record metrics
    this.metricsService.incrementCounter('alerts_created_total', {
      severity: alert.severity,
      rule: rule.name,
    });

    this.loggingService.warn('Alert created', {
      alertId: alert.id,
      ruleId,
      ruleName: rule.name,
      severity: alert.severity,
      message,
      value,
    });

    return alert;
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string, resolvedBy?: string): boolean {
    const alert = this.alerts.get(alertId);
    if (!alert || alert.status !== 'active') {
      return false;
    }

    alert.status = 'resolved';
    alert.resolvedAt = new Date();
    if (resolvedBy) {
      alert.acknowledgedBy = resolvedBy;
      alert.acknowledgedAt = new Date();
    }

    this.emit('alertResolved', alert);

    this.metricsService.incrementCounter('alerts_resolved_total', {
      severity: alert.severity,
      rule: alert.ruleName,
    });

    this.loggingService.info('Alert resolved', {
      alertId,
      ruleName: alert.ruleName,
      resolvedBy,
    });

    return true;
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string, acknowledgedBy: string): boolean {
    const alert = this.alerts.get(alertId);
    if (!alert || alert.status !== 'active') {
      return false;
    }

    alert.acknowledgedBy = acknowledgedBy;
    alert.acknowledgedAt = new Date();

    this.emit('alertAcknowledged', alert);

    this.loggingService.info('Alert acknowledged', {
      alertId,
      ruleName: alert.ruleName,
      acknowledgedBy,
    });

    return true;
  }

  /**
   * Get all alerts
   */
  getAlerts(status?: Alert['status']): Alert[] {
    const alerts = Array.from(this.alerts.values());
    return status ? alerts.filter(alert => alert.status === status) : alerts;
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): Alert[] {
    return this.getAlerts('active');
  }

  /**
   * Get alert by ID
   */
  getAlert(alertId: string): Alert | null {
    return this.alerts.get(alertId) || null;
  }

  /**
   * Get alert statistics
   */
  getAlertStatistics(): {
    total: number;
    active: number;
    resolved: number;
    suppressed: number;
    bySeverity: Record<AlertSeverity, number>;
    byRule: Record<string, number>;
  } {
    const alerts = Array.from(this.alerts.values());
    const bySeverity: Record<AlertSeverity, number> = {
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
      CRITICAL: 0,
    };
    const byRule: Record<string, number> = {};

    let active = 0;
    let resolved = 0;
    let suppressed = 0;

    alerts.forEach(alert => {
      bySeverity[alert.severity]++;
      byRule[alert.ruleName] = (byRule[alert.ruleName] || 0) + 1;

      switch (alert.status) {
        case 'active':
          active++;
          break;
        case 'resolved':
          resolved++;
          break;
        case 'suppressed':
          suppressed++;
          break;
      }
    });

    return {
      total: alerts.length,
      active,
      resolved,
      suppressed,
      bySeverity,
      byRule,
    };
  }

  /**
   * Start alert evaluation
   */
  private startEvaluation(): void {
    if (!this.config.enabled) {
      return;
    }

    this.evaluationInterval = setInterval(() => {
      this.evaluateRules();
    }, this.config.evaluationInterval);

    this.loggingService.info('Alert evaluation started', {
      interval: this.config.evaluationInterval,
    });
  }

  /**
   * Stop alert evaluation
   */
  stopEvaluation(): void {
    if (this.evaluationInterval) {
      clearInterval(this.evaluationInterval);
      this.evaluationInterval = null;
    }

    this.loggingService.info('Alert evaluation stopped');
  }

  /**
   * Evaluate all alert rules
   */
  private async evaluateRules(): Promise<void> {
    const enabledRules = Array.from(this.rules.values()).filter(
      rule => rule.enabled
    );

    for (const rule of enabledRules) {
      try {
        await this.evaluateRule(rule);
      } catch (error) {
        this.loggingService.error(
          'Error evaluating alert rule',
          error as Error,
          {
            ruleId: rule.id,
            ruleName: rule.name,
          }
        );
      }
    }
  }

  /**
   * Evaluate a single alert rule
   */
  private async evaluateRule(rule: AlertRule): Promise<void> {
    const now = Date.now();
    const lastEvaluation = this.lastEvaluationTime.get(rule.id) || 0;
    const lastAlert = this.lastAlertTime.get(rule.id) || 0;

    // Check if we're in cooldown period
    if (now - lastAlert < rule.cooldownPeriod) {
      return;
    }

    this.lastEvaluationTime.set(rule.id, now);

    const conditionMet = await this.evaluateCondition(rule.condition);

    if (conditionMet) {
      const message = `Alert condition met for rule: ${rule.name}`;
      this.createAlert(rule.id, message, undefined, {
        evaluatedAt: new Date(),
        condition: rule.condition,
      });
    }
  }

  /**
   * Evaluate an alert condition
   */
  private async evaluateCondition(condition: AlertCondition): Promise<boolean> {
    switch (condition.type) {
      case 'threshold':
        return this.evaluateThresholdCondition(condition);
      case 'composite':
        return this.evaluateCompositeCondition(condition);
      default:
        return false;
    }
  }

  /**
   * Evaluate a threshold condition
   */
  private evaluateThresholdCondition(condition: AlertCondition): boolean {
    const values = this.metricValues.get(condition.metric);
    if (!values || values.length === 0) {
      return false;
    }

    const timeWindow = condition.timeWindow || 5 * 60 * 1000; // 5 minutes default
    const cutoffTime = Date.now() - timeWindow;
    const recentValues = values.filter(v => v.timestamp > cutoffTime);

    if (recentValues.length === 0) {
      return false;
    }

    let aggregatedValue: number;
    const numericValues = recentValues.map(v => v.value);

    switch (condition.aggregation || 'avg') {
      case 'avg':
        aggregatedValue =
          numericValues.reduce((sum, val) => sum + val, 0) /
          numericValues.length;
        break;
      case 'sum':
        aggregatedValue = numericValues.reduce((sum, val) => sum + val, 0);
        break;
      case 'min':
        aggregatedValue = Math.min(...numericValues);
        break;
      case 'max':
        aggregatedValue = Math.max(...numericValues);
        break;
      case 'count':
        aggregatedValue = numericValues.length;
        break;
      default:
        aggregatedValue = numericValues[numericValues.length - 1];
    }

    const thresholdValue =
      typeof condition.value === 'number'
        ? condition.value
        : parseFloat(condition.value);

    switch (condition.operator) {
      case '>':
        return aggregatedValue > thresholdValue;
      case '<':
        return aggregatedValue < thresholdValue;
      case '>=':
        return aggregatedValue >= thresholdValue;
      case '<=':
        return aggregatedValue <= thresholdValue;
      case '==':
        return aggregatedValue === thresholdValue;
      case '!=':
        return aggregatedValue !== thresholdValue;
      default:
        return false;
    }
  }

  /**
   * Evaluate a composite condition
   */
  private async evaluateCompositeCondition(
    condition: AlertCondition
  ): Promise<boolean> {
    if (!condition.conditions || condition.conditions.length === 0) {
      return false;
    }

    const results = await Promise.all(
      condition.conditions.map(subCondition =>
        this.evaluateCondition(subCondition)
      )
    );

    switch (condition.logicalOperator || 'AND') {
      case 'AND':
        return results.every(result => result);
      case 'OR':
        return results.some(result => result);
      default:
        return false;
    }
  }

  /**
   * Execute alert actions
   */
  private async executeAlertActions(
    rule: AlertRule,
    alert: Alert
  ): Promise<void> {
    for (const action of rule.actions) {
      if (!action.enabled) {
        continue;
      }

      try {
        await this.executeAction(action, alert);
      } catch (error) {
        this.loggingService.error(
          'Error executing alert action',
          error as Error,
          {
            alertId: alert.id,
            actionType: action.type,
          }
        );
      }
    }
  }

  /**
   * Execute a single alert action
   */
  private async executeAction(
    action: AlertAction,
    alert: Alert
  ): Promise<void> {
    switch (action.type) {
      case 'log':
        this.loggingService.warn(`ALERT: ${alert.message}`, {
          alertId: alert.id,
          severity: alert.severity,
          ruleName: alert.ruleName,
        });
        break;

      case 'metric':
        this.metricsService.incrementCounter('alert_actions_executed_total', {
          type: action.type,
          severity: alert.severity,
        });
        break;

      case 'webhook':
        // In a real implementation, you would make HTTP requests to webhooks
        this.loggingService.info('Webhook alert action executed', {
          alertId: alert.id,
          webhookUrl: action.config.url,
        });
        break;

      case 'email':
        // In a real implementation, you would send emails
        this.loggingService.info('Email alert action executed', {
          alertId: alert.id,
          recipients: action.config.recipients,
        });
        break;

      case 'slack':
        // In a real implementation, you would send Slack messages
        this.loggingService.info('Slack alert action executed', {
          alertId: alert.id,
          channel: action.config.channel,
        });
        break;
    }
  }

  /**
   * Setup default alert rules
   */
  private setupDefaultRules(): void {
    // High memory usage alert
    this.addRule({
      name: 'High Memory Usage',
      description: 'Alert when memory usage exceeds 80%',
      condition: {
        type: 'threshold',
        metric: 'memory_usage_percentage',
        operator: '>',
        value: 80,
        timeWindow: 5 * 60 * 1000, // 5 minutes
        aggregation: 'avg',
      },
      severity: 'HIGH',
      enabled: true,
      cooldownPeriod: 10 * 60 * 1000, // 10 minutes
      actions: [
        {
          type: 'log',
          config: {},
          enabled: true,
        },
        {
          type: 'metric',
          config: {},
          enabled: true,
        },
      ],
      tags: {
        category: 'system',
        component: 'memory',
      },
    });

    // High error rate alert
    this.addRule({
      name: 'High Error Rate',
      description: 'Alert when error rate exceeds 5%',
      condition: {
        type: 'threshold',
        metric: 'error_rate_percentage',
        operator: '>',
        value: 5,
        timeWindow: 5 * 60 * 1000, // 5 minutes
        aggregation: 'avg',
      },
      severity: 'CRITICAL',
      enabled: true,
      cooldownPeriod: 5 * 60 * 1000, // 5 minutes
      actions: [
        {
          type: 'log',
          config: {},
          enabled: true,
        },
        {
          type: 'metric',
          config: {},
          enabled: true,
        },
      ],
      tags: {
        category: 'application',
        component: 'errors',
      },
    });

    // Slow response time alert
    this.addRule({
      name: 'Slow Response Time',
      description: 'Alert when average response time exceeds 2 seconds',
      condition: {
        type: 'threshold',
        metric: 'response_time_ms',
        operator: '>',
        value: 2000,
        timeWindow: 5 * 60 * 1000, // 5 minutes
        aggregation: 'avg',
      },
      severity: 'MEDIUM',
      enabled: true,
      cooldownPeriod: 10 * 60 * 1000, // 10 minutes
      actions: [
        {
          type: 'log',
          config: {},
          enabled: true,
        },
      ],
      tags: {
        category: 'performance',
        component: 'response_time',
      },
    });
  }

  /**
   * Generate a unique ID
   */
  private generateId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
