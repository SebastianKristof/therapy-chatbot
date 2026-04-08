import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { IncomingHttpHeaders } from 'node:http';
import { RequestError } from './askDrKristofService.js';

const ACCESS_CONFIG_PATH = path.join(process.cwd(), 'config', 'accessTokens.txt');

interface ApprovedAccessEntry {
  clientToken: string;
  deviceId?: string;
}

export interface AccessStatusPayload {
  authorized: boolean;
  status: 'approved' | 'pending' | 'bound_elsewhere' | 'missing';
  message: string;
}

interface ClientAccessHeaders {
  clientToken?: string;
  deviceId?: string;
}

function normalizeValue(value?: string) {
  return value?.trim() || undefined;
}

function normalizeToken(value: string) {
  return value.trim().replace(/^[-*+]\s+/, '').replace(/^\d+\.\s+/, '').replace(/`/g, '');
}

function parseLineBasedTokens(raw: string) {
  return raw
    .split('\n')
    .map((line) => line.replace(/\s+#.*$/, '').trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith('#'))
    .filter((line) => !line.endsWith(':'));
}

function parseApprovedAccessEntries(raw: string): ApprovedAccessEntry[] {
  return parseLineBasedTokens(raw)
    .map((line) => line.split(/\s+/).map(normalizeToken).filter(Boolean))
    .filter((parts) => parts.length > 0)
    .map((parts) => ({
      clientToken: parts[0],
      deviceId: parts[1],
    }))
    .filter((entry) => Boolean(entry.clientToken));
}

function readAccessConfig() {
  const entries = new Map<string, ApprovedAccessEntry>();

  if (existsSync(ACCESS_CONFIG_PATH)) {
    try {
      for (const entry of parseApprovedAccessEntries(readFileSync(ACCESS_CONFIG_PATH, 'utf8'))) {
        entries.set(entry.clientToken, entry);
      }
    } catch {
      // Fall back to env tokens below.
    }
  }

  for (const envToken of process.env.APP_APPROVED_TOKENS?.split(',').map((token) => token.trim()).filter(Boolean) || []) {
    entries.set(envToken, { clientToken: envToken });
  }

  return entries;
}

function readHostHeader(headers: Headers | IncomingHttpHeaders) {
  if (headers instanceof Headers) {
    return normalizeValue(headers.get('host') || headers.get('x-forwarded-host') || undefined);
  }

  const hostHeader = headers['x-forwarded-host'] || headers.host;
  return normalizeValue(Array.isArray(hostHeader) ? hostHeader[0] : hostHeader);
}

export function isLocalAccessRequest(headers: Headers | IncomingHttpHeaders) {
  const host = readHostHeader(headers)?.toLowerCase();

  if (!host) {
    return false;
  }

  return host.includes('localhost') || host.includes('127.0.0.1') || host.includes('[::1]') || host.includes('::1');
}

export function readClientAccessHeaders(headers: Headers | IncomingHttpHeaders): ClientAccessHeaders {
  if (headers instanceof Headers) {
    return {
      clientToken: normalizeValue(headers.get('x-client-token') || undefined),
      deviceId: normalizeValue(headers.get('x-device-id') || undefined),
    };
  }

  const clientTokenHeader = headers['x-client-token'];
  const deviceIdHeader = headers['x-device-id'];

  return {
    clientToken: normalizeValue(Array.isArray(clientTokenHeader) ? clientTokenHeader[0] : clientTokenHeader),
    deviceId: normalizeValue(Array.isArray(deviceIdHeader) ? deviceIdHeader[0] : deviceIdHeader),
  };
}

export function getAccessStatus(headers: ClientAccessHeaders): AccessStatusPayload {
  if (!headers.clientToken || !headers.deviceId) {
    return {
      authorized: false,
      status: 'missing',
      message: 'This device has not provided valid access credentials.',
    };
  }

  const approvedEntries = readAccessConfig();
  const approvedEntry = approvedEntries.get(headers.clientToken);

  if (!approvedEntry) {
    return {
      authorized: false,
      status: 'pending',
      message: 'This device token is waiting for approval. Add it to config/accessTokens.txt to allow access.',
    };
  }

  if (approvedEntry.deviceId && approvedEntry.deviceId !== headers.deviceId) {
    return {
      authorized: false,
      status: 'bound_elsewhere',
      message: 'This token is approved for a different device. Add this device pair to config/accessTokens.txt instead.',
    };
  }

  return {
    authorized: true,
    status: 'approved',
    message: approvedEntry.deviceId
      ? 'Access approved for this device.'
      : 'Access approved. Add the device ID to lock this token to one device.',
  };
}

export function assertAuthorizedRequest(headers: Headers | IncomingHttpHeaders) {
  if (isLocalAccessRequest(headers)) {
    return;
  }

  const status = getAccessStatus(readClientAccessHeaders(headers));

  if (!status.authorized) {
    const requestError = new RequestError(status.message, status.status === 'bound_elsewhere' ? 403 : 401);
    requestError.name = 'AccessDeniedError';
    throw requestError;
  }
}
