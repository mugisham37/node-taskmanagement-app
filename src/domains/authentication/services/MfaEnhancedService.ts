import crypto from 'crypto';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { User } from '../entities/User';
import { UserId } from '../value-objects/UserId';
import { DomainEvent } from '../../shared/events/DomainEvent';

export interface MfaSetupResult {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
  manualEntryKey: string;
}

export interface MfaValidationResult {
  valid: boolean;
  method: 'totp' | 'backup_code' | 'webauthn';
  remainingBackupCodes?: number;
  error?: string;
}

export interface WebAuthnCredential {
  id: string;
  publicKey: string;
  counter: number;
  name: string;
  createdAt: Date;
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
  authenticatorSelection: {
    authenticatorAttachment?: 'platform' | 'cross-platform';
    userVerification: 'required' | 'preferred' | 'discouraged';
    requireResidentKey: boolean;
  };
  timeout: number;
  attestation: 'none' | 'indirect' | 'direct';
}

export interface WebAuthnAuthenticationOptions {
  challenge: string;
  timeout: number;
  rpId: string;
  allowCredentials: Array<{
    type: 'public-key';
    id: string;
  }>;
  userVerification: 'required' | 'preferred' | 'discouraged';
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

export class MfaValidationFailedEvent extends DomainEvent {
  constructor(
    public readonly userId: UserId,
    public readonly method: string,
    public readonly reason: string,
    public readonly ipAddress?: string
  ) {
    super('MfaValidationFailed', {
      userId: userId.value,
      method,
      reason,
      ipAddress,
    });
  }
}

export class BackupCodeUsedEvent extends DomainEvent {
  constructor(
    public readonly userId: UserId,
    public readonly remainingCodes: number
  ) {
    super('BackupCodeUsed', {
      userId: userId.value,
      remainingCodes,
    });
  }
}

export class WebAuthnCredentialRegisteredEvent extends DomainEvent {
  constructor(
    public readonly userId: UserId,
    public readonly credentialId: string,
    public readonly credentialName: string
  ) {
    super('WebAuthnCredentialRegistered', {
      userId: userId.value,
      credentialId,
      credentialName,
    });
  }
}

/**
 * Enhanced Multi-Factor Authentication Service
 * Supports TOTP, backup codes, and WebAuthn
 */
export class MfaEnhancedService {
  private readonly serviceName: string;
  private readonly serviceUrl: string;
  private readonly rpId: string;

  constructor(
    private readonly userRepository: any,
    private readonly mfaRepository: any,
    private readonly eventBus: any,
    config: {
      serviceName: string;
      serviceUrl: string;
      rpId: string;
    }
  ) {
    this.serviceName = config.serviceName;
    this.serviceUrl = config.serviceUrl;
    this.rpId = config.rpId;
  }

  /**
   * Setup TOTP MFA for a user
   */
  async setupTotp(userId: UserId): Promise<MfaSetupResult> {
    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      if (user.mfaEnabled) {
        throw new Error('MFA is already enabled for this user');
      }

      // Generate TOTP secret
      const secret = speakeasy.generateSecret({
        name: `${this.serviceName} (${user.email.value})`,
        issuer: this.serviceName,
        length: 32,
      });

      // Generate QR code
      const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url!);

      // Generate backup codes
      const backupCodes = this.generateBackupCodes();

      // Store temporary MFA setup (not yet enabled)
      await this.mfaRepository.storeTempSetup(userId, {
        type: 'totp',
        secret: secret.base32,
        backupCodes,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      });

      return {
        secret: secret.base32!,
        qrCodeUrl,
        backupCodes,
        manualEntryKey: secret.base32!,
      };
    } catch (error) {
      throw new Error(`TOTP setup failed: ${error.message}`);
    }
  }

  /**
   * Verify TOTP setup and enable MFA
   */
  async verifyTotpSetup(
    userId: UserId,
    token: string
  ): Promise<{ success: boolean; backupCodes: string[] }> {
    try {
      const tempSetup = await this.mfaRepository.getTempSetup(userId);
      if (!tempSetup || tempSetup.type !== 'totp') {
        throw new Error('No pending TOTP setup found');
      }

      if (tempSetup.expiresAt < new Date()) {
        await this.mfaRepository.deleteTempSetup(userId);
        throw new Error('TOTP setup has expired');
      }

      // Verify the token
      const verified = speakeasy.totp.verify({
        secret: tempSetup.secret,
        encoding: 'base32',
        token,
        window: 2, // Allow 2 time steps (60 seconds) of drift
      });

      if (!verified) {
        throw new Error('Invalid TOTP token');
      }

      // Enable MFA for the user
      const user = await this.userRepository.findById(userId);
      user.enableMFA(tempSetup.secret, tempSetup.backupCodes);
      await this.userRepository.save(user);

      // Store MFA configuration
      await this.mfaRepository.storeMfaConfig(userId, {
        type: 'totp',
        secret: tempSetup.secret,
        backupCodes: tempSetup.backupCodes,
        enabledAt: new Date(),
      });

      // Clean up temporary setup
      await this.mfaRepository.deleteTempSetup(userId);

      // Publish event
      await this.eventBus.publish(new MfaEnabledEvent(userId, 'totp'));

      return {
        success: true,
        backupCodes: tempSetup.backupCodes,
      };
    } catch (error) {
      throw new Error(`TOTP verification failed: ${error.message}`);
    }
  }

  /**
   * Validate TOTP token
   */
  async validateTotp(
    userId: UserId,
    token: string,
    ipAddress?: string
  ): Promise<MfaValidationResult> {
    try {
      const mfaConfig = await this.mfaRepository.getMfaConfig(userId);
      if (!mfaConfig || mfaConfig.type !== 'totp') {
        return {
          valid: false,
          method: 'totp',
          error: 'TOTP not configured',
        };
      }

      // Check if it's a backup code first
      if (token.length === 8 && /^[A-Z0-9]{8}$/.test(token)) {
        return await this.validateBackupCode(userId, token, ipAddress);
      }

      // Validate TOTP token
      const verified = speakeasy.totp.verify({
        secret: mfaConfig.secret,
        encoding: 'base32',
        token,
        window: 2,
      });

      if (!verified) {
        await this.eventBus.publish(
          new MfaValidationFailedEvent(
            userId,
            'totp',
            'Invalid TOTP token',
            ipAddress
          )
        );

        return {
          valid: false,
          method: 'totp',
          error: 'Invalid TOTP token',
        };
      }

      return {
        valid: true,
        method: 'totp',
      };
    } catch (error) {
      return {
        valid: false,
        method: 'totp',
        error: 'TOTP validation failed',
      };
    }
  }

  /**
   * Validate backup code
   */
  async validateBackupCode(
    userId: UserId,
    code: string,
    ipAddress?: string
  ): Promise<MfaValidationResult> {
    try {
      const mfaConfig = await this.mfaRepository.getMfaConfig(userId);
      if (!mfaConfig) {
        return {
          valid: false,
          method: 'backup_code',
          error: 'MFA not configured',
        };
      }

      const codeIndex = mfaConfig.backupCodes.indexOf(code);
      if (codeIndex === -1) {
        await this.eventBus.publish(
          new MfaValidationFailedEvent(
            userId,
            'backup_code',
            'Invalid backup code',
            ipAddress
          )
        );

        return {
          valid: false,
          method: 'backup_code',
          error: 'Invalid backup code',
        };
      }

      // Remove used backup code
      mfaConfig.backupCodes.splice(codeIndex, 1);
      await this.mfaRepository.updateMfaConfig(userId, mfaConfig);

      // Update user entity
      const user = await this.userRepository.findById(userId);
      user.useBackupCode(code);
      await this.userRepository.save(user);

      // Publish event
      await this.eventBus.publish(
        new BackupCodeUsedEvent(userId, mfaConfig.backupCodes.length)
      );

      return {
        valid: true,
        method: 'backup_code',
        remainingBackupCodes: mfaConfig.backupCodes.length,
      };
    } catch (error) {
      return {
        valid: false,
        method: 'backup_code',
        error: 'Backup code validation failed',
      };
    }
  }

  /**
   * Generate new backup codes
   */
  async regenerateBackupCodes(userId: UserId): Promise<string[]> {
    try {
      const mfaConfig = await this.mfaRepository.getMfaConfig(userId);
      if (!mfaConfig) {
        throw new Error('MFA not configured');
      }

      const newBackupCodes = this.generateBackupCodes();
      mfaConfig.backupCodes = newBackupCodes;
      await this.mfaRepository.updateMfaConfig(userId, mfaConfig);

      // Update user entity
      const user = await this.userRepository.findById(userId);
      user.regenerateBackupCodes(newBackupCodes);
      await this.userRepository.save(user);

      return newBackupCodes;
    } catch (error) {
      throw new Error(`Backup code regeneration failed: ${error.message}`);
    }
  }

  /**
   * Setup WebAuthn registration
   */
  async setupWebAuthn(userId: UserId): Promise<WebAuthnRegistrationOptions> {
    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const challenge = crypto.randomBytes(32).toString('base64url');

      // Store challenge temporarily
      await this.mfaRepository.storeWebAuthnChallenge(userId, challenge, {
        type: 'registration',
        expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
      });

      return {
        challenge,
        rp: {
          name: this.serviceName,
          id: this.rpId,
        },
        user: {
          id: userId.value,
          name: user.email.value,
          displayName: user.name || user.email.value,
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 }, // ES256
          { type: 'public-key', alg: -257 }, // RS256
        ],
        authenticatorSelection: {
          userVerification: 'preferred',
          requireResidentKey: false,
        },
        timeout: 60000,
        attestation: 'none',
      };
    } catch (error) {
      throw new Error(`WebAuthn setup failed: ${error.message}`);
    }
  }

  /**
   * Verify WebAuthn registration
   */
  async verifyWebAuthnRegistration(
    userId: UserId,
    credentialName: string,
    registrationResponse: any
  ): Promise<{ success: boolean; credentialId: string }> {
    try {
      const challenge = await this.mfaRepository.getWebAuthnChallenge(userId);
      if (!challenge || challenge.type !== 'registration') {
        throw new Error('No pending WebAuthn registration found');
      }

      if (challenge.expiresAt < new Date()) {
        await this.mfaRepository.deleteWebAuthnChallenge(userId);
        throw new Error('WebAuthn registration has expired');
      }

      // Verify the registration response
      const verification = await this.verifyRegistrationResponse(
        registrationResponse,
        challenge.challenge
      );

      if (!verification.verified) {
        throw new Error('WebAuthn registration verification failed');
      }

      // Store the credential
      const credential: WebAuthnCredential = {
        id: verification.credentialId,
        publicKey: verification.publicKey,
        counter: verification.counter,
        name: credentialName,
        createdAt: new Date(),
      };

      await this.mfaRepository.storeWebAuthnCredential(userId, credential);

      // Clean up challenge
      await this.mfaRepository.deleteWebAuthnChallenge(userId);

      // Publish event
      await this.eventBus.publish(
        new WebAuthnCredentialRegisteredEvent(
          userId,
          credential.id,
          credentialName
        )
      );

      return {
        success: true,
        credentialId: credential.id,
      };
    } catch (error) {
      throw new Error(`WebAuthn registration failed: ${error.message}`);
    }
  }

  /**
   * Setup WebAuthn authentication
   */
  async setupWebAuthnAuthentication(
    userId: UserId
  ): Promise<WebAuthnAuthenticationOptions> {
    try {
      const credentials =
        await this.mfaRepository.getWebAuthnCredentials(userId);
      if (credentials.length === 0) {
        throw new Error('No WebAuthn credentials found');
      }

      const challenge = crypto.randomBytes(32).toString('base64url');

      // Store challenge temporarily
      await this.mfaRepository.storeWebAuthnChallenge(userId, challenge, {
        type: 'authentication',
        expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
      });

      return {
        challenge,
        timeout: 60000,
        rpId: this.rpId,
        allowCredentials: credentials.map(cred => ({
          type: 'public-key',
          id: cred.id,
        })),
        userVerification: 'preferred',
      };
    } catch (error) {
      throw new Error(`WebAuthn authentication setup failed: ${error.message}`);
    }
  }

  /**
   * Validate WebAuthn authentication
   */
  async validateWebAuthn(
    userId: UserId,
    authenticationResponse: any,
    ipAddress?: string
  ): Promise<MfaValidationResult> {
    try {
      const challenge = await this.mfaRepository.getWebAuthnChallenge(userId);
      if (!challenge || challenge.type !== 'authentication') {
        return {
          valid: false,
          method: 'webauthn',
          error: 'No pending WebAuthn authentication found',
        };
      }

      if (challenge.expiresAt < new Date()) {
        await this.mfaRepository.deleteWebAuthnChallenge(userId);
        return {
          valid: false,
          method: 'webauthn',
          error: 'WebAuthn authentication has expired',
        };
      }

      // Get the credential
      const credential = await this.mfaRepository.getWebAuthnCredential(
        userId,
        authenticationResponse.id
      );

      if (!credential) {
        return {
          valid: false,
          method: 'webauthn',
          error: 'Credential not found',
        };
      }

      // Verify the authentication response
      const verification = await this.verifyAuthenticationResponse(
        authenticationResponse,
        challenge.challenge,
        credential
      );

      if (!verification.verified) {
        await this.eventBus.publish(
          new MfaValidationFailedEvent(
            userId,
            'webauthn',
            'WebAuthn verification failed',
            ipAddress
          )
        );

        return {
          valid: false,
          method: 'webauthn',
          error: 'WebAuthn verification failed',
        };
      }

      // Update credential counter
      credential.counter = verification.newCounter;
      await this.mfaRepository.updateWebAuthnCredential(userId, credential);

      // Clean up challenge
      await this.mfaRepository.deleteWebAuthnChallenge(userId);

      return {
        valid: true,
        method: 'webauthn',
      };
    } catch (error) {
      return {
        valid: false,
        method: 'webauthn',
        error: 'WebAuthn validation failed',
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
        throw new Error('MFA is not enabled for this user');
      }

      // Get current MFA configuration
      const mfaConfig = await this.mfaRepository.getMfaConfig(userId);
      const method = mfaConfig?.type || 'unknown';

      // Disable MFA on user entity
      user.disableMFA();
      await this.userRepository.save(user);

      // Remove MFA configuration
      await this.mfaRepository.deleteMfaConfig(userId);

      // Remove WebAuthn credentials if any
      await this.mfaRepository.deleteAllWebAuthnCredentials(userId);

      // Publish event
      await this.eventBus.publish(new MfaDisabledEvent(userId, method));
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
    backupCodesRemaining?: number;
    webauthnCredentials?: Array<{
      id: string;
      name: string;
      createdAt: Date;
    }>;
  }> {
    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      if (!user.mfaEnabled) {
        return {
          enabled: false,
          methods: [],
        };
      }

      const methods: string[] = [];
      let backupCodesRemaining: number | undefined;
      let webauthnCredentials: any[] | undefined;

      // Check TOTP
      const mfaConfig = await this.mfaRepository.getMfaConfig(userId);
      if (mfaConfig?.type === 'totp') {
        methods.push('totp');
        backupCodesRemaining = mfaConfig.backupCodes.length;
      }

      // Check WebAuthn
      const credentials =
        await this.mfaRepository.getWebAuthnCredentials(userId);
      if (credentials.length > 0) {
        methods.push('webauthn');
        webauthnCredentials = credentials.map(cred => ({
          id: cred.id,
          name: cred.name,
          createdAt: cred.createdAt,
        }));
      }

      return {
        enabled: true,
        methods,
        backupCodesRemaining,
        webauthnCredentials,
      };
    } catch (error) {
      return {
        enabled: false,
        methods: [],
      };
    }
  }

  // Private helper methods

  private generateBackupCodes(): string[] {
    const codes: string[] = [];
    for (let i = 0; i < 10; i++) {
      codes.push(this.generateBackupCode());
    }
    return codes;
  }

  private generateBackupCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  private async verifyRegistrationResponse(
    response: any,
    expectedChallenge: string
  ): Promise<{
    verified: boolean;
    credentialId: string;
    publicKey: string;
    counter: number;
  }> {
    // TODO: Implement WebAuthn registration verification
    // This would use a library like @simplewebauthn/server
    return {
      verified: true,
      credentialId: 'mock-credential-id',
      publicKey: 'mock-public-key',
      counter: 0,
    };
  }

  private async verifyAuthenticationResponse(
    response: any,
    expectedChallenge: string,
    credential: WebAuthnCredential
  ): Promise<{
    verified: boolean;
    newCounter: number;
  }> {
    // TODO: Implement WebAuthn authentication verification
    // This would use a library like @simplewebauthn/server
    return {
      verified: true,
      newCounter: credential.counter + 1,
    };
  }
}
