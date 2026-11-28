import type { IncomingHttpHeaders } from 'node:http';
import { RequestError } from './askDrKristofService.js';

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

function readApprovedDevices() {
  const entries = new Map<string, string>();
  for (const line of (process.env.APP_APPROVED_DEVICES ?? '').split(/\r?\n/)) {
    const fields = line.trim().split(/\s+/);
    if (fields.length === 2) {
      const [token, deviceId] = fields;
      entries.set(token, deviceId);
    }
  }
  return entries;
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

  const approvedDevice = readApprovedDevices().get(headers.clientToken);

  if (!approvedDevice) {
    return {
      authorized: false,
      status: 'pending',
      message: 'This device is waiting for approval. Share its approval entry privately with the app owner.',
    };
  }

  if (approvedDevice !== headers.deviceId) {
    return {
      authorized: false,
      status: 'bound_elsewhere',
      message: 'This token is approved for a different device. Ask the app owner to approve your device.',
    };
  }

  return {
    authorized: true,
    status: 'approved',
    message: 'Access approved for this device.',
  };
}

export function assertAuthorizedRequest(headers: Headers | IncomingHttpHeaders) {
  const status = getAccessStatus(readClientAccessHeaders(headers));

  if (!status.authorized) {
    const requestError = new RequestError(status.message, status.status === 'bound_elsewhere' ? 403 : 401);
    requestError.name = 'AccessDeniedError';
    throw requestError;
  }
}
