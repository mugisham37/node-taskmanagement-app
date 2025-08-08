import { User } from '../entities/User';
import { Session } from '../entities/Session';
import { Device } from '../entities/Device';
import { UserId } from '../value-objects/UserId';
import { DomainEvent } from '../../shared/events/DomainEvent';

export interface RiskFactor {
  name: string;
  score: number;
  weight: number;
  description: string;
}

export interface RiskAssessment {
  totalScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  factors: RiskFactor[];
  recommendations: string[];
  requiresAction: boolean;
  actionType?: 'mfa' | 'password_reset' | 'account_lock' | 'manual_review';
}

export interface AuthenticationRiskContext {
  ipAddress?: string;
  userAgent?: string;
  deviceFingerprint?: string;
  location?: {
    country?: string;
    city?: string;
    coordinates?: [number, number];
  };
  timeOfDay: number; // Hour of day (0-23)
  dayOfWeek: number; // Day of week (0-6)
}

export interface ActivityRiskContext {
  type: string;
  frequency: number;
  timePattern: number[];
  resourceAccessed?: string;
  dataVolume?: number;
  metadata?: Record<string, any>;
}

export class HighRiskActivityDetectedEvent extends DomainEvent {
  constructor(
    public readonly userId: UserId,
    public readonly riskScore: number,
    public readonly riskLevel: string,
    public readonly factors: RiskFactor[]
  ) {
    super('HighRiskActivityDetected', {
      userId: userId.value,
      riskScore,
      riskLevel,
      factors,
    });
  }
}

export class RiskScoreUpdatedEvent extends DomainEvent {
  constructor(
    public readonly userId: UserId,
    public readonly previousScore: number,
    public readonly newScore: number,
    public readonly reason: string
  ) {
    super('RiskScoreUpdated', {
      userId: userId.value,
      previousScore,
      newScore,
      reason,
    });
  }
}

/**
 * Risk Assessment Service for security scoring across authentication and task operations
 * Implements machine learning-inspired risk scoring algorithms
 */
export class RiskAssessmentService {
  constructor(
    private readonly userRepository: any,
    private readonly sessionRepository: any,
    private readonly deviceRepository: any,
    private readonly activityRepository: any,
    private readonly geoLocationService: any,
    private readonly eventBus: any
  ) {}

  /**
   * Calculate comprehensive authentication risk score
   */
  async calculateAuthenticationRisk(
    user: User,
    context: AuthenticationRiskContext
  ): Promise<number> {
    const factors: RiskFactor[] = [];

    // Device risk factors
    const deviceRisk = await this.assessDeviceRisk(user.id, context);
    factors.push(...deviceRisk);

    // Location risk factors
    const locationRisk = await this.assessLocationRisk(user.id, context);
    factors.push(...locationRisk);

    // Temporal risk factors
    const temporalRisk = this.assessTemporalRisk(user, context);
    factors.push(...temporalRisk);

    // User behavior risk factors
    const behaviorRisk = await this.assessUserBehaviorRisk(user);
    factors.push(...behaviorRisk);

    // Account security risk factors
    const accountRisk = this.assessAccountSecurityRisk(user);
    factors.push(...accountRisk);

    // Calculate weighted risk score
    const totalScore = this.calculateWeightedScore(factors);

    // Create risk assessment
    const assessment: RiskAssessment = {
      totalScore,
      riskLevel: this.getRiskLevel(totalScore),
      factors,
      recommendations: this.generateRecommendations(factors, totalScore),
      requiresAction: totalScore > 0.7,
      actionType: this.determineActionType(totalScore, factors),
    };

    // Publish high-risk event if needed
    if (
      assessment.riskLevel === 'high' ||
      assessment.riskLevel === 'critical'
    ) {
      await this.eventBus.publish(
        new HighRiskActivityDetectedEvent(
          user.id,
          totalScore,
          assessment.riskLevel,
          factors
        )
      );
    }

    return totalScore;
  }

  /**
   * Calculate current risk score for ongoing session
   */
  async calculateCurrentRisk(
    userId: UserId,
    context: AuthenticationRiskContext
  ): Promise<number> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      return 1.0; // Maximum risk if user not found
    }

    return this.calculateAuthenticationRisk(user, context);
  }

  /**
   * Calculate session-specific risk score
   */
  async calculateSessionRisk(session: Session): Promise<number> {
    const factors: RiskFactor[] = [];

    // Session age factor
    const sessionAge = Date.now() - session.createdAt.getTime();
    const sessionAgeHours = sessionAge / (1000 * 60 * 60);

    if (sessionAgeHours > 24) {
      factors.push({
        name: 'long_session',
        score: Math.min(sessionAgeHours / 168, 0.3), // Max 0.3 for week-long sessions
        weight: 0.2,
        description: 'Session has been active for an extended period',
      });
    }

    // Device trust factor
    if (session.deviceId) {
      const device = await this.deviceRepository.findById(session.deviceId);
      if (device) {
        const deviceRiskScore = device.calculateRiskScore();
        factors.push({
          name: 'device_risk',
          score: deviceRiskScore,
          weight: 0.3,
          description: 'Device-based risk assessment',
        });
      }
    }

    // IP address consistency
    const recentSessions = await this.sessionRepository.findRecentByUserId(
      session.userId,
      7 // last 7 days
    );

    const ipAddresses = new Set(
      recentSessions
        .filter((s: Session) => s.ipAddress && !s.id.equals(session.id))
        .map((s: Session) => s.ipAddress)
    );

    if (
      session.ipAddress &&
      ipAddresses.size > 0 &&
      !ipAddresses.has(session.ipAddress)
    ) {
      factors.push({
        name: 'new_ip_address',
        score: 0.4,
        weight: 0.25,
        description: 'Session from new IP address',
      });
    }

    // Activity pattern analysis
    const activityRisk = await this.assessSessionActivityRisk(session);
    factors.push(...activityRisk);

    return this.calculateWeightedScore(factors);
  }

  /**
   * Assess activity-specific risk
   */
  async assessActivityRisk(
    session: Session,
    activity: ActivityRiskContext
  ): Promise<number> {
    const factors: RiskFactor[] = [];

    // Frequency-based risk
    if (activity.frequency > 100) {
      // More than 100 actions per hour
      factors.push({
        name: 'high_frequency_activity',
        score: Math.min(activity.frequency / 1000, 0.5),
        weight: 0.3,
        description: 'Unusually high activity frequency',
      });
    }

    // Time pattern analysis
    const currentHour = new Date().getHours();
    const isOffHours = currentHour < 6 || currentHour > 22;

    if (isOffHours && activity.type === 'data_export') {
      factors.push({
        name: 'off_hours_sensitive_activity',
        score: 0.6,
        weight: 0.4,
        description: 'Sensitive activity during off-hours',
      });
    }

    // Data volume risk
    if (activity.dataVolume && activity.dataVolume > 1000000) {
      // > 1MB
      factors.push({
        name: 'large_data_access',
        score: Math.min(activity.dataVolume / 10000000, 0.4), // Max 0.4 for 10MB+
        weight: 0.25,
        description: 'Large volume of data accessed',
      });
    }

    // Resource access pattern
    if (activity.resourceAccessed) {
      const resourceRisk = await this.assessResourceAccessRisk(
        session.userId,
        activity.resourceAccessed
      );
      factors.push(...resourceRisk);
    }

    return this.calculateWeightedScore(factors);
  }

  /**
   * Detect suspicious activity patterns
   */
  async detectSuspiciousActivity(
    userId: UserId,
    session: Session
  ): Promise<boolean> {
    try {
      // Get recent activity
      const recentActivity = await this.activityRepository.findRecentByUserId(
        userId,
        24 // last 24 hours
      );

      // Check for suspicious patterns
      const suspiciousPatterns = [
        this.detectRapidFireActivity(recentActivity),
        this.detectUnusualTimePatterns(recentActivity),
        this.detectAnomalousResourceAccess(recentActivity),
        this.detectGeographicalAnomalies(session, recentActivity),
        this.detectDeviceHopping(recentActivity),
      ];

      return suspiciousPatterns.some(Boolean);
    } catch (error) {
      // If detection fails, err on the side of caution
      return true;
    }
  }

  /**
   * Update user risk score with historical tracking
   */
  async updateUserRiskScore(
    userId: UserId,
    newScore: number,
    reason: string
  ): Promise<void> {
    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        return;
      }

      const previousScore = user.riskScore;

      // Only update if score changed significantly
      if (Math.abs(newScore - previousScore) > 0.05) {
        user.updateRiskScore(newScore);
        await this.userRepository.save(user);

        await this.eventBus.publish(
          new RiskScoreUpdatedEvent(userId, previousScore, newScore, reason)
        );
      }
    } catch (error) {
      console.error('Failed to update user risk score:', error);
    }
  }

  /**
   * Get risk assessment for user
   */
  async getUserRiskAssessment(userId: UserId): Promise<RiskAssessment> {
    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        return this.createMaxRiskAssessment('User not found');
      }

      const context: AuthenticationRiskContext = {
        timeOfDay: new Date().getHours(),
        dayOfWeek: new Date().getDay(),
      };

      const riskScore = await this.calculateAuthenticationRisk(user, context);

      return {
        totalScore: riskScore,
        riskLevel: this.getRiskLevel(riskScore),
        factors: [], // Would be populated by calculateAuthenticationRisk
        recommendations: this.generateRecommendations([], riskScore),
        requiresAction: riskScore > 0.7,
        actionType: this.determineActionType(riskScore, []),
      };
    } catch (error) {
      return this.createMaxRiskAssessment('Risk assessment failed');
    }
  }

  // Private helper methods

  private async assessDeviceRisk(
    userId: UserId,
    context: AuthenticationRiskContext
  ): Promise<RiskFactor[]> {
    const factors: RiskFactor[] = [];

    try {
      const devices = await this.deviceRepository.findByUserId(userId);

      // New device risk
      if (context.deviceFingerprint) {
        const knownDevice = devices.find((d: Device) =>
          d.matchesFingerprint(context.deviceFingerprint)
        );

        if (!knownDevice) {
          factors.push({
            name: 'new_device',
            score: 0.5,
            weight: 0.3,
            description: 'Authentication from new device',
          });
        } else if (!knownDevice.trusted) {
          factors.push({
            name: 'untrusted_device',
            score: 0.3,
            weight: 0.2,
            description: 'Authentication from untrusted device',
          });
        }
      }

      // Device diversity risk (too many devices)
      if (devices.length > 10) {
        factors.push({
          name: 'many_devices',
          score: Math.min(devices.length / 50, 0.3),
          weight: 0.1,
          description: 'User has many registered devices',
        });
      }
    } catch (error) {
      factors.push({
        name: 'device_assessment_failed',
        score: 0.2,
        weight: 0.1,
        description: 'Could not assess device risk',
      });
    }

    return factors;
  }

  private async assessLocationRisk(
    userId: UserId,
    context: AuthenticationRiskContext
  ): Promise<RiskFactor[]> {
    const factors: RiskFactor[] = [];

    try {
      if (!context.ipAddress) {
        return factors;
      }

      // Get location from IP
      const location = await this.geoLocationService.getLocation(
        context.ipAddress
      );

      // Get user's recent locations
      const recentSessions = await this.sessionRepository.findRecentByUserId(
        userId,
        30
      );
      const recentLocations = await Promise.all(
        recentSessions
          .filter((s: Session) => s.ipAddress)
          .map(async (s: Session) =>
            this.geoLocationService.getLocation(s.ipAddress!)
          )
      );

      // Check for new country
      const knownCountries = new Set(
        recentLocations.map(l => l?.country).filter(Boolean)
      );
      if (location?.country && !knownCountries.has(location.country)) {
        factors.push({
          name: 'new_country',
          score: 0.4,
          weight: 0.25,
          description: `Authentication from new country: ${location.country}`,
        });
      }

      // Check for impossible travel
      if (recentLocations.length > 0 && location?.coordinates) {
        const impossibleTravel = this.detectImpossibleTravel(
          recentLocations[0],
          location,
          recentSessions[0].createdAt
        );

        if (impossibleTravel) {
          factors.push({
            name: 'impossible_travel',
            score: 0.8,
            weight: 0.4,
            description: 'Impossible travel detected between locations',
          });
        }
      }

      // High-risk countries (this would be configurable)
      const highRiskCountries = ['XX', 'YY']; // Placeholder
      if (location?.country && highRiskCountries.includes(location.country)) {
        factors.push({
          name: 'high_risk_country',
          score: 0.3,
          weight: 0.2,
          description: 'Authentication from high-risk country',
        });
      }
    } catch (error) {
      // Location assessment failed - minor risk increase
      factors.push({
        name: 'location_assessment_failed',
        score: 0.1,
        weight: 0.05,
        description: 'Could not assess location risk',
      });
    }

    return factors;
  }

  private assessTemporalRisk(
    user: User,
    context: AuthenticationRiskContext
  ): RiskFactor[] {
    const factors: RiskFactor[] = [];

    // Off-hours access
    const workHours = user.workHours;
    const currentHour = context.timeOfDay;
    const currentDay = context.dayOfWeek;

    const isWorkDay = workHours.days.includes(currentDay);
    const isWorkHours =
      currentHour >= parseInt(workHours.start.split(':')[0]) &&
      currentHour <= parseInt(workHours.end.split(':')[0]);

    if (!isWorkDay || !isWorkHours) {
      factors.push({
        name: 'off_hours_access',
        score: 0.2,
        weight: 0.15,
        description: 'Authentication outside normal work hours',
      });
    }

    // Weekend access for business accounts
    if ([0, 6].includes(currentDay) && !workHours.days.includes(currentDay)) {
      factors.push({
        name: 'weekend_access',
        score: 0.15,
        weight: 0.1,
        description: 'Authentication during weekend',
      });
    }

    return factors;
  }

  private async assessUserBehaviorRisk(user: User): Promise<RiskFactor[]> {
    const factors: RiskFactor[] = [];

    // Account age risk (very new accounts are riskier)
    const accountAge = Date.now() - user.createdAt.getTime();
    const accountAgeDays = accountAge / (1000 * 60 * 60 * 24);

    if (accountAgeDays < 7) {
      factors.push({
        name: 'new_account',
        score: 0.3,
        weight: 0.2,
        description: 'Account is less than 7 days old',
      });
    }

    // Failed login attempts
    if (user.failedLoginAttempts > 0) {
      factors.push({
        name: 'recent_failed_logins',
        score: Math.min(user.failedLoginAttempts / 10, 0.4),
        weight: 0.25,
        description: `${user.failedLoginAttempts} recent failed login attempts`,
      });
    }

    // Last login time (dormant accounts are riskier when they become active)
    if (user.lastLoginAt) {
      const timeSinceLastLogin = Date.now() - user.lastLoginAt.getTime();
      const daysSinceLastLogin = timeSinceLastLogin / (1000 * 60 * 60 * 24);

      if (daysSinceLastLogin > 90) {
        factors.push({
          name: 'dormant_account_reactivation',
          score: Math.min(daysSinceLastLogin / 365, 0.3),
          weight: 0.2,
          description: 'Account has been dormant for an extended period',
        });
      }
    }

    return factors;
  }

  private assessAccountSecurityRisk(user: User): RiskFactor[] {
    const factors: RiskFactor[] = [];

    // MFA not enabled
    if (!user.mfaEnabled) {
      factors.push({
        name: 'no_mfa',
        score: 0.3,
        weight: 0.3,
        description: 'Multi-factor authentication not enabled',
      });
    }

    // Email not verified
    if (!user.isEmailVerified()) {
      factors.push({
        name: 'unverified_email',
        score: 0.4,
        weight: 0.25,
        description: 'Email address not verified',
      });
    }

    // No password (OAuth-only accounts)
    if (!user.hasPassword()) {
      factors.push({
        name: 'no_password',
        score: 0.1,
        weight: 0.1,
        description: 'Account relies solely on OAuth authentication',
      });
    }

    return factors;
  }

  private async assessSessionActivityRisk(
    session: Session
  ): Promise<RiskFactor[]> {
    const factors: RiskFactor[] = [];

    try {
      // Get recent activities for this session
      const activities = await this.activityRepository.findBySessionId(
        session.id
      );

      // High activity volume
      if (activities.length > 1000) {
        factors.push({
          name: 'high_session_activity',
          score: Math.min(activities.length / 10000, 0.3),
          weight: 0.2,
          description: 'Unusually high activity volume in session',
        });
      }

      // Rapid consecutive actions
      const rapidActions = this.detectRapidActions(activities);
      if (rapidActions > 50) {
        factors.push({
          name: 'rapid_actions',
          score: Math.min(rapidActions / 500, 0.4),
          weight: 0.25,
          description: 'Rapid consecutive actions detected',
        });
      }
    } catch (error) {
      // If we can't assess activity, add minor risk
      factors.push({
        name: 'activity_assessment_failed',
        score: 0.1,
        weight: 0.05,
        description: 'Could not assess session activity',
      });
    }

    return factors;
  }

  private async assessResourceAccessRisk(
    userId: UserId,
    resourceId: string
  ): Promise<RiskFactor[]> {
    const factors: RiskFactor[] = [];

    // Check if user typically accesses this resource
    const accessHistory =
      await this.activityRepository.findResourceAccessHistory(
        userId,
        resourceId,
        30 // last 30 days
      );

    if (accessHistory.length === 0) {
      factors.push({
        name: 'new_resource_access',
        score: 0.2,
        weight: 0.15,
        description: 'Accessing resource for the first time',
      });
    }

    return factors;
  }

  private calculateWeightedScore(factors: RiskFactor[]): number {
    if (factors.length === 0) {
      return 0;
    }

    const weightedSum = factors.reduce((sum, factor) => {
      return sum + factor.score * factor.weight;
    }, 0);

    const totalWeight = factors.reduce((sum, factor) => sum + factor.weight, 0);

    return totalWeight > 0 ? Math.min(weightedSum / totalWeight, 1.0) : 0;
  }

  private getRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
    if (score >= 0.9) return 'critical';
    if (score >= 0.7) return 'high';
    if (score >= 0.4) return 'medium';
    return 'low';
  }

  private generateRecommendations(
    factors: RiskFactor[],
    totalScore: number
  ): string[] {
    const recommendations: string[] = [];

    // Factor-specific recommendations
    factors.forEach(factor => {
      switch (factor.name) {
        case 'no_mfa':
          recommendations.push(
            'Enable multi-factor authentication for better security'
          );
          break;
        case 'new_device':
          recommendations.push(
            'Verify this device and consider marking it as trusted'
          );
          break;
        case 'new_country':
          recommendations.push('Confirm this login attempt is legitimate');
          break;
        case 'off_hours_access':
          recommendations.push(
            'Review access patterns and consider restricting off-hours access'
          );
          break;
        case 'unverified_email':
          recommendations.push('Verify your email address');
          break;
      }
    });

    // Score-based recommendations
    if (totalScore > 0.8) {
      recommendations.push('Consider changing your password immediately');
      recommendations.push('Review recent account activity');
    } else if (totalScore > 0.5) {
      recommendations.push('Review your security settings');
      recommendations.push('Consider enabling additional security features');
    }

    return [...new Set(recommendations)]; // Remove duplicates
  }

  private determineActionType(
    score: number,
    factors: RiskFactor[]
  ): 'mfa' | 'password_reset' | 'account_lock' | 'manual_review' | undefined {
    if (score >= 0.95) return 'account_lock';
    if (score >= 0.8) return 'manual_review';
    if (score >= 0.6) return 'mfa';
    if (factors.some(f => f.name === 'impossible_travel'))
      return 'password_reset';

    return undefined;
  }

  private createMaxRiskAssessment(reason: string): RiskAssessment {
    return {
      totalScore: 1.0,
      riskLevel: 'critical',
      factors: [
        {
          name: 'assessment_failed',
          score: 1.0,
          weight: 1.0,
          description: reason,
        },
      ],
      recommendations: ['Contact support immediately'],
      requiresAction: true,
      actionType: 'manual_review',
    };
  }

  // Suspicious activity detection methods

  private detectRapidFireActivity(activities: any[]): boolean {
    if (activities.length < 10) return false;

    // Check for more than 10 actions in 1 minute
    const oneMinuteAgo = Date.now() - 60000;
    const recentActions = activities.filter(
      a => new Date(a.createdAt).getTime() > oneMinuteAgo
    );

    return recentActions.length > 10;
  }

  private detectUnusualTimePatterns(activities: any[]): boolean {
    // Check for activity during unusual hours (2-6 AM)
    const unusualHourActivities = activities.filter(a => {
      const hour = new Date(a.createdAt).getHours();
      return hour >= 2 && hour <= 6;
    });

    return unusualHourActivities.length > activities.length * 0.3;
  }

  private detectAnomalousResourceAccess(activities: any[]): boolean {
    // Check for accessing many different resources in short time
    const resourceIds = new Set(
      activities.map(a => a.resourceId).filter(Boolean)
    );
    return resourceIds.size > 50 && activities.length > 100;
  }

  private detectGeographicalAnomalies(
    session: Session,
    activities: any[]
  ): boolean {
    // This would require more sophisticated geolocation analysis
    // For now, just check if session IP is different from recent activities
    return false; // Placeholder
  }

  private detectDeviceHopping(activities: any[]): boolean {
    // Check for rapid switching between different devices
    const deviceIds = activities
      .map(a => a.deviceId)
      .filter(Boolean)
      .slice(0, 20); // Last 20 activities

    const uniqueDevices = new Set(deviceIds);
    return uniqueDevices.size > 3 && deviceIds.length > 10;
  }

  private detectImpossibleTravel(
    location1: any,
    location2: any,
    timeBetween: Date
  ): boolean {
    if (!location1?.coordinates || !location2?.coordinates) {
      return false;
    }

    // Calculate distance between coordinates (simplified)
    const distance = this.calculateDistance(
      location1.coordinates,
      location2.coordinates
    );

    // Calculate time difference in hours
    const timeDiff = (Date.now() - timeBetween.getTime()) / (1000 * 60 * 60);

    // Assume maximum travel speed of 1000 km/h (commercial flight)
    const maxPossibleDistance = timeDiff * 1000;

    return distance > maxPossibleDistance;
  }

  private calculateDistance(
    coord1: [number, number],
    coord2: [number, number]
  ): number {
    // Haversine formula for calculating distance between two points on Earth
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(coord2[0] - coord1[0]);
    const dLon = this.toRadians(coord2[1] - coord1[1]);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(coord1[0])) *
        Math.cos(this.toRadians(coord2[0])) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  private detectRapidActions(activities: any[]): number {
    let rapidCount = 0;

    for (let i = 1; i < activities.length; i++) {
      const timeDiff =
        new Date(activities[i].createdAt).getTime() -
        new Date(activities[i - 1].createdAt).getTime();

      if (timeDiff < 1000) {
        // Less than 1 second between actions
        rapidCount++;
      }
    }

    return rapidCount;
  }
}
