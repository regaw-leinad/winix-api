import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios, { AxiosError, AxiosHeaders } from 'axios';
import { WinixClient, RateLimitError } from '../src';

vi.mock('axios', async () => {
  const actual = await vi.importActual<typeof import('axios')>('axios');
  return {
    ...actual,
    default: {
      get: vi.fn(),
    },
  };
});

const mockedAxiosGet = vi.mocked(axios.get);

function createAxiosError(status: number): AxiosError {
  return new AxiosError(
    `Request failed with status code ${status}`,
    String(status),
    undefined,
    undefined,
    {
      status,
      data: { message: 'error' },
      statusText: 'error',
      headers: {},
      config: { headers: new AxiosHeaders() },
    },
  );
}

const DEVICE_ID = 'test-device-123';
const IDENTITY_ID = 'us-east-1:84008e15-d6af-4698-8646-66d05c1abe8b';

const mockStatusResponse = {
  data: {
    headers: { resultCode: 'S', resultMessage: 'success' },
    body: {
      data: [{
        attributes: {
          A02: '1',
          A03: '01',
          A04: '01',
          A21: '100',
        },
      }],
    },
  },
};

const mockSetResponse = {
  data: {
    headers: { resultCode: 'S', resultMessage: 'success' },
    body: {},
  },
};

describe('WinixClient', () => {
  let client: WinixClient;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    client = new WinixClient(IDENTITY_ID);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('construction', () => {
    it('throws if identityId is empty', () => {
      expect(() => new WinixClient('')).toThrow(/non-empty identityId/);
    });
  });

  describe('URL format', () => {
    it('uses identityId (not A211) in the control URL', async () => {
      mockedAxiosGet.mockResolvedValue(mockSetResponse);
      await client.setPower(DEVICE_ID, '1' as any);
      const calledUrl = mockedAxiosGet.mock.calls[0][0] as string;
      expect(calledUrl).toContain(`/common/control/devices/${DEVICE_ID}/${IDENTITY_ID}/A02:1`);
      expect(calledUrl).not.toContain('/A211/');
    });

    it('uses the plain status URL for reads', async () => {
      mockedAxiosGet.mockResolvedValue(mockStatusResponse);
      await client.getDeviceStatus(DEVICE_ID);
      const calledUrl = mockedAxiosGet.mock.calls[0][0] as string;
      expect(calledUrl).toBe(`https://us.api.winix-iot.com/common/event/sttus/devices/${DEVICE_ID}`);
    });

    // Pins the URL format for every setter. The instance refactor newly exposed these
    // (previously only setPower/Mode/Airflow/Plasmawave went through the rate-limited client);
    // ensures no wiring got dropped and no setter regresses to a hardcoded segment.
    it.each([
      ['setMode', (c: WinixClient) => c.setMode(DEVICE_ID, '01' as any), 'A03:01'],
      ['setAirflow', (c: WinixClient) => c.setAirflow(DEVICE_ID, '02' as any), 'A04:02'],
      ['setPlasmawave', (c: WinixClient) => c.setPlasmawave(DEVICE_ID, '1' as any), 'A07:1'],
      ['setChildLock', (c: WinixClient) => c.setChildLock(DEVICE_ID, '1' as any), 'A08:1'],
      ['setPollutionLamp', (c: WinixClient) => c.setPollutionLamp(DEVICE_ID, '1' as any), 'A09:1'],
      ['setUV', (c: WinixClient) => c.setUV(DEVICE_ID, '1' as any), 'A10:1'],
      ['setBrightness', (c: WinixClient) => c.setBrightness(DEVICE_ID, '1' as any), 'A16:1'],
      ['setTimer', (c: WinixClient) => c.setTimer(DEVICE_ID, '1' as any), 'A15:1'],
    ])('%s hits the identityId control URL', async (_name, call, expectedSegment) => {
      mockedAxiosGet.mockResolvedValue(mockSetResponse);
      await call(client);
      const calledUrl = mockedAxiosGet.mock.calls[0][0] as string;
      expect(calledUrl).toBe(
        `https://us.api.winix-iot.com/common/control/devices/${DEVICE_ID}/${IDENTITY_ID}/${expectedSegment}`,
      );
    });
  });

  describe('getDeviceStatus', () => {
    it('returns device status on success', async () => {
      mockedAxiosGet.mockResolvedValue(mockStatusResponse);
      const status = await client.getDeviceStatus(DEVICE_ID);
      expect(status.power).toBe('1');
      expect(status.mode).toBe('01');
      expect(status.airflow).toBe('01');
      expect(status.filterHours).toBe(100);
    });

    it('maps optional attributes when present', async () => {
      mockedAxiosGet.mockResolvedValue({
        data: {
          headers: { resultCode: 'S', resultMessage: 'success' },
          body: {
            data: [{
              attributes: {
                A02: '1', A03: '01', A04: '01', A21: '50',
                A07: '1', A08: '0', A09: '1', A10: '0',
                A15: '2', A16: '70',
                S04: '12', S07: '01', S08: '0.85', S14: '42',
              },
            }],
          },
        },
      });
      const status = await client.getDeviceStatus(DEVICE_ID);
      expect(status.plasmawave).toBe('1');
      expect(status.childLock).toBe('0');
      expect(status.pollutionLamp).toBe('1');
      expect(status.uv).toBe('0');
      expect(status.timer).toBe('2');
      expect(status.brightness).toBe('70');
      expect(status.pm25).toBe(12);
      expect(status.airQuality).toBe('01');
      expect(status.airQValue).toBe(0.85);
      expect(status.ambientLight).toBe(42);
    });

    it.each([
      ['numeric poor', '2.5', '03'],
      ['numeric fair', '1.5', '02'],
      ['numeric good', '0.5', '01'],
      ['enum poor passthrough', '03', '03'],
    ])('parses air quality (%s)', async (_label, raw, expected) => {
      mockedAxiosGet.mockResolvedValue({
        data: {
          headers: { resultCode: 'S', resultMessage: 'success' },
          body: {
            data: [{
              attributes: { A02: '1', A03: '01', A04: '01', A21: '0', S07: raw },
            }],
          },
        },
      });
      const status = await client.getDeviceStatus(DEVICE_ID);
      expect(status.airQuality).toBe(expected);
    });

    it('throws RateLimitError on 403', async () => {
      mockedAxiosGet.mockRejectedValue(createAxiosError(403));
      await expect(client.getDeviceStatus(DEVICE_ID)).rejects.toThrow(RateLimitError);
    });

    it('throws RateLimitError on 429', async () => {
      mockedAxiosGet.mockRejectedValue(createAxiosError(429));
      // Second call (advanced past cooldown) also throws, so test on a fresh client
      client = new WinixClient(IDENTITY_ID);
      await expect(client.getDeviceStatus(DEVICE_ID)).rejects.toThrow(RateLimitError);
    });

    it('rethrows other axios errors', async () => {
      mockedAxiosGet.mockRejectedValue(createAxiosError(500));
      await expect(client.getDeviceStatus(DEVICE_ID)).rejects.not.toThrow(RateLimitError);
      await expect(client.getDeviceStatus(DEVICE_ID)).rejects.toThrow(AxiosError);
    });

    it('rethrows non-axios errors', async () => {
      mockedAxiosGet.mockRejectedValue(new Error('network failure'));
      await expect(client.getDeviceStatus(DEVICE_ID)).rejects.toThrow('network failure');
    });
  });

  describe('setPower', () => {
    it('succeeds on 200', async () => {
      mockedAxiosGet.mockResolvedValue(mockSetResponse);
      const result = await client.setPower(DEVICE_ID, '1' as any);
      expect(result).toBe('1');
    });

    it('throws RateLimitError on 403', async () => {
      mockedAxiosGet.mockRejectedValue(createAxiosError(403));
      await expect(client.setPower(DEVICE_ID, '1' as any)).rejects.toThrow(RateLimitError);
    });
  });

  describe('cooldown on RateLimitError', () => {
    it('enters 60s cooldown after RateLimitError', async () => {
      mockedAxiosGet.mockRejectedValue(createAxiosError(429));
      await expect(client.getDeviceStatus(DEVICE_ID)).rejects.toThrow(RateLimitError);

      mockedAxiosGet.mockClear();
      await expect(client.getDeviceStatus(DEVICE_ID)).rejects.toThrow(RateLimitError);
      expect(mockedAxiosGet).not.toHaveBeenCalled();
    });

    it('recovers after 60s', async () => {
      mockedAxiosGet.mockRejectedValueOnce(createAxiosError(429));
      await expect(client.getDeviceStatus(DEVICE_ID)).rejects.toThrow(RateLimitError);

      vi.advanceTimersByTime(60_000);

      mockedAxiosGet.mockResolvedValue(mockStatusResponse);
      const status = await client.getDeviceStatus(DEVICE_ID);
      expect(status.power).toBe('1');
    });

    it('still in cooldown before 60s', async () => {
      mockedAxiosGet.mockRejectedValueOnce(createAxiosError(429));
      await expect(client.getDeviceStatus(DEVICE_ID)).rejects.toThrow(RateLimitError);

      vi.advanceTimersByTime(59_000);

      mockedAxiosGet.mockClear();
      await expect(client.getDeviceStatus(DEVICE_ID)).rejects.toThrow(RateLimitError);
      expect(mockedAxiosGet).not.toHaveBeenCalled();
    });

    it('blocks all methods during cooldown', async () => {
      mockedAxiosGet.mockRejectedValueOnce(createAxiosError(429));
      await expect(client.getDeviceStatus(DEVICE_ID)).rejects.toThrow(RateLimitError);

      mockedAxiosGet.mockClear();
      await expect(client.setPower(DEVICE_ID, '1' as any)).rejects.toThrow(RateLimitError);
      await expect(client.setMode(DEVICE_ID, '01' as any)).rejects.toThrow(RateLimitError);
      await expect(client.setAirflow(DEVICE_ID, '01' as any)).rejects.toThrow(RateLimitError);
      await expect(client.setPlasmawave(DEVICE_ID, '1' as any)).rejects.toThrow(RateLimitError);
      expect(mockedAxiosGet).not.toHaveBeenCalled();
    });

    it('respects custom cooldownMs', async () => {
      const shortClient = new WinixClient(IDENTITY_ID, 5_000);
      mockedAxiosGet.mockRejectedValueOnce(createAxiosError(429));
      await expect(shortClient.getDeviceStatus(DEVICE_ID)).rejects.toThrow(RateLimitError);
      expect(shortClient.getCooldownRemaining()).toBe(5_000);
    });
  });

  describe('getCooldownRemaining', () => {
    it('returns 0 when not rate limited', () => {
      expect(client.getCooldownRemaining()).toBe(0);
    });

    it('returns remaining time during cooldown', async () => {
      mockedAxiosGet.mockRejectedValueOnce(createAxiosError(429));
      await expect(client.getDeviceStatus(DEVICE_ID)).rejects.toThrow(RateLimitError);

      expect(client.getCooldownRemaining()).toBe(60_000);
      vi.advanceTimersByTime(30_000);
      expect(client.getCooldownRemaining()).toBe(30_000);
    });
  });

  describe('non-rate-limit errors', () => {
    it('does not trigger cooldown on other errors', async () => {
      mockedAxiosGet.mockRejectedValueOnce(new Error('network error'));
      await expect(client.getDeviceStatus(DEVICE_ID)).rejects.toThrow('network error');
      expect(client.getCooldownRemaining()).toBe(0);

      mockedAxiosGet.mockResolvedValue(mockStatusResponse);
      const status = await client.getDeviceStatus(DEVICE_ID);
      expect(status.power).toBe('1');
    });
  });
});
