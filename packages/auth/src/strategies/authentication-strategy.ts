/**
 * Authentication Strategy Interface and Implementations
 *
 * Provides different authentication strategies that can be used
 * in a pluggable authentication system
 */

import { AuthorizationError, InfrastructureError } from '@taskmanagement/core';

export interface AuthenticationContext {
  userId?: string;
  email?: string;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface AuthenticationResult {
  success: boolean;
  userId?: string;
  email?: string;
  roles?: string[];
  permissions?: string[];
  requiresAdditionalAuth?: boolean;
  additionalAuthType?: 'totp' | 'sms' | 'email' | 'webauthn';
  sessionData?: Record<string, any>;
  error?: string;
}

export interface AuthenticationCredentials {
  type: 'password' | 'oauth' | 'webauthn' | 'api-key' | 'certificate';
  identifier: string; // email, username, or other identifier
  secret?: string; // password, token, etc.
  additionalData?: Record<string, any>;
}

export abstract class AuthenticationStrategy {
  abstract readonly name: string;
  abstract readonly type: string;

  /**
   * Authenticate user with provided credentials
   */
  abstract authenticate(
    credentials: AuthenticationCredentials,
    context: AuthenticationContext
  ): Promise<AuthenticationResult>;

  /**
   * Validate if this strategy can handle the given credentials
   */
  abstract canHandle(credentials: AuthenticationCredentials): boolean;

  /**
   * Get strategy configuration
   */
  abstract getConfig(): Record<string, any>;

  /**
   * Validate strategy configuration
   */
  protected validateConfig(config: Record<string, any>): void {
    // Override in subclasses for specific validation
  }
}

export class PasswordAuthenticationStrategy extends AuthenticationStrategy {
  readonly name = 'password';
  readonly type = 'local';

  constructor(
    private readonly userRepository: any, // IUserRepository
    private readonly passwordService: any // PasswordService
  ) {
    super();
  }

  async authenticate(
    credentials: AuthenticationCredentials,
    context: AuthenticationContext
  ): Promise<AuthenticationResult> {
    try {
      if (!credentials.secret) {
        return {
          success: false,
          error: 'Password is required',
        };
      }

      // Find user by email/username
      const user = await this.userRepository.findByEmail(credentials.identifier);
      if (!user) {
        return {
          success: false,
          error: 'Invalid credentials',
        };
      }

      // Verify password
      const isValidPassword = await this.passwordService.verify(
        credentials.secret,
        user.passwordHash
      );

      if (!isValidPassword) {
        return {
          success: false,
          error: 'Invalid credentials',
        };
      }

      // Check if user is active
      if (!user.isActive) {
        return {
          success: false,
          error: 'Account is disabled',
        };
      }

      // Check if email is verified
      if (!user.emailVerified) {
        return {
          success: false,
          error: 'Email not verified',
        };
      }

      return {
        success: true,
        userId: user.id.value,
        email: user.email.value,
        roles: user.roles || [],
        permissions: user.permissions || [],
        requiresAdditionalAuth: user.twoFactorEnabled,
        additionalAuthType: user.twoFactorEnabled ? 'totp' : undefined,
      };
    } catch (error) {
      throw new InfrastructureError(
        `Password authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  canHandle(credentials: AuthenticationCredentials): boolean {
    return credentials.type === 'password' && !!credentials.secret;
  }

  getConfig(): Record<string, any> {
    return {
      type: this.type,
      name: this.name,
      requiresPassword: true,
      supportsMultiFactor: true,
    };
  }
}

export class OAuthAuthenticationStrategy extends AuthenticationStrategy {
  readonly name = 'oauth';
  readonly type = 'external';

  constructor(
    private readonly oauthService: any, // OAuthService
    private readonly userRepository: any // IUserRepository
  ) {
    super();
  }

  async authenticate(
    credentials: AuthenticationCredentials,
    context: AuthenticationContext
  ): Promise<AuthenticationResult> {
    try {
      const { provider, accessToken } = credentials.additionalData || {};

      if (!provider || !accessToken) {
        return {
          success: false,
          error: 'OAuth provider and access token are required',
        };
      }

      // Get user info from OAuth provider
      const userInfo = await this.oauthService.getUserInfo(provider, accessToken);

      // Find or create user
      let user = await this.userRepository.findByEmail(userInfo.email);

      if (!user) {
        // Create new user from OAuth data
        user = await this.createUserFromOAuth(userInfo);
      } else {
        // Update user's OAuth data
        await this.updateUserOAuthData(user, userInfo);
      }

      return {
        success: true,
        userId: user.id.value,
        email: user.email.value,
        roles: user.roles || [],
        permissions: user.permissions || [],
        sessionData: {
          provider,
          providerUserId: userInfo.providerUserId,
        },
      };
    } catch (error) {
      throw new InfrastructureError(
        `OAuth authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  canHandle(credentials: AuthenticationCredentials): boolean {
    return (
      credentials.type === 'oauth' &&
      !!credentials.additionalData?.provider &&
      !!credentials.additionalData?.accessToken
    );
  }

  getConfig(): Record<string, any> {
    return {
      type: this.type,
      name: this.name,
      requiresPassword: false,
      supportsMultiFactor: false,
      externalProvider: true,
    };
  }

  private async createUserFromOAuth(userInfo: any): Promise<any> {
    // Implementation would create a new user from OAuth data
    // This is a placeholder
    throw new InfrastructureError('User creation from OAuth not implemented');
  }

  private async updateUserOAuthData(user: any, userInfo: any): Promise<void> {
    // Implementation would update user's OAuth data
    // This is a placeholder
  }
}

export class WebAuthnAuthenticationStrategy extends AuthenticationStrategy {
  readonly name = 'webauthn';
  readonly type = 'biometric';

  constructor(
    private readonly webauthnService: any, // WebAuthnService
    private readonly userRepository: any // IUserRepository
  ) {
    super();
  }

  async authenticate(
    credentials: AuthenticationCredentials,
    context: AuthenticationContext
  ): Promise<AuthenticationResult> {
    try {
      const { credential } = credentials.additionalData || {};

      if (!credential) {
        return {
          success: false,
          error: 'WebAuthn credential is required',
        };
      }

      // Verify WebAuthn credential
      const verification = await this.webauthnService.verifyAuthentication(credential);

      if (!verification.verified) {
        return {
          success: false,
          error: verification.error || 'WebAuthn verification failed',
        };
      }

      // Get user
      const user = await this.userRepository.findById(verification.userId);
      if (!user) {
        return {
          success: false,
          error: 'User not found',
        };
      }

      return {
        success: true,
        userId: user.id.value,
        email: user.email.value,
        roles: user.roles || [],
        permissions: user.permissions || [],
        sessionData: {
          credentialId: verification.credentialId,
          authMethod: 'webauthn',
        },
      };
    } catch (error) {
      throw new InfrastructureError(
        `WebAuthn authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  canHandle(credentials: AuthenticationCredentials): boolean {
    return credentials.type === 'webauthn' && !!credentials.additionalData?.credential;
  }

  getConfig(): Record<string, any> {
    return {
      type: this.type,
      name: this.name,
      requiresPassword: false,
      supportsMultiFactor: false,
      biometric: true,
    };
  }
}

export class ApiKeyAuthenticationStrategy extends AuthenticationStrategy {
  readonly name = 'api-key';
  readonly type = 'token';

  constructor(
    private readonly apiKeyService: any, // ApiKeyService (would need to be implemented)
    private readonly userRepository: any // IUserRepository
  ) {
    super();
  }

  async authenticate(
    credentials: AuthenticationCredentials,
    context: AuthenticationContext
  ): Promise<AuthenticationResult> {
    try {
      if (!credentials.secret) {
        return {
          success: false,
          error: 'API key is required',
        };
      }

      // Validate API key
      const apiKeyData = await this.apiKeyService.validateApiKey(credentials.secret);

      if (!apiKeyData || !apiKeyData.isActive) {
        return {
          success: false,
          error: 'Invalid or inactive API key',
        };
      }

      // Check expiration
      if (apiKeyData.expiresAt && new Date() > apiKeyData.expiresAt) {
        return {
          success: false,
          error: 'API key has expired',
        };
      }

      // Get user
      const user = await this.userRepository.findById(apiKeyData.userId);
      if (!user) {
        return {
          success: false,
          error: 'User not found',
        };
      }

      // Update last used
      await this.apiKeyService.updateLastUsed(credentials.secret, context.ipAddress);

      return {
        success: true,
        userId: user.id.value,
        email: user.email.value,
        roles: apiKeyData.scopes || user.roles || [],
        permissions: apiKeyData.permissions || user.permissions || [],
        sessionData: {
          apiKeyId: apiKeyData.id,
          authMethod: 'api-key',
        },
      };
    } catch (error) {
      throw new InfrastructureError(
        `API key authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  canHandle(credentials: AuthenticationCredentials): boolean {
    return credentials.type === 'api-key' && !!credentials.secret;
  }

  getConfig(): Record<string, any> {
    return {
      type: this.type,
      name: this.name,
      requiresPassword: false,
      supportsMultiFactor: false,
      programmatic: true,
    };
  }
}

/**
 * Authentication Strategy Manager
 * 
 * Manages multiple authentication strategies and routes authentication
 * requests to the appropriate strategy
 */
export class AuthenticationStrategyManager {
  private strategies = new Map<string, AuthenticationStrategy>();

  /**
   * Register an authentication strategy
   */
  registerStrategy(strategy: AuthenticationStrategy): void {
    this.strategies.set(strategy.name, strategy);
  }

  /**
   * Get all registered strategies
   */
  getStrategies(): AuthenticationStrategy[] {
    return Array.from(this.strategies.values());
  }

  /**
   * Get strategy by name
   */
  getStrategy(name: string): AuthenticationStrategy | undefined {
    return this.strategies.get(name);
  }

  /**
   * Find strategy that can handle the given credentials
   */
  findStrategy(credentials: AuthenticationCredentials): AuthenticationStrategy | undefined {
    for (const strategy of this.strategies.values()) {
      if (strategy.canHandle(credentials)) {
        return strategy;
      }
    }
    return undefined;
  }

  /**
   * Authenticate using the appropriate strategy
   */
  async authenticate(
    credentials: AuthenticationCredentials,
    context: AuthenticationContext
  ): Promise<AuthenticationResult> {
    const strategy = this.findStrategy(credentials);

    if (!strategy) {
      throw new AuthorizationError(
        `No authentication strategy found for credentials type: ${credentials.type}`
      );
    }

    return await strategy.authenticate(credentials, context);
  }

  /**
   * Get configuration for all strategies
   */
  getStrategiesConfig(): Record<string, any> {
    const config: Record<string, any> = {};

    for (const [name, strategy] of this.strategies) {
      config[name] = strategy.getConfig();
    }

    return config;
  }
}