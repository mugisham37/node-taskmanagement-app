import { AuditLog, AuditAction } from '../entities/audit-log';
import { ActivityTracking, ActivityType, ActivityTrackingProps } from '../entities/activity-tracking';
import { IAuditLogRepository } from '../repositories/audit-log-repository';
import { IActivityTrackingRepository } from '../repositories/activity-tracking-repository';

export class AuditDomainService {
  constructor(
    private readonly auditLogRepository: IAuditLogRepository,
    private readonly activityTrackingRepository: IActivityTrackingRepository
  ) {}

  async logEntityChange(
    entityType: string,
    entityId: string,
    action: AuditAction,
    oldValues?: Record<string, any>,
    newValues?: Record<string, any>,
    context?: {
      userId?: string;
      userEmail?: string;
      ipAddress?: string;
      userAgent?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<AuditLog> {
    // Calculate changes
    const changes: Record<string, any> = {};
    if (oldValues && newValues) {
      for (const key in newValues) {
        if (oldValues[key] !== newValues[key]) {
          changes[key] = {
            from: oldValues[key],
            to: newValues[key],
          };
        }
      }
    }

    const auditLog = AuditLog.create({
      entityType,
      entityId,
      action,
      userId: context?.userId,
      userEmail: context?.userEmail,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
      oldValues,
      newValues,
      changes: Object.keys(changes).length > 0 ? changes : undefined,
      metadata: context?.metadata,
    });

    await this.auditLogRepository.save(auditLog);
    return auditLog;
  }

  async trackActivity(
    userId: string,
    action: string,
    description: string,
    context?: {
      workspaceId?: string;
      projectId?: string;
      taskId?: string;
      type?: ActivityType;
      metadata?: Record<string, any>;
      ipAddress?: string;
      userAgent?: string;
      sessionId?: string;
      duration?: number;
    }
  ): Promise<ActivityTracking> {
    const activityProps: Partial<Omit<ActivityTrackingProps, 'id' | 'createdAt' | 'updatedAt'>> = {
      userId,
      type: context?.type || ActivityType.USER_ACTION,
      action,
      description,
      metadata: context?.metadata || {},
      context: {
        feature: this.extractFeatureFromAction(action),
        module: this.extractModuleFromAction(action),
        ...context?.metadata,
      },
    };

    // Only add optional properties if they have values
    if (context?.workspaceId !== undefined) {
      activityProps['workspaceId'] = context.workspaceId;
    }
    if (context?.projectId !== undefined) {
      activityProps['projectId'] = context.projectId;
    }
    if (context?.taskId !== undefined) {
      activityProps['taskId'] = context.taskId;
    }
    if (context?.ipAddress !== undefined) {
      activityProps['ipAddress'] = context.ipAddress;
    }
    if (context?.userAgent !== undefined) {
      activityProps['userAgent'] = context.userAgent;
    }
    if (context?.sessionId !== undefined) {
      activityProps['sessionId'] = context.sessionId;
    }
    if (context?.duration !== undefined) {
      activityProps['duration'] = context.duration;
    }

    const activity = ActivityTracking.create(activityProps as Omit<ActivityTrackingProps, 'id' | 'createdAt' | 'updatedAt'>);

    await this.activityTrackingRepository.save(activity);
    return activity;
  }

  async getAuditTrail(
    entityType: string,
    entityId: string
  ): Promise<AuditLog[]> {
    return this.auditLogRepository.getAuditTrail(entityType, entityId);
  }

  async getSecurityEvents(
    startDate?: Date,
    endDate?: Date,
    limit: number = 100
  ): Promise<AuditLog[]> {
    const events = await this.auditLogRepository.findSecurityEvents(limit);

    if (startDate || endDate) {
      return events.filter(event => {
        if (startDate && event.createdAt < startDate) return false;
        if (endDate && event.createdAt > endDate) return false;
        return true;
      });
    }

    return events;
  }

  async getUserActivity(
    userId: string,
    startDate?: Date,
    endDate?: Date,
    limit: number = 100
  ): Promise<ActivityTracking[]> {
    if (startDate && endDate) {
      return this.activityTrackingRepository.findByUserAndDateRange(
        userId,
        startDate,
        endDate
      );
    }

    return this.activityTrackingRepository.findByUserId(userId, limit);
  }

  async getWorkspaceActivity(
    workspaceId: string,
    startDate?: Date,
    endDate?: Date,
    limit: number = 100
  ): Promise<ActivityTracking[]> {
    if (startDate && endDate) {
      const activities = await this.activityTrackingRepository.findByDateRange(
        startDate,
        endDate,
        limit
      );
      return activities.filter(a => a.workspaceId === workspaceId);
    }

    return this.activityTrackingRepository.findByWorkspaceId(
      workspaceId,
      limit
    );
  }

  async getSecuritySummary(
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    totalEvents: number;
    securityEvents: number;
    uniqueUsers: number;
    topActions: Array<{ action: AuditAction; count: number }>;
    suspiciousActivity: number;
    riskScore: number;
  }> {
    const summary = await this.auditLogRepository.getSecuritySummary(
      startDate,
      endDate
    );

    // Calculate risk score based on security events
    const riskScore = this.calculateRiskScore(summary);

    return {
      ...summary,
      riskScore,
    };
  }

  async getActivityStats(
    userId?: string,
    workspaceId?: string
  ): Promise<{
    totalActivities: number;
    uniqueActions: number;
    averageDuration: number;
    topActions: Array<{ action: string; count: number }>;
    productivityScore: number;
  }> {
    const stats = await this.activityTrackingRepository.getActivityStats(
      userId,
      workspaceId
    );

    // Calculate productivity score
    const productivityScore = this.calculateProductivityScore(stats);

    return {
      ...stats,
      productivityScore,
    };
  }

  async detectSuspiciousActivity(
    userId?: string,
    timeWindowHours: number = 24
  ): Promise<{
    suspiciousEvents: AuditLog[];
    riskLevel: 'low' | 'medium' | 'high';
    recommendations: string[];
  }> {
    const startDate = new Date();
    startDate.setHours(startDate.getHours() - timeWindowHours);

    const query: any = {
      startDate,
      endDate: new Date(),
      limit: 1000,
    };

    if (userId) {
      query.userId = userId;
    }

    const events = await this.auditLogRepository.searchLogs(query);
    const suspiciousEvents = this.identifySuspiciousEvents(events);
    const riskLevel = this.assessRiskLevel(suspiciousEvents);
    const recommendations = this.generateSecurityRecommendations(
      suspiciousEvents,
      riskLevel
    );

    return {
      suspiciousEvents,
      riskLevel,
      recommendations,
    };
  }

  async cleanupOldLogs(retentionDays: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const deletedAuditLogs =
      await this.auditLogRepository.deleteOlderThan(cutoffDate);
    const deletedActivities =
      await this.activityTrackingRepository.deleteOlderThan(cutoffDate);

    return deletedAuditLogs + deletedActivities;
  }

  private extractFeatureFromAction(action: string): string {
    const actionParts = action.split('_');
    return actionParts[0] || 'unknown';
  }

  private extractModuleFromAction(action: string): string {
    const actionParts = action.split('_');
    return actionParts.length > 1 ? (actionParts[1] || 'unknown') : 'unknown';
  }

  private calculateRiskScore(summary: any): number {
    const securityEventRatio =
      summary.totalEvents > 0
        ? summary.securityEvents / summary.totalEvents
        : 0;

    const suspiciousActivityRatio =
      summary.totalEvents > 0
        ? summary.suspiciousActivity / summary.totalEvents
        : 0;

    // Risk score from 0-100
    return Math.min(
      100,
      Math.round(securityEventRatio * 50 + suspiciousActivityRatio * 50)
    );
  }

  private calculateProductivityScore(stats: any): number {
    // Simple productivity calculation based on activity patterns
    const baseScore = 50;
    const activityBonus = Math.min(25, stats.totalActivities / 100);
    const durationBonus =
      stats.averageDuration > 0 && stats.averageDuration < 30000 ? 25 : 0;

    return Math.round(baseScore + activityBonus + durationBonus);
  }

  private identifySuspiciousEvents(events: AuditLog[]): AuditLog[] {
    return events.filter(event => {
      // Define suspicious patterns
      const suspiciousActions: AuditAction[] = [
        AuditAction.LOGIN,
        AuditAction.PASSWORD_CHANGE,
        AuditAction.PERMISSION_CHANGE,
        AuditAction.DELETE,
      ];

      // Check for multiple failed attempts
      const isSecurityEvent = event.isSecurityEvent();
      const isSuspiciousAction = suspiciousActions.includes(event.action);

      return isSecurityEvent || isSuspiciousAction;
    });
  }

  private assessRiskLevel(
    suspiciousEvents: AuditLog[]
  ): 'low' | 'medium' | 'high' {
    if (suspiciousEvents.length === 0) return 'low';
    if (suspiciousEvents.length < 5) return 'medium';
    return 'high';
  }

  private generateSecurityRecommendations(
    suspiciousEvents: AuditLog[],
    riskLevel: 'low' | 'medium' | 'high'
  ): string[] {
    const recommendations: string[] = [];

    if (riskLevel === 'high') {
      recommendations.push(
        'Consider implementing additional security measures'
      );
      recommendations.push('Review user access permissions');
      recommendations.push('Enable multi-factor authentication');
    }

    if (riskLevel === 'medium') {
      recommendations.push('Monitor user activity more closely');
      recommendations.push('Review recent security events');
    }

    if (suspiciousEvents.some(e => e.action === 'LOGIN')) {
      recommendations.push('Review login patterns and locations');
    }

    if (suspiciousEvents.some(e => e.action === 'PERMISSION_CHANGE')) {
      recommendations.push('Audit permission changes');
    }

    return recommendations;
  }
}
