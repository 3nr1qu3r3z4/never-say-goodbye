import "server-only";

import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const keyLength = 64;

export async function hashSecret(secret: string) {
  const salt = randomBytes(16);
  const key = (await scrypt(secret, salt, keyLength)) as Buffer;
  return `scrypt:${salt.toString("hex")}:${key.toString("hex")}`;
}

export async function verifySecret(secret: string, encoded: string) {
  const [algorithm, saltHex, keyHex] = encoded.split(":");
  if (algorithm !== "scrypt" || !saltHex || !keyHex) return false;

  const salt = Buffer.from(saltHex, "hex");
  const expectedKey = Buffer.from(keyHex, "hex");
  if (salt.length !== 16 || expectedKey.length !== keyLength) return false;

  const actualKey = (await scrypt(secret, salt, keyLength)) as Buffer;
  return timingSafeEqual(actualKey, expectedKey);
}
