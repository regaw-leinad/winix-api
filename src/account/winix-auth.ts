import { CognitoIdentityProvider, NotAuthorizedException } from '@aws-sdk/client-cognito-identity-provider';
import { WarrantLite } from './warrant-lite';
import { decode } from 'jsonwebtoken';

// Pulled from Winix Home v1.0.8 (Android) APK
// thanks to https://github.com/hfern/winix
export const COGNITO_APP_CLIENT_ID = '14og512b9u20b8vrdm55d8empi';
export const COGNITO_CLIENT_SECRET_KEY = 'k554d4pvgf2n0chbhgtmbe4q0ul4a9flp3pcl6a47ch6rripvvr';
export const COGNITO_USER_POOL_ID = 'us-east-1_Ofd50EosD';
export const COGNITO_REGION = 'us-east-1';

const COGNITO_CLIENT = new CognitoIdentityProvider({
  region: COGNITO_REGION,
});

export interface WinixAuthResponse {
  userId: string;
  accessToken: string;
  expiresAt: number;
  refreshToken: string;
}

export class RefreshTokenExpiredError extends Error {
  constructor() {
    super('Refresh token has expired');
  }
}

export class WinixAuth {

  static async login(username: string, password: string, maxAttempts = 5): Promise<WinixAuthResponse> {
    const w = new WarrantLite(username, password, COGNITO_CLIENT, COGNITO_USER_POOL_ID, COGNITO_APP_CLIENT_ID, COGNITO_CLIENT_SECRET_KEY);

    // Workaround for Winix's login API failing when user is signed in to the app on another device.
    const response = await retry(() => w.authenticateUser(), maxAttempts, 3000);
    const sub = decode(response.AuthenticationResult!.AccessToken!)!.sub as string;

    return {
      userId: sub,
      accessToken: response.AuthenticationResult!.AccessToken!,
      expiresAt: toExpiresAt(response.AuthenticationResult!.ExpiresIn!),
      refreshToken: response.AuthenticationResult!.RefreshToken!,
    };
  }

  static async refresh(refreshToken: string, userId: string): Promise<WinixAuthResponse> {
    const authParams = {
      REFRESH_TOKEN: refreshToken,
      SECRET_HASH: WarrantLite.getSecretHash(userId, COGNITO_APP_CLIENT_ID, COGNITO_CLIENT_SECRET_KEY),
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
