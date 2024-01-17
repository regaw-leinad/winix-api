/**
 * This is a partial port of the Warrant-lite library to Typescript.
 * https://github.com/capless/warrant-lite/blob/master/warrant_lite/__init__.py
 */

import {
  CognitoIdentityProvider,
  InitiateAuthCommandOutput,
  RespondToAuthChallengeCommandOutput,
} from '@aws-sdk/client-cognito-identity-provider';
import { format } from 'date-fns';
import crypto from 'crypto';

class ForceChangePasswordException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ForceChangePasswordException';
  }
}

const hexHighChars: Set<string> = new Set(['8', '9', 'A', 'B', 'C', 'D', 'E', 'F', 'a', 'b', 'c', 'd', 'e', 'f']);
// https://github.com/amazon-archives/amazon-cognito-identity-js/blob/master/src/AuthenticationHelper.js#L22
const nHex = 'FFFFFFFFFFFFFFFFC90FDAA22168C234C4C6628B80DC1CD1' +
  '29024E088A67CC74020BBEA63B139B22514A08798E3404DD' +
  'EF9519B3CD3A431B302B0A6DF25F14374FE1356D6D51C245' +
  'E485B576625E7EC6F44C42E9A637ED6B0BFF5CB6F406B7ED' +
  'EE386BFB5A899FA5AE9F24117C4B1FE649286651ECE45B3D' +
  'C2007CB8A163BF0598DA48361C55D39A69163FA8FD24CF5F' +
  '83655D23DCA3AD961C62F356208552BB9ED529077096966D' +
  '670C354E4ABC9804F1746C08CA18217C32905E462E36CE3B' +
  'E39E772C180E86039B2783A2EC07A28FB5C55DF06F4C52C9' +
  'DE2BCBF6955817183995497CEA956AE515D2261898FA0510' +
  '15728E5A8AAAC42DAD33170D04507A33A85521ABDF1CBA64' +
  'ECFB850458DBEF0A8AEA71575D060C7DB3970F85A6E1E4C7' +
  'ABF5AE8CDB0933D71E8C94E04A25619DCEE3D2261AD2EE6B' +
  'F12FFA06D98A0864D87602733EC86A64521F2B18177B200C' +
  'BBE117577A615D6C770988C0BAD946E208E24FA074E5AB31' +
  '43DB5BFCE0FD108E4B82D120A93AD2CAFFFFFFFFFFFFFFFF';

// https://github.com/amazon-archives/amazon-cognito-identity-js/blob/master/src/AuthenticationHelper.js#L49
const gHex = '2';
const infoBits = Buffer.from('Caldera Derived Key', 'utf-8');

function hashSha256(buf: Buffer): string {
  const hash = crypto.createHash('sha256').update(buf).digest('hex');
  return hash.padStart(64, '0');
}

function hexHash(hexString: string): string {
  return hashSha256(Buffer.from(hexString, 'hex'));
}

function hexToLong(hexString: string): bigint {
  return BigInt('0x' + hexString);
}

function longToHex(longNum: bigint): string {
  return longNum.toString(16);
}

function getRandom(nbytes: number): bigint {
  return hexToLong(crypto.randomBytes(nbytes).toString('hex'));
}

function padHex(longInt: bigint | string): string {
  let hashStr = typeof longInt === 'bigint' ? longToHex(longInt) : longInt;
  if (hashStr.length % 2 === 1) {
    hashStr = '0' + hashStr;
  } else if (hexHighChars.has(hashStr[0])) {
    hashStr = '00' + hashStr;
  }
  return hashStr;
}

function computeHkdf(ikm: Buffer, salt: Buffer): Buffer {
  const prk = crypto.createHmac('sha256', salt).update(ikm).digest();
  const infoBitsUpdate = Buffer.concat([infoBits, Buffer.from([1])]);
  return crypto.createHmac('sha256', prk).update(infoBitsUpdate).digest().subarray(0, 16);
}

function calculateU(bigA: bigint, bigB: bigint): bigint {
  const uHexHash = hexHash(padHex(bigA) + padHex(bigB));
  return hexToLong(uHexHash);
}

function powMod(base: bigint, exponent: bigint, modulus: bigint): bigint {
  let result = BigInt(1);
  base = base % modulus;

  while (exponent > 0) {
    if (exponent % BigInt(2) === BigInt(1)) {
      result = (result * base) % modulus;
    }
    exponent = exponent / BigInt(2);
    base = (base * base) % modulus;
  }

  return result;
}

export class WarrantLite {
  private static readonly NEW_PASSWORD_REQUIRED_CHALLENGE = 'NEW_PASSWORD_REQUIRED';
  private static readonly PASSWORD_VERIFIER_CHALLENGE = 'PASSWORD_VERIFIER';

  private readonly bigN: bigint;
  private readonly g: bigint;
  private readonly k: bigint;
  private readonly smallAValue: bigint;
  private readonly largeAValue: bigint;

  constructor(
    private username: string,
    private password: string,
    private client: CognitoIdentityProvider,
    private poolId: string,
    private clientId: string,
    private clientSecret: string,
  ) {
    this.bigN = hexToLong(nHex);
    this.g = hexToLong(gHex);
    this.k = hexToLong(hexHash('00' + nHex + '0' + gHex));
    this.smallAValue = this.generateRandomSmallA();
    this.largeAValue = this.calculateA();
  }

  static getSecretHash(username: string, clientId: string, clientSecret: string): string {
    const message = Buffer.from(username + clientId, 'utf-8');
    const hmac = crypto.createHmac('sha256', clientSecret).update(message).digest();
    return hmac.toString('base64');
  }

  async authenticateUser(): Promise<RespondToAuthChallengeCommandOutput> {
    const authParams = this.getAuthParams();

    let response: InitiateAuthCommandOutput;
    try {
      response = await this.client.initiateAuth({
        AuthFlow: 'USER_SRP_AUTH',
        AuthParameters: authParams,
        ClientId: this.clientId,
      });
    } catch (error) {
      console.error('Error during authentication:', error);
      throw error;
    }

    if (response.ChallengeName !== WarrantLite.PASSWORD_VERIFIER_CHALLENGE) {
      throw new Error(`Unsupported challenge: ${response.ChallengeName}`);
    }

    // Here we must have a PASSWORD_VERIFIER_CHALLENGE
    const challengeResponse = this.processChallenge(response.ChallengeParameters!);
    challengeResponse['USERNAME'] = this.username;

    const tokens = await this.client.respondToAuthChallenge({
      ClientId: this.clientId,
      ChallengeName: WarrantLite.PASSWORD_VERIFIER_CHALLENGE,
      ChallengeResponses: challengeResponse,
    });

    if (tokens.ChallengeName === WarrantLite.NEW_PASSWORD_REQUIRED_CHALLENGE) {
      throw new ForceChangePasswordException('Change password before authenticating');
    }

    return tokens;
  }

  private generateRandomSmallA(): bigint {
    const randomLongInt = getRandom(128);
    return randomLongInt % this.bigN;
  }

  private calculateA(): bigint {
    const bigA = powMod(this.g, this.smallAValue, this.bigN);

    if (bigA % this.bigN === BigInt(0)) {
      throw new Error('Safety check for A failed');
    }
    return bigA;
  }

  private getPasswordAuthenticationKey(username: string, password: string, serverBValue: bigint, salt: bigint): Buffer {
    const uValue = calculateU(this.largeAValue, serverBValue);
    if (uValue === BigInt(0)) {
      throw new Error('U cannot be zero.');
    }

    const usernamePassword = `${this.poolId.split('_')[1]}${username}:${password}`;
    const usernamePasswordHash = hashSha256(Buffer.from(usernamePassword));

    const xValue = hexToLong(hexHash(padHex(salt) + usernamePasswordHash));
    const gModPowXN = powMod(this.g, xValue, this.bigN);
    const intValue2 = serverBValue - this.k * gModPowXN;
    const sValue = powMod(intValue2, this.smallAValue + uValue * xValue, this.bigN);

    return computeHkdf(Buffer.from(padHex(sValue), 'hex'), Buffer.from(padHex(longToHex(uValue)), 'hex'));
  }

  private getAuthParams(): Record<string, string> {
    return {
      USERNAME: this.username,
      SRP_A: longToHex(this.largeAValue),
      SECRET_HASH: WarrantLite.getSecretHash(this.username, this.clientId, this.clientSecret),
    };
  }

  private processChallenge(challengeParameters: Record<string, string>): Record<string, string> {
    const userIdForSrp = challengeParameters['USER_ID_FOR_SRP'];
    const saltHex = challengeParameters['SALT'];
    const srpBHex = challengeParameters['SRP_B'];
    const secretBlockB64 = challengeParameters['SECRET_BLOCK'];

    const timestamp = this.getFormattedTimestamp();
    const hkdf = this.getPasswordAuthenticationKey(userIdForSrp, this.password, hexToLong(srpBHex), hexToLong(saltHex));
    const secretBlockBytes = Buffer.from(secretBlockB64, 'base64');

    const message = Buffer.concat([
      Buffer.from(this.poolId.split('_')[1], 'utf-8'),
      Buffer.from(userIdForSrp, 'utf-8'),
      secretBlockBytes,
      Buffer.from(timestamp, 'utf-8'),
    ]);

    const hmac = crypto.createHmac('sha256', hkdf).update(message).digest();
    const signatureString = hmac.toString('base64');

    return {
      TIMESTAMP: timestamp,
      USERNAME: userIdForSrp,
      PASSWORD_CLAIM_SECRET_BLOCK: secretBlockB64,
      PASSWORD_CLAIM_SIGNATURE: signatureString,
      SECRET_HASH: WarrantLite.getSecretHash(this.username, this.clientId, this.clientSecret),
    };
  }

  private getFormattedTimestamp(): string {
    const now = new Date();
    const utcDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(),
      now.getUTCHours(), now.getUTCMinutes(), now.getUTCSeconds()));

    return format(utcDate, 'EEE MMM d HH:mm:ss \'UTC\' yyyy');
  }
}
