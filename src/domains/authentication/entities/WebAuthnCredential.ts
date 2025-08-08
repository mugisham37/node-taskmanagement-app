import { BaseEntity } from '../../shared/entities/BaseEntity';
import { WebAuthnCredentialId } from '../value-objects/WebAuthnCredentialId';
import { UserId } from '../value-objects/UserId';
import { DomainEvent } from '../../shared/events/DomainEvent';

export type AuthenticatorTransport =
  | 'usb'
  | 'nfc'
  | 'ble'
  | 'internal'
  | 'hybrid';

export interface WebAuthnCredentialProps {
  id: WebAuthnCredentialId;
  userId: UserId;
  credentialId: string;
  publicKey: Buffer;
  counter: bigint;
  deviceType: string;
  backedUp: boolean;
  transports: AuthenticatorTransport[];
  name?: string;
  createdAt: Date;
  lastUsedAt?: Date;
}

export class WebAuthnCredentialRegisteredEvent extends DomainEvent {
  constructor(
    public readonly credentialId: WebAuthnCredentialId,
    public readonly userId: UserId,
    public readonly deviceType: string,
    public readonly name?: string
  ) {
    super('WebAuthnCredentialRegistered', {
      credentialId: credentialId.value,
      userId: userId.value,
      deviceType,
      name,
    });
  }
}

export class WebAuthnCredentialUsedEvent extends DomainEvent {
  constructor(
    public readonly credentialId: WebAuthnCredentialId,
    public readonly userId: UserId,
    public readonly counter: bigint
  ) {
    super('WebAuthnCredentialUsed', {
      credentialId: credentialId.value,
      userId: userId.value,
      counter: counter.toString(),
    });
  }
}

export class WebAuthnCredentialRevokedEvent extends DomainEvent {
  constructor(
    public readonly credentialId: WebAuthnCredentialId,
    public readonly userId: UserId,
    public readonly reason: string
  ) {
    super('WebAuthnCredentialRevoked', {
      credentialId: credentialId.value,
      userId: userId.value,
      reason,
    });
  }
}

export class WebAuthnCredential extends BaseEntity<WebAuthnCredentialProps> {
  private constructor(props: WebAuthnCredentialProps) {
    super(props);
  }

  public static create(
    props: Omit<WebAuthnCredentialProps, 'id' | 'createdAt' | 'lastUsedAt'>
  ): WebAuthnCredential {
    const credential = new WebAuthnCredential({
      ...props,
      id: WebAuthnCredentialId.generate(),
      createdAt: new Date(),
    });

    credential.addDomainEvent(
      new WebAuthnCredentialRegisteredEvent(
        credential.id,
        credential.userId,
        credential.deviceType,
        credential.name
      )
    );

    return credential;
  }

  public static fromPersistence(
    props: WebAuthnCredentialProps
  ): WebAuthnCredential {
    return new WebAuthnCredential(props);
  }

  // Getters
  get id(): WebAuthnCredentialId {
    return this.props.id;
  }

  get userId(): UserId {
    return this.props.userId;
  }

  get credentialId(): string {
    return this.props.credentialId;
  }

  get publicKey(): Buffer {
    return this.props.publicKey;
  }

  get counter(): bigint {
    return this.props.counter;
  }

  get deviceType(): string {
    return this.props.deviceType;
  }

  get backedUp(): boolean {
    return this.props.backedUp;
  }

  get transports(): AuthenticatorTransport[] {
    return [...this.props.transports];
  }

  get name(): string | undefined {
    return this.props.name;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get lastUsedAt(): Date | undefined {
    return this.props.lastUsedAt;
  }

  // Business methods
  public updateCounter(newCounter: bigint): void {
    if (newCounter <= this.props.counter) {
      throw new Error(
        'Counter must be greater than current counter (replay attack protection)'
      );
    }

    this.props.counter = newCounter;
    this.props.lastUsedAt = new Date();

    this.addDomainEvent(
      new WebAuthnCredentialUsedEvent(this.id, this.userId, newCounter)
    );
  }

  public updateName(name: string): void {
    if (!name.trim()) {
      throw new Error('Credential name cannot be empty');
    }

    this.props.name = name.trim();
  }

  public revoke(reason: string): void {
    this.addDomainEvent(
      new WebAuthnCredentialRevokedEvent(this.id, this.userId, reason)
    );
  }

  public isActive(thresholdDays: number = 90): boolean {
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

  public supportsTransport(transport: AuthenticatorTransport): boolean {
    return this.props.transports.includes(transport);
  }

  public isRoamingAuthenticator(): boolean {
    return this.props.transports.some(transport =>
      ['usb', 'nfc', 'ble', 'hybrid'].includes(transport)
    );
  }

  public isPlatformAuthenticator(): boolean {
    return this.props.transports.includes('internal');
  }

  public isBackedUp(): boolean {
    return this.props.backedUp;
  }

  public matchesCredentialId(credentialId: string): boolean {
    return this.props.credentialId === credentialId;
  }

  public getCredentialInfo(): {
    id: string;
    credentialId: string;
    deviceType: string;
    name?: string;
    backedUp: boolean;
    transports: AuthenticatorTransport[];
    isActive: boolean;
    isPlatform: boolean;
    isRoaming: boolean;
    lastUsedAt?: Date;
    daysSinceLastUse?: number;
  } {
    return {
      id: this.id.value,
      credentialId: this.credentialId,
      deviceType: this.deviceType,
      name: this.name,
      backedUp: this.backedUp,
      transports: this.transports,
      isActive: this.isActive(),
      isPlatform: this.isPlatformAuthenticator(),
      isRoaming: this.isRoamingAuthenticator(),
      lastUsedAt: this.lastUsedAt,
      daysSinceLastUse: this.getDaysSinceLastUse() ?? undefined,
    };
  }

  public static isValidTransport(
    transport: string
  ): transport is AuthenticatorTransport {
    return ['usb', 'nfc', 'ble', 'internal', 'hybrid'].includes(transport);
  }

  public static getSupportedTransports(): AuthenticatorTransport[] {
    return ['usb', 'nfc', 'ble', 'internal', 'hybrid'];
  }

  public static validateCounter(counter: bigint): boolean {
    return counter >= 0n;
  }

  public static validateCredentialId(credentialId: string): boolean {
    // Basic validation - credential ID should be base64url encoded
    return /^[A-Za-z0-9_-]+$/.test(credentialId) && credentialId.length > 0;
  }

  /**
   * Calculate credential risk score based on usage patterns
   */
  public calculateRiskScore(): number {
    let riskScore = 0;

    // Usage frequency factor
    const daysSinceLastUse = this.getDaysSinceLastUse();
    if (daysSinceLastUse === null) {
      riskScore += 0.3; // Never used
    } else if (daysSinceLastUse > 180) {
      riskScore += 0.4; // Very long inactive
    } else if (daysSinceLastUse > 90) {
      riskScore += 0.2; // Long inactive
    }

    // Backup status factor (non-backed-up credentials are riskier)
    if (!this.backedUp) {
      riskScore += 0.2;
    }

    // Transport factor (internal authenticators are generally more secure)
    if (!this.isPlatformAuthenticator()) {
      riskScore += 0.1;
    }

    // Age factor (very old credentials might use outdated security)
    const credentialAge = Math.floor(
      (Date.now() - this.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (credentialAge > 365 * 2) {
      riskScore += 0.1; // Over 2 years old
    }

    return Math.min(riskScore, 1.0);
  }

  /**
   * Get credential security assessment
   */
  public getSecurityAssessment(): {
    riskScore: number;
    riskLevel: 'low' | 'medium' | 'high';
    securityFeatures: {
      backedUp: boolean;
      platformAuthenticator: boolean;
      roamingAuthenticator: boolean;
      multipleTransports: boolean;
    };
    recommendations: string[];
  } {
    const riskScore = this.calculateRiskScore();
    const recommendations: string[] = [];

    if (!this.backedUp) {
      recommendations.push(
        'Consider using a backed-up authenticator for better recovery options'
      );
    }

    if (this.getDaysSinceLastUse() && this.getDaysSinceLastUse()! > 90) {
      recommendations.push('Credential has been inactive for a long time');
    }

    if (!this.isPlatformAuthenticator() && !this.isRoamingAuthenticator()) {
      recommendations.push(
        'Consider using a platform or roaming authenticator for better security'
      );
    }

    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    if (riskScore > 0.6) {
      riskLevel = 'high';
      recommendations.push(
        'Consider replacing this credential with a newer one'
      );
    } else if (riskScore > 0.3) {
      riskLevel = 'medium';
      recommendations.push('Monitor credential usage and consider updating');
    }

    return {
      riskScore,
      riskLevel,
      securityFeatures: {
        backedUp: this.backedUp,
        platformAuthenticator: this.isPlatformAuthenticator(),
        roamingAuthenticator: this.isRoamingAuthenticator(),
        multipleTransports: this.transports.length > 1,
      },
      recommendations,
    };
  }

  /**
   * Check if credential should be considered for rotation
   */
  public shouldRotate(maxAge: number = 365 * 2): boolean {
    const credentialAge = Math.floor(
      (Date.now() - this.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    );

    return credentialAge > maxAge || this.calculateRiskScore() > 0.7;
  }

  /**
   * Get usage statistics
   */
  public getUsageStats(): {
    daysSinceCreated: number;
    daysSinceLastUse: number | null;
    isActive: boolean;
    usageFrequency: 'never' | 'rare' | 'occasional' | 'frequent';
  } {
    const daysSinceCreated = Math.floor(
      (Date.now() - this.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    const daysSinceLastUse = this.getDaysSinceLastUse();

    let usageFrequency: 'never' | 'rare' | 'occasional' | 'frequent' = 'never';
    if (daysSinceLastUse !== null) {
      if (daysSinceLastUse <= 7) {
        usageFrequency = 'frequent';
      } else if (daysSinceLastUse <= 30) {
        usageFrequency = 'occasional';
      } else if (daysSinceLastUse <= 90) {
        usageFrequency = 'rare';
      }
    }

    return {
      daysSinceCreated,
      daysSinceLastUse,
      isActive: this.isActive(),
      usageFrequency,
    };
  }
}
