import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WinixClient, RateLimitError, WinixAPI } from '../src';

vi.mock('../src/api', () => ({
  WinixAPI: {
    getDeviceStatus: vi.fn(),
    setPower: vi.fn(),
    setMode: vi.fn(),
    setAirflow: vi.fn(),
    setPlasmawave: vi.fn(),
  },
}));

const DEVICE_ID = 'test-device-123';

const mockStatus = {
  power: '1',
  mode: '01',
  airflow: '01',
  filterHours: 100,
};

describe('WinixClient', () => {
  let client: WinixClient;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    client = new WinixClient();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('passthrough on success', () => {
    it('should return device status from WinixAPI', async () => {
      vi.mocked(WinixAPI.getDeviceStatus).mockResolvedValue(mockStatus as any);
      const result = await client.getDeviceStatus(DEVICE_ID);
      expect(result).toEqual(mockStatus);
      expect(WinixAPI.getDeviceStatus).toHaveBeenCalledWith(DEVICE_ID);
    });

    it('should pass through setPower', async () => {
      vi.mocked(WinixAPI.setPower).mockResolvedValue('1' as any);
      const result = await client.setPower(DEVICE_ID, '1' as any);
      expect(result).toBe('1');
    });
  });

  describe('cooldown on RateLimitError', () => {
    it('should enter 60s cooldown after RateLimitError', async () => {
      vi.mocked(WinixAPI.getDeviceStatus).mockRejectedValue(new RateLimitError());

      // First call triggers cooldown
      await expect(client.getDeviceStatus(DEVICE_ID)).rejects.toThrow(RateLimitError);

      // Second call should throw immediately without calling API
      vi.mocked(WinixAPI.getDeviceStatus).mockClear();
      await expect(client.getDeviceStatus(DEVICE_ID)).rejects.toThrow(RateLimitError);
      expect(WinixAPI.getDeviceStatus).not.toHaveBeenCalled();
    });

    it('should recover after 60s', async () => {
      vi.mocked(WinixAPI.getDeviceStatus).mockRejectedValueOnce(new RateLimitError());
      await expect(client.getDeviceStatus(DEVICE_ID)).rejects.toThrow(RateLimitError);

      vi.advanceTimersByTime(60_000);

      vi.mocked(WinixAPI.getDeviceStatus).mockResolvedValue(mockStatus as any);
      const result = await client.getDeviceStatus(DEVICE_ID);
      expect(result).toEqual(mockStatus);
      expect(WinixAPI.getDeviceStatus).toHaveBeenCalledWith(DEVICE_ID);
    });

    it('should still be in cooldown before 60s', async () => {
      vi.mocked(WinixAPI.getDeviceStatus).mockRejectedValueOnce(new RateLimitError());
      await expect(client.getDeviceStatus(DEVICE_ID)).rejects.toThrow(RateLimitError);

      vi.advanceTimersByTime(59_000);

      vi.mocked(WinixAPI.getDeviceStatus).mockClear();
      await expect(client.getDeviceStatus(DEVICE_ID)).rejects.toThrow(RateLimitError);
      expect(WinixAPI.getDeviceStatus).not.toHaveBeenCalled();
    });

    it('should block all methods during cooldown', async () => {
      vi.mocked(WinixAPI.getDeviceStatus).mockRejectedValueOnce(new RateLimitError());
      await expect(client.getDeviceStatus(DEVICE_ID)).rejects.toThrow(RateLimitError);

      await expect(client.setPower(DEVICE_ID, '1' as any)).rejects.toThrow(RateLimitError);
      expect(WinixAPI.setPower).not.toHaveBeenCalled();

      await expect(client.setMode(DEVICE_ID, '01' as any)).rejects.toThrow(RateLimitError);
      expect(WinixAPI.setMode).not.toHaveBeenCalled();

      await expect(client.setAirflow(DEVICE_ID, '01' as any)).rejects.toThrow(RateLimitError);
      expect(WinixAPI.setAirflow).not.toHaveBeenCalled();

      await expect(client.setPlasmawave(DEVICE_ID, '1' as any)).rejects.toThrow(RateLimitError);
      expect(WinixAPI.setPlasmawave).not.toHaveBeenCalled();
    });
  });

  describe('getCooldownRemaining', () => {
    it('should return 0 when not rate limited', () => {
      expect(client.getCooldownRemaining()).toBe(0);
    });

    it('should return remaining time during cooldown', async () => {
      vi.mocked(WinixAPI.getDeviceStatus).mockRejectedValueOnce(new RateLimitError());
      await expect(client.getDeviceStatus(DEVICE_ID)).rejects.toThrow(RateLimitError);

      expect(client.getCooldownRemaining()).toBe(60_000);
      vi.advanceTimersByTime(30_000);
      expect(client.getCooldownRemaining()).toBe(30_000);
    });
  });

  describe('non-rate-limit errors', () => {
    it('should not trigger cooldown on other errors', async () => {
      vi.mocked(WinixAPI.getDeviceStatus).mockRejectedValueOnce(new Error('network error'));
      await expect(client.getDeviceStatus(DEVICE_ID)).rejects.toThrow('network error');

      expect(client.getCooldownRemaining()).toBe(0);

      vi.mocked(WinixAPI.getDeviceStatus).mockResolvedValue(mockStatus as any);
      const result = await client.getDeviceStatus(DEVICE_ID);
      expect(result).toEqual(mockStatus);
    });
  });
});
