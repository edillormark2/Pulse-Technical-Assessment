import { test } from "node:test";
import assert from "node:assert/strict";
import { isPublicId, MAX_BODY_BYTES, networkKey, readJson, sameOrigin } from "./http.ts";

const post = (body: string, headers: Record<string, string> = {}) =>
  new Request("https://pulse.test/api/x", { method: "POST", body, headers: { host: "pulse.test", ...headers } });

test("readJson accepts a small JSON object", async () => {
  assert.deepEqual(await readJson(post('{"to":"x"}')), { to: "x" });
});

test("readJson refuses oversized, malformed and non-object bodies", async () => {
  assert.equal(await readJson(post("x".repeat(MAX_BODY_BYTES + 1))), null);
  assert.equal(await readJson(post("{}", { "content-length": String(MAX_BODY_BYTES + 1) })), null);
  assert.equal(await readJson(post("{not json")), null);
  assert.equal(await readJson(post("[1,2]")), null);
  assert.equal(await readJson(post("null")), null);
  assert.equal(await readJson(post('"text"')), null);
});

test("sameOrigin lets this site and origin-less clients through, nobody else", () => {
  const req = (origin?: string) =>
    new Request("https://pulse.test/api/x", {
      method: "POST",
      headers: { host: "pulse.test", ...(origin ? { origin } : {}) },
    });
  assert.equal(sameOrigin(req()), true);
  assert.equal(sameOrigin(req("https://pulse.test")), true);
  assert.equal(sameOrigin(req("https://evil.example")), false);
  assert.equal(sameOrigin(req("https://pulse.test.evil.example")), false);
  assert.equal(sameOrigin(req("not a url")), false);
});

test("networkKey is stable per address and never contains it", () => {
  const req = (ip: string) => new Request("https://pulse.test/", { headers: { "x-forwarded-for": `${ip}, 10.0.0.1` } });
  assert.equal(networkKey(req("203.0.113.7")), networkKey(req("203.0.113.7")));
  assert.notEqual(networkKey(req("203.0.113.7")), networkKey(req("203.0.113.8")));
  assert.ok(!networkKey(req("203.0.113.7")).includes("203"));
});

test("public ids are server-made UUIDs only", () => {
  assert.equal(isPublicId(crypto.randomUUID()), true);
  for (const value of ["", "crowd-paris", "x".repeat(36), 7, null, "' OR 1=1 --"]) {
    assert.equal(isPublicId(value), false, String(value));
  }
});
