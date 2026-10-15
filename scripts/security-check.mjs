// Attack the Pulse API the way a stranger with curl would, and assert each
// attempt is refused: forged identities, signals outside a call, harassment
// after "not now", oversized payloads, floods, and requests from other sites.
//
// Run against a local server with the database in .env:
//   npm run dev            (or: npm run build && npm start)
//   npm run test:security  (node --env-file=.env scripts/security-check.mjs)
//
// It creates a few sessions, leaves them, and clears the rate-limit counters
// it used, so it refuses to point anywhere but this machine.
import { createHash } from "node:crypto";

const BASE = process.argv[2] ?? "http://localhost:3000";
if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(BASE).hostname)) {
  console.error(`Refusing to run against ${BASE}: this check is for a local server only.`);
  process.exit(2);
}
const results = [];
const check = (name, pass, detail = "") => {
  results.push({ name, pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function call(path, { token, body, method = "POST", headers = {} } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
  let json = null;
  try {
    json = await res.json();
  } catch {}
  return { status: res.status, json };
}

const join = (lat, lng) => call("/api/join", { body: { lat, lng, utcOffset: 480 } });
// Polls are limited to one per 100 ms per session; space them out.
const poll = async (s) => {
  await sleep(120);
  return call("/api/poll", { token: s.token });
};
const signal = (s, to, type, payload) => call("/api/signal", { token: s.token, body: { to, type, payload } });

// --- sessions -------------------------------------------------------------
const A = (await join(14.6, 121.0)).json;
const B = (await join(37.77, -122.42)).json;
const C = (await join(51.5, -0.12)).json;
check("join returns a public id and a 256-bit token", /^[0-9a-f-]{36}$/.test(A.id) && /^[\w-]{43}$/.test(A.token));

let p = await poll(A);
const listed = p.json.peers.find((x) => x.id === B.id);
check("peers list shows others by public id only", !!listed && !("token" in listed) && !JSON.stringify(p.json).includes(B.token));
check("a fresh session has no call", p.json.call === null);

// --- identity ------------------------------------------------------------
check("poll without a token is refused", (await call("/api/poll")).status === 401);
check("poll with someone's public id as a token is refused", (await call("/api/poll", { token: B.id })).status === 401);
check("poll with a made-up token is refused", (await call("/api/poll", { token: "x".repeat(43) })).status === 401);
check("poll by GET (token in URL) no longer exists", (await call(`/api/poll?id=${B.id}`, { method: "GET" })).status === 405);
check(
  "old-style forged signal (fromId in body, no token) is refused",
  (await call("/api/signal", { body: { fromId: B.id, toId: A.id, type: "accept" } })).status === 401,
);
check(
  "leaving someone else by their id is refused",
  (await call("/api/leave", { body: JSON.stringify({ id: B.id }) })).status === 401,
);

// --- call state ------------------------------------------------------------
check("accepting a call nobody asked for is refused", (await signal(A, B.id, "accept")).status === 409);
check(
  "sending SDP to someone you are not connected to is refused",
  (await signal(A, B.id, "offer", JSON.stringify({ type: "offer", sdp: "v=0" }))).status === 409,
);
check("asking with a payload attached is refused", (await signal(A, B.id, "request", "x")).status === 400);
check("signalling yourself is refused", (await signal(A, A.id, "request")).status === 400);
check("signalling a made-up id is refused", (await signal(A, "not-an-id", "request")).status === 400);

check("A asks B", (await signal(A, B.id, "request")).status === 200);
p = await poll(B);
check(
  "B receives the request, from A's real id, with a ringing call",
  p.json.signals.some((s) => s.type === "request" && s.fromId === A.id) && p.json.call?.state === "ringing",
);
check("A cannot answer their own ask", (await signal(A, B.id, "accept")).status === 409);

const cAsks = await signal(C, B.id, "request");
p = await poll(C);
check(
  "C asking B while B is being asked gets 'busy' from the server",
  cAsks.status === 200 && p.json.signals.some((s) => s.type === "decline" && JSON.parse(s.payload ?? "{}").reason === "busy"),
);

check("B says not now", (await signal(B, A.id, "decline")).status === 200);
p = await poll(A);
check("A hears 'not now' and the call is gone", p.json.signals.some((s) => s.type === "decline") && p.json.call === null);
await signal(A, B.id, "request");
const bAfter = await poll(B);
const aAfter = await poll(A);
check(
  "A cannot ask B again straight away (cooldown): B is not disturbed",
  !bAfter.json.signals.some((s) => s.type === "request") && aAfter.json.signals.some((s) => s.type === "decline") && bAfter.json.call === null,
);

check("C asks B", (await signal(C, B.id, "request")).status === 200);
await poll(B);
check("B accepts C", (await signal(B, C.id, "accept")).status === 200);
p = await poll(C);
check("C sees accept and a connected call", p.json.signals.some((s) => s.type === "accept") && p.json.call?.state === "connected");
check("C can now send an offer to B", (await signal(C, B.id, "offer", JSON.stringify({ type: "offer", sdp: "v=0" }))).status === 200);
check(
  "A still cannot inject SDP into B's call",
  (await signal(A, B.id, "offer", JSON.stringify({ type: "offer", sdp: "v=0" }))).status === 409,
);
p = await poll(A);
check("others see B and C as busy", p.json.peers.find((x) => x.id === B.id)?.busy && p.json.peers.find((x) => x.id === C.id)?.busy);

// --- size and rate -----------------------------------------------------------
check("an oversized SDP is refused (413)", (await signal(C, B.id, "offer", "x".repeat(33 * 1024))).status === 413);
check("an oversized ICE candidate is refused (413)", (await signal(C, B.id, "ice", "x".repeat(5 * 1024))).status === 413);
check(
  "an oversized body is refused before parsing",
  (await call("/api/signal", { token: C.token, body: JSON.stringify({ to: B.id, type: "ice", payload: "x".repeat(60 * 1024) }) })).status === 400,
);

const D = (await join(-33.87, 151.21)).json;
let lastStatus = 0;
for (let i = 0; i < 11; i++) {
  // Asks to people who are not online: each counts against the ask budget.
  lastStatus = (await signal(D, crypto.randomUUID(), "request")).status;
}
check("asking more than 10 times a minute is refused (429)", lastStatus === 429);

const E = (await join(40.71, -74.0)).json;
let floodStatus = 0;
for (let i = 0; i < 155 && floodStatus !== 429; i++) floodStatus = (await signal(E, A.id, "end")).status;
check("more than 150 signals in 10 s is refused (429)", floodStatus === 429);

await sleep(150);
const [fast1, fast2] = await Promise.all([call("/api/poll", { token: A.token }), call("/api/poll", { token: A.token })]);
check("polling faster than every 100 ms is refused (429)", [fast1.status, fast2.status].includes(429));

check(
  "a request from another site's page is refused (403)",
  (await call("/api/join", { body: { lat: 1, lng: 1 }, headers: { Origin: "https://evil.example" } })).status === 403,
);
check("invalid coordinates are refused", (await join(123, 456)).status === 400);

// --- storage -------------------------------------------------------------------
const { createRequire } = await import("node:module");
const pg = createRequire(process.cwd() + "/package.json")("pg");
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const row = (await db.query(`select "tokenHash" from "Presence" where id = $1`, [A.id])).rows[0];
check(
  "the database keeps only the token's SHA-256",
  row?.tokenHash === createHash("sha256").update(A.token).digest("hex") && row.tokenHash !== A.token,
);

// --- leaving ----------------------------------------------------------------
check("B leaves with its own token (beacon body)", (await call("/api/leave", { body: JSON.stringify({ token: B.token }) })).status === 200);
p = await poll(C);
check("C is told the call ended and B is gone", p.json.signals.some((s) => s.type === "end") && p.json.call === null && !p.json.peers.some((x) => x.id === B.id));
check("B's token stops working", (await call("/api/poll", { token: B.token })).status === 401);

// --- clean up: leave everyone, forget this run's counters ------------------------
for (const s of [A, C, D, E]) await call("/api/leave", { body: JSON.stringify({ token: s.token }) });
await db.query(`delete from "RateLimit"`);
await db.end();

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
