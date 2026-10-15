import { createHash, randomBytes } from "node:crypto";

// A session has two names. Its public id is shared with everyone online, so
// it is never a credential. Its token is a 256-bit secret held only by the
// owner's tab; the database keeps just its SHA-256, so a copy of the table
// cannot be replayed as anyone.

const TOKEN = /^[A-Za-z0-9_-]{43}$/; // 32 random bytes, base64url

export function newToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function isToken(value: unknown): value is string {
  return typeof value === "string" && TOKEN.test(value);
}
