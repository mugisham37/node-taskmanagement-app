import { User } from '../entities/User';
import { WebAuthnCredential } from '../entities/WebAuthnCredential';
import { UserId } from '../value-objects/UserId';
import { WebAuthnCredentialId } from '../value-objects/WebAuthnCredentialId';
import { DomainEvent } from '../../shared/events/DomainEvent';

export interface TotpSetupResult {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
}

export interface SmsSetupResult {
  phoneNumber: string;
  verificationCode: string;
}

export interface WebAuthnRegistrationOptions {
  challenge: string;
  rp: {
    name: string;
    id: string;
  };
  user: {
    id: string;
    name: string;
    displayName: string;
  };
  pubKeyCredParams: Array<{
    type: 'public-key';
    alg: number;
  }>;
  authenticatorSelection?: {
    authenticatorAttachment?: 'platform' | 'cross-platform';
    userVerification?: 'required' | 'preferred' | 'discouraged';
    requireResidentKey?: boolean;
  };
  timeout?: number;
}

export interface WebAuthnAuthenticationOptions {
  challenge: string;
  allowCredentials: Array<{
    type: 'public-key';
    id: string;
    transports?: string[];
  }>;
  timeout?: number;
  userVerification?: 'required' | 'preferred' | 'discouraged';
}

export interface MfaVerificationResult {
  success: boolean;
  method: 'totp' | 'sms' | 'webauthn' | 'backup_code';
  error?: string;
  remainingAttempts?: number;
}

export class MfaEnabledEvent extends DomainEvent {
  constructor(
    public readonly userId: UserId,
    public readonly method: string
  ) {
    super('MfaEnabled', {
      userId: userId.value,
      method,
    });
  }
}

export class MfaDisabledEvent extends DomainEvent {
  constructor(
    public readonly userId: UserId,
    public readonly method: string
  ) {
    super('MfaDisabled', {
      userId: userId.value,
      method,
    });
  }
}

export class MfaVerificationFailedEvent extends DomainEvent {
  constructor(
    public readonly userId: UserId,
    public readonly method: string,
    public readonly reason: string
  ) {
    super('MfaVerificationFailed', {
      userId: userId.value,
      method,
      reason,
    });
  }
}

/**
 * Multi-Factor Authentication Service
 * Supports TOTP, SMS, and WebAuthn authentication methods
 */
export class MfaService {
  constructor(
    private readonly userRepository: any,
    private readonly webauthnCredentialRepository: any,
    private readonly totpService: any,
    private readonly smsService: any,
    private readonly webauthnService: any,
    private readonly eventBus: any
  ) {}

  /**
   * Setup TOTP (Time-based One-Time Password) for a user
   */
  async setupTotp(userId: UserId): Promise<TotpSetupResult> {
    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      if (user.mfaEnabled) {
        throw new Error('MFA is already enabled');
      }

      // Generate TOTP secret
      const secret = this.totpService.generateSecret();

      // Generate QR code URL
      const qrCodeUrl = this.totpService.generateQrCodeUrl(
        user.email.value,
        secret,
        'Unified Enterprise Platform'
      );

      // Generate backup codes
      const backupCodes = this.generateBackupCodes();

      return {
        secret,
        qrCodeUrl,
        backupCodes,
      };
    } catch (error) {
      throw new Error(`TOTP setup failed: ${error.message}`);
    }
  }

  /**
   * Confirm TOTP setup with verification token
   */
  async confirmTotpSetup(
    userId: UserId,
    secret: string,
    token: string,
    backupCodes: string[]
  ): Promise<void> {
    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Verify the token
      const isValid = this.totpService.verifyToken(secret, token);
      if (!isValid) {
        throw new Error('Invalid TOTP token');
      }

      // Enable MFA for the user
      user.enableMfa(secret, backupCodes);
      await this.userRepository.save(user);

      await this.eventBus.publish(new MfaEnabledEvent(userId, 'TOTP'));
    } catch (error) {
      throw new Error(`TOTP confirmation failed: ${error.message}`);
    }
  }

  /**
   * Setup SMS-based MFA
   */
  async setupSms(userId: UserId, phoneNumber: string): Promise<SmsSetupResult> {
    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Generate and send verification code
      const verificationCode = this.generateVerificationCode();
      await this.smsService.sendVerificationCode(phoneNumber, verificationCode);

      return {
        phoneNumber,
        verificationCode, // In production, don't return this
      };
    } catch (error) {
      throw new Error(`SMS setup failed: ${error.message}`);
    }
  }

  /**
   * Confirm SMS setup with verification code
   */
  async confirmSmsSetup(
    userId: UserId,
    phoneNumber: string,
    verificationCode: string
  ): Promise<void> {
    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Verify the code (in production, check against stored code)
      const isValid = await this.smsService.verifyCode(
        phoneNumber,
        verificationCode
      );
      if (!isValid) {
        throw new Error('Invalid verification code');
      }

      // Store phone number and enable SMS MFA
      // TODO: Add phone number to user entity
      const backupCodes = this.generateBackupCodes();
      user.enableMfa('sms:' + phoneNumber, backupCodes);
      await this.userRepository.save(user);

      await this.eventBus.publish(new MfaEnabledEvent(userId, 'SMS'));
    } catch (error) {
      throw new Error(`SMS confirmation failed: ${error.message}`);
    }
  }

  /**
   * Generate WebAuthn registration options
   */
  async generateWebAuthnRegistrationOptions(
    userId: UserId,
    authenticatorType?: 'platform' | 'cross-platform'
  ): Promise<WebAuthnRegistrationOptions> {
    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const challenge = this.webauthnService.generateChallenge();

      const options: WebAuthnRegistrationOptions = {
        challenge,
        rp: {
          name: 'Unified Enterprise Platform',
          id: process.env.WEBAUTHN_RP_ID || 'localhost',
        },
        user: {
          id: user.id.value,
          name: user.email.value,
          displayName: user.name || user.email.value,
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 }, // ES256
          { type: 'public-key', alg: -257 }, // RS256
        ],
        timeout: 60000,
      };

      if (authenticatorType) {
        options.authenticatorSelection = {
          authenticatorAttachment: authenticatorType,
          userVerification: 'preferred',
          requireResidentKey: false,
        };
      }

      return options;
    } catch (error) {
      throw new Error(
        `WebAuthn registration options generation failed: ${error.message}`
      );
    }
  }

  /**
   * Verify and register WebAuthn credential
   */
  async registerWebAuthnCredential(
    userId: UserId,
    registrationResponse: any,
    challenge: string,
    credentialName?: string
  ): Promise<WebAuthnCredential> {
    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Verify the registration response
      const verification = await this.webauthnService.verifyRegistration(
        registrationResponse,
        challenge
      );

      if (!verification.verified) {
        throw new Error('WebAuthn registration verification failed');
      }

      // Create credential entity
      const credential = WebAuthnCredential.create({
        userId,
        credentialId: verification.credentialId,
        publicKey: verification.publicKey,
        counter: BigInt(verification.counter),
        deviceType: verification.deviceType || 'unknown',
        backedUp: verification.backedUp || false,
        transports: verification.transports || [],
        name: credentialName,
      });

      await this.webauthnCredentialRepository.save(credential);

      // Enable MFA if not already enabled
      if (!user.mfaEnabled) {
        const backupCodes = this.generateBackupCodes();
        user.enableMfa('webauthn', backupCodes);
        await this.userRepository.save(user);

        await this.eventBus.publish(new MfaEnabledEvent(userId, 'WebAuthn'));
      }

      return credential;
    } catch (error) {
      throw new Error(
        `WebAuthn credential registration failed: ${error.message}`
      );
    }
  }

  /**
   * Generate WebAuthn authentication options
   */
  async generateWebAuthnAuthenticationOptions(
    userId: UserId
  ): Promise<WebAuthnAuthenticationOptions> {
    try {
      const credentials =
        await this.webauthnCredentialRepository.findByUserId(userId);

      const challenge = this.webauthnService.generateChallenge();

      const allowCredentials = credentials.map((cred: WebAuthnCredential) => ({
        type: 'public-key' as const,
        id: cred.credentialId,
        transports: cred.transports,
      }));

      return {
        challenge,
        allowCredentials,
        timeout: 60000,
        userVerification: 'preferred',
      };
    } catch (error) {
      throw new Error(
        `WebAuthn authentication options generation failed: ${error.message}`
      );
    }
  }

  /**
   * Verify TOTP token
   */
  async verifyTotpToken(
    userId: UserId,
    token: string
  ): Promise<MfaVerificationResult> {
    try {
      const user = await this.userRepository.findById(userId);
      if (!user || !user.mfaEnabled || !user.totpSecret) {
        return {
          success: false,
          method: 'totp',
          error: 'TOTP not enabled',
        };
      }

      const isValid = this.totpService.verifyToken(user.totpSecret, token);

      if (!isValid) {
        await this.eventBus.publish(
          new MfaVerificationFailedEvent(userId, 'TOTP', 'Invalid token')
        );

        return {
          success: false,
          method: 'totp',
          error: 'Invalid token',
        };
      }

      return {
        success: true,
        method: 'totp',
      };
    } catch (error) {
      return {
        success: false,
        method: 'totp',
        error: 'Verification failed',
      };
    }
  }

  /**
   * Verify SMS token
   */
  async verifySmsToken(
    userId: UserId,
    token: string
  ): Promise<MfaVerificationResult> {
    try {
      const user = await this.userRepository.findById(userId);
      if (!user || !user.mfaEnabled) {
        return {
          success: false,
          method: 'sms',
          error: 'SMS MFA not enabled',
        };
      }

      // Extract phone number from TOTP secret (format: "sms:+1234567890")
      const phoneNumber = user.totpSecret?.startsWith('sms:')
        ? user.totpSecret.substring(4)
        : null;

      if (!phoneNumber) {
        return {
          success: false,
          method: 'sms',
          error: 'SMS not configured',
        };
      }

      const isValid = await this.smsService.verifyCode(phoneNumber, token);

      if (!isValid) {
        await this.eventBus.publish(
          new MfaVerificationFailedEvent(userId, 'SMS', 'Invalid code')
        );

        return {
          success: false,
          method: 'sms',
          error: 'Invalid code',
        };
      }

      return {
        success: true,
        method: 'sms',
      };
    } catch (error) {
      return {
        success: false,
        method: 'sms',
        error: 'Verification failed',
      };
    }
  }

  /**
   * Verify WebAuthn authentication
   */
  async verifyWebAuthnAuthentication(
    userId: UserId,
    authenticationResponse: any,
    challenge: string
  ): Promise<MfaVerificationResult> {
    try {
      const credential =
        await this.webauthnCredentialRepository.findByCredentialId(
          authenticationResponse.id
        );

      if (!credential || !credential.userId.equals(userId)) {
        return {
          success: false,
          method: 'webauthn',
          error: 'Credential not found',
        };
      }

      const verification = await this.webauthnService.verifyAuthentication(
        authenticationResponse,
        challenge,
        credential.publicKey,
        credential.counter
      );

      if (!verification.verified) {
        await this.eventBus.publish(
          new MfaVerificationFailedEvent(
            userId,
            'WebAuthn',
            'Authentication failed'
          )
        );

        return {
          success: false,
          method: 'webauthn',
          error: 'Authentication failed',
        };
      }

      // Update credential counter
      credential.updateCounter(BigInt(verification.counter));
      await this.webauthnCredentialRepository.save(credential);

      return {
        success: true,
        method: 'webauthn',
      };
    } catch (error) {
      return {
        success: false,
        method: 'webauthn',
        error: 'Verification failed',
      };
    }
  }

  /**
   * Verify backup code
   */
  async verifyBackupCode(
    userId: UserId,
    code: string
  ): Promise<MfaVerificationResult> {
    try {
      const user = await this.userRepository.findById(userId);
      if (!user || !user.mfaEnabled) {
        return {
          success: false,
          method: 'backup_code',
          error: 'MFA not enabled',
        };
      }

      const codeIndex = user.backupCodes.indexOf(code);
      if (codeIndex === -1) {
        await this.eventBus.publish(
          new MfaVerificationFailedEvent(userId, 'backup_code', 'Invalid code')
        );

        return {
          success: false,
          method: 'backup_code',
          error: 'Invalid backup code',
        };
      }

      // Remove used backup code
      const updatedCodes = [...user.backupCodes];
      updatedCodes.splice(codeIndex, 1);

      // Update user with remaining codes
      // TODO: Add method to update backup codes
      await this.userRepository.save(user);

      return {
        success: true,
        method: 'backup_code',
        remainingAttempts: updatedCodes.length,
      };
    } catch (error) {
      return {
        success: false,
        method: 'backup_code',
        error: 'Verification failed',
      };
    }
  }

  /**
   * Disable MFA for a user
   */
  async disableMfa(userId: UserId): Promise<void> {
    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      if (!user.mfaEnabled) {
        throw new Error('MFA is not enabled');
      }

      // Disable MFA
      user.disableMfa();
      await this.userRepository.save(user);

      // Remove all WebAuthn credentials
      const credentials =
        await this.webauthnCredentialRepository.findByUserId(userId);
      for (const credential of credentials) {
        credential.revoke('MFA disabled');
        await this.webauthnCredentialRepository.delete(credential.id);
      }

      await this.eventBus.publish(new MfaDisabledEvent(userId, 'ALL'));
    } catch (error) {
      throw new Error(`MFA disable failed: ${error.message}`);
    }
  }

  /**
   * Get MFA status for a user
   */
  async getMfaStatus(userId: UserId): Promise<{
    enabled: boolean;
    methods: string[];
    backupCodesRemaining: number;
    webauthnCredentials: number;
  }> {
    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const methods: string[] = [];

      if (user.mfaEnabled) {
        if (user.totpSecret) {
          if (user.totpSecret.startsWith('sms:')) {
            methods.push('SMS');
          } else if (user.totpSecret === 'webauthn') {
            methods.push('WebAuthn');
          } else {
            methods.push('TOTP');
          }
        }
      }

      const webauthnCredentials =
        await this.webauthnCredentialRepository.countByUserId(userId);
      if (webauthnCredentials > 0) {
        methods.push('WebAuthn');
      }

      return {
        enabled: user.mfaEnabled,
        methods: [...new Set(methods)],
        backupCodesRemaining: user.backupCodes.length,
        webauthnCredentials,
      };
    } catch (error) {
      return {
        enabled: false,
        methods: [],
        backupCodesRemaining: 0,
        webauthnCredentials: 0,
      };
    }
  }

  // Private helper methods

  private generateBackupCodes(): string[] {
    const codes: string[] = [];
    for (let i = 0; i < 10; i++) {
      codes.push(this.generateRandomCode(8));
    }
    return codes;
  }

  private generateVerificationCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private generateRandomCode(length: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
}
