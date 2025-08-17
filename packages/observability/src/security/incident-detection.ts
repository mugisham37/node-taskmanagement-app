import { EventEmitter } from 'events';
import { Counter, Gauge, Histogram } from 'prom-client';
import { Logger } from 'winston';

export interface SecurityIncident {
  id: string;
  type: SecurityIncidentType;
  severity: SecuritySeverity;
  timestamp: Date;
  source: string;
  description: string;
  metadata: Record<string, any>;
  status: IncidentStatus;
  assignedTo?: string;
  resolvedAt?: Date;
  escalatedAt?: Date;
}

export enum SecurityIncidentType {
  AUTHENTICATION_FAILURE = 'authentication_failure',
  AUTHORIZATION_VIOLATION = 'authorization_violation',
  SUSPICIOUS_ACTIVITY = 'suspicious_activity',
  DATA_BREACH_ATTEMPT = 'data_breach_attempt',
  MALWARE_DETECTION = 'malware_detection',
  DDOS_ATTACK = 'ddos_attack',
  SQL_INJECTION = 'sql_injection',
  XSS_ATTEMPT = 'xss_attempt',
  PRIVILEGE_ESCALATION = 'privilege_escalation',
  UNUSUAL_DATA_ACCESS = 'unusual_data_access',
  FAILED_COMPLIANCE_CHECK = 'failed_compliance_check',
  VULNERABILITY_EXPLOITATION = 'vulnerability_exploitation'
}

export enum SecuritySeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum IncidentStatus {
  DETECTED = 'detected',
  INVESTIGATING = 'investigating',
  CONFIRMED = 'confirmed',
  MITIGATING = 'mitigating',
  RESOLVED = 'resolved',
  FALSE_POSITIVE = 'false_positive'
}

export interface SecurityRule {
  id: string;
  name: string;
  type: SecurityIncidentType;
  severity: SecuritySeverity;
  condition: (event: SecurityEvent) => boolean;
  threshold?: number;
  timeWindow?: number; // in milliseconds
  enabled: boolean;
  description: string;
}

export interface SecurityEvent {
  timestamp: Date;
  source: string;
  type: string;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  endpoint?: string;
  method?: string;
  statusCode?: number;
  responseTime?: number;
  payload?: any;
  metadata: Record<string, any>;
}

export interface SecurityMetrics {
  incidentsDetected: Counter;
  incidentsByType: Counter;
  incidentsBySeverity: Counter;
  responseTime: Histogram;
  activeIncidents: Gauge;
  falsePositiveRate: Gauge;
}

export class SecurityIncidentDetector extends EventEmitter {
  private rules: Map<string, SecurityRule> = new Map();
  private incidents: Map<string, SecurityIncident> = new Map();
  private eventBuffer: SecurityEvent[] = [];
  private metrics: SecurityMetrics;

  constructor(
    private logger: Logger,
    private alertManager: SecurityAlertManager
  ) {
    super();
    this.initializeMetrics();
    this.loadDefaultRules();
    this.startEventProcessing();
  }

  private initializeMetrics(): void {
    this.metrics = {
      incidentsDetected: new Counter({
        name: 'security_incidents_detected_total',
        help: 'Total number of security incidents detected',
        labelNames: ['type', 'severity', 'source']
      }),
      incidentsByType: new Counter({
        name: 'security_incidents_by_type_total',
        help: 'Security incidents grouped by type',
        labelNames: ['type']
      }),
      incidentsBySeverity: new Counter({
        name: 'security_incidents_by_severity_total',
        help: 'Security incidents grouped by severity',
        labelNames: ['severity']
      }),
      responseTime: new Histogram({
        name: 'security_incident_response_time_seconds',
        help: 'Time taken to respond to security incidents',
        labelNames: ['severity'],
        buckets: [1, 5, 10, 30, 60, 300, 600, 1800, 3600]
      }),
      activeIncidents: new Gauge({
        name: 'security_active_incidents',
        help: 'Number of active security incidents',
        labelNames: ['severity']
      }),
      falsePositiveRate: new Gauge({
        name: 'security_false_positive_rate',
        help: 'Rate of false positive security incidents'
      })
    };
  }

  private loadDefaultRules(): void {
    const defaultRules: SecurityRule[] = [
      {
        id: 'auth_brute_force',
        name: 'Authentication Brute Force Detection',
        type: SecurityIncidentType.AUTHENTICATION_FAILURE,
        severity: SecuritySeverity.HIGH,
        condition: (event) => this.detectBruteForce(event),
        threshold: 5,
        timeWindow: 300000, // 5 minutes
        enabled: true,
        description: 'Detects multiple failed authentication attempts from same IP'
      },
      {
        id: 'sql_injection_attempt',
        name: 'SQL Injection Detection',
        type: SecurityIncidentType.SQL_INJECTION,
        severity: SecuritySeverity.CRITICAL,
        condition: (event) => this.detectSQLInjection(event),
        enabled: true,
        description: 'Detects potential SQL injection attempts in request parameters'
      },
      {
        id: 'xss_attempt',
        name: 'XSS Attack Detection',
        type: SecurityIncidentType.XSS_ATTEMPT,
        severity: SecuritySeverity.HIGH,
        condition: (event) => this.detectXSS(event),
        enabled: true,
        description: 'Detects potential XSS attacks in user input'
      },
      {
        id: 'privilege_escalation',
        name: 'Privilege Escalation Detection',
        type: SecurityIncidentType.PRIVILEGE_ESCALATION,
        severity: SecuritySeverity.CRITICAL,
        condition: (event) => this.detectPrivilegeEscalation(event),
        enabled: true,
        description: 'Detects attempts to access resources beyond user permissions'
      },
      {
        id: 'unusual_data_access',
        name: 'Unusual Data Access Pattern',
        type: SecurityIncidentType.UNUSUAL_DATA_ACCESS,
        severity: SecuritySeverity.MEDIUM,
        condition: (event) => this.detectUnusualDataAccess(event),
        threshold: 100,
        timeWindow: 3600000, // 1 hour
        enabled: true,
        description: 'Detects unusual patterns in data access'
      },
      {
        id: 'ddos_detection',
        name: 'DDoS Attack Detection',
        type: SecurityIncidentType.DDOS_ATTACK,
        severity: SecuritySeverity.HIGH,
        condition: (event) => this.detectDDoS(event),
        threshold: 1000,
        timeWindow: 60000, // 1 minute
        enabled: true,
        description: 'Detects potential DDoS attacks based on request patterns'
      }
    ];

    defaultRules.forEach(rule => this.addRule(rule));
  }

  public addRule(rule: SecurityRule): void {
    this.rules.set(rule.id, rule);
    this.logger.info('Security rule added', { ruleId: rule.id, ruleName: rule.name });
  }

  public removeRule(ruleId: string): void {
    this.rules.delete(ruleId);
    this.logger.info('Security rule removed', { ruleId });
  }

  public processEvent(event: SecurityEvent): void {
    this.eventBuffer.push(event);
    
    // Process rules against the event
    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue;

      try {
        if (rule.condition(event)) {
          this.createIncident(rule, event);
        }
      } catch (error) {
        this.logger.error('Error processing security rule', {
          ruleId: rule.id,
          error: error.message,
          event
        });
      }
    }

    // Clean up old events
    this.cleanupEventBuffer();
  }

  private createIncident(rule: SecurityRule, event: SecurityEvent): void {
    const incident: SecurityIncident = {
      id: this.generateIncidentId(),
      type: rule.type,
      severity: rule.severity,
      timestamp: new Date(),
      source: event.source,
      description: `${rule.name}: ${rule.description}`,
      metadata: {
        ruleId: rule.id,
        triggerEvent: event,
        ruleName: rule.name
      },
      status: IncidentStatus.DETECTED
    };

    this.incidents.set(incident.id, incident);

    // Update metrics
    this.metrics.incidentsDetected.inc({
      type: incident.type,
      severity: incident.severity,
      source: incident.source
    });
    this.metrics.incidentsByType.inc({ type: incident.type });
    this.metrics.incidentsBySeverity.inc({ severity: incident.severity });
    this.metrics.activeIncidents.inc({ severity: incident.severity });

    // Emit incident event
    this.emit('incident', incident);

    // Send alert
    this.alertManager.sendAlert(incident);

    this.logger.warn('Security incident detected', {
      incidentId: incident.id,
      type: incident.type,
      severity: incident.severity,
      source: incident.source
    });
  }

  private detectBruteForce(event: SecurityEvent): boolean {
    if (event.type !== 'authentication' || event.statusCode === 200) {
      return false;
    }

    const timeWindow = 300000; // 5 minutes
    const threshold = 5;
    const now = Date.now();

    const recentFailures = this.eventBuffer.filter(e => 
      e.type === 'authentication' &&
      e.ipAddress === event.ipAddress &&
      e.statusCode !== 200 &&
      (now - e.timestamp.getTime()) < timeWindow
    );

    return recentFailures.length >= threshold;
  }

  private detectSQLInjection(event: SecurityEvent): boolean {
    const sqlPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/i,
      /(\b(OR|AND)\s+\d+\s*=\s*\d+)/i,
      /(\'|\"|;|--|\*|\|)/,
      /(\b(SCRIPT|JAVASCRIPT|VBSCRIPT|ONLOAD|ONERROR)\b)/i
    ];

    const payload = JSON.stringify(event.payload || {});
    return sqlPatterns.some(pattern => pattern.test(payload));
  }

  private detectXSS(event: SecurityEvent): boolean {
    const xssPatterns = [
      /<script[^>]*>.*?<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<iframe[^>]*>.*?<\/iframe>/gi,
      /<object[^>]*>.*?<\/object>/gi,
      /<embed[^>]*>/gi
    ];

    const payload = JSON.stringify(event.payload || {});
    return xssPatterns.some(pattern => pattern.test(payload));
  }

  private detectPrivilegeEscalation(event: SecurityEvent): boolean {
    // Check if user is trying to access admin endpoints without proper permissions
    if (event.endpoint?.includes('/admin/') && !event.metadata.hasAdminRole) {
      return true;
    }

    // Check for attempts to modify user roles or permissions
    if (event.payload && (
      event.payload.role || 
      event.payload.permissions || 
      event.payload.isAdmin
    )) {
      return !event.metadata.canModifyRoles;
    }

    return false;
  }

  private detectUnusualDataAccess(event: SecurityEvent): boolean {
    if (!event.userId || event.type !== 'data_access') {
      return false;
    }

    const timeWindow = 3600000; // 1 hour
    const threshold = 100;
    const now = Date.now();

    const recentAccess = this.eventBuffer.filter(e => 
      e.type === 'data_access' &&
      e.userId === event.userId &&
      (now - e.timestamp.getTime()) < timeWindow
    );

    return recentAccess.length >= threshold;
  }

  private detectDDoS(event: SecurityEvent): boolean {
    const timeWindow = 60000; // 1 minute
    const threshold = 1000;
    const now = Date.now();

    const recentRequests = this.eventBuffer.filter(e => 
      e.ipAddress === event.ipAddress &&
      (now - e.timestamp.getTime()) < timeWindow
    );

    return recentRequests.length >= threshold;
  }

  private cleanupEventBuffer(): void {
    const maxAge = 3600000; // 1 hour
    const now = Date.now();
    
    this.eventBuffer = this.eventBuffer.filter(event => 
      (now - event.timestamp.getTime()) < maxAge
    );
  }

  private generateIncidentId(): string {
    return `SEC-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private startEventProcessing(): void {
    // Process events periodically for time-based rules
    setInterval(() => {
      this.processTimeBasedRules();
    }, 60000); // Every minute
  }

  private processTimeBasedRules(): void {
    // Process rules that require time-based analysis
    for (const rule of this.rules.values()) {
      if (!rule.enabled || !rule.timeWindow) continue;

      try {
        this.processTimeBasedRule(rule);
      } catch (error) {
        this.logger.error('Error processing time-based rule', {
          ruleId: rule.id,
          error: error.message
        });
      }
    }
  }

  private processTimeBasedRule(rule: SecurityRule): void {
    // Implementation for time-based rule processing
    // This would analyze patterns over time windows
  }

  public getIncident(incidentId: string): SecurityIncident | undefined {
    return this.incidents.get(incidentId);
  }

  public getAllIncidents(): SecurityIncident[] {
    return Array.from(this.incidents.values());
  }

  public updateIncidentStatus(incidentId: string, status: IncidentStatus, assignedTo?: string): void {
    const incident = this.incidents.get(incidentId);
    if (!incident) return;

    const oldStatus = incident.status;
    incident.status = status;
    if (assignedTo) incident.assignedTo = assignedTo;
    if (status === IncidentStatus.RESOLVED) incident.resolvedAt = new Date();

    // Update metrics
    if (oldStatus !== IncidentStatus.RESOLVED && status === IncidentStatus.RESOLVED) {
      this.metrics.activeIncidents.dec({ severity: incident.severity });
      
      const responseTime = (incident.resolvedAt!.getTime() - incident.timestamp.getTime()) / 1000;
      this.metrics.responseTime.observe({ severity: incident.severity }, responseTime);
    }

    this.emit('incidentUpdated', incident);
    this.logger.info('Security incident updated', {
      incidentId,
      oldStatus,
      newStatus: status,
      assignedTo
    });
  }

  public getActiveIncidents(): SecurityIncident[] {
    return Array.from(this.incidents.values()).filter(
      incident => incident.status !== IncidentStatus.RESOLVED && 
                 incident.status !== IncidentStatus.FALSE_POSITIVE
    );
  }

  public getIncidentsByType(type: SecurityIncidentType): SecurityIncident[] {
    return Array.from(this.incidents.values()).filter(
      incident => incident.type === type
    );
  }

  public getIncidentsBySeverity(severity: SecuritySeverity): SecurityIncident[] {
    return Array.from(this.incidents.values()).filter(
      incident => incident.severity === severity
    );
  }
}

export class SecurityAlertManager {
  constructor(
    private logger: Logger,
    private notificationService: NotificationService
  ) {}

  public async sendAlert(incident: SecurityIncident): Promise<void> {
    try {
      const alert = this.createAlert(incident);
      
      // Send to appropriate channels based on severity
      switch (incident.severity) {
        case SecuritySeverity.CRITICAL:
          await this.sendCriticalAlert(alert);
          break;
        case SecuritySeverity.HIGH:
          await this.sendHighPriorityAlert(alert);
          break;
        case SecuritySeverity.MEDIUM:
          await this.sendMediumPriorityAlert(alert);
          break;
        case SecuritySeverity.LOW:
          await this.sendLowPriorityAlert(alert);
          break;
      }

      this.logger.info('Security alert sent', {
        incidentId: incident.id,
        severity: incident.severity,
        type: incident.type
      });
    } catch (error) {
      this.logger.error('Failed to send security alert', {
        incidentId: incident.id,
        error: error.message
      });
    }
  }

  private createAlert(incident: SecurityIncident): SecurityAlert {
    return {
      id: `ALERT-${incident.id}`,
      incidentId: incident.id,
      title: `Security Incident: ${incident.type}`,
      message: incident.description,
      severity: incident.severity,
      timestamp: incident.timestamp,
      metadata: incident.metadata
    };
  }

  private async sendCriticalAlert(alert: SecurityAlert): Promise<void> {
    // Send to all channels for critical alerts
    await Promise.all([
      this.notificationService.sendEmail({
        to: process.env.SECURITY_TEAM_EMAIL!,
        subject: `🚨 CRITICAL Security Alert: ${alert.title}`,
        body: this.formatAlertEmail(alert)
      }),
      this.notificationService.sendSlack({
        channel: '#security-alerts',
        message: this.formatSlackAlert(alert),
        priority: 'critical'
      }),
      this.notificationService.sendSMS({
        to: process.env.SECURITY_ONCALL_PHONE!,
        message: `CRITICAL: ${alert.title} - ${alert.message}`
      }),
      this.notificationService.sendPagerDuty({
        severity: 'critical',
        summary: alert.title,
        source: 'security-monitoring',
        component: 'security-incident-detector'
      })
    ]);
  }

  private async sendHighPriorityAlert(alert: SecurityAlert): Promise<void> {
    await Promise.all([
      this.notificationService.sendEmail({
        to: process.env.SECURITY_TEAM_EMAIL!,
        subject: `⚠️ HIGH Priority Security Alert: ${alert.title}`,
        body: this.formatAlertEmail(alert)
      }),
      this.notificationService.sendSlack({
        channel: '#security-alerts',
        message: this.formatSlackAlert(alert),
        priority: 'high'
      })
    ]);
  }

  private async sendMediumPriorityAlert(alert: SecurityAlert): Promise<void> {
    await this.notificationService.sendSlack({
      channel: '#security-alerts',
      message: this.formatSlackAlert(alert),
      priority: 'medium'
    });
  }

  private async sendLowPriorityAlert(alert: SecurityAlert): Promise<void> {
    await this.notificationService.sendSlack({
      channel: '#security-monitoring',
      message: this.formatSlackAlert(alert),
      priority: 'low'
    });
  }

  private formatAlertEmail(alert: SecurityAlert): string {
    return `
Security Incident Detected

Incident ID: ${alert.incidentId}
Severity: ${alert.severity.toUpperCase()}
Type: ${alert.title}
Time: ${alert.timestamp.toISOString()}

Description:
${alert.message}

Metadata:
${JSON.stringify(alert.metadata, null, 2)}

Please investigate immediately.
    `.trim();
  }

  private formatSlackAlert(alert: SecurityAlert): string {
    const emoji = {
      [SecuritySeverity.CRITICAL]: '🚨',
      [SecuritySeverity.HIGH]: '⚠️',
      [SecuritySeverity.MEDIUM]: '⚡',
      [SecuritySeverity.LOW]: 'ℹ️'
    };

    return `${emoji[alert.severity]} *${alert.severity.toUpperCase()}* Security Alert

*Incident:* ${alert.title}
*ID:* ${alert.incidentId}
*Time:* ${alert.timestamp.toISOString()}

*Description:* ${alert.message}`;
  }
}

interface SecurityAlert {
  id: string;
  incidentId: string;
  title: string;
  message: string;
  severity: SecuritySeverity;
  timestamp: Date;
  metadata: Record<string, any>;
}

interface NotificationService {
  sendEmail(params: { to: string; subject: string; body: string }): Promise<void>;
  sendSlack(params: { channel: string; message: string; priority: string }): Promise<void>;
  sendSMS(params: { to: string; message: string }): Promise<void>;
  sendPagerDuty(params: { severity: string; summary: string; source: string; component: string }): Promise<void>;
}