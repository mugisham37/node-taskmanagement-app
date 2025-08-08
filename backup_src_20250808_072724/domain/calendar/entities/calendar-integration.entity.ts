import { BaseEntity } from '../../shared/entities/base.entity';
import { CalendarIntegrationId } from '../value-objects/calendar-integration-id.vo';
import { UserId } from '../../shared/value-objects/user-id.vo';
import { CalendarProvider } from '../value-objects/calendar-provider.vo';
import { CalendarName } from '../value-objects/calendar-name.vo';
import { AccessToken } from '../value-objects/access-token.vo';
import { RefreshToken } from '../value-objects/refresh-token.vo';
import { DomainEvent } from '../../shared/events/domain-event';
import { CalendarIntegrationCreatedEvent } from '../events/calendar-integration-created.event';
import { CalendarIntegrationUpdatedEvent } from '../events/calendar-integration-updated.event';
import { CalendarIntegrationDeletedEvent } from '../events/calendar-integration-deleted.event';

export enum SyncDirection {
  IMPORT = 'import',
  EXPORT = 'export',
  BOTH = 'both',
}

export interface CalendarIntegrationSettings {
  syncDirection: SyncDirection;
  syncTasks: boolean;
  syncMeetings: boolean;
  syncDeadlines: boolean;
  defaultReminders: number[];
}

export interface CalendarIntegrationProps {
  id: CalendarIntegrationId;
  userId: UserId;
  provider: CalendarProvider;
  providerAccountId: string;
  calendarId: string;
  calendarName: CalendarName;
  accessToken: AccessToken;
  refreshToken?: RefreshToken;
  tokenExpiry?: Date;
  syncEnabled: boolean;
  lastSyncedAt?: Date;
  syncErrors: string[];
  settings: CalendarIntegrationSettings;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCalendarIntegrationProps {
  userId: string;
  provider: string;
  providerAccountId: string;
  calendarId: string;
  calendarName: string;
  accessToken: string;
  refreshToken?: string;
  tokenExpiry?: Date;
  syncEnabled?: boolean;
  settings?: Partial<CalendarIntegrationSettings>;
}

export interface UpdateCalendarIntegrationProps {
  calendarName?: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiry?: Date;
  syncEnabled?: boolean;
  lastSyncedAt?: Date;
  syncErrors?: string[];
  settings?: Partial<CalendarIntegrationSettings>;
}

export class CalendarIntegration extends BaseEntity<CalendarIntegrationProps> {
  private constructor(props: CalendarIntegrationProps) {
    super(props, props.id.value);
  }

  public static create(
    props: CreateCalendarIntegrationProps
  ): CalendarIntegration {
    const id = CalendarIntegrationId.create();
    const userId = UserId.create(props.userId);
    const provider = CalendarProvider.create(props.provider);
    const calendarName = CalendarName.create(props.calendarName);
    const accessToken = AccessToken.create(props.accessToken);
    const refreshToken = props.refreshToken
      ? RefreshToken.create(props.refreshToken)
      : undefined;

    // Default settings
    const defaultSettings: CalendarIntegrationSettings = {
      syncDirection: SyncDirection.BOTH,
      syncTasks: true,
      syncMeetings: true,
      syncDeadlines: true,
      defaultReminders: [30],
    };

    const settings = { ...defaultSettings, ...props.settings };

    const now = new Date();
    const calendarIntegration = new CalendarIntegration({
      id,
      userId,
      provider,
      providerAccountId: props.providerAccountId,
      calendarId: props.calendarId,
      calendarName,
      accessToken,
      refreshToken,
      tokenExpiry: props.tokenExpiry,
      syncEnabled: props.syncEnabled !== undefined ? props.syncEnabled : true,
      lastSyncedAt: undefined,
      syncErrors: [],
      settings,
      createdAt: now,
      updatedAt: now,
    });

    // Add domain event
    calendarIntegration.addDomainEvent(
      new CalendarIntegrationCreatedEvent(calendarIntegration)
    );

    return calendarIntegration;
  }

  public static reconstitute(
    props: CalendarIntegrationProps
  ): CalendarIntegration {
    return new CalendarIntegration(props);
  }

  public update(props: UpdateCalendarIntegrationProps): void {
    const updates: Partial<CalendarIntegrationProps> = {};

    if (props.calendarName !== undefined) {
      updates.calendarName = CalendarName.create(props.calendarName);
    }

    if (props.accessToken !== undefined) {
      updates.accessToken = AccessToken.create(props.accessToken);
    }

    if (props.refreshToken !== undefined) {
      updates.refreshToken = props.refreshToken
        ? RefreshToken.create(props.refreshToken)
        : undefined;
    }

    if (props.tokenExpiry !== undefined) {
      updates.tokenExpiry = props.tokenExpiry;
    }

    if (props.syncEnabled !== undefined) {
      updates.syncEnabled = props.syncEnabled;
    }

    if (props.lastSyncedAt !== undefined) {
      updates.lastSyncedAt = props.lastSyncedAt;
    }

    if (props.syncErrors !== undefined) {
      updates.syncErrors = [...props.syncErrors];
    }

    if (props.settings !== undefined) {
      updates.settings = { ...this.props.settings, ...props.settings };
    }

    // Apply updates
    Object.assign(this.props, updates, { updatedAt: new Date() });

    // Add domain event
    this.addDomainEvent(
      new CalendarIntegrationUpdatedEvent(this, Object.keys(updates))
    );
  }

  public updateTokens(
    accessToken: string,
    refreshToken?: string,
    tokenExpiry?: Date
  ): void {
    this.props.accessToken = AccessToken.create(accessToken);
    if (refreshToken) {
      this.props.refreshToken = RefreshToken.create(refreshToken);
    }
    if (tokenExpiry) {
      this.props.tokenExpiry = tokenExpiry;
    }
    this.props.updatedAt = new Date();

    // Clear any token-related sync errors
    this.props.syncErrors = this.props.syncErrors.filter(
      error =>
        !error.toLowerCase().includes('token') &&
        !error.toLowerCase().includes('auth')
    );
  }

  public recordSyncSuccess(): void {
    this.props.lastSyncedAt = new Date();
    this.props.syncErrors = [];
    this.props.updatedAt = new Date();
  }

  public recordSyncError(error: string): void {
    this.props.syncErrors.push(`${new Date().toISOString()}: ${error}`);

    // Keep only the last 10 errors
    if (this.props.syncErrors.length > 10) {
      this.props.syncErrors = this.props.syncErrors.slice(-10);
    }

    this.props.updatedAt = new Date();
  }

  public isTokenExpired(): boolean {
    if (!this.props.tokenExpiry) {
      return false;
    }

    // Consider token expired if it expires within the next 5 minutes
    const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);
    return this.props.tokenExpiry <= fiveMinutesFromNow;
  }

  public needsSync(maxAge: number = 60 * 60 * 1000): boolean {
    // Default 1 hour
    if (!this.props.syncEnabled) {
      return false;
    }

    if (!this.props.lastSyncedAt) {
      return true;
    }

    const timeSinceLastSync = Date.now() - this.props.lastSyncedAt.getTime();
    return timeSinceLastSync > maxAge;
  }

  public hasRecentSyncErrors(): boolean {
    if (this.props.syncErrors.length === 0) {
      return false;
    }

    // Check if there are errors from the last 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return this.props.syncErrors.some(error => {
      const errorDate = new Date(error.split(':')[0]);
      return errorDate > oneDayAgo;
    });
  }

  public canSync(): boolean {
    return this.props.syncEnabled && !this.isTokenExpired();
  }

  public delete(): void {
    this.addDomainEvent(new CalendarIntegrationDeletedEvent(this));
  }

  // Getters
  public get id(): CalendarIntegrationId {
    return this.props.id;
  }

  public get userId(): UserId {
    return this.props.userId;
  }

  public get provider(): CalendarProvider {
    return this.props.provider;
  }

  public get providerAccountId(): string {
    return this.props.providerAccountId;
  }

  public get calendarId(): string {
    return this.props.calendarId;
  }

  public get calendarName(): CalendarName {
    return this.props.calendarName;
  }

  public get accessToken(): AccessToken {
    return this.props.accessToken;
  }

  public get refreshToken(): RefreshToken | undefined {
    return this.props.refreshToken;
  }

  public get tokenExpiry(): Date | undefined {
    return this.props.tokenExpiry;
  }

  public get syncEnabled(): boolean {
    return this.props.syncEnabled;
  }

  public get lastSyncedAt(): Date | undefined {
    return this.props.lastSyncedAt;
  }

  public get syncErrors(): string[] {
    return [...this.props.syncErrors];
  }

  public get settings(): CalendarIntegrationSettings {
    return { ...this.props.settings };
  }

  public get createdAt(): Date {
    return this.props.createdAt;
  }

  public get updatedAt(): Date {
    return this.props.updatedAt;
  }
}
