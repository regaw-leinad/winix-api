import { describe, it, expect } from 'vitest';
import { WinixAPI, WinixClient, RateLimitError, Power } from '../src';

const DEVICE_ID = process.env.WINIX_DEVICE_ID;

describe.runIf(DEVICE_ID)('rate limiting integration', () => {
  it('should throw RateLimitError, block during cooldown, and recover', async () => {
    const client = new WinixClient();

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
    const client = new WinixClient();

    // A bogus device ID should return an application-level error, not a rate limit
    try {
      await client.getDeviceStatus('fake-device-id-does-not-exist');
    } catch (e) {
      expect(e).not.toBeInstanceOf(RateLimitError);
    }

    // Client should not be in cooldown
    expect(client.getCooldownRemaining()).toBe(0);
  }, 15_000);

  it('should work normally for a single request after recovery', async () => {
    // Wait for any leftover rate limit from previous test to clear
    await new Promise(r => setTimeout(r, 75_000));

    const client = new WinixClient();

    // Single request should succeed and not trigger cooldown
    const status = await client.getDeviceStatus(DEVICE_ID!);
    expect(status.power).toBeDefined();
    expect(client.getCooldownRemaining()).toBe(0);

    // Verify the raw API also returns RateLimitError (not AxiosError) when rate limited
    let hitLimit = false;
    for (let i = 0; i < 100 && !hitLimit; i++) {
      try {
        await WinixAPI.getDeviceStatus(DEVICE_ID!);
      } catch (e) {
        expect(e).toBeInstanceOf(RateLimitError);
        hitLimit = true;
      }
    }
    expect(hitLimit).toBe(true);
  }, 120_000);
});
