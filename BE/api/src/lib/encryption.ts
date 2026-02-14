import CryptoJS from "crypto-js";

import { env } from "./env.js";

export function encryptString(value: string): string {
  return CryptoJS.AES.encrypt(value, env.ENCRYPTION_KEY).toString();
}

export function decryptString(value: string): string {
  const bytes = CryptoJS.AES.decrypt(value, env.ENCRYPTION_KEY);
  const decrypted = bytes.toString(CryptoJS.enc.Utf8);

  if (!decrypted) {
    throw new Error("failed to decrypt stored value");
  }

  return decrypted;
}
