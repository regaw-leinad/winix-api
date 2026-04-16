import { describe, it, expect, beforeAll } from 'vitest';
import { WinixAccount, WinixClient, RateLimitError, Power } from '../src';

const USERNAME = process.env.WINIX_USERNAME;
const PASSWORD = process.env.WINIX_PASSWORD;
const DEVICE_ID = process.env.WINIX_DEVICE_ID;

const canRun = USERNAME && PASSWORD && DEVICE_ID;

describe.runIf(canRun)('rate limiting integration', () => {
  let identityId: string;

  beforeAll(async () => {
    const account = await WinixAccount.fromCredentials(USERNAME!, PASSWORD!);
    identityId = account.getIdentityId();
  }, 30_000);

  it('should throw RateLimitError, block during cooldown, and recover', async () => {
    const client = new WinixClient(identityId);

    // Step 1: Drain the bucket with rapid-fire requests
    let requestCount = 0;
    let rateLimited = false;

    while (!rateLimited && requestCount < 100) {
      try {
        await client.getDeviceStatus(DEVICE_ID!);
        requestCount++;
      } catch (e) {
        expect(e).toBeInstanceOf(RateLimitError);
        rateLimited = true;
      }
    }

    expect(rateLimited).toBe(true);
    expect(requestCount).toBeGreaterThan(0);

    // Step 2: Client should block subsequent calls without hitting the API
    expect(client.getCooldownRemaining()).toBeGreaterThan(0);
    await expect(client.getDeviceStatus(DEVICE_ID!)).rejects.toThrow(RateLimitError);
    await expect(client.setPower(DEVICE_ID!, Power.On)).rejects.toThrow(RateLimitError);

    // Step 3: Wait for cooldown + API recovery, then verify it works again
    await new Promise(r => setTimeout(r, 75_000));

    const status = await client.getDeviceStatus(DEVICE_ID!);
    expect(status.power).toBeDefined();
    expect(client.getCooldownRemaining()).toBe(0);
  }, 180_000);

  it('should not trigger cooldown on invalid device ID', async () => {
    const client = new WinixClient(identityId);

    // A bogus device ID should return an application-level error, not a rate limit
    try {
      await client.getDeviceStatus('fake-device-id-does-not-exist');
    } catch (e) {
      expect(e).not.toBeInstanceOf(RateLimitError);
    }

    // Client should not be in cooldown
    expect(client.getCooldownRemaining()).toBe(0);
  }, 15_000);
});
