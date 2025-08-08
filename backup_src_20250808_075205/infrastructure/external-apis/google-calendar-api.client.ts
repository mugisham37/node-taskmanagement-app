import {
  GoogleCalendarApiClient,
  GoogleCalendarEvent,
  GoogleCalendarListResponse,
} from '../../domain/calendar/services/google-calendar-integration.service';

export class GoogleCalendarApiClientImpl implements GoogleCalendarApiClient {
  private readonly baseUrl = 'https://www.googleapis.com/calendar/v3';

  async getEvents(
    calendarId: string,
    accessToken: string,
    options?: {
      timeMin?: string;
      timeMax?: string;
      maxResults?: number;
      pageToken?: string;
    }
  ): Promise<GoogleCalendarListResponse> {
    const params = new URLSearchParams();

    if (options?.timeMin) {
      params.append('timeMin', options.timeMin);
    }
    if (options?.timeMax) {
      params.append('timeMax', options.timeMax);
    }
    if (options?.maxResults) {
      params.append('maxResults', options.maxResults.toString());
    }
    if (options?.pageToken) {
      params.append('pageToken', options.pageToken);
    }

    // Always include these parameters for better results
    params.append('singleEvents', 'true');
    params.append('orderBy', 'startTime');

    const url = `${this.baseUrl}/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Google Calendar API error: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    return await response.json();
  }

  async createEvent(
    calendarId: string,
    accessToken: string,
    event: Partial<GoogleCalendarEvent>
  ): Promise<GoogleCalendarEvent> {
    const url = `${this.baseUrl}/calendars/${encodeURIComponent(calendarId)}/events`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Google Calendar API error: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    return await response.json();
  }

  async updateEvent(
    calendarId: string,
    eventId: string,
    accessToken: string,
    event: Partial<GoogleCalendarEvent>
  ): Promise<GoogleCalendarEvent> {
    const url = `${this.baseUrl}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`;

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Google Calendar API error: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    return await response.json();
  }

  async deleteEvent(
    calendarId: string,
    eventId: string,
    accessToken: string
  ): Promise<void> {
    const url = `${this.baseUrl}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`;

    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok && response.status !== 404) {
      const errorText = await response.text();
      throw new Error(
        `Google Calendar API error: ${response.status} ${response.statusText} - ${errorText}`
      );
    }
  }

  async refreshAccessToken(refreshToken: string): Promise<{
    access_token: string;
    expires_in: number;
    refresh_token?: string;
  }> {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error('Google OAuth credentials not configured');
    }

    const url = 'https://oauth2.googleapis.com/token';
    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Google OAuth error: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    return await response.json();
  }

  async getCalendarList(accessToken: string): Promise<{
    kind: string;
    etag: string;
    items: Array<{
      id: string;
      summary: string;
      description?: string;
      primary?: boolean;
      accessRole: string;
    }>;
  }> {
    const url = `${this.baseUrl}/users/me/calendarList`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Google Calendar API error: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    return await response.json();
  }

  async getCalendarInfo(
    calendarId: string,
    accessToken: string
  ): Promise<{
    id: string;
    summary: string;
    description?: string;
    timeZone: string;
    accessRole: string;
  }> {
    const url = `${this.baseUrl}/calendars/${encodeURIComponent(calendarId)}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Google Calendar API error: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    return await response.json();
  }
}
