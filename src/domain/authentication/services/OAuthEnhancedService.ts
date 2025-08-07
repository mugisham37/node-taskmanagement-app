import crypto from 'crypto';
import { User } from '../entities/User';
import { Account } from '../entities/Account';
import { UserId } from '../value-objects/UserId';
import { AccountId } from '../value-objects/AccountId';
import { Email } from '../../shared/value-objects/Email';
import { DomainEvent } from '../../shared/events/DomainEvent';

export interface OAuthProvider {
  id: string;
  name: string;
  clientId: string;
  clientSecret: string;
  authorizationUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  scope: string[];
  redirectUri: string;
}

export interface OAuthState {
  state: string;
  provider: string;
  redirectUri?: string;
  workspaceInvite?: string;
  createdAt: Date;
  expiresAt: Date;
}

export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  tokenType: string;
  scope?: string;
}

export interface OAuthUserInfo {
  id: string;
  email: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  picture?: string;
  emailVerified?: boolean;
  locale?: string;
}

export interface OAuthAuthorizationUrl {
  url: string;
  state: string;
}

export interface OAuthAuthenticationResult {
  success: boolean;
  user?: User;
  account?: Account;
  isNewUser?: boolean;
  requiresEmailVerification?: boolean;
  error?: string;
}

export class OAuthAccountLinkedEvent extends DomainEvent {
  constructor(
    public readonly userId: UserId,
    public readonly provider: string,
    public readonly providerAccountId: string
  ) {
    super('OAuthAccountLinked', {
      userId: userId.value,
      provider,
      providerAccountId,
    });
  }
}

export class OAuthAccountUnlinkedEvent extends DomainEvent {
  constructor(
    public readonly userId: UserId,
    public readonly provider: string,
    public readonly providerAccountId: string
  ) {
    super('OAuthAccountUnlinked', {
      userId: userId.value,
      provider,
      providerAccountId,
    });
  }
}

export class OAuthUserRegisteredEvent extends DomainEvent {
  constructor(
    public readonly userId: UserId,
    public readonly provider: string,
    public readonly email: string
  ) {
    super('OAuthUserRegistered', {
      userId: userId.value,
      provider,
      email,
    });
  }
}

export class OAuthAuthenticationFailedEvent extends DomainEvent {
  constructor(
    public readonly provider: string,
    public readonly error: string,
    public readonly email?: string
  ) {
    super('OAuthAuthenticationFailed', {
      provider,
      error,
      email,
    });
  }
}

/**
 * Enhanced OAuth Service with multiple provider support
 * Handles OAuth flows, account linking, and user provisioning
 */
export class OAuthEnhancedService {
  private readonly providers: Map<string, OAuthProvider> = new Map();

  constructor(
    private readonly userRepository: any,
    private readonly accountRepository: any,
    private readonly oauthStateRepository: any,
    private readonly eventBus: any,
    providers: OAuthProvider[]
  ) {
    // Register OAuth providers
    providers.forEach(provider => {
      this.providers.set(provider.id, provider);
    });
  }

  /**
   * Generate OAuth authorization URL
   */
  async generateAuthorizationUrl(
    providerId: string,
    options: {
      redirectUri?: string;
      workspaceInvite?: string;
      additionalScopes?: string[];
    } = {}
  ): Promise<OAuthAuthorizationUrl> {
    try {
      const provider = this.providers.get(providerId);
      if (!provider) {
        throw new Error(`OAuth provider '${providerId}' not found`);
      }

      // Generate secure state parameter
      const state = crypto.randomBytes(32).toString('base64url');

      // Store state with metadata
      const oauthState: OAuthState = {
        state,
        provider: providerId,
        redirectUri: options.redirectUri,
        workspaceInvite: options.workspaceInvite,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      };

      await this.oauthStateRepository.store(state, oauthState);

      // Build authorization URL
      const authUrl = new URL(provider.authorizationUrl);
      authUrl.searchParams.set('client_id', provider.clientId);
      authUrl.searchParams.set('redirect_uri', provider.redirectUri);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('state', state);

      // Set scopes
      const scopes = [...provider.scope, ...(options.additionalScopes || [])];
      authUrl.searchParams.set('scope', scopes.join(' '));

      // Provider-specific parameters
      if (providerId === 'google') {
        authUrl.searchParams.set('access_type', 'offline');
        authUrl.searchParams.set('prompt', 'consent');
      } else if (providerId === 'microsoft') {
        authUrl.searchParams.set('prompt', 'consent');
      } else if (providerId === 'github') {
        authUrl.searchParams.set('allow_signup', 'true');
      }

      return {
        url: authUrl.toString(),
        state,
      };
    } catch (error) {
      throw new Error(`Authorization URL generation failed: ${error.message}`);
    }
  }

  /**
   * Handle OAuth callback and authenticate user
   */
  async handleCallback(
    providerId: string,
    code: string,
    state: string,
    error?: string
  ): Promise<OAuthAuthenticationResult> {
    try {
      // Handle OAuth error
      if (error) {
        await this.eventBus.publish(
          new OAuthAuthenticationFailedEvent(providerId, error)
        );

        return {
          success: false,
          error: `OAuth error: ${error}`,
        };
      }

      // Validate state parameter
      const oauthState = await this.oauthStateRepository.get(state);
      if (!oauthState || oauthState.provider !== providerId) {
        return {
          success: false,
          error: 'Invalid OAuth state',
        };
      }

      if (oauthState.expiresAt < new Date()) {
        await this.oauthStateRepository.delete(state);
        return {
          success: false,
          error: 'OAuth state expired',
        };
      }

      const provider = this.providers.get(providerId);
      if (!provider) {
        return {
          success: false,
          error: `OAuth provider '${providerId}' not found`,
        };
      }

      // Exchange code for tokens
      const tokens = await this.exchangeCodeForTokens(provider, code);

      // Get user info from provider
      const userInfo = await this.getUserInfo(provider, tokens.accessToken);

      // Find or create user account
      const result = await this.findOrCreateUser(
        provider,
        userInfo,
        tokens,
        oauthState
      );

      // Clean up state
      await this.oauthStateRepository.delete(state);

      return result;
    } catch (error) {
      await this.eventBus.publish(
        new OAuthAuthenticationFailedEvent(providerId, error.message)
      );

      return {
        success: false,
        error: `OAuth authentication failed: ${error.message}`,
      };
    }
  }

  /**
   * Link OAuth account to existing user
   */
  async linkAccount(
    userId: UserId,
    providerId: string,
    code: string,
    state: string
  ): Promise<{ success: boolean; account?: Account; error?: string }> {
    try {
      // Validate state
      const oauthState = await this.oauthStateRepository.get(state);
      if (!oauthState || oauthState.provider !== providerId) {
        return {
          success: false,
          error: 'Invalid OAuth state',
        };
      }

      const provider = this.providers.get(providerId);
      if (!provider) {
        return {
          success: false,
          error: `OAuth provider '${providerId}' not found`,
        };
      }

      // Get user
      const user = await this.userRepository.findById(userId);
      if (!user) {
        return {
          success: false,
          error: 'User not found',
        };
      }

      // Exchange code for tokens
      const tokens = await this.exchangeCodeForTokens(provider, code);

      // Get user info from provider
      const userInfo = await this.getUserInfo(provider, tokens.accessToken);

      // Check if account is already linked to another user
      const existingAccount =
        await this.accountRepository.findByProviderAccount(
          providerId,
          userInfo.id
        );

      if (existingAccount && !existingAccount.userId.equals(userId)) {
        return {
          success: false,
          error: 'This account is already linked to another user',
        };
      }

      // Create or update account
      let account: Account;
      if (existingAccount) {
        // Update existing account
        account = existingAccount;
        account.updateTokens(tokens);
      } else {
        // Create new account
        account = Account.create({
          userId,
          provider: providerId,
          providerAccountId: userInfo.id,
          type: 'oauth',
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: tokens.expiresAt,
          tokenType: tokens.tokenType,
          scope: tokens.scope,
        });

        await this.eventBus.publish(
          new OAuthAccountLinkedEvent(userId, providerId, userInfo.id)
        );
      }

      await this.accountRepository.save(account);

      // Clean up state
      await this.oauthStateRepository.delete(state);

      return {
        success: true,
        account,
      };
    } catch (error) {
      return {
        success: false,
        error: `Account linking failed: ${error.message}`,
      };
    }
  }

  /**
   * Unlink OAuth account from user
   */
  async unlinkAccount(
    userId: UserId,
    providerId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const account = await this.accountRepository.findByUserAndProvider(
        userId,
        providerId
      );

      if (!account) {
        return {
          success: false,
          error: 'Account not found',
        };
      }

      // Check if user has other authentication methods
      const user = await this.userRepository.findById(userId);
      const hasPassword = !!user.passwordHash;
      const otherAccounts = await this.accountRepository.findByUserId(userId);
      const hasOtherOAuthAccounts = otherAccounts.length > 1;

      if (!hasPassword && !hasOtherOAuthAccounts) {
        return {
          success: false,
          error: 'Cannot unlink the only authentication method',
        };
      }

      // Revoke tokens if possible
      await this.revokeTokens(providerId, account.accessToken);

      // Delete account
      await this.accountRepository.delete(account.id);

      // Publish event
      await this.eventBus.publish(
        new OAuthAccountUnlinkedEvent(
          userId,
          providerId,
          account.providerAccountId
        )
      );

      return {
        success: true,
      };
    } catch (error) {
      return {
        success: false,
        error: `Account unlinking failed: ${error.message}`,
      };
    }
  }

  /**
   * Refresh OAuth tokens
   */
  async refreshTokens(
    accountId: AccountId
  ): Promise<{ success: boolean; tokens?: OAuthTokens; error?: string }> {
    try {
      const account = await this.accountRepository.findById(accountId);
      if (!account) {
        return {
          success: false,
          error: 'Account not found',
        };
      }

      if (!account.refreshToken) {
        return {
          success: false,
          error: 'No refresh token available',
        };
      }

      const provider = this.providers.get(account.provider);
      if (!provider) {
        return {
          success: false,
          error: `OAuth provider '${account.provider}' not found`,
        };
      }

      // Refresh tokens
      const newTokens = await this.refreshAccessToken(
        provider,
        account.refreshToken
      );

      // Update account
      account.updateTokens(newTokens);
      await this.accountRepository.save(account);

      return {
        success: true,
        tokens: newTokens,
      };
    } catch (error) {
      return {
        success: false,
        error: `Token refresh failed: ${error.message}`,
      };
    }
  }

  /**
   * Get user's linked OAuth accounts
   */
  async getUserAccounts(userId: UserId): Promise<
    Array<{
      id: string;
      provider: string;
      providerAccountId: string;
      email?: string;
      name?: string;
      picture?: string;
      linkedAt: Date;
    }>
  > {
    try {
      const accounts = await this.accountRepository.findByUserId(userId);

      return accounts.map(account => ({
        id: account.id.value,
        provider: account.provider,
        providerAccountId: account.providerAccountId,
        email: account.email,
        name: account.name,
        picture: account.picture,
        linkedAt: account.createdAt,
      }));
    } catch (error) {
      return [];
    }
  }

  /**
   * Get available OAuth providers
   */
  getAvailableProviders(): Array<{
    id: string;
    name: string;
    scope: string[];
  }> {
    return Array.from(this.providers.values()).map(provider => ({
      id: provider.id,
      name: provider.name,
      scope: provider.scope,
    }));
  }

  // Private helper methods

  private async exchangeCodeForTokens(
    provider: OAuthProvider,
    code: string
  ): Promise<OAuthTokens> {
    const tokenData = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: provider.clientId,
      client_secret: provider.clientSecret,
      code,
      redirect_uri: provider.redirectUri,
    });

    const response = await fetch(provider.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: tokenData,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token exchange failed: ${error}`);
    }

    const tokens = await response.json();

    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: tokens.expires_in
        ? new Date(Date.now() + tokens.expires_in * 1000)
        : undefined,
      tokenType: tokens.token_type || 'Bearer',
      scope: tokens.scope,
    };
  }

  private async getUserInfo(
    provider: OAuthProvider,
    accessToken: string
  ): Promise<OAuthUserInfo> {
    const response = await fetch(provider.userInfoUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`User info fetch failed: ${error}`);
    }

    const userInfo = await response.json();

    // Normalize user info based on provider
    return this.normalizeUserInfo(provider.id, userInfo);
  }

  private normalizeUserInfo(
    providerId: string,
    rawUserInfo: any
  ): OAuthUserInfo {
    switch (providerId) {
      case 'google':
        return {
          id: rawUserInfo.sub,
          email: rawUserInfo.email,
          name: rawUserInfo.name,
          firstName: rawUserInfo.given_name,
          lastName: rawUserInfo.family_name,
          picture: rawUserInfo.picture,
          emailVerified: rawUserInfo.email_verified,
          locale: rawUserInfo.locale,
        };

      case 'github':
        return {
          id: rawUserInfo.id.toString(),
          email: rawUserInfo.email,
          name: rawUserInfo.name,
          picture: rawUserInfo.avatar_url,
          emailVerified: true, // GitHub emails are verified
        };

      case 'microsoft':
        return {
          id: rawUserInfo.id,
          email: rawUserInfo.mail || rawUserInfo.userPrincipalName,
          name: rawUserInfo.displayName,
          firstName: rawUserInfo.givenName,
          lastName: rawUserInfo.surname,
          picture: rawUserInfo.photo,
          emailVerified: true, // Microsoft emails are verified
        };

      default:
        return {
          id: rawUserInfo.id || rawUserInfo.sub,
          email: rawUserInfo.email,
          name: rawUserInfo.name,
          picture: rawUserInfo.picture || rawUserInfo.avatar_url,
          emailVerified: rawUserInfo.email_verified,
        };
    }
  }

  private async findOrCreateUser(
    provider: OAuthProvider,
    userInfo: OAuthUserInfo,
    tokens: OAuthTokens,
    oauthState: OAuthState
  ): Promise<OAuthAuthenticationResult> {
    // Try to find existing account
    let account = await this.accountRepository.findByProviderAccount(
      provider.id,
      userInfo.id
    );

    if (account) {
      // Update tokens
      account.updateTokens(tokens);
      await this.accountRepository.save(account);

      // Get user
      const user = await this.userRepository.findById(account.userId);
      if (!user) {
        throw new Error('User not found for existing account');
      }

      return {
        success: true,
        user,
        account,
        isNewUser: false,
      };
    }

    // Try to find user by email
    if (userInfo.email) {
      const email = Email.create(userInfo.email);
      const existingUser = await this.userRepository.findByEmail(email);

      if (existingUser) {
        // Link account to existing user
        account = Account.create({
          userId: existingUser.id,
          provider: provider.id,
          providerAccountId: userInfo.id,
          type: 'oauth',
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: tokens.expiresAt,
          tokenType: tokens.tokenType,
          scope: tokens.scope,
          email: userInfo.email,
          name: userInfo.name,
          picture: userInfo.picture,
        });

        await this.accountRepository.save(account);

        await this.eventBus.publish(
          new OAuthAccountLinkedEvent(existingUser.id, provider.id, userInfo.id)
        );

        return {
          success: true,
          user: existingUser,
          account,
          isNewUser: false,
        };
      }
    }

    // Create new user
    if (!userInfo.email) {
      return {
        success: false,
        error: 'Email is required for user registration',
      };
    }

    const email = Email.create(userInfo.email);
    const newUser = User.create({
      email,
      emailVerified: userInfo.emailVerified || false,
      name: userInfo.name,
      image: userInfo.picture,
      mfaEnabled: false,
      backupCodes: [],
      failedLoginAttempts: 0,
      riskScore: 0,
      timezone: 'UTC',
      workHours: {
        start: '09:00',
        end: '17:00',
        days: [1, 2, 3, 4, 5],
      },
      taskViewPreferences: {
        defaultView: 'list',
        groupBy: 'status',
      },
      notificationSettings: {
        email: true,
        push: true,
        desktop: true,
      },
      productivitySettings: {
        pomodoroLength: 25,
        breakLength: 5,
      },
      avatarColor: '#3B82F6',
      workspacePreferences: {},
    });

    await this.userRepository.save(newUser);

    // Create OAuth account
    account = Account.create({
      userId: newUser.id,
      provider: provider.id,
      providerAccountId: userInfo.id,
      type: 'oauth',
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
      tokenType: tokens.tokenType,
      scope: tokens.scope,
      email: userInfo.email,
      name: userInfo.name,
      picture: userInfo.picture,
    });

    await this.accountRepository.save(account);

    // Publish events
    await this.eventBus.publish(
      new OAuthUserRegisteredEvent(newUser.id, provider.id, userInfo.email)
    );

    await this.eventBus.publish(
      new OAuthAccountLinkedEvent(newUser.id, provider.id, userInfo.id)
    );

    return {
      success: true,
      user: newUser,
      account,
      isNewUser: true,
      requiresEmailVerification: !userInfo.emailVerified,
    };
  }

  private async refreshAccessToken(
    provider: OAuthProvider,
    refreshToken: string
  ): Promise<OAuthTokens> {
    const tokenData = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: provider.clientId,
      client_secret: provider.clientSecret,
      refresh_token: refreshToken,
    });

    const response = await fetch(provider.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: tokenData,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token refresh failed: ${error}`);
    }

    const tokens = await response.json();

    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || refreshToken, // Some providers don't return new refresh token
      expiresAt: tokens.expires_in
        ? new Date(Date.now() + tokens.expires_in * 1000)
        : undefined,
      tokenType: tokens.token_type || 'Bearer',
      scope: tokens.scope,
    };
  }

  private async revokeTokens(
    providerId: string,
    accessToken: string
  ): Promise<void> {
    try {
      const provider = this.providers.get(providerId);
      if (!provider) {
        return;
      }

      // Provider-specific token revocation
      let revokeUrl: string | undefined;

      switch (providerId) {
        case 'google':
          revokeUrl = `https://oauth2.googleapis.com/revoke?token=${accessToken}`;
          break;
        case 'github':
          // GitHub doesn't have a revoke endpoint, tokens expire naturally
          break;
        case 'microsoft':
          // Microsoft uses different revocation endpoint
          break;
      }

      if (revokeUrl) {
        await fetch(revokeUrl, { method: 'POST' });
      }
    } catch (error) {
      // Token revocation is best effort
      console.warn(`Token revocation failed for ${providerId}:`, error);
    }
  }
}
