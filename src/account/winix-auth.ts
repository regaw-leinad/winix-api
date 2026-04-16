import { CognitoIdentityProvider, NotAuthorizedException } from '@aws-sdk/client-cognito-identity-provider';
import { WarrantLite } from './warrant-lite';
import { decode } from 'jsonwebtoken';

// Pulled from Winix Smart v1.5.7 (Android) APK.
// Winix rotated the client on 2026-04-16 and moved to a public client (no secret).
export const COGNITO_APP_CLIENT_ID = '5rjk59c5tt7k9g8gpj0vd2qfg9';
export const COGNITO_USER_POOL_ID = 'us-east-1_Ofd50EosD';
export const COGNITO_REGION = 'us-east-1';

const COGNITO_CLIENT = new CognitoIdentityProvider({
  region: COGNITO_REGION,
});

export interface WinixAuthResponse {
  userId: string;
  accessToken: string;
  idToken: string;
  expiresAt: number;
  refreshToken: string;
}

export class RefreshTokenExpiredError extends Error {
  constructor() {
    super('Refresh token has expired');
  }
}

export class WinixAuth {

  static async login(username: string, password: string, maxAttempts = 3): Promise<WinixAuthResponse> {
    // Retry with a fresh WarrantLite instance per attempt to generate new SRP values each time.
    const response = await retry(() => {
      const w = new WarrantLite(username, password, COGNITO_CLIENT, COGNITO_USER_POOL_ID, COGNITO_APP_CLIENT_ID);
      return w.authenticateUser();
    }, maxAttempts, 3000);
    const sub = decode(response.AuthenticationResult!.AccessToken!)!.sub as string;

    return {
      userId: sub,
      accessToken: response.AuthenticationResult!.AccessToken!,
      idToken: response.AuthenticationResult!.IdToken!,
      expiresAt: toExpiresAt(response.AuthenticationResult!.ExpiresIn!),
      refreshToken: response.AuthenticationResult!.RefreshToken!,
    };
  }

  static async refresh(refreshToken: string, userId: string): Promise<WinixAuthResponse> {
    const authParams = {
      REFRESH_TOKEN: refreshToken,
    };

    let response;

    try {
      response = await COGNITO_CLIENT.initiateAuth({
        ClientId: COGNITO_APP_CLIENT_ID,
        AuthFlow: 'REFRESH_TOKEN',
        AuthParameters: authParams,
      });
    } catch (error) {
      if (error instanceof NotAuthorizedException) {
        throw new RefreshTokenExpiredError();
      }
      throw error;
    }

    return {
      userId: userId,
      accessToken: response.AuthenticationResult!.AccessToken!,
      idToken: response.AuthenticationResult!.IdToken!,
      expiresAt: toExpiresAt(response.AuthenticationResult!.ExpiresIn!),
      refreshToken: refreshToken,
    };
  }
}

/**
 * Retry a function a maximum number of times, with a delay between each attempt.
 *
 * @param fn
 * @param maxAttempts
 * @param delayMs
 */
async function retry<T>(fn: () => Promise<T>, maxAttempts: number, delayMs: number): Promise<T> {
  let error: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (e) {
      error = e;
      await delay(delayMs);
    }
  }

  // If we get here, we've exceeded the maximum number of attempts - throw the last error we got
  throw error;
}

function toExpiresAt(expiresIn: number): number {
  return Date.now() + expiresIn * 1000;
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
