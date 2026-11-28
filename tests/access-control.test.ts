import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { assertAuthorizedRequest, getAccessStatus } from '../server/accessControl.ts';

const original = process.env.APP_APPROVED_DEVICES;

afterEach(() => {
  if (original === undefined) {
    delete process.env.APP_APPROVED_DEVICES;
  } else {
    process.env.APP_APPROVED_DEVICES = original;
  }
});

const token = 'fixture-token';
const device = 'fixture-device';
const matchingHeaders = () => new Headers({ 'x-client-token': token, 'x-device-id': device });
const matchingStatus = () => getAccessStatus({ clientToken: token, deviceId: device });

test('access stays closed when no private device approvals are configured', () => {
  delete process.env.APP_APPROVED_DEVICES;
  assert.equal(matchingStatus().status, 'pending');
  assert.throws(() => assertAuthorizedRequest(matchingHeaders()), { name: 'AccessDeniedError', status: 401 });
});

test('private approvals require the matching device and ignore incomplete entries', () => {
  process.env.APP_APPROVED_DEVICES = 'fixture-token fixture-device\r\nmissing-device\nsecond-token second-device\n';
  assert.equal(matchingStatus().authorized, true);
  assert.doesNotThrow(() => assertAuthorizedRequest(matchingHeaders()));

  const wrongDevice = new Headers({ 'x-client-token': token, 'x-device-id': 'second-device' });
  assert.throws(() => assertAuthorizedRequest(wrongDevice), { name: 'AccessDeniedError', status: 403 });
  assert.equal(getAccessStatus({ clientToken: 'missing-device', deviceId: device }).authorized, false);
});

test('request headers do not grant access without an approved pair', () => {
  process.env.APP_APPROVED_DEVICES = '';
  assert.throws(
    () => assertAuthorizedRequest(new Headers({ host: 'localhost' })),
    { name: 'AccessDeniedError', status: 401 },
  );
});
