import { describe, it, expect, beforeAll } from 'vitest';
import { WinixAccount, WinixAPI, WinixDevice, Power, Mode, Airflow } from '../src';

const USERNAME = process.env.WINIX_USERNAME;
const PASSWORD = process.env.WINIX_PASSWORD;
const DEVICE_ID = process.env.WINIX_DEVICE_ID;

const hasCredentials = USERNAME && PASSWORD;
const hasDevice = hasCredentials && DEVICE_ID;

// The device needs time to process commands before the status API reflects the change.
const DEVICE_SETTLE_MS = 8_000;

function settle(): Promise<void> {
  return new Promise(r => setTimeout(r, DEVICE_SETTLE_MS));
}

describe.runIf(hasCredentials)('winix api integration', () => {
  let account: WinixAccount;
  let devices: WinixDevice[];

  describe('authentication', () => {
    it('should login and register with cognito', async () => {
      account = await WinixAccount.fromCredentials(USERNAME!, PASSWORD!);
      expect(account).toBeDefined();
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
      const status = await WinixAPI.getDeviceStatus(DEVICE_ID!);
      originalPower = status.power;
      originalMode = status.mode;
      originalAirflow = status.airflow;
    });

    it('should get device status', async () => {
      const status = await WinixAPI.getDeviceStatus(DEVICE_ID!);
      expect(Object.values(Power)).toContain(status.power);
      expect(Object.values(Mode)).toContain(status.mode);
      expect(Object.values(Airflow)).toContain(status.airflow);
    });

    it('should turn device off', async () => {
      await WinixAPI.setPower(DEVICE_ID!, Power.Off);
      await settle();

      const status = await WinixAPI.getDeviceStatus(DEVICE_ID!);
      expect(status.power).toBe(Power.Off);
    }, 30_000);

    it('should turn device on after delay', async () => {
      await new Promise(r => setTimeout(r, 10_000));

      await WinixAPI.setPower(DEVICE_ID!, Power.On);
      await settle();

      const status = await WinixAPI.getDeviceStatus(DEVICE_ID!);
      expect(status.power).toBe(Power.On);
    }, 30_000);

    it('should set mode to manual and airflow to high', async () => {
      await WinixAPI.setMode(DEVICE_ID!, Mode.Manual);
      await settle();

      await WinixAPI.setAirflow(DEVICE_ID!, Airflow.High);
      await settle();

      const status = await WinixAPI.getDeviceStatus(DEVICE_ID!);
      expect(status.mode).toBe(Mode.Manual);
      expect(status.airflow).toBe(Airflow.High);
    }, 30_000);

    it('should restore original state', async () => {
      await WinixAPI.setMode(DEVICE_ID!, originalMode);
      await settle();

      await WinixAPI.setAirflow(DEVICE_ID!, originalAirflow);
      await settle();

      await WinixAPI.setPower(DEVICE_ID!, originalPower);
      await settle();

      const status = await WinixAPI.getDeviceStatus(DEVICE_ID!);
      expect(status.power).toBe(originalPower);
      expect(status.mode).toBe(originalMode);
      expect(status.airflow).toBe(originalAirflow);
    }, 45_000);
  });
});
