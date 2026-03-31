import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WinixAPI, RateLimitError } from '../src';
import axios, { AxiosError, AxiosHeaders } from 'axios';

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
  const error = new AxiosError(
    `Request failed with status code ${status}`,
    String(status),
    undefined,
    undefined,
    {
      status,
      data: { message: 'Forbidden' },
      statusText: 'Forbidden',
      headers: {},
      config: { headers: new AxiosHeaders() },
    },
  );
  return error;
}

const DEVICE_ID = 'test-device-123';

const mockStatusResponse = {
  data: {
    headers: { resultCode: 'S', resultMessage: 'success' },
    body: {
      data: [{
        attributes: {
          A02: '1', // Power On
          A03: '01', // Mode Auto
          A04: '01', // Airflow Low
          A21: '100', // FilterHours
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

describe('WinixAPI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getDeviceStatus', () => {
    it('should return device status on success', async () => {
      mockedAxiosGet.mockResolvedValue(mockStatusResponse);
      const status = await WinixAPI.getDeviceStatus(DEVICE_ID);
      expect(status.power).toBe('1');
      expect(status.mode).toBe('01');
    });

    it('should throw RateLimitError on 403', async () => {
      mockedAxiosGet.mockRejectedValue(createAxiosError(403));
      await expect(WinixAPI.getDeviceStatus(DEVICE_ID)).rejects.toThrow(RateLimitError);
    });

    it('should throw RateLimitError on 429', async () => {
      mockedAxiosGet.mockRejectedValue(createAxiosError(429));
      await expect(WinixAPI.getDeviceStatus(DEVICE_ID)).rejects.toThrow(RateLimitError);
    });

    it('should rethrow other errors as-is', async () => {
      const error = createAxiosError(500);
      mockedAxiosGet.mockRejectedValue(error);
      await expect(WinixAPI.getDeviceStatus(DEVICE_ID)).rejects.toThrow(AxiosError);
      await expect(WinixAPI.getDeviceStatus(DEVICE_ID)).rejects.not.toThrow(RateLimitError);
    });

    it('should rethrow non-axios errors as-is', async () => {
      mockedAxiosGet.mockRejectedValue(new Error('network failure'));
      await expect(WinixAPI.getDeviceStatus(DEVICE_ID)).rejects.toThrow('network failure');
    });
  });

  describe('setPower', () => {
    it('should succeed on 200', async () => {
      mockedAxiosGet.mockResolvedValue(mockSetResponse);
      const result = await WinixAPI.setPower(DEVICE_ID, '1' as any);
      expect(result).toBe('1');
    });

    it('should throw RateLimitError on 403', async () => {
      mockedAxiosGet.mockRejectedValue(createAxiosError(403));
      await expect(WinixAPI.setPower(DEVICE_ID, '1' as any)).rejects.toThrow(RateLimitError);
    });

    it('should throw RateLimitError on 429', async () => {
      mockedAxiosGet.mockRejectedValue(createAxiosError(429));
      await expect(WinixAPI.setPower(DEVICE_ID, '1' as any)).rejects.toThrow(RateLimitError);
    });

    it('should rethrow other errors as-is', async () => {
      mockedAxiosGet.mockRejectedValue(createAxiosError(500));
      await expect(WinixAPI.setPower(DEVICE_ID, '1' as any)).rejects.not.toThrow(RateLimitError);
    });
  });
});
