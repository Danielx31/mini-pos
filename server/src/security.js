import { randomBytes, scryptSync, timingSafeEqual, createHash } from "node:crypto";

const HASH_LENGTH = 64;
export const SESSION_SECONDS = 60 * 60 * 8;

export function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, HASH_LENGTH).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  const [salt, expectedHex] = stored.split(":");
  if (!salt || !expectedHex || expectedHex.length !== HASH_LENGTH * 2) return false;
  const actual = scryptSync(password, salt, HASH_LENGTH);
  return timingSafeEqual(actual, Buffer.from(expectedHex, "hex"));
}

export function randomToken() {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

export function cookieValue(token, secure) {
  return `pos_session=${token}; HttpOnly; Path=/api/v1; SameSite=Strict; Max-Age=${SESSION_SECONDS}${secure ? "; Secure" : ""}`;
}

export function clearCookie(secure) {
  return `pos_session=; HttpOnly; Path=/api/v1; SameSite=Strict; Max-Age=0${secure ? "; Secure" : ""}`;
}
