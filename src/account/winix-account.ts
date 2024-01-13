import { COGNITO_CLIENT_SECRET_KEY, WinixAuth, WinixAuthResponse } from './winix-auth';
import { WinixDevice } from './winix-device';
import { decode, JwtPayload } from 'jsonwebtoken';
import { crc32 } from 'crc';
import axios from 'axios';

const TOKEN_EXPIRY_BUFFER = 10 * 60 * 1000;
const URL_GET_DEVICES = 'https://us.mobile.winix-iot.com/getDeviceInfoList';
const URL_REGISTER_USER = 'https://us.mobile.winix-iot.com/registerUser';
const URL_CHECK_ACCESS_TOKEN = 'https://us.mobile.winix-iot.com/checkAccessToken';

interface WinixDevicesResponse {
  deviceInfoList: WinixDevice[];
}

export class WinixAccount {
  private uuid: string;

  private constructor(private auth: WinixAuthResponse) {
    this.uuid = WinixAccount.generateUuid(auth.accessToken);
  }

  static async fromCredentials(username: string, password: string): Promise<WinixAccount> {
    const auth = await WinixAuth.login(username, password);
    const account = new WinixAccount(auth);
    await account.registerUser(username);
    await account.checkAccessToken();
    return account;
  }

  static async fromRefreshToken(refreshToken: string, userId: string): Promise<WinixAccount> {
    const account = new WinixAccount(await WinixAuth.refresh(userId, refreshToken));
    await account.checkAccessToken();
    return account;
  }

  /**
   * Get a list of devices associated with the account.
   */
  async getDevices(): Promise<WinixDevice[]> {
    const response = await axios.post<WinixDevicesResponse>(URL_GET_DEVICES, {
      accessToken: await this.getAccessToken(),
      uuid: this.uuid,
    });

    if (response.status !== 200) {
      throw new Error(`Error getting devices (${response.status}): ${response.data}`);
    }

    return response.data.deviceInfoList;
  }

  private async refresh(): Promise<void> {
    // Don't refresh if we don't need to
    if (!this.isExpired()) {
      return;
    }

    this.auth = await WinixAuth.refresh(this.auth.userId, this.auth.refreshToken);
    // Generate a new uuid based on the new access token
    this.uuid = WinixAccount.generateUuid(this.auth.accessToken);
    await this.checkAccessToken();
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
   * Register the logged-in android login/uuid with the Winix API.
   * <br>
   * Call after getting a cognito access token, but before checkAccessToken(). This is necessary for the winix backend
   * to recognize the android "uuid" we send in these api requests.
   */
  private async registerUser(email: string): Promise<void> {
    const payload = {
      cognitoClientSecretKey: COGNITO_CLIENT_SECRET_KEY,
      accessToken: await this.getAccessToken(),
      uuid: this.uuid,
      email: email,
      osType: 'android',
      osVersion: '29',
      mobileLang: 'en',
    };

    const response = await axios.post(URL_REGISTER_USER, payload);
    if (response.status !== 200) {
      throw new Error(`Error while registering user (${response.status}): ${response.data}`);
    }
  }

  /**
   * Confirm the validity of the access token with the Winix API.
   */
  private async checkAccessToken(): Promise<void> {
    const payload = {
      cognitoClientSecretKey: COGNITO_CLIENT_SECRET_KEY,
      accessToken: await this.getAccessToken(),
      uuid: this.uuid,
      osVersion: '29',
      mobileLang: 'en',
    };

    const response = await axios.post(URL_CHECK_ACCESS_TOKEN, payload);
    if (response.status !== 200) {
      throw new Error(`Error while checking access token (${response.status}): ${response.data}`);
    }
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
