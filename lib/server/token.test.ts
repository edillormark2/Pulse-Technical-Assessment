import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { hashToken, isToken, newToken } from "./token.ts";

test("tokens are 256 random bits, URL-safe, and never repeat", () => {
  const seen = new Set<string>();
  for (let i = 0; i < 1000; i++) {
    const token = newToken();
    assert.ok(isToken(token), token);
    assert.equal(Buffer.from(token, "base64url").length, 32);
    seen.add(token);
  }
  assert.equal(seen.size, 1000);
});

test("only the SHA-256 of a token is stored, and it is stable", () => {
  const token = newToken();
  assert.equal(hashToken(token), createHash("sha256").update(token).digest("hex"));
  assert.equal(hashToken(token), hashToken(token));
  assert.notEqual(hashToken(token), token);
});

test("anything that is not a token is refused", () => {
  for (const value of [undefined, null, 42, "", "short", "x".repeat(44), "has spaces in it padded out to 43 characters", crypto.randomUUID()]) {
    assert.equal(isToken(value), false, String(value));
  }
});
