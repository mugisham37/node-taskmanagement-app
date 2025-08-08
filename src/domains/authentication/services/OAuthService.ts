import { User } from '../entities/User';
import { Account, OAuthProvider } from '../entities/Account';
import { UserId } from '../value-objects/UserId';
import { Email } from '../value-objects/Email';
import { DomainEvent } from '../../shared/events/DomainEvent';

export interface OAuthProfile {
  id: string;
  email: string;
  name?: string;
  image?: string;
  emailVerified?: boolean;
}

export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  tokenType?: string;
  scope?: string;
  idToken?: string;
}

export interface OAuthAuthorizationUrl {
  url: string;
  state: string;
  codeVerifier?: string; // For PKCE
}

export interface OAuthCallbackResult {
  user: User;
  account: Account;
  isNewUser: boolean;
  tokens: OAuthTokens;
}

export interface ProviderConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
  authorizationUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  usePKCE?: boolean;
}

export class OAuthAccountConnectedEvent extends DomainEvent {
  constructor(
    public readonly userId: UserId,
    public readonly provider: OAuthProvider,
    public readonly isNewUser: boolean
  ) {
    super('OAuthAccountConnected', {
      userId: userId.value,
      provider,
      isNewUser,
    });
  }
}

export class OAuthAccountDisconnectedEvent extends DomainEvent {
  constructor(
    public readonly userId: UserId,
    public readonly provider: OAuthProvider
  ) {
    super('OAuthAccountDisconnected', {
      userId: userId.value,
      provider,
    });
  }
}

export class OAuthTokenRefreshedEvent extends DomainEvent {
  constructor(
    public readonly userId: UserId,
    public readonly provider: OAuthProvider,
    public readonly expiresAt?: number
  ) {
    super('OAuthTokenRefreshed', {
      userId: userId.value,
      provider,
      expiresAt,
    });
  }
}

/**
 * OAuth Service with Google, GitHub, and Microsoft provider integration
 * Handles OAuth flows, token management, and account linking
 */
export class OAuthService {
  private readonly providerConfigs: Map<OAuthProvider, ProviderConfig>;

  constructor(
    private readonly userRepository: any,
    private readonly accountRepository: any,
    private readonly httpClient: any,
    private readonly eventBus: any,
    configs: Record<OAuthProvider, ProviderConfig>
  ) {
    this.providerConfigs = new Map(
      Object.entries(configs) as [OAuthProvider, ProviderConfig][]
    );
  }

  /**
   * Generate OAuth authorization URL
   */
  async generateAuthorizationUrl(
    provider: OAuthProvider,
    state?: string
  ): Promise<OAuthAuthorizationUrl> {
    const config = this.getProviderConfig(provider);
    const generatedState = state || this.generateState();

    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      scope: config.scopes.join(' '),
      response_type: 'code',
      state: generatedState,
    });

    let codeVerifier: string | undefined;

    // Add PKCE for providers that support it
    if (config.usePKCE) {
      codeVerifier = this.generateCodeVerifier();
      const codeChallenge = await this.generateCodeChallenge(codeVerifier);
      params.append('code_challenge', codeChallenge);
      params.append('code_challenge_method', 'S256');
    }

    // Provider-specific parameters
    if (provider === 'google') {
      params.append('access_type', 'offline');
      params.append('prompt', 'consent');
    } else if (provider === 'microsoft') {
      params.append('response_mode', 'query');
    }

    const url = `${config.authorizationUrl}?${params.toString()}`;

    return {
      url,
      state: generatedState,
      codeVerifier,
    };
  }

  /**
   * Handle OAuth callback and exchange code for tokens
   */
  async handleCallback(
    provider: OAuthProvider,
    code: string,
    state: string,
    codeVerifier?: string
  ): Promise<OAuthCallbackResult> {
    try {
      // Exchange code for tokens
      const tokens = await this.exchangeCodeForTokens(
        provider,
        code,
        codeVerifier
      );

      // Get user profile from provider
      const profile = await this.getUserProfile(provider, tokens.accessToken);

      // Find or create user
      const { user, isNewUser } = await this.findOrCreateUser(profile);

      // Find or create account
      const account = await this.findOrCreateAccount(
        user,
        provider,
        profile.id,
        tokens
      );

      // Publish event
      await this.eventBus.publish(
        new OAuthAccountConnectedEvent(user.id, provider, isNewUser)
      );

      return {
        user,
        account,
        isNewUser,
        tokens,
      };
    } catch (error) {
      throw new Error(`OAuth callback failed: ${error.message}`);
    }
  }

  /**
   * Refresh OAuth tokens
   */
  async refreshTokens(
    provider: OAuthProvider,
    refreshToken: string
  ): Promise<OAuthTokens> {
    try {
      const config = this.getProviderConfig(provider);

      const params = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: config.clientId,
        client_secret: config.clientSecret,
      });

      const response = await this.httpClient.post(config.tokenUrl, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      if (!response.ok) {
        throw new Error(`Token refresh failed: ${response.statusText}`);
      }

      const data = await response.json();

      const tokens: OAuthTokens = {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || refreshToken, // Some providers don't return new refresh token
        expiresAt: data.expires_in
          ? Math.floor(Date.now() / 1000) + data.expires_in
          : undefined,
        tokenType: data.token_type,
        scope: data.scope,
        idToken: data.id_token,
      };

      return tokens;
    } catch (error) {
      throw new Error(`Token refresh failed: ${error.message}`);
    }
  }

  /**
   * Revoke OAuth tokens
   */
  async revokeTokens(
    provider: OAuthProvider,
    accessToken: string
  ): Promise<void> {
    try {
      const revokeUrls = {
        google: 'https://oauth2.googleapis.com/revoke',
        github: 'https://api.github.com/applications/{client_id}/token',
        microsoft:
          'https://login.microsoftonline.com/common/oauth2/v2.0/logout',
        apple: 'https://appleid.apple.com/auth/revoke',
        slack: 'https://slack.com/api/auth.revoke',
        discord: 'https://discord.com/api/oauth2/token/revoke',
        linkedin: 'https://www.linkedin.com/oauth/v2/revoke',
      };

      const revokeUrl = revokeUrls[provider];
      if (!revokeUrl) {
        return; // Provider doesn't support token revocation
      }

      if (provider === 'google') {
        await this.httpClient.post(revokeUrl, null, {
          params: { token: accessToken },
        });
      } else if (provider === 'github') {
        const config = this.getProviderConfig(provider);
        await this.httpClient.delete(
          revokeUrl.replace('{client_id}', config.clientId),
          {
            headers: {
              Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`,
            },
            data: { access_token: accessToken },
          }
        );
      }
      // Add other provider-specific revocation logic as needed
    } catch (error) {
      // Log error but don't throw - revocation is best effort
      console.error(`Token revocation failed for ${provider}:`, error);
    }
  }

  /**
   * Get user's connected accounts
   */
  async getUserAccounts(userId: UserId): Promise<Account[]> {
    return this.accountRepository.findByUserId(userId);
  }

  /**
   * Disconnect OAuth account
   */
  async disconnectAccount(
    userId: UserId,
    provider: OAuthProvider
  ): Promise<void> {
    try {
      const account = await this.accountRepository.findByUserIdAndProvider(
        userId,
        provider
      );
      if (!account) {
        throw new Error('Account not found');
      }

      // Revoke tokens
      if (account.accessToken) {
        await this.revokeTokens(provider, account.accessToken);
      }

      // Delete account
      account.disconnect();
      await this.accountRepository.delete(account.id);

      await this.eventBus.publish(
        new OAuthAccountDisconnectedEvent(userId, provider)
      );
    } catch (error) {
      throw new Error(`Account disconnection failed: ${error.message}`);
    }
  }

  /**
   * Check if account tokens need refresh
   */
  async checkAndRefreshTokens(account: Account): Promise<Account> {
    if (!account.isTokenExpired() || !account.canRefreshToken()) {
      return account;
    }

    try {
      const provider = account.provider as OAuthProvider;
      const newTokens = await this.refreshTokens(
        provider,
        account.refreshToken!
      );

      account.updateTokens(newTokens);
      await this.accountRepository.save(account);

      await this.eventBus.publish(
        new OAuthTokenRefreshedEvent(
          account.userId,
          provider,
          newTokens.expiresAt
        )
      );

      return account;
    } catch (error) {
      throw new Error(`Token refresh failed: ${error.message}`);
    }
  }

  /**
   * Get calendar access token for supported providers
   */
  async getCalendarAccessToken(
    userId: UserId,
    provider: OAuthProvider
  ): Promise<string | null> {
    if (!['google', 'microsoft'].includes(provider)) {
      return null;
    }

    const account = await this.accountRepository.findByUserIdAndProvider(
      userId,
      provider
    );
    if (!account || !account.hasCalendarPermissions()) {
      return null;
    }

    // Refresh tokens if needed
    const refreshedAccount = await this.checkAndRefreshTokens(account);
    return refreshedAccount.accessToken || null;
  }

  // Private helper methods

  private getProviderConfig(provider: OAuthProvider): ProviderConfig {
    const config = this.providerConfigs.get(provider);
    if (!config) {
      throw new Error(`Provider ${provider} not configured`);
    }
    return config;
  }

  private async exchangeCodeForTokens(
    provider: OAuthProvider,
    code: string,
    codeVerifier?: string
  ): Promise<OAuthTokens> {
    const config = this.getProviderConfig(provider);

    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: config.redirectUri,
      client_id: config.clientId,
      client_secret: config.clientSecret,
    });

    if (codeVerifier) {
      params.append('code_verifier', codeVerifier);
    }

    const response = await this.httpClient.post(config.tokenUrl, params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    if (!response.ok) {
      throw new Error(`Token exchange failed: ${response.statusText}`);
    }

    const data = await response.json();

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_in
        ? Math.floor(Date.now() / 1000) + data.expires_in
        : undefined,
      tokenType: data.token_type,
      scope: data.scope,
      idToken: data.id_token,
    };
  }

  private async getUserProfile(
    provider: OAuthProvider,
    accessToken: string
  ): Promise<OAuthProfile> {
    const config = this.getProviderConfig(provider);

    const response = await this.httpClient.get(config.userInfoUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`User profile fetch failed: ${response.statusText}`);
    }

    const data = await response.json();

    // Normalize profile data based on provider
    switch (provider) {
      case 'google':
        return {
          id: data.sub,
          email: data.email,
          name: data.name,
          image: data.picture,
          emailVerified: data.email_verified,
        };

      case 'github':
        return {
          id: data.id.toString(),
          email: data.email,
          name: data.name,
          image: data.avatar_url,
          emailVerified: true, // GitHub emails are considered verified
        };

      case 'microsoft':
        return {
          id: data.id,
          email: data.mail || data.userPrincipalName,
          name: data.displayName,
          image: data.photo,
          emailVerified: true,
        };

      case 'apple':
        return {
          id: data.sub,
          email: data.email,
          name: data.name
            ? `${data.name.firstName} ${data.name.lastName}`
            : undefined,
          emailVerified: data.email_verified === 'true',
        };

      case 'slack':
        return {
          id: data.user.id,
          email: data.user.email,
          name: data.user.name,
          image: data.user.image_192,
          emailVerified: true,
        };

      case 'discord':
        return {
          id: data.id,
          email: data.email,
          name: data.username,
          image: data.avatar
            ? `https://cdn.discordapp.com/avatars/${data.id}/${data.avatar}.png`
            : undefined,
          emailVerified: data.verified,
        };

      case 'linkedin':
        return {
          id: data.id,
          email: data.emailAddress,
          name: `${data.firstName} ${data.lastName}`,
          image: data.pictureUrl,
          emailVerified: true,
        };

      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }

  private async findOrCreateUser(
    profile: OAuthProfile
  ): Promise<{ user: User; isNewUser: boolean }> {
    const email = Email.create(profile.email);
    let user = await this.userRepository.findByEmail(email);

    if (user) {
      return { user, isNewUser: false };
    }

    // Create new user
    user = User.create({
      email,
      emailVerified: profile.emailVerified ? new Date() : undefined,
      name: profile.name,
      image: profile.image,
      mfaEnabled: false,
      totpSecret: undefined,
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

    await this.userRepository.save(user);
    return { user, isNewUser: true };
  }

  private async findOrCreateAccount(
    user: User,
    provider: OAuthProvider,
    providerAccountId: string,
    tokens: OAuthTokens
  ): Promise<Account> {
    let account = await this.accountRepository.findByProviderAndAccountId(
      provider,
      providerAccountId
    );

    if (account) {
      // Update existing account tokens
      account.updateTokens(tokens);
      await this.accountRepository.save(account);
      return account;
    }

    // Create new account
    account = Account.create({
      userId: user.id,
      type: 'oauth',
      provider,
      providerAccountId,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
      tokenType: tokens.tokenType,
      scope: tokens.scope,
      idToken: tokens.idToken,
    });

    await this.accountRepository.save(account);
    return account;
  }

  private generateState(): string {
    return (
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15)
    );
  }

  private generateCodeVerifier(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Buffer.from(array).toString('base64url');
  }

  private async generateCodeChallenge(verifier: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return Buffer.from(digest).toString('base64url');
  }
}
