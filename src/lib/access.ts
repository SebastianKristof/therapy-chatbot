const ACCESS_TOKEN_KEY = 'askdrkristof_access_token';
const DEVICE_ID_KEY = 'askdrkristof_device_id';

export function isLocalDevelopmentHost() {
  if (typeof window === 'undefined') {
    return false;
  }

  const { hostname } = window.location;
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

function generatePrefixedId(prefix: string) {
  const random = globalThis.crypto?.randomUUID?.().replace(/-/g, '') || `${Date.now()}${Math.random().toString(16).slice(2)}`;
  return `${prefix}_${random}`;
}

export interface AccessCredentials {
  clientToken: string;
  deviceId: string;
}

export interface AccessStatus {
  authorized: boolean;
  clientToken: string;
  deviceId: string;
  message: string;
  status: 'approved' | 'pending' | 'bound_elsewhere' | 'missing';
}

export function readOrCreateAccessCredentials(): AccessCredentials {
  const existingToken = localStorage.getItem(ACCESS_TOKEN_KEY)?.trim();
  const existingDeviceId = localStorage.getItem(DEVICE_ID_KEY)?.trim();

  const clientToken = existingToken || generatePrefixedId('adk');
  const deviceId = existingDeviceId || generatePrefixedId('device');

  if (!existingToken) {
    localStorage.setItem(ACCESS_TOKEN_KEY, clientToken);
  }

  if (!existingDeviceId) {
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }

  return { clientToken, deviceId };
}

export function regenerateAccessCredentials(): AccessCredentials {
  const nextCredentials = {
    clientToken: generatePrefixedId('adk'),
    deviceId: generatePrefixedId('device'),
  };

  localStorage.setItem(ACCESS_TOKEN_KEY, nextCredentials.clientToken);
  localStorage.setItem(DEVICE_ID_KEY, nextCredentials.deviceId);

  return nextCredentials;
}

export function getAccessHeaders() {
  const { clientToken, deviceId } = readOrCreateAccessCredentials();

  return {
    'X-Client-Token': clientToken,
    'X-Device-Id': deviceId,
  };
}

export async function fetchAccessStatus(): Promise<AccessStatus> {
  const credentials = readOrCreateAccessCredentials();

  if (isLocalDevelopmentHost()) {
    return {
      authorized: true,
      clientToken: credentials.clientToken,
      deviceId: credentials.deviceId,
      message: 'Local development bypass is active.',
      status: 'approved',
    };
  }

  const response = await fetch('/api/access', {
    headers: getAccessHeaders(),
  });

  const data = (await response.json().catch(() => ({}))) as Partial<AccessStatus> & { error?: string };

  if (!response.ok) {
    return {
      authorized: false,
      clientToken: credentials.clientToken,
      deviceId: credentials.deviceId,
      message: data.error || data.message || 'Access could not be verified.',
      status: (data.status as AccessStatus['status']) || 'missing',
    };
  }

  return {
    authorized: Boolean(data.authorized),
    clientToken: credentials.clientToken,
    deviceId: credentials.deviceId,
    message: data.message || '',
    status: (data.status as AccessStatus['status']) || 'pending',
  };
}
