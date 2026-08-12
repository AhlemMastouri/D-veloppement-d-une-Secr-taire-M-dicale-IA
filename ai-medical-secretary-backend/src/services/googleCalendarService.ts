/**
 * Google Calendar Integration Service
 * Uses the Google Calendar API via googleapis to sync appointments.
 * 
 * Configuration required in .env:
 *   GOOGLE_CLIENT_ID=...
 *   GOOGLE_CLIENT_SECRET=...
 *   GOOGLE_REDIRECT_URI=...
 *   GOOGLE_REFRESH_TOKEN=...  (doctor's OAuth refresh token)
 */
import { google } from 'googleapis';

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/api/v1/integrations/google/callback';
const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;

function getOAuthClient() {
  const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
  if (REFRESH_TOKEN) {
    oauth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });
  }
  return oauth2Client;
}

export function getAuthUrl(): string {
  const oauth2Client = getOAuthClient();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/calendar'],
  });
}

export async function exchangeCode(code: string) {
  const oauth2Client = getOAuthClient();
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

export interface CalendarEvent {
  summary: string;
  description?: string;
  startDateTime: string;  // ISO8601
  endDateTime: string;
  location?: string;
  attendeeEmail?: string;
}

/**
 * Create or update a Google Calendar event.
 * Returns the created/updated event id.
 */
export async function upsertGoogleEvent(event: CalendarEvent, existingEventId?: string): Promise<string | null> {
  if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
    console.warn('[GoogleCalendar] Not configured – skipping sync.');
    return null;
  }

  try {
    const auth = getOAuthClient();
    const calendar = google.calendar({ version: 'v3', auth });

    const eventBody: any = {
      summary: event.summary,
      description: event.description,
      location: event.location,
      start: { dateTime: event.startDateTime, timeZone: 'Europe/Paris' },
      end: { dateTime: event.endDateTime, timeZone: 'Europe/Paris' },
    };

    if (event.attendeeEmail) {
      eventBody.attendees = [{ email: event.attendeeEmail }];
    }

    if (existingEventId) {
      const res = await calendar.events.update({
        calendarId: 'primary',
        eventId: existingEventId,
        requestBody: eventBody,
      });
      return res.data.id || null;
    } else {
      const res = await calendar.events.insert({
        calendarId: 'primary',
        requestBody: eventBody,
      });
      return res.data.id || null;
    }
  } catch (err: any) {
    console.error('[GoogleCalendar] Error syncing event:', err.message);
    return null;
  }
}

/**
 * Delete a Google Calendar event.
 */
export async function deleteGoogleEvent(eventId: string): Promise<boolean> {
  if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) return false;
  try {
    const auth = getOAuthClient();
    const calendar = google.calendar({ version: 'v3', auth });
    await calendar.events.delete({ calendarId: 'primary', eventId });
    return true;
  } catch (err: any) {
    console.error('[GoogleCalendar] Error deleting event:', err.message);
    return false;
  }
}

/**
 * List events from Google Calendar for a time range to detect conflicts.
 */
export async function listGoogleEvents(timeMin: string, timeMax: string) {
  if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) return [];
  try {
    const auth = getOAuthClient();
    const calendar = google.calendar({ version: 'v3', auth });
    const res = await calendar.events.list({
      calendarId: 'primary',
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: 'startTime',
    });
    return res.data.items || [];
  } catch (err: any) {
    console.error('[GoogleCalendar] Error listing events:', err.message);
    return [];
  }
}
