import { createCipheriv, createDecipheriv } from 'crypto';
import axios from 'axios';

// Extracted from Winix Smart v1.5.6 APK native library (libnative-lib.so)
const AES_KEY = Buffer.from('84be38f854e320dd4a0a8c7fe0f3a9b84c288445916933fc222465bbd5a518d0', 'hex');
const AES_IV = Buffer.from('dfd55f316e72e97b905f8739005c99a7', 'hex');

export const MOBILE_APP_VERSION = '1.5.6';
export const MOBILE_MODEL = 'SM-G988B';

/**
 * Encrypt a JSON payload using AES-256-CBC for the Winix mobile API.
 */
export function encrypt(payload: object): Buffer {
  const cipher = createCipheriv('aes-256-cbc', AES_KEY, AES_IV);
  return Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]);
}

/**
 * Decrypt an AES-256-CBC encrypted response from the Winix mobile API.
 */
export function decrypt<T>(data: Buffer): T {
  const decipher = createDecipheriv('aes-256-cbc', AES_KEY, AES_IV);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  return JSON.parse(decrypted) as T;
}

/**
 * Send an encrypted POST request to the Winix mobile API and return the decrypted response.
 */
export async function mobilePost<T>(url: string, payload: object): Promise<T> {
  const response = await axios.post(url, encrypt(payload), {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Accept': 'application/octet-stream',
    },
    responseType: 'arraybuffer',
  });

  if (response.status !== 200) {
    throw new Error(`Error calling ${url} (${response.status})`);
  }

  return decrypt<T>(Buffer.from(response.data));
}
