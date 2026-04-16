import { COGNITO_REGION, WinixAuth, WinixAuthResponse, COGNITO_USER_POOL_ID } from './winix-auth';
import { decode, JwtPayload } from 'jsonwebtoken';
import { WinixDevice } from './winix-device';
import { crc32 } from 'crc';
import { mobilePost, MOBILE_APP_VERSION, MOBILE_MODEL } from './winix-crypto';
import { CognitoIdentity } from '@aws-sdk/client-cognito-identity';

const TOKEN_EXPIRY_BUFFER = 10 * 60 * 1000;
const URL_GET_DEVICES = 'https://us.mobile.winix-iot.com/getDeviceInfoList';
const URL_REGISTER_USER = 'https://us.mobile.winix-iot.com/registerUser';
const URL_CHECK_ACCESS_TOKEN = 'https://us.mobile.winix-iot.com/checkAccessToken';
const URL_INIT = 'https://us.mobile.winix-iot.com/init';

// Pulled from Winix Smart v1.5.7 APK (AWSAbstractCognitoIdentityProvider.java).
const IDENTITY_POOL_ID = 'us-east-1:84008e15-d6af-4698-8646-66d05c1abe8b';
const COGNITO_LOGINS_PROVIDER = `cognito-idp.${COGNITO_REGION}.amazonaws.com/${COGNITO_USER_POOL_ID}`;

const IDENTITY_CLIENT = new CognitoIdentity({ region: COGNITO_REGION });

interface WinixMobileResponse {
  resultCode: string;
  resultMessage: string;
}

interface WinixDevicesResponse extends WinixMobileResponse {
  deviceInfoList: WinixDevice[];
}

/**
 * Existing auth credentials.
 */
export interface WinixExistingAuth {
  /**
   * The username used to log in (email)
   */
  username: string;
  /**
   * The refresh token
   */
  refreshToken: string;
  /**
   * The user id (subject) from the cognito access token
   */
  userId: string;
}

export class WinixAccount {
  private uuid: string;
  private identityId?: string;

  private constructor(private username: string, private auth: WinixAuthResponse) {
    this.uuid = WinixAccount.generateUuid(auth.accessToken);
  }

  /**
   * Create a WinixAccount from credentials.
   *
   * @param username The username (email)
   * @param password The password
   */
  static async fromCredentials(username: string, password: string): Promise<WinixAccount> {
    const auth = await WinixAuth.login(username, password);
    return WinixAccount.from(username, auth);
  }

  /**
   * Create a WinixAccount from existing auth credentials.
   *
   * @param existingAuth Existing auth credentials
   */
  static async fromExistingAuth({ username, refreshToken, userId }: WinixExistingAuth): Promise<WinixAccount> {
    const auth = await WinixAuth.refresh(refreshToken, userId);
    return WinixAccount.from(username, auth);
  }

  /**
   * Create a WinixAccount from an existing WinixAuthResponse and username.
   *
   * @param username The username (email)
   * @param auth The existing auth response
   */
  static async from(username: string, auth: WinixAuthResponse): Promise<WinixAccount> {
    const account = new WinixAccount(username, auth);
    await account.establishSession();
    return account;
  }

  /**
   * Get the Cognito Identity Pool identity id resolved during session establishment.
   * Required to construct a WinixClient for device control.
   */
  getIdentityId(): string {
    if (!this.identityId) {
      throw new Error('identityId not resolved; call a WinixAccount factory before getIdentityId()');
    }
    return this.identityId;
  }

  /**
   * Get a list of devices associated with the account.
   */
  async getDevices(): Promise<WinixDevice[]> {
    const response = await mobilePost<WinixDevicesResponse>(URL_GET_DEVICES, {
      accessToken: await this.getAccessToken(),
      uuid: this.uuid,
    });

    return response.deviceInfoList;
  }

  private async refresh(): Promise<void> {
    // Don't refresh if we don't need to
    if (!this.isExpired()) {
      return;
    }

    this.auth = await WinixAuth.refresh(this.auth.refreshToken, this.auth.userId);
    // Generate a new uuid based on the new access token
    this.uuid = WinixAccount.generateUuid(this.auth.accessToken);
    await this.establishSession();
  }

  /**
   * Run the Winix mobile handshake that follows a fresh login or token refresh.
   * Order is load-bearing: identityId is needed by registerUser/checkAccessToken,
   * and /init sits between registerUser and checkAccessToken as of v1.5.7.
   *
   * Uses this.auth.accessToken directly (not getAccessToken) so a stale isExpired()
   * check can't recursively trigger another refresh mid-handshake.
   */
  private async establishSession(): Promise<void> {
    const accessToken = this.auth.accessToken;
    await this.resolveIdentityId();
    await this.registerUser(accessToken);
    await this.init(accessToken);
    await this.checkAccessToken(accessToken);
  }

  private async getAccessToken(): Promise<string> {
    // refresh if necessary
    if (this.isExpired()) {
      await this.refresh();
    }

    return this.auth.accessToken;
  }

  /**
   * Check if the access token is expired.
   * Mark as expired if it's within 10 minutes of expiring.
   */
  private isExpired(): boolean {
    return !this.auth.accessToken || this.auth.expiresAt <= (Date.now() - TOKEN_EXPIRY_BUFFER);
  }

  /**
   * Resolve the Cognito Identity Pool identity id for the current user.
   * Required in the mobile API payload as of Winix Smart v1.5.7.
   */
  private async resolveIdentityId(): Promise<void> {
    const response = await IDENTITY_CLIENT.getId({
      IdentityPoolId: IDENTITY_POOL_ID,
      Logins: { [COGNITO_LOGINS_PROVIDER]: this.auth.idToken },
    });
    if (!response.IdentityId) {
      throw new Error('Cognito GetId returned no IdentityId');
    }
    this.identityId = response.IdentityId;
  }

  /**
   * Register the logged-in android login/uuid with the Winix API. The winix backend
   * needs to see this registration before it accepts the "uuid" we send on later calls.
   */
  private async registerUser(accessToken: string): Promise<void> {
    await mobilePost<WinixMobileResponse>(URL_REGISTER_USER, {
      identityId: this.identityId,
      accessToken,
      uuid: this.uuid,
      email: this.username,
      osType: 'android',
      osVersion: '29',
      mobileLang: 'en',
      appVersion: MOBILE_APP_VERSION,
      mobileModel: MOBILE_MODEL,
    });
  }

  /**
   * Winix mobile API init endpoint. Called after registerUser() as of v1.5.7.
   */
  private async init(accessToken: string): Promise<void> {
    await mobilePost<WinixMobileResponse>(URL_INIT, {
      accessToken,
      uuid: this.uuid,
      region: 'US',
    });
  }

  /**
   * Confirm the validity of the access token with the Winix API.
   */
  private async checkAccessToken(accessToken: string): Promise<void> {
    await mobilePost<WinixMobileResponse>(URL_CHECK_ACCESS_TOKEN, {
      identityId: this.identityId,
      accessToken,
      uuid: this.uuid,
      osVersion: '29',
      mobileLang: 'en',
      appVersion: MOBILE_APP_VERSION,
      mobileModel: MOBILE_MODEL,
    });
  }

  /**
   * Construct a fake secure android id as
   * CRC32('github.com/regaw-leinad/winix-api' + userid) + CRC32('HGF' + userid)
   * where userid is the subject from the cognito access token.
   */
  private static generateUuid(accessToken: string): string {
    if (!accessToken) {
      return '';
    }

    const decoded: JwtPayload = decode(accessToken) as JwtPayload;
    const sub: string = decoded.sub!;

    const useridB = Buffer.from(sub);
    const p1 = crc32(Buffer.concat([Buffer.from('github.com/regaw-leinad/winix-api'), useridB])).toString(16);
    const p2 = crc32(Buffer.concat([Buffer.from('HGF'), useridB])).toString(16);
    return `${p1}${p2}`;
  }
}
