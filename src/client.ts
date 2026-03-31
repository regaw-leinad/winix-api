import { Airflow, DeviceStatus, Mode, Plasmawave, Power } from './device';
import { RateLimitError } from './error';
import { WinixAPI } from './api';

const COOLDOWN_MS = 60_000;

export class WinixClient {
  private cooldownUntil = 0;

  /**
   * Returns the remaining cooldown time in milliseconds, or 0 if not rate limited.
   */
  getCooldownRemaining(): number {
    return Math.max(0, this.cooldownUntil - Date.now());
  }

  async getDeviceStatus(deviceId: string): Promise<DeviceStatus> {
    return this.execute(() => WinixAPI.getDeviceStatus(deviceId));
  }

  async setPower(deviceId: string, value: Power): Promise<Power> {
    return this.execute(() => WinixAPI.setPower(deviceId, value));
  }

  async setMode(deviceId: string, value: Mode): Promise<Mode> {
    return this.execute(() => WinixAPI.setMode(deviceId, value));
  }

  async setAirflow(deviceId: string, value: Airflow): Promise<Airflow> {
    return this.execute(() => WinixAPI.setAirflow(deviceId, value));
  }

  async setPlasmawave(deviceId: string, value: Plasmawave): Promise<Plasmawave> {
    return this.execute(() => WinixAPI.setPlasmawave(deviceId, value));
  }

  private async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (Date.now() < this.cooldownUntil) {
      throw new RateLimitError();
    }

    try {
      return await fn();
    } catch (e: unknown) {
      if (e instanceof RateLimitError) {
        this.cooldownUntil = Date.now() + COOLDOWN_MS;
      }
      throw e;
    }
  }
}
