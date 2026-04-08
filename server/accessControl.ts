import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { IncomingHttpHeaders } from 'node:http';
import { RequestError } from './askDrKristofService.js';

const ACCESS_CONFIG_PATH = path.join(process.cwd(), 'config', 'accessTokens.txt');
const ACCESS_BINDINGS_PATH = path.join(process.cwd(), 'server', 'data', 'accessBindings.json');

interface AccessBindings {
  bindings?: Record<string, string>;
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
    .filter((line) => !line.endsWith(':'))
    .map(normalizeToken)
    .filter(Boolean);
}

function readAccessConfig() {
  const tokens = new Set<string>();

  if (existsSync(ACCESS_CONFIG_PATH)) {
    try {
      for (const token of parseLineBasedTokens(readFileSync(ACCESS_CONFIG_PATH, 'utf8'))) {
        tokens.add(token);
      }
    } catch {
      // Fall back to env tokens below.
    }
  }

  for (const envToken of process.env.APP_APPROVED_TOKENS?.split(',').map((token) => token.trim()).filter(Boolean) || []) {
    tokens.add(envToken);
  }

  return [...tokens];
}

function readBindings() {
  try {
    const raw = readFileSync(ACCESS_BINDINGS_PATH, 'utf8');
    const parsed = JSON.parse(raw) as AccessBindings;
    return parsed.bindings || {};
  } catch {
    return {};
  }
}

function writeBindings(bindings: Record<string, string>) {
  mkdirSync(path.dirname(ACCESS_BINDINGS_PATH), { recursive: true });
  writeFileSync(ACCESS_BINDINGS_PATH, JSON.stringify({ bindings }, null, 2));
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

  const approvedTokens = new Set(readAccessConfig());

  if (!approvedTokens.has(headers.clientToken)) {
    return {
      authorized: false,
      status: 'pending',
      message: 'This device token is waiting for approval. Add it to config/accessTokens.txt to allow access.',
    };
  }

  const bindings = readBindings();
  const boundDeviceId = bindings[headers.clientToken];

  if (boundDeviceId && boundDeviceId !== headers.deviceId) {
    return {
      authorized: false,
      status: 'bound_elsewhere',
      message: 'This token is already bound to another device. Generate a new token for this device.',
    };
  }

  if (!boundDeviceId) {
    bindings[headers.clientToken] = headers.deviceId;
    writeBindings(bindings);
  }

  return {
    authorized: true,
    status: 'approved',
    message: 'Access approved for this device.',
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
