import { BaseEntity } from './base-entity';

export type DeviceType = 'mobile' | 'desktop' | 'tablet' | 'unknown';

export interface DeviceProps {
  id: string;
  userId: string;
  name: string;
  type: DeviceType;
  fingerprint: string;
  trusted: boolean;
  lastUsedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class Device extends BaseEntity<DeviceProps> {
  private constructor(props: DeviceProps) {
    super(props.id, props.createdAt, props.updatedAt);
    this.props = props;
  }

  public static create(
    props: Omit<DeviceProps, 'id' | 'createdAt' | 'updatedAt'>
  ): Device {
    const now = new Date();
    const device = new Device({
      ...props,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    });

    return device;
  }

  public static fromPersistence(props: DeviceProps): Device {
    return new Device(props);
  }

  // Getters
  get userId(): string {
    return this.props.userId;
  }

  get name(): string {
    return this.props.name;
  }

  get type(): DeviceType {
    return this.props.type;
  }

  get fingerprint(): string {
    return this.props.fingerprint;
  }

  get trusted(): boolean {
    return this.props.trusted;
  }

  get lastUsedAt(): Date | undefined {
    return this.props.lastUsedAt;
  }

  // Business methods
  public trust(): void {
    if (this.props.trusted) {
      throw new Error('Device is already trusted');
    }

    this.props.trusted = true;
    this.props.updatedAt = new Date();
  }

  public untrust(reason: string): void {
    if (!this.props.trusted) {
      throw new Error('Device is not trusted');
    }

    this.props.trusted = false;
    this.props.updatedAt = new Date();
  }

  public recordActivity(): void {
    const now = new Date();
    this.props.lastUsedAt = now;
    this.props.updatedAt = now;
  }

  public updateName(name: string): void {
    if (!name.trim()) {
      throw new Error('Device name cannot be empty');
    }

    this.props.name = name.trim();
    this.props.updatedAt = new Date();
  }

  public isActive(thresholdDays: number = 30): boolean {
    if (!this.props.lastUsedAt) {
      return false;
    }

    const threshold = new Date();
    threshold.setDate(threshold.getDate() - thresholdDays);

    return this.props.lastUsedAt > threshold;
  }

  public getDaysSinceLastUse(): number | null {
    if (!this.props.lastUsedAt) {
      return null;
    }

    const now = new Date();
    const diffTime = now.getTime() - this.props.lastUsedAt.getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  }

  public isMobile(): boolean {
    return this.props.type === 'mobile';
  }

  public isDesktop(): boolean {
    return this.props.type === 'desktop';
  }

  public isTablet(): boolean {
    return this.props.type === 'tablet';
  }

  public matchesFingerprint(fingerprint: string): boolean {
    return this.props.fingerprint === fingerprint;
  }

  public getDeviceInfo(): {
    id: string;
    name: string;
    type: DeviceType;
    trusted: boolean;
    isActive: boolean;
    lastUsedAt?: Date;
    daysSinceLastUse?: number;
  } {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      trusted: this.trusted,
      isActive: this.isActive(),
      lastUsedAt: this.lastUsedAt,
      daysSinceLastUse: this.getDaysSinceLastUse() ?? undefined,
    };
  }

  public static detectDeviceType(userAgent?: string): DeviceType {
    if (!userAgent) {
      return 'unknown';
    }

    const ua = userAgent.toLowerCase();

    if (
      ua.includes('mobile') ||
      ua.includes('android') ||
      ua.includes('iphone')
    ) {
      return 'mobile';
    }

    if (ua.includes('tablet') || ua.includes('ipad')) {
      return 'tablet';
    }

    if (
      ua.includes('windows') ||
      ua.includes('macintosh') ||
      ua.includes('linux')
    ) {
      return 'desktop';
    }

    return 'unknown';
  }

  public static generateFingerprint(
    userAgent?: string,
    ipAddress?: string,
    additionalData?: Record<string, any>
  ): string {
    const components = [
      userAgent || 'unknown',
      ipAddress || 'unknown',
      additionalData?.screenResolution || 'unknown',
      additionalData?.timezone || 'unknown',
      additionalData?.language || 'unknown',
      Date.now().toString(),
    ];

    // Simple fingerprint generation - in production, use a more sophisticated method
    return Buffer.from(components.join('|')).toString('base64');
  }

  /**
   * Enhanced device risk assessment
   */
  public calculateRiskScore(): number {
    let riskScore = 0;

    // Device trust factor
    if (!this.trusted) {
      riskScore += 0.3;
    }

    // Activity factor
    const daysSinceLastUse = this.getDaysSinceLastUse();
    if (daysSinceLastUse === null) {
      riskScore += 0.4; // Never used
    } else if (daysSinceLastUse > 90) {
      riskScore += 0.3; // Long inactive
    } else if (daysSinceLastUse > 30) {
      riskScore += 0.1; // Moderately inactive
    }

    // Device type factor (mobile devices might be higher risk)
    if (this.type === 'mobile') {
      riskScore += 0.1;
    }

    // Age factor (very new devices might be suspicious)
    const deviceAge = Math.floor(
      (Date.now() - this.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (deviceAge < 1) {
      riskScore += 0.2;
    }

    return Math.min(riskScore, 1.0);
  }

  /**
   * Check if device requires additional verification
   */
  public requiresAdditionalVerification(): boolean {
    return this.calculateRiskScore() > 0.5 || !this.trusted;
  }

  /**
   * Get device security status
   */
  public getSecurityStatus(): {
    riskScore: number;
    riskLevel: 'low' | 'medium' | 'high';
    requiresVerification: boolean;
    trusted: boolean;
    recommendations: string[];
  } {
    const riskScore = this.calculateRiskScore();
    const recommendations: string[] = [];

    if (!this.trusted) {
      recommendations.push('Trust this device for faster future logins');
    }

    if (this.getDaysSinceLastUse() && this.getDaysSinceLastUse()! > 30) {
      recommendations.push('Device has been inactive for a long time');
    }

    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    if (riskScore > 0.7) {
      riskLevel = 'high';
      recommendations.push('Consider additional security measures');
    } else if (riskScore > 0.4) {
      riskLevel = 'medium';
      recommendations.push('Monitor device activity closely');
    }

    return {
      riskScore,
      riskLevel,
      requiresVerification: this.requiresAdditionalVerification(),
      trusted: this.trusted,
      recommendations,
    };
  }

  protected validate(): void {
    if (!this.props.userId) {
      throw new Error('User ID is required');
    }
    if (!this.props.name) {
      throw new Error('Device name is required');
    }
    if (!this.props.fingerprint) {
      throw new Error('Device fingerprint is required');
    }
  }
}
