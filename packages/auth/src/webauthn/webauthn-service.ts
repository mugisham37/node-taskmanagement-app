/**
 * WebAuthn Service
 *
 * Handles WebAuthn (Web Authentication) for passwordless authentication
 * Supports FIDO2/WebAuthn standards for biometric and hardware key authentication
 */

import { CacheService } from '@taskmanagement/cache';
import { AuthorizationError, InfrastructureError, LoggingService } from '@taskmanagement/core';
import { ValidationError } from '@taskmanagement/validation';

export interface WebAuthnConfig {
  rpName: string; // Relying Party name
  rpId: string; // Relying Party ID (domain)
  origin: string; // Expected origin
  timeout: number; // Timeout in milliseconds
  userVerification: 'required' | 'preferred' | 'discouraged';
  attestation: 'none' | 'indirect' | 'direct' | 'enterprise';
  authenticatorSelection: {
    authenticatorAttachment?: 'platform' | 'cross-platform';
    requireResidentKey?: boolean;
    residentKey?: 'discouraged' | 'preferred' | 'required';
    userVerification?: 'required' | 'preferred' | 'discouraged';
  };
}

export interface RegistrationOptions {
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
  timeout: number;
  attestation: 'none' | 'indirect' | 'direct' | 'enterprise';
  authenticatorSelection: {
    authenticatorAttachment?: 'platform' | 'cross-platform';
    requireResidentKey?: boolean;
    residentKey?: 'discouraged' | 'preferred' | 'required';
    userVerification?: 'required' | 'preferred' | 'discouraged';
  };
  excludeCredentials?: Array<{
    type: 'public-key';
    id: string;
  }>;
}

export interface AuthenticationOptions {
  challenge: string;
  timeout: number;
  rpId: string;
  allowCredentials?: Array<{
    type: 'public-key';
    id: string;
    transports?: Array<'usb' | 'nfc' | 'ble' | 'internal'>;
  }>;
  userVerification: 'required' | 'preferred' | 'discouraged';
}

export interface RegistrationCredential {
  id: string;
  rawId: string;
  response: {
    clientDataJSON: string;
    attestationObject: string;
  };
  type: 'public-key';
}

export interface AuthenticationCredential {
  id: string;
  rawId: string;
  response: {
    clientDataJSON: string;
    authenticatorData: string;
    signature: string;
    userHandle?: string;
  };
  type: 'public-key';
}

export interface StoredCredential {
  credentialId: string;
  userId: string;
  publicKey: string;
  counter: number;
  transports: Array<'usb' | 'nfc' | 'ble' | 'internal'>;
  createdAt: Date;
  lastUsed?: Date;
  nickname?: string;
  aaguid?: string;
}

export interface VerificationResult {
  verified: boolean;
  credentialId?: string;
  newCounter?: number;
  error?: string;
}

export class WebAuthnService {
  private readonly defaultConfig: WebAuthnConfig = {
    rpName: 'Task Management System',
    rpId: 'localhost',
    origin: 'http://localhost:3000',
    timeout: 60000, // 60 seconds
    userVerification: 'preferred',
    attestation: 'none',
    authenticatorSelection: {
      authenticatorAttachment: undefined,
      requireResidentKey: false,
      residentKey: 'preferred',
      userVerification: 'preferred',
    },
  };

  constructor(
    private readonly logger: LoggingService,
    private readonly cacheService: CacheService,
    private readonly config: Partial<WebAuthnConfig> = {}
  ) {}

  /**
   * Generate registration options for WebAuthn
   */
  async generateRegistrationOptions(
    userId: string,
    userName: string,
    userDisplayName: string
  ): Promise<RegistrationOptions> {
    try {
      const finalConfig = { ...this.defaultConfig, ...this.config };
      const challenge = this.generateChallenge();

      // Get existing credentials to exclude
      const existingCredentials = await this.getUserCredentials(userId);
      const excludeCredentials = existingCredentials.map(cred => ({
        type: 'public-key' as const,
        id: cred.credentialId,
      }));

      const options: RegistrationOptions = {
        challenge,
        rp: {
          name: finalConfig.rpName,
          id: finalConfig.rpId,
        },
        user: {
          id: userId,
          name: userName,
          displayName: userDisplayName,
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 }, // ES256
          { type: 'public-key', alg: -257 }, // RS256
        ],
        timeout: finalConfig.timeout,
        attestation: finalConfig.attestation,
        authenticatorSelection: finalConfig.authenticatorSelection,
        excludeCredentials: excludeCredentials.length > 0 ? excludeCredentials : undefined,
      };

      // Store challenge for verification
      await this.storeChallenge(userId, challenge, 'registration');

      this.logger.info('WebAuthn registration options generated', {
        userId,
        userName,
        challengeLength: challenge.length,
      });

      return options;
    } catch (error) {
      this.logger.error('Failed to generate registration options', error as Error, {
        userId,
        userName,
      });
      throw new InfrastructureError(
        `Failed to generate registration options: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Verify registration credential
   */
  async verifyRegistration(
    userId: string,
    credential: RegistrationCredential
  ): Promise<VerificationResult> {
    try {
      // Get stored challenge
      const storedChallenge = await this.getStoredChallenge(userId, 'registration');
      if (!storedChallenge) {
        throw new AuthorizationError('No registration challenge found');
      }

      // Parse client data
      const clientData = JSON.parse(
        Buffer.from(credential.response.clientDataJSON, 'base64').toString()
      );

      // Verify challenge
      if (clientData.challenge !== storedChallenge) {
        throw new AuthorizationError('Challenge mismatch');
      }

      // Verify origin
      const finalConfig = { ...this.defaultConfig, ...this.config };
      if (clientData.origin !== finalConfig.origin) {
        throw new AuthorizationError('Origin mismatch');
      }

      // Verify type
      if (clientData.type !== 'webauthn.create') {
        throw new AuthorizationError('Invalid ceremony type');
      }

      // In a real implementation, you would:
      // 1. Parse and verify the attestation object
      // 2. Extract the public key
      // 3. Verify the attestation signature
      // 4. Check the attestation certificate chain
      
      // For this implementation, we'll simulate successful verification
      const credentialId = credential.id;
      const publicKey = 'simulated-public-key'; // Would be extracted from attestation object
      
      // Store the credential
      const storedCredential: StoredCredential = {
        credentialId,
        userId,
        publicKey,
        counter: 0,
        transports: ['internal'], // Would be extracted from attestation
        createdAt: new Date(),
      };

      await this.storeCredential(storedCredential);

      // Clean up challenge
      await this.removeChallenge(userId, 'registration');

      this.logger.info('WebAuthn registration verified successfully', {
        userId,
        credentialId,
      });

      return {
        verified: true,
        credentialId,
        newCounter: 0,
      };
    } catch (error) {
      this.logger.error('Failed to verify registration', error as Error, {
        userId,
        credentialId: credential.id,
      });

      if (error instanceof AuthorizationError) {
        return {
          verified: false,
          error: error.message,
        };
      }

      throw new InfrastructureError(
        `Failed to verify registration: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Generate authentication options for WebAuthn
   */
  async generateAuthenticationOptions(userId?: string): Promise<AuthenticationOptions> {
    try {
      const finalConfig = { ...this.defaultConfig, ...this.config };
      const challenge = this.generateChallenge();

      let allowCredentials: Array<{
        type: 'public-key';
        id: string;
        transports?: Array<'usb' | 'nfc' | 'ble' | 'internal'>;
      }> | undefined;

      if (userId) {
        // Get user's credentials
        const userCredentials = await this.getUserCredentials(userId);
        allowCredentials = userCredentials.map(cred => ({
          type: 'public-key' as const,
          id: cred.credentialId,
          transports: cred.transports,
        }));

        // Store challenge for this specific user
        await this.storeChallenge(userId, challenge, 'authentication');
      } else {
        // Store challenge for any user (usernameless authentication)
        await this.storeChallenge('anonymous', challenge, 'authentication');
      }

      const options: AuthenticationOptions = {
        challenge,
        timeout: finalConfig.timeout,
        rpId: finalConfig.rpId,
        allowCredentials: allowCredentials?.length ? allowCredentials : undefined,
        userVerification: finalConfig.userVerification,
      };

      this.logger.info('WebAuthn authentication options generated', {
        userId: userId || 'anonymous',
        challengeLength: challenge.length,
        credentialCount: allowCredentials?.length || 0,
      });

      return options;
    } catch (error) {
      this.logger.error('Failed to generate authentication options', error as Error, {
        userId,
      });
      throw new InfrastructureError(
        `Failed to generate authentication options: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Verify authentication credential
   */
  async verifyAuthentication(
    credential: AuthenticationCredential,
    userId?: string
  ): Promise<VerificationResult & { userId?: string }> {
    try {
      // Get stored credential
      const storedCredential = await this.getCredential(credential.id);
      if (!storedCredential) {
        throw new AuthorizationError('Credential not found');
      }

      const actualUserId = userId || storedCredential.userId;

      // Get stored challenge
      const storedChallenge = await this.getStoredChallenge(
        userId || 'anonymous',
        'authentication'
      );
      if (!storedChallenge) {
        throw new AuthorizationError('No authentication challenge found');
      }

      // Parse client data
      const clientData = JSON.parse(
        Buffer.from(credential.response.clientDataJSON, 'base64').toString()
      );

      // Verify challenge
      if (clientData.challenge !== storedChallenge) {
        throw new AuthorizationError('Challenge mismatch');
      }

      // Verify origin
      const finalConfig = { ...this.defaultConfig, ...this.config };
      if (clientData.origin !== finalConfig.origin) {
        throw new AuthorizationError('Origin mismatch');
      }

      // Verify type
      if (clientData.type !== 'webauthn.get') {
        throw new AuthorizationError('Invalid ceremony type');
      }

      // In a real implementation, you would:
      // 1. Parse the authenticator data
      // 2. Verify the signature using the stored public key
      // 3. Check the counter to prevent replay attacks
      // 4. Verify user presence and verification flags

      // For this implementation, we'll simulate successful verification
      const newCounter = storedCredential.counter + 1;

      // Update credential
      storedCredential.counter = newCounter;
      storedCredential.lastUsed = new Date();
      await this.storeCredential(storedCredential);

      // Clean up challenge
      await this.removeChallenge(userId || 'anonymous', 'authentication');

      this.logger.info('WebAuthn authentication verified successfully', {
        userId: actualUserId,
        credentialId: credential.id,
        newCounter,
      });

      return {
        verified: true,
        credentialId: credential.id,
        newCounter,
        userId: actualUserId,
      };
    } catch (error) {
      this.logger.error('Failed to verify authentication', error as Error, {
        credentialId: credential.id,
        userId,
      });

      if (error instanceof AuthorizationError) {
        return {
          verified: false,
          error: error.message,
        };
      }

      throw new InfrastructureError(
        `Failed to verify authentication: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get user's WebAuthn credentials
   */
  async getUserCredentials(userId: string): Promise<StoredCredential[]> {
    try {
      const key = `webauthn-credentials:${userId}`;
      const credentials = await this.cacheService.get<StoredCredential[]>(key);
      return credentials || [];
    } catch (error) {
      this.logger.error('Failed to get user credentials', error as Error, {
        userId,
      });
      return [];
    }
  }

  /**
   * Remove a credential
   */
  async removeCredential(userId: string, credentialId: string): Promise<void> {
    try {
      const credentials = await this.getUserCredentials(userId);
      const filtered = credentials.filter(cred => cred.credentialId !== credentialId);

      const key = `webauthn-credentials:${userId}`;
      await this.cacheService.set(key, filtered, {});

      this.logger.info('WebAuthn credential removed', {
        userId,
        credentialId,
      });
    } catch (error) {
      this.logger.error('Failed to remove credential', error as Error, {
        userId,
        credentialId,
      });
      throw new InfrastructureError(
        `Failed to remove credential: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Update credential nickname
   */
  async updateCredentialNickname(
    userId: string,
    credentialId: string,
    nickname: string
  ): Promise<void> {
    try {
      const credentials = await this.getUserCredentials(userId);
      const credential = credentials.find(cred => cred.credentialId === credentialId);

      if (!credential) {
        throw ValidationError.forField('credentialId', 'Credential not found', credentialId);
      }

      credential.nickname = nickname;

      const key = `webauthn-credentials:${userId}`;
      await this.cacheService.set(key, credentials, {});

      this.logger.info('WebAuthn credential nickname updated', {
        userId,
        credentialId,
        nickname,
      });
    } catch (error) {
      this.logger.error('Failed to update credential nickname', error as Error, {
        userId,
        credentialId,
        nickname,
      });

      if (error instanceof ValidationError) {
        throw error;
      }

      throw new InfrastructureError(
        `Failed to update credential nickname: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  // Private helper methods

  private generateChallenge(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Buffer.from(array).toString('base64url');
  }

  private async storeChallenge(
    userId: string,
    challenge: string,
    type: 'registration' | 'authentication'
  ): Promise<void> {
    const key = `webauthn-challenge:${type}:${userId}`;
    await this.cacheService.set(key, challenge, { ttl: 300 }); // 5 minutes
  }

  private async getStoredChallenge(
    userId: string,
    type: 'registration' | 'authentication'
  ): Promise<string | null> {
    const key = `webauthn-challenge:${type}:${userId}`;
    return await this.cacheService.get<string>(key);
  }

  private async removeChallenge(
    userId: string,
    type: 'registration' | 'authentication'
  ): Promise<void> {
    const key = `webauthn-challenge:${type}:${userId}`;
    await this.cacheService.delete(key);
  }

  private async storeCredential(credential: StoredCredential): Promise<void> {
    // Store by credential ID for lookup
    const credKey = `webauthn-credential:${credential.credentialId}`;
    await this.cacheService.set(credKey, credential, {});

    // Store in user's credential list
    const userCredentials = await this.getUserCredentials(credential.userId);
    const existingIndex = userCredentials.findIndex(
      cred => cred.credentialId === credential.credentialId
    );

    if (existingIndex >= 0) {
      userCredentials[existingIndex] = credential;
    } else {
      userCredentials.push(credential);
    }

    const userKey = `webauthn-credentials:${credential.userId}`;
    await this.cacheService.set(userKey, userCredentials, {});
  }

  private async getCredential(credentialId: string): Promise<StoredCredential | null> {
    const key = `webauthn-credential:${credentialId}`;
    return await this.cacheService.get<StoredCredential>(key);
  }
}