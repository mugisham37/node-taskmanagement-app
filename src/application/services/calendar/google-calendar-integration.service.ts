import { CalendarEvent, EventType } from '../entities/calendar-event.entity';
import { CalendarIntegration } from '../entities/calendar-integration.entity';
import { DomainService } from '../../shared/services/domain-service';

export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  location?: string;
  htmlLink?: string;
  attendees?: Array<{
    email: string;
    displayName?: string;
    responseStatus: 'needsAction' | 'declined' | 'tentative' | 'accepted';
  }>;
  reminders?: {
    useDefault: boolean;
    overrides?: Array<{
      method: 'email' | 'popup';
      minutes: number;
    }>;
  };
  recurrence?: string[];
  status: 'confirmed' | 'tentative' | 'cancelled';
  created: string;
  updated: string;
}

export interface GoogleCalendarListResponse {
  kind: string;
  etag: string;
  nextPageToken?: string;
  items: GoogleCalendarEvent[];
}

export interface GoogleCalendarApiClient {
  getEvents(
    calendarId: string,
    accessToken: string,
    options?: {
      timeMin?: string;
      timeMax?: string;
      maxResults?: number;
      pageToken?: string;
    }
  ): Promise<GoogleCalendarListResponse>;

  createEvent(
    calendarId: string,
    accessToken: string,
    event: Partial<GoogleCalendarEvent>
  ): Promise<GoogleCalendarEvent>;

  updateEvent(
    calendarId: string,
    eventId: string,
    accessToken: string,
    event: Partial<GoogleCalendarEvent>
  ): Promise<GoogleCalendarEvent>;

  deleteEvent(
    calendarId: string,
    eventId: string,
    accessToken: string
  ): Promise<void>;

  refreshAccessToken(refreshToken: string): Promise<{
    access_token: string;
    expires_in: number;
    refresh_token?: string;
  }>;
}

export interface SyncResult {
  imported: number;
  exported: number;
  updated: number;
  deleted: number;
  errors: string[];
}

export class GoogleCalendarIntegrationService extends DomainService {
  constructor(private readonly googleCalendarApi: GoogleCalendarApiClient) {
    super('GoogleCalendarIntegrationService');
  }

  /**
   * Sync events between internal calendar and Google Calendar
   */
  async syncCalendar(
    integration: CalendarIntegration,
    internalEvents: CalendarEvent[],
    options?: {
      timeMin?: Date;
      timeMax?: Date;
      dryRun?: boolean;
    }
  ): Promise<SyncResult> {
    const result: SyncResult = {
      imported: 0,
      exported: 0,
      updated: 0,
      deleted: 0,
      errors: [],
    };

    try {
      // Ensure we have a valid access token
      await this.ensureValidAccessToken(integration);

      const timeMin = options?.timeMin?.toISOString();
      const timeMax = options?.timeMax?.toISOString();

      // Import events from Google Calendar
      if (
        integration.settings.syncDirection === 'import' ||
        integration.settings.syncDirection === 'both'
      ) {
        const importResult = await this.importEventsFromGoogle(
          integration,
          internalEvents,
          { timeMin, timeMax, dryRun: options?.dryRun }
        );
        result.imported = importResult.imported;
        result.updated += importResult.updated;
        result.errors.push(...importResult.errors);
      }

      // Export events to Google Calendar
      if (
        integration.settings.syncDirection === 'export' ||
        integration.settings.syncDirection === 'both'
      ) {
        const exportResult = await this.exportEventsToGoogle(
          integration,
          internalEvents,
          { timeMin, timeMax, dryRun: options?.dryRun }
        );
        result.exported = exportResult.exported;
        result.updated += exportResult.updated;
        result.errors.push(...exportResult.errors);
      }

      return result;
    } catch (error) {
      result.errors.push(
        `Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      return result;
    }
  }

  /**
   * Import events from Google Calendar
   */
  private async importEventsFromGoogle(
    integration: CalendarIntegration,
    existingEvents: CalendarEvent[],
    options?: {
      timeMin?: string;
      timeMax?: string;
      dryRun?: boolean;
    }
  ): Promise<{ imported: number; updated: number; errors: string[] }> {
    const result = { imported: 0, updated: 0, errors: [] };

    try {
      let pageToken: string | undefined;
      const existingEventMap = new Map(
        existingEvents
          .filter(e => e.externalEventId)
          .map(e => [e.externalEventId!, e])
      );

      do {
        const response = await this.googleCalendarApi.getEvents(
          integration.calendarId,
          integration.accessToken.value,
          {
            timeMin: options?.timeMin,
            timeMax: options?.timeMax,
            maxResults: 250,
            pageToken,
          }
        );

        for (const googleEvent of response.items) {
          try {
            if (googleEvent.status === 'cancelled') {
              // Handle deleted events
              const existingEvent = existingEventMap.get(googleEvent.id);
              if (existingEvent && !options?.dryRun) {
                // Mark for deletion or handle as needed
                this.logOperation('Event cancelled in Google Calendar', {
                  eventId: googleEvent.id,
                });
              }
              continue;
            }

            const shouldImport = this.shouldImportEvent(
              googleEvent,
              integration.settings
            );
            if (!shouldImport) {
              continue;
            }

            const existingEvent = existingEventMap.get(googleEvent.id);

            if (existingEvent) {
              // Update existing event if Google event is newer
              const googleUpdated = new Date(googleEvent.updated);
              if (googleUpdated > existingEvent.updatedAt && !options?.dryRun) {
                this.updateInternalEventFromGoogle(existingEvent, googleEvent);
                result.updated++;
              }
            } else {
              // Create new internal event
              if (!options?.dryRun) {
                this.createInternalEventFromGoogle(googleEvent, integration);
                result.imported++;
              }
            }
          } catch (error) {
            result.errors.push(
              `Failed to process Google event ${googleEvent.id}: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
          }
        }

        pageToken = response.nextPageToken;
      } while (pageToken);
    } catch (error) {
      result.errors.push(
        `Failed to import from Google Calendar: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }

    return result;
  }

  /**
   * Export events to Google Calendar
   */
  private async exportEventsToGoogle(
    integration: CalendarIntegration,
    internalEvents: CalendarEvent[],
    options?: {
      timeMin?: string;
      timeMax?: string;
      dryRun?: boolean;
    }
  ): Promise<{ exported: number; updated: number; errors: string[] }> {
    const result = { exported: 0, updated: 0, errors: [] };

    try {
      // Get existing Google events to avoid duplicates
      const googleEventsMap = new Map<string, GoogleCalendarEvent>();
      let pageToken: string | undefined;

      do {
        const response = await this.googleCalendarApi.getEvents(
          integration.calendarId,
          integration.accessToken.value,
          {
            timeMin: options?.timeMin,
            timeMax: options?.timeMax,
            maxResults: 250,
            pageToken,
          }
        );

        response.items.forEach(event => {
          googleEventsMap.set(event.id, event);
        });

        pageToken = response.nextPageToken;
      } while (pageToken);

      // Process internal events
      for (const internalEvent of internalEvents) {
        try {
          const shouldExport = this.shouldExportEvent(
            internalEvent,
            integration.settings
          );
          if (!shouldExport) {
            continue;
          }

          if (internalEvent.externalEventId) {
            // Update existing Google event
            const googleEvent = googleEventsMap.get(
              internalEvent.externalEventId
            );
            if (googleEvent) {
              const googleUpdated = new Date(googleEvent.updated);
              if (internalEvent.updatedAt > googleUpdated && !options?.dryRun) {
                await this.updateGoogleEventFromInternal(
                  integration,
                  internalEvent,
                  googleEvent
                );
                result.updated++;
              }
            }
          } else {
            // Create new Google event
            if (!options?.dryRun) {
              await this.createGoogleEventFromInternal(
                integration,
                internalEvent
              );
              result.exported++;
            }
          }
        } catch (error) {
          result.errors.push(
            `Failed to export event ${internalEvent.id.value}: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }
      }
    } catch (error) {
      result.errors.push(
        `Failed to export to Google Calendar: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }

    return result;
  }

  /**
   * Ensure the integration has a valid access token
   */
  private async ensureValidAccessToken(
    integration: CalendarIntegration
  ): Promise<void> {
    if (!integration.isTokenExpired()) {
      return;
    }

    if (!integration.refreshToken) {
      throw new Error('Access token expired and no refresh token available');
    }

    try {
      const tokenResponse = await this.googleCalendarApi.refreshAccessToken(
        integration.refreshToken.value
      );

      const tokenExpiry = new Date(
        Date.now() + tokenResponse.expires_in * 1000
      );

      integration.updateTokens(
        tokenResponse.access_token,
        tokenResponse.refresh_token,
        tokenExpiry
      );
    } catch (error) {
      throw new Error(
        `Failed to refresh access token: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Check if a Google event should be imported
   */
  private shouldImportEvent(
    googleEvent: GoogleCalendarEvent,
    settings: any
  ): boolean {
    // Basic filtering based on settings
    if (
      googleEvent.summary?.toLowerCase().includes('task') &&
      !settings.syncTasks
    ) {
      return false;
    }

    if (
      googleEvent.summary?.toLowerCase().includes('meeting') &&
      !settings.syncMeetings
    ) {
      return false;
    }

    if (
      googleEvent.summary?.toLowerCase().includes('deadline') &&
      !settings.syncDeadlines
    ) {
      return false;
    }

    return true;
  }

  /**
   * Check if an internal event should be exported
   */
  private shouldExportEvent(
    internalEvent: CalendarEvent,
    settings: any
  ): boolean {
    switch (internalEvent.type) {
      case EventType.TASK:
        return settings.syncTasks;
      case EventType.MEETING:
        return settings.syncMeetings;
      case EventType.DEADLINE:
        return settings.syncDeadlines;
      default:
        return true;
    }
  }

  /**
   * Convert Google Calendar event to internal event
   */
  private createInternalEventFromGoogle(
    googleEvent: GoogleCalendarEvent,
    integration: CalendarIntegration
  ): CalendarEvent {
    const startDate = googleEvent.start.dateTime
      ? new Date(googleEvent.start.dateTime)
      : new Date(googleEvent.start.date!);

    const endDate = googleEvent.end.dateTime
      ? new Date(googleEvent.end.dateTime)
      : new Date(googleEvent.end.date!);

    const allDay = !googleEvent.start.dateTime;

    // Determine event type based on title and content
    let eventType = EventType.OTHER;
    const title = googleEvent.summary.toLowerCase();
    if (title.includes('meeting') || title.includes('call')) {
      eventType = EventType.MEETING;
    } else if (title.includes('deadline') || title.includes('due')) {
      eventType = EventType.DEADLINE;
    } else if (title.includes('task') || title.includes('todo')) {
      eventType = EventType.TASK;
    }

    // Convert attendees
    const attendees = (googleEvent.attendees || []).map(attendee => ({
      userId: attendee.email, // This would need to be mapped to internal user IDs
      status: this.mapGoogleAttendeeStatus(attendee.responseStatus),
    }));

    // Convert reminders
    const reminders = (googleEvent.reminders?.overrides || []).map(
      (reminder, index) => ({
        id: `google-${googleEvent.id}-${index}`,
        minutesBefore: reminder.minutes,
        method:
          reminder.method === 'email'
            ? ('email' as const)
            : ('notification' as const),
        sent: false,
      })
    );

    return CalendarEvent.create({
      title: googleEvent.summary,
      description: googleEvent.description,
      type: eventType,
      startDate,
      endDate: allDay ? undefined : endDate,
      allDay,
      location: googleEvent.location,
      url: googleEvent.htmlLink,
      userId: integration.userId.value,
      attendees,
      reminders,
      metadata: {
        externalCalendarId: integration.calendarId,
        externalEventId: googleEvent.id,
        googleCreated: googleEvent.created,
        googleUpdated: googleEvent.updated,
        importedFrom: 'google',
      },
    });
  }

  /**
   * Update internal event from Google event
   */
  private updateInternalEventFromGoogle(
    internalEvent: CalendarEvent,
    googleEvent: GoogleCalendarEvent
  ): void {
    const startDate = googleEvent.start.dateTime
      ? new Date(googleEvent.start.dateTime)
      : new Date(googleEvent.start.date!);

    const endDate = googleEvent.end.dateTime
      ? new Date(googleEvent.end.dateTime)
      : new Date(googleEvent.end.date!);

    const allDay = !googleEvent.start.dateTime;

    internalEvent.update({
      title: googleEvent.summary,
      description: googleEvent.description,
      startDate,
      endDate: allDay ? undefined : endDate,
      allDay,
      location: googleEvent.location,
      url: googleEvent.htmlLink,
      metadata: {
        ...internalEvent.metadata,
        googleUpdated: googleEvent.updated,
        lastSyncedFrom: 'google',
      },
    });
  }

  /**
   * Create Google event from internal event
   */
  private async createGoogleEventFromInternal(
    integration: CalendarIntegration,
    internalEvent: CalendarEvent
  ): Promise<void> {
    const googleEvent: Partial<GoogleCalendarEvent> = {
      summary: internalEvent.title.value,
      description: internalEvent.description?.value,
      location: internalEvent.location?.value,
      start: internalEvent.allDay
        ? { date: internalEvent.startDate.value.toISOString().split('T')[0] }
        : { dateTime: internalEvent.startDate.value.toISOString() },
      end: internalEvent.endDate
        ? internalEvent.allDay
          ? { date: internalEvent.endDate.value.toISOString().split('T')[0] }
          : { dateTime: internalEvent.endDate.value.toISOString() }
        : internalEvent.allDay
          ? { date: internalEvent.startDate.value.toISOString().split('T')[0] }
          : {
              dateTime: new Date(
                internalEvent.startDate.value.getTime() + 60 * 60 * 1000
              ).toISOString(),
            },
    };

    // Add reminders
    if (internalEvent.reminders.length > 0) {
      googleEvent.reminders = {
        useDefault: false,
        overrides: internalEvent.reminders.map(reminder => ({
          method: reminder.method === 'email' ? 'email' : 'popup',
          minutes: reminder.minutesBefore,
        })),
      };
    }

    const createdEvent = await this.googleCalendarApi.createEvent(
      integration.calendarId,
      integration.accessToken.value,
      googleEvent
    );

    // Update internal event with external IDs
    internalEvent.update({
      metadata: {
        ...internalEvent.metadata,
        externalCalendarId: integration.calendarId,
        externalEventId: createdEvent.id,
        exportedTo: 'google',
      },
    });
  }

  /**
   * Update Google event from internal event
   */
  private async updateGoogleEventFromInternal(
    integration: CalendarIntegration,
    internalEvent: CalendarEvent,
    googleEvent: GoogleCalendarEvent
  ): Promise<void> {
    const updatedGoogleEvent: Partial<GoogleCalendarEvent> = {
      summary: internalEvent.title.value,
      description: internalEvent.description?.value,
      location: internalEvent.location?.value,
      start: internalEvent.allDay
        ? { date: internalEvent.startDate.value.toISOString().split('T')[0] }
        : { dateTime: internalEvent.startDate.value.toISOString() },
      end: internalEvent.endDate
        ? internalEvent.allDay
          ? { date: internalEvent.endDate.value.toISOString().split('T')[0] }
          : { dateTime: internalEvent.endDate.value.toISOString() }
        : internalEvent.allDay
          ? { date: internalEvent.startDate.value.toISOString().split('T')[0] }
          : {
              dateTime: new Date(
                internalEvent.startDate.value.getTime() + 60 * 60 * 1000
              ).toISOString(),
            },
    };

    await this.googleCalendarApi.updateEvent(
      integration.calendarId,
      googleEvent.id,
      integration.accessToken.value,
      updatedGoogleEvent
    );
  }

  /**
   * Map Google attendee status to internal status
   */
  private mapGoogleAttendeeStatus(googleStatus: string): any {
    switch (googleStatus) {
      case 'accepted':
        return 'accepted';
      case 'declined':
        return 'declined';
      case 'tentative':
        return 'tentative';
      case 'needsAction':
      default:
        return 'pending';
    }
  }
}
