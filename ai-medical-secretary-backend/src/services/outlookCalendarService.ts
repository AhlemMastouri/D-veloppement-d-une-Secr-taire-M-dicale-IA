/**
 * Microsoft Outlook / Graph API Integration Service
 * Uses @azure/msal-node + Microsoft Graph to sync appointments with Outlook calendar.
 *
 * Configuration required in .env:
 *   OUTLOOK_CLIENT_ID=...
 *   OUTLOOK_CLIENT_SECRET=...
 *   OUTLOOK_TENANT_ID=...
 *   OUTLOOK_REDIRECT_URI=...
 *   OUTLOOK_REFRESH_TOKEN=...  (doctor's OAuth refresh token)
 */
import { ConfidentialClientApplication, Configuration } from '@azure/msal-node';

const CLIENT_ID = process.env.OUTLOOK_CLIENT_ID || '';
const CLIENT_SECRET = process.env.OUTLOOK_CLIENT_SECRET || '';
const TENANT_ID = process.env.OUTLOOK_TENANT_ID || 'common';
const REDIRECT_URI = process.env.OUTLOOK_REDIRECT_URI || 'http://localhost:5000/api/v1/integrations/outlook/callback';
const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

const SCOPES = ['Calendars.ReadWrite', 'offline_access'];

function getMsalClient(): ConfidentialClientApplication {
  const config: Configuration = {
    auth: {
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      authority: `https://login.microsoftonline.com/${TENANT_ID}`,
    },
  };
  return new ConfidentialClientApplication(config);
}

export function getOutlookAuthUrl(): string {
  const msalClient = getMsalClient();
  return msalClient.getAuthCodeUrl({
    scopes: SCOPES,
    redirectUri: REDIRECT_URI,
  }) as any; // returns Promise<string> – caller should await
}

export async function exchangeOutlookCode(code: string) {
  const msalClient = getMsalClient();
  const result = await msalClient.acquireTokenByCode({
    code,
    scopes: SCOPES,
    redirectUri: REDIRECT_URI,
  });
  return result;
}

async function getAccessToken(): Promise<string | null> {
  const refreshToken = process.env.OUTLOOK_REFRESH_TOKEN;
  if (!CLIENT_ID || !CLIENT_SECRET || !refreshToken) {
    console.warn('[Outlook] Not configured – skipping sync.');
    return null;
  }

  try {
    const msalClient = getMsalClient();
    const result = await msalClient.acquireTokenByRefreshToken({
      refreshToken,
      scopes: SCOPES,
    });
    return result?.accessToken || null;
  } catch (err: any) {
    console.error('[Outlook] Token refresh error:', err.message);
    return null;
  }
}

export interface OutlookEvent {
  subject: string;
  body?: string;
  startDateTime: string; // ISO8601
  endDateTime: string;
  location?: string;
  attendeeEmail?: string;
}

async function graphRequest(method: string, path: string, accessToken: string, body?: any) {
  const { default: fetch } = await import('node-fetch');
  const res = await fetch(`${GRAPH_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Graph API error (${res.status}): ${errText}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

/**
 * Create or update an Outlook Calendar event.
 */
export async function upsertOutlookEvent(event: OutlookEvent, existingEventId?: string): Promise<string | null> {
  const token = await getAccessToken();
  if (!token) return null;

  try {
    const eventBody: any = {
      subject: event.subject,
      body: { contentType: 'Text', content: event.body || '' },
      start: { dateTime: event.startDateTime, timeZone: 'Romance Standard Time' },
      end: { dateTime: event.endDateTime, timeZone: 'Romance Standard Time' },
      location: event.location ? { displayName: event.location } : undefined,
    };

    if (event.attendeeEmail) {
      eventBody.attendees = [
        { emailAddress: { address: event.attendeeEmail }, type: 'required' },
      ];
    }

    if (existingEventId) {
      await graphRequest('PATCH', `/me/events/${existingEventId}`, token, eventBody);
      return existingEventId;
    } else {
      const created: any = await graphRequest('POST', '/me/events', token, eventBody);
      return created?.id || null;
    }
  } catch (err: any) {
    console.error('[Outlook] Error syncing event:', err.message);
    return null;
  }
}

/**
 * Delete an Outlook Calendar event.
 */
export async function deleteOutlookEvent(eventId: string): Promise<boolean> {
  const token = await getAccessToken();
  if (!token) return false;
  try {
    await graphRequest('DELETE', `/me/events/${eventId}`, token);
    return true;
  } catch (err: any) {
    console.error('[Outlook] Error deleting event:', err.message);
    return false;
  }
}

/**
 * List Outlook events for conflict detection.
 */
export async function listOutlookEvents(startDateTime: string, endDateTime: string) {
  const token = await getAccessToken();
  if (!token) return [];
  try {
    const data: any = await graphRequest(
      'GET',
      `/me/calendarView?startDateTime=${startDateTime}&endDateTime=${endDateTime}&$select=subject,start,end,id`,
      token
    );
    return data?.value || [];
  } catch (err: any) {
    console.error('[Outlook] Error listing events:', err.message);
    return [];
  }
}
