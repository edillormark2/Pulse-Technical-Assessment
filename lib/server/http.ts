import { createHash } from "node:crypto";

/** Small JSON bodies only: the largest legitimate one is an SDP offer. */
export const MAX_BODY_BYTES = 48 * 1024;

const NO_STORE = { "Cache-Control": "no-store" };

export function ok(body: unknown = { ok: true }): Response {
  return Response.json(body, { headers: NO_STORE });
}

/** A short, stable error the client can act on; never a stack trace. */
export function fail(status: number, error: string, headers: Record<string, string> = {}): Response {
  return Response.json({ error }, { status, headers: { ...NO_STORE, ...headers } });
}

/**
 * Parse a small JSON object body. Reads text rather than `request.json()`
 * because `navigator.sendBeacon` posts text/plain. Returns null for anything
 * oversized, malformed, or not a plain object.
 */
export async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) return null;
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return null;
  try {
    const value: unknown = JSON.parse(text);
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/**
 * Browsers always say where a request came from. Refusing other origins
 * stops some other site from making its visitors' browsers join or signal
 * here. Clients that send no Origin (curl, scripts) still meet the rate
 * limits and the token checks.
 */
export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === request.headers.get("host");
  } catch {
    return false;
  }
}

/**
 * A salted hash of the caller's IP, for per-network limits. The address
 * itself is never stored. On Vercel `x-forwarded-for` is set by the edge,
 * not by the client.
 */
export function networkKey(request: Request): string {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "local";
  return createHash("sha256").update(`pulse-net:${ip}`).digest("base64url").slice(0, 22);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Public ids are server-generated UUIDs; anything else is not a person. */
export function isPublicId(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}
