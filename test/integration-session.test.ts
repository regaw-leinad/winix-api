import { describe, it, expect } from 'vitest';
import {
  MobileSessionInvalidError,
  NoDataError,
  RateLimitError,
  WinixAccount,
  WinixClient,
} from '../src';

const USERNAME = process.env.WINIX_USERNAME;
const PASSWORD = process.env.WINIX_PASSWORD;
const DEVICE_ID = process.env.WINIX_DEVICE_ID;

const canRun = USERNAME && PASSWORD;
const canRunDevice = canRun && DEVICE_ID;

// Integration tests for issue regaw-leinad/homebridge-winix-purifiers#43.
//
// WARNING: running these tests will invalidate the Winix mobile-app
// session on whatever phone is logged in with the same account. Use a
// dedicated test account or be prepared to log back in on the phone.

describe.runIf(canRun)('mobile session invalidation', () => {
  it('second login invalidates first instance: getDevices throws MobileSessionInvalidError', async () => {
    const account1 = await WinixAccount.fromCredentials(USERNAME!, PASSWORD!);
    const baseline = await account1.getDevices();
    expect(baseline.length).toBeGreaterThan(0);

    await new Promise(r => setTimeout(r, 2000));

    const account2 = await WinixAccount.fromCredentials(USERNAME!, PASSWORD!);
    const second = await account2.getDevices();
    expect(second.length).toBeGreaterThan(0);

    await expect(account1.getDevices()).rejects.toBeInstanceOf(MobileSessionInvalidError);
  }, 60_000);

  it.runIf(canRunDevice)('control plane (getDeviceStatus) survives mobile session invalidation', async () => {
    const account1 = await WinixAccount.fromCredentials(USERNAME!, PASSWORD!);
    const client1 = new WinixClient(account1.getIdentityId());

    const baseline = await client1.getDeviceStatus(DEVICE_ID!);
    expect(baseline.power).toBeDefined();

    await new Promise(r => setTimeout(r, 2000));
    await WinixAccount.fromCredentials(USERNAME!, PASSWORD!);

    await expect(account1.getDevices()).rejects.toBeInstanceOf(MobileSessionInvalidError);

    const status = await client1.getDeviceStatus(DEVICE_ID!);
    expect(status.power).toBeDefined();
  }, 60_000);
});

describe.runIf(canRun)('control plane error shapes', () => {
  it('plausible-but-unknown deviceId throws NoDataError', async () => {
    const account = await WinixAccount.fromCredentials(USERNAME!, PASSWORD!);
    const client = new WinixClient(account.getIdentityId());
    await expect(client.getDeviceStatus('CCCCCCCCCCCC_xxxxxxxxxx')).rejects.toBeInstanceOf(NoDataError);
  }, 30_000);

  it('real-format-not-mine throws NoDataError', async () => {
    const account = await WinixAccount.fromCredentials(USERNAME!, PASSWORD!);
    const client = new WinixClient(account.getIdentityId());
    await expect(client.getDeviceStatus('000000000000_aaaaaaaaaa')).rejects.toBeInstanceOf(NoDataError);
  }, 30_000);

  it('empty deviceId throws RateLimitError', async () => {
    const account = await WinixAccount.fromCredentials(USERNAME!, PASSWORD!);
    const client = new WinixClient(account.getIdentityId());
    await expect(client.getDeviceStatus('')).rejects.toBeInstanceOf(RateLimitError);
  }, 30_000);

  // Note: Winix returns either "parameter(s) not valid : device id" or "no data" for
  // gibberish input depending on backend mood; both are valid soft-error responses and
  // both surface as a thrown error from the client. We just assert that it rejects.
  it('random gibberish rejects', async () => {
    const account = await WinixAccount.fromCredentials(USERNAME!, PASSWORD!);
    const client = new WinixClient(account.getIdentityId());
    await expect(client.getDeviceStatus('not-a-device-id')).rejects.toThrow();
  }, 30_000);
});
