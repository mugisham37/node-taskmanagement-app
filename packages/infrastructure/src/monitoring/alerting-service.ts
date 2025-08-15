export interface Alert {
  id: string;
  type: 'error' | 'warning' | 'info' | 'critical';
  title: string;
  message: string;
  source: string;
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
  metadata?: Record<string, any>;
}

export interface AlertRule {
  id: string;
  name: string;
  condition: string;
  threshold: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  cooldownPeriod: number; // minutes
}

export interface AlertingService {
  /**
   * Send an alert
   */
  sendAlert(alert: Omit<Alert, 'id' | 'timestamp' | 'resolved'>): Promise<void>;

  /**
   * Get active alerts
   */
  getActiveAlerts(): Promise<Alert[]>;

  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string): Promise<boolean>;

  /**
   * Create alert rule
   */
  createAlertRule(rule: Omit<AlertRule, 'id'>): Promise<AlertRule>;

  /**
   * Check alert rules against metrics
   */
  checkAlertRules(metrics: Record<string, number>): Promise<void>;
}

export class DefaultAlertingService implements AlertingService {
  private alerts: Map<string, Alert> = new Map();
  private alertRules: Map<string, AlertRule> = new Map();
  private lastAlertTime: Map<string, Date> = new Map();

  async sendAlert(alert: Omit<Alert, 'id' | 'timestamp' | 'resolved'>): Promise<void> {
    const fullAlert: Alert = {
      ...alert,
      id: this.generateAlertId(),
      timestamp: new Date(),
      resolved: false,
    };

    this.alerts.set(fullAlert.id, fullAlert);

    // In a real implementation, this would send to external alerting systems
    console.log(`ALERT [${fullAlert.type.toUpperCase()}]: ${fullAlert.title} - ${fullAlert.message}`);
  }

  async getActiveAlerts(): Promise<Alert[]> {
    return Array.from(this.alerts.values()).filter(alert => !alert.resolved);
  }

  async resolveAlert(alertId: string): Promise<boolean> {
    const alert = this.alerts.get(alertId);
    if (alert && !alert.resolved) {
      alert.resolved = true;
      alert.resolvedAt = new Date();
      return true;
    }
    return false;
  }

  async createAlertRule(rule: Omit<AlertRule, 'id'>): Promise<AlertRule> {
    const fullRule: AlertRule = {
      ...rule,
      id: this.generateRuleId(),
    };

    this.alertRules.set(fullRule.id, fullRule);
    return fullRule;
  }

  async checkAlertRules(metrics: Record<string, number>): Promise<void> {
    for (const rule of this.alertRules.values()) {
      if (!rule.enabled) continue;

      // Check cooldown period
      const lastAlert = this.lastAlertTime.get(rule.id);
      if (lastAlert) {
        const cooldownMs = rule.cooldownPeriod * 60 * 1000;
        if (Date.now() - lastAlert.getTime() < cooldownMs) {
          continue;
        }
      }

      // Simple threshold checking (in real implementation, this would be more sophisticated)
      const metricValue = metrics[rule.condition];
      if (metricValue !== undefined && metricValue > rule.threshold) {
        await this.sendAlert({
          type: rule.severity === 'critical' ? 'critical' : 'warning',
          title: `Alert: ${rule.name}`,
          message: `Metric ${rule.condition} (${metricValue}) exceeded threshold ${rule.threshold}`,
          source: 'alert-rule',
          metadata: { ruleId: rule.id, metricValue, threshold: rule.threshold },
        });

        this.lastAlertTime.set(rule.id, new Date());
      }
    }
  }

  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateRuleId(): string {
    return `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}