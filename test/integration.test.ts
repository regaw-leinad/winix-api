import { describe, it, expect, beforeAll } from 'vitest';
import { WinixAccount, WinixClient, WinixDevice, DeviceStatus, Power, Mode, Airflow } from '../src';

const USERNAME = process.env.WINIX_USERNAME;
const PASSWORD = process.env.WINIX_PASSWORD;
const DEVICE_ID = process.env.WINIX_DEVICE_ID;

const hasCredentials = USERNAME && PASSWORD;
const hasDevice = hasCredentials && DEVICE_ID;

// The device reports its state up to the status API on its own cadence, so a
// command is not reflected immediately. Rather than sleep a fixed guess, poll
// the status plane until the commanded state appears (fast on a good day,
// tolerant on a slow one). The interval is spaced well under the server's
// rate-limit bucket so polling never trips the client's 60s cooldown.
const POLL_INTERVAL_MS = 3_000;
const POLL_TIMEOUT_MS = 30_000;

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

async function waitForStatus(
  client: WinixClient,
  deviceId: string,
  predicate: (s: DeviceStatus) => boolean,
): Promise<DeviceStatus> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  let status = await client.getDeviceStatus(deviceId);
  while (!predicate(status) && Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS);
    status = await client.getDeviceStatus(deviceId);
  }
  return status;
}

describe.runIf(hasCredentials)('winix api integration', () => {
  let account: WinixAccount;
  let client: WinixClient;
  let devices: WinixDevice[];

  describe('authentication', () => {
    it('should login and register with cognito', async () => {
      account = await WinixAccount.fromCredentials(USERNAME!, PASSWORD!);
      expect(account).toBeDefined();
      client = new WinixClient(account.getIdentityId());
    }, 30_000);

    it('should get device list', async () => {
      devices = await account.getDevices();
      expect(devices.length).toBeGreaterThan(0);

      for (const d of devices) {
        expect(d.deviceId).toBeTruthy();
        expect(d.modelName).toBeTruthy();
      }
    });
  });

  describe.runIf(hasDevice)('device control', () => {
    let originalPower: Power;
    let originalMode: Mode;
    let originalAirflow: Airflow;

    beforeAll(async () => {
      const status = await client.getDeviceStatus(DEVICE_ID!);
      originalPower = status.power;
      originalMode = status.mode;
      originalAirflow = status.airflow;
    });

    it('should get device status', async () => {
      const status = await client.getDeviceStatus(DEVICE_ID!);
      expect(Object.values(Power)).toContain(status.power);
      expect(Object.values(Mode)).toContain(status.mode);
      expect(Object.values(Airflow)).toContain(status.airflow);
    });

    it('should turn device off', async () => {
      await client.setPower(DEVICE_ID!, Power.Off);

      const status = await waitForStatus(client, DEVICE_ID!, s => s.power === Power.Off);
      expect(status.power).toBe(Power.Off);
    }, 40_000);

    it('should turn device on after delay', async () => {
      await sleep(10_000);

      await client.setPower(DEVICE_ID!, Power.On);

      const status = await waitForStatus(client, DEVICE_ID!, s => s.power === Power.On);
      expect(status.power).toBe(Power.On);
    }, 50_000);

    it('should set mode to manual and airflow to high', async () => {
      await client.setMode(DEVICE_ID!, Mode.Manual);
      await client.setAirflow(DEVICE_ID!, Airflow.High);

      const status = await waitForStatus(
        client,
        DEVICE_ID!,
        s => s.mode === Mode.Manual && s.airflow === Airflow.High,
      );
      expect(status.mode).toBe(Mode.Manual);
      expect(status.airflow).toBe(Airflow.High);
    }, 50_000);

    it('should restore original state', async () => {
      await client.setMode(DEVICE_ID!, originalMode);
      await client.setAirflow(DEVICE_ID!, originalAirflow);
      await client.setPower(DEVICE_ID!, originalPower);

      // In Auto mode the device controls airflow itself based on air quality, so
      // an explicit setAirflow does not stick. Only wait for / assert it when
      // restoring to Manual.
      const airflowShouldStick = originalMode === Mode.Manual;
      const status = await waitForStatus(
        client,
        DEVICE_ID!,
        s => s.power === originalPower && s.mode === originalMode &&
          (!airflowShouldStick || s.airflow === originalAirflow),
      );
      expect(status.power).toBe(originalPower);
      expect(status.mode).toBe(originalMode);
      if (airflowShouldStick) {
        expect(status.airflow).toBe(originalAirflow);
      }
    }, 60_000);
  });
});
