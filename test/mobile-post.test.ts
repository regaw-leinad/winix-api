import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { mobilePost, encrypt } from '../src/account/winix-crypto';

vi.mock('axios', async () => {
  const actual = await vi.importActual<typeof import('axios')>('axios');
  return {
    ...actual,
    default: { post: vi.fn() },
  };
});

const mockedPost = vi.mocked(axios.post);

const URL = 'https://us.mobile.winix-iot.com/registerUser';

function encryptedResponse(status: number, body: object | null) {
  const data = body === null ? Buffer.alloc(0) : encrypt(body);
  return { status, data: data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) };
}

describe('mobilePost', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the decrypted body on HTTP 200 with resultCode=200', async () => {
    mockedPost.mockResolvedValue(encryptedResponse(200, { resultCode: '200', resultMessage: 'ok', data: 42 }));
    const result = await mobilePost<{ data: number }>(URL, { foo: 'bar' });
    expect(result.data).toBe(42);
  });

  it('throws with server resultCode/resultMessage on HTTP 400 with an encrypted body', async () => {
    mockedPost.mockResolvedValue(encryptedResponse(400, { resultCode: '401', resultMessage: 'identityId missing' }));
    await expect(mobilePost(URL, {})).rejects.toThrow(/HTTP 400.*resultCode=401.*identityId missing/);
  });

  it('throws with HTTP info when the non-2xx body cannot be decrypted', async () => {
    mockedPost.mockResolvedValue({ status: 502, data: Buffer.from('<html>gateway</html>').buffer });
    await expect(mobilePost(URL, {})).rejects.toThrow(/HTTP 502.*no decryptable body/);
  });

  it('throws when HTTP 200 but server resultCode is not 200', async () => {
    mockedPost.mockResolvedValue(encryptedResponse(200, { resultCode: '403', resultMessage: 'invalid access token' }));
    await expect(mobilePost(URL, {})).rejects.toThrow(/resultCode=403.*invalid access token/);
  });

  it('throws on empty response body', async () => {
    mockedPost.mockResolvedValue(encryptedResponse(200, null));
    await expect(mobilePost(URL, {})).rejects.toThrow(/empty or undecryptable/);
  });
});
