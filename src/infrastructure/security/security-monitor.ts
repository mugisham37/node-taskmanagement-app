/**
 * Security Monitoring Service
 * Comprehensive security event monitoring and threat detection
 */

import { EventEmitter } from 'events';
import { logger } from '../logging/logger';
import { metricsService } from '../monitoring/metrics.service';

export interface SecurityEvent {
  id: string;
  type:
    | 'authentication'
    | 'authorization'
    | 'data_access'
    | 'system'
    | 'network';
  severity: 'low' | 'medium' | 'high' | 'critical';
  source: string;
  userId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  resource?: string;
  action?: string;
  timestamp: Date;
  metadata: Record<string, any>;
  resolved: boolean;
}

export interface SecurityThreat {
  id: string;
  type:
    | 'brute_force'
    | 'suspicious_activity'
    | 'data_breach'
    | 'privilege_escalation'
    | 'malware';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  indicators: string[];
  affectedUsers: string[];
  affectedResources: string[];
  firstSeen: Date;
  lastSeen: Date;
  eventCount: number;
  status: 'active' | 'investigating' | 'resolved' | 'false_positive';
  mitigationSteps: string[];
}

export interface SecurityMetrics {
  timestamp: Date;
  authenticationEvents: {
    successful: number;
    failed: number;
    blocked: number;
    mfaRequired: number;
    mfaSuccessful: number;
    mfaFailed: number;
  };
  authorizationEvents: {
    allowed: number;
    denied: number;
    privilegeEscalation: number;
  };
  dataAccess: {
    reads: number;
    writes: number;
    deletes: number;
    exports: number;
    unauthorizedAttempts: number;
  };
  threats: {
    active: number;
    resolved: number;
    falsePositives: number;
    criticalThreats: number;
  };
  systemSecurity: {
    vulnerabilities: number;
    patchesApplied: number;
    securityScans: number;
    complianceScore: number;
  };
}

export interface SecurityConfig {
  monitoring: {
    enabled: boolean;
    realTimeAlerts: boolean;
    retentionDays: number;
    maxEventsPerMinute: number;
  };
  threatDetection: {
    enabled: boolean;
    bruteForceThreshold: number;
    suspiciousActivityThreshold: number;
    anomalyDetectionEnabled: boolean;
  };
  compliance: {
    gdprEnabled: boolean;
    hipaaEnabled: boolean;
    sox404Enabled: boolean;
    auditLogRetentionDays: number;
  };
  alerting: {
    emailEnabled: boolean;
    slackEnabled: boolean;
    webhookEnabled: boolean;
    criticalAlertThreshold: number;
  };
}

export class SecurityMonitor extends EventEmitter {
  private readonly events: SecurityEvent[] = [];
  private readonly threats: SecurityThreat[] = [];
  private readonly metrics: SecurityMetrics[] = [];
  private readonly config: SecurityConfig;
  private monitoringInterval?: NodeJS.Timeout;
  private threatDetectionInterval?: NodeJS.Timeout;
  private readonly MAX_EVENTS = 10000;
  private readonly MAX_THREATS = 1000;
  private readonly MAX_METRICS = 1000;

  // Threat detection patterns
  private readonly bruteForceAttempts = new Map<
    string,
    { count: number; firstAttempt: Date; lastAttempt: Date }
  >();
  private readonly suspiciousActivities = new Map<
    string,
    { activities: string[]; firstSeen: Date; lastSeen: Date }
  >();

  constructor(config: Partial<SecurityConfig> = {}) {
    super();

    this.config = {
      monitoring: {
        enabled: true,
        realTimeAlerts: true,
        retentionDays: 90,
        maxEventsPerMinute: 1000,
        ...config.monitoring,
      },
      threatDetection: {
        enabled: true,
        bruteForceThreshold: 5,
        suspiciousActivityThreshold: 10,
        anomalyDetectionEnabled: true,
        ...config.threatDetection,
      },
      compliance: {
        gdprEnabled: true,
        hipaaEnabled: false,
        sox404Enabled: false,
        auditLogRetentionDays: 2555, // 7 years
        ...config.compliance,
      },
      alerting: {
        emailEnabled: true,
        slackEnabled: false,
        webhookEnabled: false,
        criticalAlertThreshold: 1,
        ...config.alerting,
      },
    };

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.on('securityEvent', (event: SecurityEvent) => {
      this.processSecurityEvent(event);
    });

    this.on('threatDetected', (threat: SecurityThreat) => {
      this.processThreatDetection(threat);
    });

    this.on('criticalAlert', (event: SecurityEvent) => {
      this.handleCriticalAlert(event);
    });
  }

  /**
   * Start security monitoring
   */
  startMonitoring(): void {
    if (!this.config.monitoring.enabled) {
      logger.info('Security monitoring is disabled');
      return;
    }

    logger.info('Starting security monitoring');

    // Start metrics collection
    this.monitoringInterval = setInterval(() => {
      this.collectSecurityMetrics();
    }, 60000); // Every minute

    // Start threat detection
    if (this.config.threatDetection.enabled) {
      this.threatDetectionInterval = setInterval(() => {
        this.runThreatDetection();
      }, 30000); // Every 30 seconds
    }

    // Initial metrics collection
    this.collectSecurityMetrics();
  }

  /**
   * Stop security monitoring
   */
  stopMonitoring(): void {
    logger.info('Stopping security monitoring');

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }

    if (this.threatDetectionInterval) {
      clearInterval(this.threatDetectionInterval);
      this.threatDetectionInterval = undefined;
    }
  }

  /**
   * Record a security event
   */
  recordEvent(
    eventData: Omit<SecurityEvent, 'id' | 'timestamp' | 'resolved'>
  ): void {
    const event: SecurityEvent = {
      id: this.generateEventId(),
      timestamp: new Date(),
      resolved: false,
      ...eventData,
    };

    // Store event
    this.events.push(event);
    if (this.events.length > this.MAX_EVENTS) {
      this.events.shift();
    }

    // Record metrics
    metricsService.recordSystemEvent('security_event', {
      type: event.type,
      severity: event.severity,
      source: event.source,
      user_id: event.userId || 'anonymous',
    });

    // Emit event for processing
    this.emit('securityEvent', event);

    // Log event
    logger.info('Security event recorded', {
      eventId: event.id,
      type: event.type,
      severity: event.severity,
      source: event.source,
      userId: event.userId,
    });

    // Check for critical events
    if (event.severity === 'critical') {
      this.emit('criticalAlert', event);
    }
  }

  /**
   * Record authentication event
   */
  recordAuthenticationEvent(
    result:
      | 'success'
      | 'failure'
      | 'blocked'
      | 'mfa_required'
      | 'mfa_success'
      | 'mfa_failure',
    userId?: string,
    ipAddress?: string,
    userAgent?: string,
    metadata: Record<string, any> = {}
  ): void {
    const severity =
      result === 'failure' || result === 'blocked' ? 'medium' : 'low';

    this.recordEvent({
      type: 'authentication',
      severity,
      source: 'authentication_service',
      userId,
      ipAddress,
      userAgent,
      action: result,
      metadata: {
        result,
        ...metadata,
      },
    });

    // Track brute force attempts
    if (result === 'failure' && ipAddress) {
      this.trackBruteForceAttempt(ipAddress, userId);
    }
  }

  /**
   * Record authorization event
   */
  recordAuthorizationEvent(
    result: 'allowed' | 'denied' | 'privilege_escalation',
    userId: string,
    resource: string,
    action: string,
    ipAddress?: string,
    metadata: Record<string, any> = {}
  ): void {
    const severity =
      result === 'denied'
        ? 'medium'
        : result === 'privilege_escalation'
          ? 'high'
          : 'low';

    this.recordEvent({
      type: 'authorization',
      severity,
      source: 'authorization_service',
      userId,
      ipAddress,
      resource,
      action,
      metadata: {
        result,
        ...metadata,
      },
    });
  }

  /**
   * Record data access event
   */
  recordDataAccessEvent(
    operation: 'read' | 'write' | 'delete' | 'export',
    userId: string,
    resource: string,
    authorized: boolean,
    ipAddress?: string,
    metadata: Record<string, any> = {}
  ): void {
    const severity = !authorized
      ? 'high'
      : operation === 'delete' || operation === 'export'
        ? 'medium'
        : 'low';

    this.recordEvent({
      type: 'data_access',
      severity,
      source: 'data_access_service',
      userId,
      ipAddress,
      resource,
      action: operation,
      metadata: {
        operation,
        authorized,
        ...metadata,
      },
    });

    // Track suspicious data access patterns
    if (!authorized) {
      this.trackSuspiciousActivity(
        userId,
        `unauthorized_${operation}_${resource}`
      );
    }
  }

  /**
   * Record system security event
   */
  recordSystemEvent(
    eventType:
      | 'vulnerability_detected'
      | 'patch_applied'
      | 'security_scan'
      | 'configuration_change',
    severity: SecurityEvent['severity'],
    description: string,
    metadata: Record<string, any> = {}
  ): void {
    this.recordEvent({
      type: 'system',
      severity,
      source: 'system_security',
      action: eventType,
      metadata: {
        description,
        ...metadata,
      },
    });
  }

  /**
   * Track brute force attempts
   */
  private trackBruteForceAttempt(ipAddress: string, userId?: string): void {
    const key = `${ipAddress}:${userId || 'unknown'}`;
    const now = new Date();
    const existing = this.bruteForceAttempts.get(key);

    if (existing) {
      existing.count++;
      existing.lastAttempt = now;
    } else {
      this.bruteForceAttempts.set(key, {
        count: 1,
        firstAttempt: now,
        lastAttempt: now,
      });
    }

    const attempts = this.bruteForceAttempts.get(key)!;

    // Check if threshold exceeded
    if (attempts.count >= this.config.threatDetection.bruteForceThreshold) {
      this.createThreat({
        type: 'brute_force',
        severity: 'high',
        description: `Brute force attack detected from IP ${ipAddress}`,
        indicators: [ipAddress, userId || 'unknown_user'],
        affectedUsers: userId ? [userId] : [],
        affectedResources: ['authentication_system'],
        eventCount: attempts.count,
        mitigationSteps: [
          'Block IP address',
          'Notify affected user',
          'Review authentication logs',
          'Consider implementing additional security measures',
        ],
      });
    }
  }

  /**
   * Track suspicious activities
   */
  private trackSuspiciousActivity(userId: string, activity: string): void {
    const existing = this.suspiciousActivities.get(userId);
    const now = new Date();

    if (existing) {
      existing.activities.push(activity);
      existing.lastSeen = now;
    } else {
      this.suspiciousActivities.set(userId, {
        activities: [activity],
        firstSeen: now,
        lastSeen: now,
      });
    }

    const userActivities = this.suspiciousActivities.get(userId)!;

    // Check if threshold exceeded
    if (
      userActivities.activities.length >=
      this.config.threatDetection.suspiciousActivityThreshold
    ) {
      this.createThreat({
        type: 'suspicious_activity',
        severity: 'medium',
        description: `Suspicious activity pattern detected for user ${userId}`,
        indicators: userActivities.activities,
        affectedUsers: [userId],
        affectedResources: ['user_account', 'data_access'],
        eventCount: userActivities.activities.length,
        mitigationSteps: [
          'Review user activity logs',
          'Contact user to verify legitimate activity',
          'Consider temporary account restrictions',
          'Investigate data access patterns',
        ],
      });
    }
  }

  /**
   * Create a security threat
   */
  private createThreat(
    threatData: Omit<SecurityThreat, 'id' | 'firstSeen' | 'lastSeen' | 'status'>
  ): void {
    const threat: SecurityThreat = {
      id: this.generateThreatId(),
      firstSeen: new Date(),
      lastSeen: new Date(),
      status: 'active',
      ...threatData,
    };

    // Store threat
    this.threats.push(threat);
    if (this.threats.length > this.MAX_THREATS) {
      this.threats.shift();
    }

    // Record metrics
    metricsService.recordSystemEvent('security_threat', {
      type: threat.type,
      severity: threat.severity,
      status: threat.status,
    });

    // Emit threat detection event
    this.emit('threatDetected', threat);

    logger.warn('Security threat detected', {
      threatId: threat.id,
      type: threat.type,
      severity: threat.severity,
      description: threat.description,
    });
  }

  /**
   * Process security event
   */
  private processSecurityEvent(event: SecurityEvent): void {
    // Additional processing logic can be added here
    // For example, correlation with other events, pattern matching, etc.

    // Update metrics
    this.updateSecurityMetrics(event);

    // Check for real-time alerts
    if (
      this.config.monitoring.realTimeAlerts &&
      event.severity === 'critical'
    ) {
      this.sendRealTimeAlert(event);
    }
  }

  /**
   * Process threat detection
   */
  private processThreatDetection(threat: SecurityThreat): void {
    // Additional threat processing logic
    logger.info('Processing security threat', {
      threatId: threat.id,
      type: threat.type,
      severity: threat.severity,
    });

    // Auto-mitigation for certain threat types
    if (threat.type === 'brute_force' && threat.severity === 'high') {
      this.autoMitigateBruteForce(threat);
    }
  }

  /**
   * Handle critical security alerts
   */
  private handleCriticalAlert(event: SecurityEvent): void {
    logger.error('Critical security alert', {
      eventId: event.id,
      type: event.type,
      source: event.source,
      userId: event.userId,
      metadata: event.metadata,
    });

    // Record critical alert metric
    metricsService.recordSystemEvent('critical_security_alert', {
      type: event.type,
      source: event.source,
      user_id: event.userId || 'unknown',
    });

    // Send immediate notifications
    this.sendCriticalAlert(event);
  }

  /**
   * Auto-mitigation for brute force attacks
   */
  private autoMitigateBruteForce(threat: SecurityThreat): void {
    logger.info('Auto-mitigating brute force attack', {
      threatId: threat.id,
      indicators: threat.indicators,
    });

    // This would integrate with your rate limiting or IP blocking system
    // For now, just log the mitigation action
    threat.mitigationSteps.push('Auto-mitigation: IP temporarily blocked');
    threat.status = 'investigating';
  }

  /**
   * Send real-time alert
   */
  private sendRealTimeAlert(event: SecurityEvent): void {
    // This would integrate with your alerting system
    logger.info('Sending real-time security alert', {
      eventId: event.id,
      type: event.type,
      severity: event.severity,
    });
  }

  /**
   * Send critical alert
   */
  private sendCriticalAlert(event: SecurityEvent): void {
    // This would integrate with your critical alerting system
    logger.error('Sending critical security alert', {
      eventId: event.id,
      type: event.type,
      severity: event.severity,
    });
  }

  /**
   * Run threat detection algorithms
   */
  private runThreatDetection(): void {
    if (!this.config.threatDetection.enabled) {
      return;
    }

    // Clean up old tracking data
    this.cleanupTrackingData();

    // Run anomaly detection if enabled
    if (this.config.threatDetection.anomalyDetectionEnabled) {
      this.runAnomalyDetection();
    }
  }

  /**
   * Clean up old tracking data
   */
  private cleanupTrackingData(): void {
    const now = new Date();
    const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24 hours ago

    // Clean up brute force tracking
    for (const [key, data] of this.bruteForceAttempts.entries()) {
      if (data.lastAttempt < cutoff) {
        this.bruteForceAttempts.delete(key);
      }
    }

    // Clean up suspicious activity tracking
    for (const [key, data] of this.suspiciousActivities.entries()) {
      if (data.lastSeen < cutoff) {
        this.suspiciousActivities.delete(key);
      }
    }
  }

  /**
   * Run anomaly detection
   */
  private runAnomalyDetection(): void {
    // This would implement more sophisticated anomaly detection algorithms
    // For now, just log that anomaly detection is running
    logger.debug('Running security anomaly detection');
  }

  /**
   * Collect security metrics
   */
  private collectSecurityMetrics(): void {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    const recentEvents = this.events.filter(
      event => event.timestamp >= oneHourAgo
    );

    const metrics: SecurityMetrics = {
      timestamp: now,
      authenticationEvents: {
        successful: recentEvents.filter(
          e => e.type === 'authentication' && e.action === 'success'
        ).length,
        failed: recentEvents.filter(
          e => e.type === 'authentication' && e.action === 'failure'
        ).length,
        blocked: recentEvents.filter(
          e => e.type === 'authentication' && e.action === 'blocked'
        ).length,
        mfaRequired: recentEvents.filter(
          e => e.type === 'authentication' && e.action === 'mfa_required'
        ).length,
        mfaSuccessful: recentEvents.filter(
          e => e.type === 'authentication' && e.action === 'mfa_success'
        ).length,
        mfaFailed: recentEvents.filter(
          e => e.type === 'authentication' && e.action === 'mfa_failure'
        ).length,
      },
      authorizationEvents: {
        allowed: recentEvents.filter(
          e => e.type === 'authorization' && e.action === 'allowed'
        ).length,
        denied: recentEvents.filter(
          e => e.type === 'authorization' && e.action === 'denied'
        ).length,
        privilegeEscalation: recentEvents.filter(
          e => e.type === 'authorization' && e.action === 'privilege_escalation'
        ).length,
      },
      dataAccess: {
        reads: recentEvents.filter(
          e => e.type === 'data_access' && e.action === 'read'
        ).length,
        writes: recentEvents.filter(
          e => e.type === 'data_access' && e.action === 'write'
        ).length,
        deletes: recentEvents.filter(
          e => e.type === 'data_access' && e.action === 'delete'
        ).length,
        exports: recentEvents.filter(
          e => e.type === 'data_access' && e.action === 'export'
        ).length,
        unauthorizedAttempts: recentEvents.filter(
          e => e.type === 'data_access' && e.metadata.authorized === false
        ).length,
      },
      threats: {
        active: this.threats.filter(t => t.status === 'active').length,
        resolved: this.threats.filter(t => t.status === 'resolved').length,
        falsePositives: this.threats.filter(t => t.status === 'false_positive')
          .length,
        criticalThreats: this.threats.filter(
          t => t.severity === 'critical' && t.status === 'active'
        ).length,
      },
      systemSecurity: {
        vulnerabilities: recentEvents.filter(
          e => e.type === 'system' && e.action === 'vulnerability_detected'
        ).length,
        patchesApplied: recentEvents.filter(
          e => e.type === 'system' && e.action === 'patch_applied'
        ).length,
        securityScans: recentEvents.filter(
          e => e.type === 'system' && e.action === 'security_scan'
        ).length,
        complianceScore: this.calculateComplianceScore(),
      },
    };

    // Store metrics
    this.metrics.push(metrics);
    if (this.metrics.length > this.MAX_METRICS) {
      this.metrics.shift();
    }

    // Record metrics in monitoring system
    metricsService.recordTechnicalMetric({
      name: 'security_authentication_events',
      value:
        metrics.authenticationEvents.successful +
        metrics.authenticationEvents.failed,
      labels: { type: 'total' },
    });

    metricsService.recordTechnicalMetric({
      name: 'security_active_threats',
      value: metrics.threats.active,
      labels: { severity: 'all' },
    });

    metricsService.recordTechnicalMetric({
      name: 'security_compliance_score',
      value: metrics.systemSecurity.complianceScore,
      labels: { type: 'overall' },
    });
  }

  /**
   * Calculate compliance score
   */
  private calculateComplianceScore(): number {
    // This would implement actual compliance scoring logic
    // For now, return a mock score based on recent security events
    const recentEvents = this.events.filter(
      e => e.timestamp >= new Date(Date.now() - 24 * 60 * 60 * 1000)
    );
    const criticalEvents = recentEvents.filter(
      e => e.severity === 'critical'
    ).length;
    const highEvents = recentEvents.filter(e => e.severity === 'high').length;

    // Simple scoring: start at 100, deduct points for security events
    let score = 100;
    score -= criticalEvents * 10;
    score -= highEvents * 5;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Update security metrics based on event
   */
  private updateSecurityMetrics(event: SecurityEvent): void {
    // This would update real-time metrics
    // For now, just log the metric update
    logger.debug('Updating security metrics', {
      eventType: event.type,
      severity: event.severity,
    });
  }

  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    return `sec_event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique threat ID
   */
  private generateThreatId(): string {
    return `sec_threat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Public API methods

  /**
   * Get security events
   */
  getEvents(filters?: {
    type?: SecurityEvent['type'];
    severity?: SecurityEvent['severity'];
    userId?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): SecurityEvent[] {
    let events = [...this.events];

    if (filters) {
      if (filters.type) {
        events = events.filter(e => e.type === filters.type);
      }
      if (filters.severity) {
        events = events.filter(e => e.severity === filters.severity);
      }
      if (filters.userId) {
        events = events.filter(e => e.userId === filters.userId);
      }
      if (filters.startDate) {
        events = events.filter(e => e.timestamp >= filters.startDate!);
      }
      if (filters.endDate) {
        events = events.filter(e => e.timestamp <= filters.endDate!);
      }
      if (filters.limit) {
        events = events.slice(-filters.limit);
      }
    }

    return events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Get security threats
   */
  getThreats(filters?: {
    type?: SecurityThreat['type'];
    severity?: SecurityThreat['severity'];
    status?: SecurityThreat['status'];
    limit?: number;
  }): SecurityThreat[] {
    let threats = [...this.threats];

    if (filters) {
      if (filters.type) {
        threats = threats.filter(t => t.type === filters.type);
      }
      if (filters.severity) {
        threats = threats.filter(t => t.severity === filters.severity);
      }
      if (filters.status) {
        threats = threats.filter(t => t.status === filters.status);
      }
      if (filters.limit) {
        threats = threats.slice(-filters.limit);
      }
    }

    return threats.sort((a, b) => b.lastSeen.getTime() - a.lastSeen.getTime());
  }

  /**
   * Get security metrics
   */
  getMetrics(limit: number = 24): SecurityMetrics[] {
    return this.metrics.slice(-limit);
  }

  /**
   * Get latest security metrics
   */
  getLatestMetrics(): SecurityMetrics | null {
    return this.metrics.length > 0
      ? this.metrics[this.metrics.length - 1]
      : null;
  }

  /**
   * Resolve a security event
   */
  resolveEvent(eventId: string): boolean {
    const event = this.events.find(e => e.id === eventId);
    if (event) {
      event.resolved = true;
      logger.info('Security event resolved', { eventId });
      return true;
    }
    return false;
  }

  /**
   * Update threat status
   */
  updateThreatStatus(
    threatId: string,
    status: SecurityThreat['status']
  ): boolean {
    const threat = this.threats.find(t => t.id === threatId);
    if (threat) {
      threat.status = status;
      threat.lastSeen = new Date();
      logger.info('Security threat status updated', { threatId, status });
      return true;
    }
    return false;
  }

  /**
   * Get security dashboard data
   */
  getDashboardData(): {
    summary: {
      totalEvents: number;
      criticalEvents: number;
      activeThreats: number;
      complianceScore: number;
    };
    recentEvents: SecurityEvent[];
    activeThreats: SecurityThreat[];
    metrics: SecurityMetrics | null;
  } {
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const recentEvents = this.events.filter(e => e.timestamp >= last24Hours);
    const criticalEvents = recentEvents.filter(e => e.severity === 'critical');
    const activeThreats = this.threats.filter(t => t.status === 'active');
    const latestMetrics = this.getLatestMetrics();

    return {
      summary: {
        totalEvents: recentEvents.length,
        criticalEvents: criticalEvents.length,
        activeThreats: activeThreats.length,
        complianceScore: latestMetrics?.systemSecurity.complianceScore || 0,
      },
      recentEvents: recentEvents.slice(-10),
      activeThreats: activeThreats.slice(-10),
      metrics: latestMetrics,
    };
  }

  /**
   * Export security data for compliance
   */
  exportComplianceData(
    startDate: Date,
    endDate: Date
  ): {
    events: SecurityEvent[];
    threats: SecurityThreat[];
    metrics: SecurityMetrics[];
    summary: Record<string, any>;
  } {
    const events = this.events.filter(
      e => e.timestamp >= startDate && e.timestamp <= endDate
    );
    const threats = this.threats.filter(
      t => t.firstSeen >= startDate && t.firstSeen <= endDate
    );
    const metrics = this.metrics.filter(
      m => m.timestamp >= startDate && m.timestamp <= endDate
    );

    const summary = {
      period: { startDate, endDate },
      totalEvents: events.length,
      eventsByType: this.groupBy(events, 'type'),
      eventsBySeverity: this.groupBy(events, 'severity'),
      totalThreats: threats.length,
      threatsByType: this.groupBy(threats, 'type'),
      threatsBySeverity: this.groupBy(threats, 'severity'),
      averageComplianceScore:
        metrics.length > 0
          ? metrics.reduce(
              (sum, m) => sum + m.systemSecurity.complianceScore,
              0
            ) / metrics.length
          : 0,
    };

    return { events, threats, metrics, summary };
  }

  /**
   * Helper method to group array by property
   */
  private groupBy<T>(array: T[], property: keyof T): Record<string, number> {
    return array.reduce(
      (groups, item) => {
        const key = String(item[property]);
        groups[key] = (groups[key] || 0) + 1;
        return groups;
      },
      {} as Record<string, number>
    );
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.stopMonitoring();
    this.events.length = 0;
    this.threats.length = 0;
    this.metrics.length = 0;
    this.bruteForceAttempts.clear();
    this.suspiciousActivities.clear();
  }
}

// Singleton instance
let securityMonitor: SecurityMonitor | null = null;

export function createSecurityMonitor(
  config?: Partial<SecurityConfig>
): SecurityMonitor {
  if (!securityMonitor) {
    securityMonitor = new SecurityMonitor(config);
  }
  return securityMonitor;
}

export function getSecurityMonitor(): SecurityMonitor {
  if (!securityMonitor) {
    securityMonitor = new SecurityMonitor();
  }
  return securityMonitor;
}
