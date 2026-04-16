import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WinixAccount } from '../src';

// Minimal mocks: skip Cognito SRP + mobile API entirely, drive the factory via WinixAuth.refresh.
vi.mock('../src/account/winix-auth', async () => {
  const actual = await vi.importActual<typeof import('../src/account/winix-auth')>('../src/account/winix-auth');
  return {
    ...actual,
    WinixAuth: {
      refresh: vi.fn(),
    },
  };
});

vi.mock('../src/account/winix-crypto', async () => {
  const actual = await vi.importActual<typeof import('../src/account/winix-crypto')>('../src/account/winix-crypto');
  return {
    ...actual,
    mobilePost: vi.fn().mockResolvedValue({ resultCode: '200', resultMessage: 'ok' }),
  };
});

vi.mock('@aws-sdk/client-cognito-identity', () => {
  class CognitoIdentity {
    async getId() {
      return { IdentityId: 'us-east-1:resolved-identity-id' };
    }
  }
  return { CognitoIdentity };
});

// JWT with sub claim, unsigned. Payload decodes to { sub: "user-sub-123" }.
const FAKE_JWT = 'eyJhbGciOiJub25lIn0.eyJzdWIiOiJ1c2VyLXN1Yi0xMjMifQ.';

describe('WinixAccount.getIdentityId', () => {
  beforeEach(async () => {
    const { WinixAuth } = await import('../src/account/winix-auth');
    vi.mocked(WinixAuth.refresh).mockResolvedValue({
      accessToken: FAKE_JWT,
      idToken: FAKE_JWT,
      refreshToken: 'refresh-token',
      userId: 'user-sub-123',
      expiresAt: Date.now() + 3600_000,
    });
  });

  it('returns the identityId resolved during session establishment', async () => {
    const account = await WinixAccount.fromExistingAuth({
      username: 'u@example.com',
      refreshToken: 'refresh-token',
      userId: 'user-sub-123',
    });

    expect(account.getIdentityId()).toBe('us-east-1:resolved-identity-id');
  });
});
