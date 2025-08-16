/**
 * OAuth Service
 *
 * Handles OAuth integration with multiple providers (Google, GitHub, etc.)
 * Supports OAuth 2.0 and OpenID Connect flows
 */

import { CacheService } from '@taskmanagement/cache';
import { AuthorizationError, InfrastructureError, LoggingService } from '@taskmanagement/core';
import { ValidationError } from '@taskmanagement/validation';

export interface OAuthProvider {
  name: string;
  clientId: string;
  clientSecret: string;
  authorizationUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  scope: string[];
  redirectUri: string;
  responseType: 'code' | 'token';
  grantType: 'authorization_code' | 'client_credentials';
  pkceEnabled: boolean;
}

export interface OAuthConfig {
  providers: Record<string, OAuthProvider>;
  stateExpiration: number; // in seconds
  nonceExpiration: number; // in seconds
  enablePKCE: boolean;
  defaultScopes: string[];
}

export interface AuthorizationUrlRequest {
  provider: string;
  state?: string;
  nonce?: string;
  scopes?: string[];
  redirectUri?: string;
  codeChallenge?: string;
  codeChallengeMethod?: 'S256' | 'plain';
}

export interface AuthorizationUrlResponse {
  url: string;
  state: string;
  nonce?: string;
  codeVerifier?: string;
}

export interface TokenExchangeRequest {
  provider: string;
  code: string;
  state: string;
  redirectUri?: string;
  codeVerifier?: string;
}

export interface TokenResponse {
  accessToken: string;
  refreshToken?: string;
  tokenType: string;
  expiresIn: number;
  scope: string;
  idToken?: string;
}

export interface UserInfo {
  id: string;
  email: string;
  emailVerified: boolean;
  name: string;
  firstName?: string;
  lastName?: string;
  picture?: string;
  locale?: string;
  provider: string;
  providerUserId: string;
  rawData: Record<string, any>;
}

export interface OAuthState {
  provider: string;
  redirectUri: string;
  originalUrl?: string;
  userId?: string;
  timestamp: number;
  nonce?: string;
  codeVerifier?: string;
}

export interface OAuthTokenData {
  access_token: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
  scope?: string;
  id_token?: string;
}

export interface JWTPayload {
  sub?: string;
  aud?: string;
  exp?: number;
  nbf?: number;
  iat?: number;
  [key: string]: any;
}

export class OAuthService {
  private readonly defaultConfig: Partial<OAuthConfig> = {
    stateExpiration: 600, // 10 minutes
    nonceExpiration: 600, // 10 minutes
    enablePKCE: true,
    defaultScopes: ['openid', 'profile', 'email'],
  };

  constructor(
    private readonly logger: LoggingService,
    private readonly cacheService: CacheService,
    private readonly config: OAuthConfig
  ) {
    this.validateConfig();
  }

  /**
   * Generate authorization URL for OAuth flow
   */
  async generateAuthorizationUrl(
    request: AuthorizationUrlRequest
  ): Promise<AuthorizationUrlResponse> {
    try {
      const provider = this.getProvider(request.provider);
      const state = request.state || this.generateState();
      const nonce = request.nonce || this.generateNonce();

      // Store state for validation
      await this.storeState(state, {
        provider: request.provider,
        redirectUri: request.redirectUri || provider.redirectUri,
        timestamp: Date.now(),
        nonce,
      });

      const params = new URLSearchParams({
        client_id: provider.clientId,
        response_type: provider.responseType,
        redirect_uri: request.redirectUri || provider.redirectUri,
        scope: (request.scopes || provider.scope).join(' '),
        state,
      });

      // Add nonce for OpenID Connect
      if (nonce) {
        params.append('nonce', nonce);
      }

      let codeVerifier: string | undefined;

      // Add PKCE parameters if enabled
      if (provider.pkceEnabled || this.config.enablePKCE) {
        codeVerifier = this.generateCodeVerifier();
        const codeChallenge = await this.generateCodeChallenge(codeVerifier);

        params.append('code_challenge', codeChallenge);
        params.append('code_challenge_method', 'S256');

        // Store code verifier with state
        const stateData = await this.getState(state);
        if (stateData) {
          stateData.codeVerifier = codeVerifier;
          await this.storeState(state, stateData);
        }
      }

      const url = `${provider.authorizationUrl}?${params.toString()}`;

      this.logger.info('OAuth authorization URL generated', {
        provider: request.provider,
        state,
        scopes: request.scopes || provider.scope,
      });

      const result: AuthorizationUrlResponse = {
        url,
        state,
        nonce,
      };

      if (codeVerifier) {
        result.codeVerifier = codeVerifier;
      }

      return result;
    } catch (error) {
      this.logger.error('Failed to generate authorization URL', error as Error, {
        provider: request.provider,
      });
      throw new InfrastructureError(
        `Failed to generate authorization URL: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(request: TokenExchangeRequest): Promise<TokenResponse> {
    try {
      const provider = this.getProvider(request.provider);

      // Validate state
      const stateData = await this.getState(request.state);
      if (!stateData) {
        throw new AuthorizationError('Invalid or expired state parameter');
      }

      if (stateData.provider !== request.provider) {
        throw new AuthorizationError('State provider mismatch');
      }

      // Prepare token request
      const tokenParams = new URLSearchParams({
        grant_type: provider.grantType,
        client_id: provider.clientId,
        client_secret: provider.clientSecret,
        code: request.code,
        redirect_uri: request.redirectUri || stateData.redirectUri,
      });

      // Add PKCE code verifier if available
      if (stateData.codeVerifier) {
        tokenParams.append('code_verifier', stateData.codeVerifier);
      }

      // Make token request
      const response = await fetch(provider.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: tokenParams.toString(),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new AuthorizationError(`Token exchange failed: ${response.status} ${errorData}`);
      }

      const tokenData = (await response.json()) as OAuthTokenData;

      // Clean up state
      await this.removeState(request.state);

      const tokenResponse: TokenResponse = {
        accessToken: tokenData.access_token,
        ...(tokenData.refresh_token && { refreshToken: tokenData.refresh_token }),
        tokenType: tokenData.token_type || 'Bearer',
        expiresIn: tokenData.expires_in || 3600,
        scope: tokenData.scope || provider.scope.join(' '),
        ...(tokenData.id_token && { idToken: tokenData.id_token }),
      };

      this.logger.info('OAuth token exchange successful', {
        provider: request.provider,
        tokenType: tokenResponse.tokenType,
        expiresIn: tokenResponse.expiresIn,
      });

      return tokenResponse;
    } catch (error) {
      this.logger.error('Failed to exchange code for token', error as Error, {
        provider: request.provider,
        state: request.state,
      });

      if (error instanceof AuthorizationError) {
        throw error;
      }

      throw new InfrastructureError(
        `Failed to exchange code for token: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get user information using access token
   */
  async getUserInfo(provider: string, accessToken: string): Promise<UserInfo> {
    try {
      const providerConfig = this.getProvider(provider);

      const response = await fetch(providerConfig.userInfoUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        throw new AuthorizationError(`Failed to fetch user info: ${response.status}`);
      }

      const userData = await response.json();
      const userInfo = this.normalizeUserInfo(provider, userData);

      this.logger.info('OAuth user info retrieved', {
        provider,
        userId: userInfo.id,
        email: userInfo.email,
      });

      return userInfo;
    } catch (error) {
      this.logger.error('Failed to get user info', error as Error, {
        provider,
      });

      if (error instanceof AuthorizationError) {
        throw error;
      }

      throw new InfrastructureError(
        `Failed to get user info: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(provider: string, refreshToken: string): Promise<TokenResponse> {
    try {
      const providerConfig = this.getProvider(provider);

      const tokenParams = new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: providerConfig.clientId,
        client_secret: providerConfig.clientSecret,
        refresh_token: refreshToken,
      });

      const response = await fetch(providerConfig.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: tokenParams.toString(),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new AuthorizationError(`Token refresh failed: ${response.status} ${errorData}`);
      }

      const tokenData = (await response.json()) as OAuthTokenData;

      const tokenResponse: TokenResponse = {
        accessToken: tokenData.access_token,
        tokenType: tokenData.token_type || 'Bearer',
        expiresIn: tokenData.expires_in || 3600,
        scope: tokenData.scope || providerConfig.scope.join(' '),
        ...(tokenData.refresh_token && { refreshToken: tokenData.refresh_token }),
        ...(tokenData.id_token && { idToken: tokenData.id_token }),
      };

      // If no new refresh token was provided, keep the old one
      if (!tokenData.refresh_token && refreshToken) {
        tokenResponse.refreshToken = refreshToken;
      }

      this.logger.info('OAuth token refresh successful', {
        provider,
        tokenType: tokenResponse.tokenType,
        expiresIn: tokenResponse.expiresIn,
      });

      return tokenResponse;
    } catch (error) {
      this.logger.error('Failed to refresh token', error as Error, {
        provider,
      });

      if (error instanceof AuthorizationError) {
        throw error;
      }

      throw new InfrastructureError(
        `Failed to refresh token: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Revoke access token
   */
  async revokeToken(provider: string, token: string): Promise<void> {
    try {
      const providerConfig = this.getProvider(provider);

      // Not all providers support token revocation
      // This is a best-effort implementation
      const revokeUrl = this.getTokenRevokeUrl(provider);

      if (!revokeUrl) {
        this.logger.warn('Token revocation not supported for provider', {
          provider,
        });
        return;
      }

      const response = await fetch(revokeUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${Buffer.from(
            `${providerConfig.clientId}:${providerConfig.clientSecret}`
          ).toString('base64')}`,
        },
        body: new URLSearchParams({
          token,
          token_type_hint: 'access_token',
        }).toString(),
      });

      if (!response.ok) {
        this.logger.warn('Token revocation failed', {
          provider,
          status: response.status,
        });
      } else {
        this.logger.info('OAuth token revoked successfully', {
          provider,
        });
      }
    } catch (error) {
      this.logger.error('Failed to revoke token', error as Error, {
        provider,
      });
      // Don't throw error for revocation failures
    }
  }

  /**
   * Validate ID token (for OpenID Connect)
   */
  async validateIdToken(provider: string, idToken: string): Promise<any> {
    try {
      // This is a simplified implementation
      // In production, you should properly validate the JWT signature
      // using the provider's public keys

      const parts = idToken.split('.');
      if (parts.length !== 3) {
        throw ValidationError.forField('idToken', 'Invalid ID token format', idToken);
      }

      if (!parts[1]) {
        throw ValidationError.forField('idToken', 'Missing payload in ID token', idToken);
      }

      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString()) as JWTPayload;

      // Basic validation
      const now = Math.floor(Date.now() / 1000);

      if (payload.exp && payload.exp < now) {
        throw ValidationError.forField('idToken', 'ID token has expired', payload.exp);
      }

      if (payload.nbf && payload.nbf > now) {
        throw ValidationError.forField('idToken', 'ID token not yet valid', payload.nbf);
      }

      const providerConfig = this.getProvider(provider);
      if (payload.aud !== providerConfig.clientId) {
        throw ValidationError.forField('idToken', 'ID token audience mismatch', payload.aud);
      }

      this.logger.info('ID token validated successfully', {
        provider,
        subject: payload.sub,
        audience: payload.aud,
      });

      return payload;
    } catch (error) {
      this.logger.error('Failed to validate ID token', error as Error, {
        provider,
      });

      if (error instanceof ValidationError) {
        throw error;
      }

      throw new InfrastructureError(
        `Failed to validate ID token: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  // Private helper methods

  private validateConfig(): void {
    if (!this.config.providers || Object.keys(this.config.providers).length === 0) {
      throw new InfrastructureError('No OAuth providers configured');
    }

    for (const [name, provider] of Object.entries(this.config.providers)) {
      if (!provider.clientId || !provider.clientSecret) {
        throw new InfrastructureError(`OAuth provider ${name} missing client credentials`);
      }

      if (!provider.authorizationUrl || !provider.tokenUrl) {
        throw new InfrastructureError(`OAuth provider ${name} missing required URLs`);
      }
    }
  }

  private getProvider(name: string): OAuthProvider {
    const provider = this.config.providers[name];
    if (!provider) {
      throw ValidationError.forField('provider', `Unknown OAuth provider: ${name}`, name);
    }
    return provider;
  }

  private generateState(): string {
    return Buffer.from(`${Date.now()}_${Math.random().toString(36).substring(2)}`).toString(
      'base64url'
    );
  }

  private generateNonce(): string {
    return Buffer.from(`${Date.now()}_${Math.random().toString(36).substring(2)}`).toString(
      'base64url'
    );
  }

  private generateCodeVerifier(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Buffer.from(array).toString('base64url');
  }

  private async generateCodeChallenge(codeVerifier: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(codeVerifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return Buffer.from(digest).toString('base64url');
  }

  private async storeState(state: string, data: OAuthState): Promise<void> {
    const key = `oauth-state:${state}`;
    const ttl = this.config.stateExpiration || this.defaultConfig.stateExpiration!;
    await this.cacheService.set(key, data, { ttl });
  }

  private async getState(state: string): Promise<OAuthState | null> {
    const key = `oauth-state:${state}`;
    return await this.cacheService.get<OAuthState>(key);
  }

  private async removeState(state: string): Promise<void> {
    const key = `oauth-state:${state}`;
    await this.cacheService.del(key);
  }

  private normalizeUserInfo(provider: string, userData: any): UserInfo {
    // Normalize user data based on provider
    switch (provider) {
      case 'google':
        return {
          id: userData.sub || userData.id,
          email: userData.email,
          emailVerified: userData.email_verified || false,
          name: userData.name,
          firstName: userData.given_name,
          lastName: userData.family_name,
          picture: userData.picture,
          locale: userData.locale,
          provider,
          providerUserId: userData.sub || userData.id,
          rawData: userData,
        };

      case 'github':
        return {
          id: userData.id.toString(),
          email: userData.email,
          emailVerified: true, // GitHub emails are verified
          name: userData.name || userData.login,
          firstName: userData.name?.split(' ')[0],
          lastName: userData.name?.split(' ').slice(1).join(' '),
          picture: userData.avatar_url,
          locale: userData.location,
          provider,
          providerUserId: userData.id.toString(),
          rawData: userData,
        };

      case 'microsoft':
        return {
          id: userData.id,
          email: userData.mail || userData.userPrincipalName,
          emailVerified: true,
          name: userData.displayName,
          firstName: userData.givenName,
          lastName: userData.surname,
          picture: userData.photo,
          locale: userData.preferredLanguage,
          provider,
          providerUserId: userData.id,
          rawData: userData,
        };

      default:
        // Generic normalization
        return {
          id: userData.id || userData.sub,
          email: userData.email,
          emailVerified: userData.email_verified || false,
          name: userData.name || userData.displayName,
          firstName: userData.given_name || userData.firstName,
          lastName: userData.family_name || userData.lastName,
          picture: userData.picture || userData.avatar_url,
          locale: userData.locale,
          provider,
          providerUserId: userData.id || userData.sub,
          rawData: userData,
        };
    }
  }

  private getTokenRevokeUrl(provider: string): string | null {
    // Provider-specific revocation URLs
    const revokeUrls: Record<string, string> = {
      google: 'https://oauth2.googleapis.com/revoke',
      github: 'https://api.github.com/applications/{client_id}/grant',
      microsoft: 'https://login.microsoftonline.com/common/oauth2/v2.0/logout',
    };

    return revokeUrls[provider] || null;
  }
}

// Predefined OAuth provider configurations
export const OAUTH_PROVIDERS = {
  google: {
    authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
    scope: ['openid', 'profile', 'email'],
    responseType: 'code' as const,
    grantType: 'authorization_code' as const,
    pkceEnabled: true,
  },

  github: {
    authorizationUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    userInfoUrl: 'https://api.github.com/user',
    scope: ['user:email'],
    responseType: 'code' as const,
    grantType: 'authorization_code' as const,
    pkceEnabled: false,
  },

  microsoft: {
    authorizationUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    userInfoUrl: 'https://graph.microsoft.com/v1.0/me',
    scope: ['openid', 'profile', 'email'],
    responseType: 'code' as const,
    grantType: 'authorization_code' as const,
    pkceEnabled: true,
  },
} as const;
