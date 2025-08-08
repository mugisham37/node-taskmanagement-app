import { BaseEntity } from '../../shared/entities/BaseEntity';
import { AccountId } from '../value-objects/AccountId';
import { UserId } from '../value-objects/UserId';
import { DomainEvent } from '../../shared/events/DomainEvent';

export type AccountType = 'oauth' | 'email' | 'credentials';
export type OAuthProvider =
  | 'google'
  | 'github'
  | 'microsoft'
  | 'apple'
  | 'slack'
  | 'discord'
  | 'linkedin';

export interface AccountProps {
  id: AccountId;
  userId: UserId;
  type: AccountType;
  provider: string;
  providerAccountId: string;
  refreshToken?: string;
  accessToken?: string;
  expiresAt?: number;
  tokenType?: string;
  scope?: string;
  idToken?: string;
  sessionState?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class AccountConnectedEvent extends DomainEvent {
  constructor(
    public readonly accountId: AccountId,
    public readonly userId: UserId,
    public readonly provider: string
  ) {
    super('AccountConnected', {
      accountId: accountId.value,
      userId: userId.value,
      provider,
    });
  }
}

export class AccountDisconnectedEvent extends DomainEvent {
  constructor(
    public readonly accountId: AccountId,
    public readonly userId: UserId,
    public readonly provider: string
  ) {
    super('AccountDisconnected', {
      accountId: accountId.value,
      userId: userId.value,
      provider,
    });
  }
}

export class AccountTokenRefreshedEvent extends DomainEvent {
  constructor(
    public readonly accountId: AccountId,
    public readonly provider: string,
    public readonly expiresAt?: number
  ) {
    super('AccountTokenRefreshed', {
      accountId: accountId.value,
      provider,
      expiresAt,
    });
  }
}

export class Account extends BaseEntity<AccountProps> {
  private constructor(props: AccountProps) {
    super(props);
  }

  public static create(
    props: Omit<AccountProps, 'id' | 'createdAt' | 'updatedAt'>
  ): Account {
    const account = new Account({
      ...props,
      id: AccountId.generate(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    account.addDomainEvent(
      new AccountConnectedEvent(account.id, account.userId, account.provider)
    );

    return account;
  }

  public static fromPersistence(props: AccountProps): Account {
    return new Account(props);
  }

  // Getters
  get id(): AccountId {
    return this.props.id;
  }

  get userId(): UserId {
    return this.props.userId;
  }

  get type(): AccountType {
    return this.props.type;
  }

  get provider(): string {
    return this.props.provider;
  }

  get providerAccountId(): string {
    return this.props.providerAccountId;
  }

  get refreshToken(): string | undefined {
    return this.props.refreshToken;
  }

  get accessToken(): string | undefined {
    return this.props.accessToken;
  }

  get expiresAt(): number | undefined {
    return this.props.expiresAt;
  }

  get tokenType(): string | undefined {
    return this.props.tokenType;
  }

  get scope(): string | undefined {
    return this.props.scope;
  }

  get idToken(): string | undefined {
    return this.props.idToken;
  }

  get sessionState(): string | undefined {
    return this.props.sessionState;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  // Business methods
  public isOAuthAccount(): boolean {
    return this.props.type === 'oauth';
  }

  public isTokenExpired(): boolean {
    if (!this.props.expiresAt) {
      return false;
    }
    return this.props.expiresAt * 1000 < Date.now();
  }

  public hasValidToken(): boolean {
    return !!this.props.accessToken && !this.isTokenExpired();
  }

  public updateTokens(tokens: {
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: number;
    tokenType?: string;
    scope?: string;
    idToken?: string;
  }): void {
    if (tokens.accessToken !== undefined) {
      this.props.accessToken = tokens.accessToken;
    }
    if (tokens.refreshToken !== undefined) {
      this.props.refreshToken = tokens.refreshToken;
    }
    if (tokens.expiresAt !== undefined) {
      this.props.expiresAt = tokens.expiresAt;
    }
    if (tokens.tokenType !== undefined) {
      this.props.tokenType = tokens.tokenType;
    }
    if (tokens.scope !== undefined) {
      this.props.scope = tokens.scope;
    }
    if (tokens.idToken !== undefined) {
      this.props.idToken = tokens.idToken;
    }

    this.props.updatedAt = new Date();

    this.addDomainEvent(
      new AccountTokenRefreshedEvent(
        this.id,
        this.provider,
        this.props.expiresAt
      )
    );
  }

  public refreshTokens(tokens: {
    accessToken: string;
    refreshToken?: string;
    expiresAt?: number;
  }): void {
    this.updateTokens(tokens);
  }

  public disconnect(): void {
    this.addDomainEvent(
      new AccountDisconnectedEvent(this.id, this.userId, this.provider)
    );
  }

  public getTokenInfo(): {
    hasAccessToken: boolean;
    hasRefreshToken: boolean;
    isExpired: boolean;
    expiresAt?: Date;
    scope?: string;
  } {
    return {
      hasAccessToken: !!this.props.accessToken,
      hasRefreshToken: !!this.props.refreshToken,
      isExpired: this.isTokenExpired(),
      expiresAt: this.props.expiresAt
        ? new Date(this.props.expiresAt * 1000)
        : undefined,
      scope: this.props.scope,
    };
  }

  public isProvider(provider: string): boolean {
    return this.props.provider === provider;
  }

  public isSameProviderAccount(providerAccountId: string): boolean {
    return this.props.providerAccountId === providerAccountId;
  }

  public canRefreshToken(): boolean {
    return !!this.props.refreshToken && this.isOAuthAccount();
  }

  public getProviderInfo(): {
    provider: string;
    providerAccountId: string;
    type: AccountType;
  } {
    return {
      provider: this.props.provider,
      providerAccountId: this.props.providerAccountId,
      type: this.props.type,
    };
  }

  public static isValidProvider(provider: string): provider is OAuthProvider {
    return [
      'google',
      'github',
      'microsoft',
      'apple',
      'slack',
      'discord',
      'linkedin',
    ].includes(provider);
  }

  public static getSupportedProviders(): OAuthProvider[] {
    return [
      'google',
      'github',
      'microsoft',
      'apple',
      'slack',
      'discord',
      'linkedin',
    ];
  }

  /**
   * Get provider-specific configuration
   */
  public static getProviderConfig(provider: OAuthProvider): {
    name: string;
    scopes: string[];
    supportsRefresh: boolean;
    requiresEmailVerification: boolean;
  } {
    const configs = {
      google: {
        name: 'Google',
        scopes: [
          'openid',
          'email',
          'profile',
          'https://www.googleapis.com/auth/calendar',
        ],
        supportsRefresh: true,
        requiresEmailVerification: false,
      },
      github: {
        name: 'GitHub',
        scopes: ['user:email', 'read:user'],
        supportsRefresh: true,
        requiresEmailVerification: false,
      },
      microsoft: {
        name: 'Microsoft',
        scopes: [
          'openid',
          'email',
          'profile',
          'https://graph.microsoft.com/calendars.read',
        ],
        supportsRefresh: true,
        requiresEmailVerification: false,
      },
      apple: {
        name: 'Apple',
        scopes: ['name', 'email'],
        supportsRefresh: true,
        requiresEmailVerification: false,
      },
      slack: {
        name: 'Slack',
        scopes: ['identity.basic', 'identity.email'],
        supportsRefresh: true,
        requiresEmailVerification: false,
      },
      discord: {
        name: 'Discord',
        scopes: ['identify', 'email'],
        supportsRefresh: true,
        requiresEmailVerification: false,
      },
      linkedin: {
        name: 'LinkedIn',
        scopes: ['r_liteprofile', 'r_emailaddress'],
        supportsRefresh: true,
        requiresEmailVerification: false,
      },
    };

    return configs[provider];
  }

  /**
   * Check if provider supports calendar integration
   */
  public supportsCalendarIntegration(): boolean {
    return ['google', 'microsoft'].includes(this.provider);
  }

  /**
   * Get calendar-specific scopes for the provider
   */
  public getCalendarScopes(): string[] {
    if (this.provider === 'google') {
      return ['https://www.googleapis.com/auth/calendar'];
    }
    if (this.provider === 'microsoft') {
      return [
        'https://graph.microsoft.com/calendars.read',
        'https://graph.microsoft.com/calendars.readwrite',
      ];
    }
    return [];
  }

  /**
   * Check if account has calendar permissions
   */
  public hasCalendarPermissions(): boolean {
    if (!this.supportsCalendarIntegration() || !this.scope) {
      return false;
    }

    const calendarScopes = this.getCalendarScopes();
    return calendarScopes.some(scope => this.scope!.includes(scope));
  }
}
