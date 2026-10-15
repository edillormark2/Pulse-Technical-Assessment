import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { isValidLatLng } from "@/lib/geo";
import { newToken, hashToken } from "@/lib/server/auth";
import { allow } from "@/lib/server/rate-limit";
import { JOIN_LIMIT } from "@/lib/server/limits";
import { fail, networkKey, ok, readJson, sameOrigin } from "@/lib/server/http";
import type { JoinResponse } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Real-world UTC offsets run from UTC-12:00 to UTC+14:00, in 15-minute steps.
function isValidUtcOffset(v: unknown): v is number {
  return (
    typeof v === "number" && Number.isInteger(v) && v >= -720 && v <= 840 && v % 15 === 0
  );
}

/** About a metre: more precision than a privacy-offset dot can use. */
const round = (v: number) => Math.round(v * 1e5) / 1e5;

// POST /api/join — body { lat, lng, utcOffset? }, already privacy-offset on
// the device (the raw location never reaches the server). Creates a session
// and returns its public id and its secret token. The token authenticates
// every later call; only its hash is stored.
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return fail(403, "forbidden");
  const body = await readJson(request);
  if (!body) return fail(400, "invalid body");

  const { lat, lng, utcOffset } = body;
  if (!isValidLatLng(lat, lng)) return fail(400, "invalid coordinates");
  if (utcOffset !== undefined && !isValidUtcOffset(utcOffset)) {
    return fail(400, "invalid utcOffset");
  }

  // Each network can only add so many people, so nobody fills the map with bots.
  if (!(await allow(`join:${networkKey(request)}`, JOIN_LIMIT.limit, JOIN_LIMIT.windowMs))) {
    return fail(429, "too many new sessions", { "Retry-After": "60" });
  }

  const token = newToken();
  const presence = await prisma.presence.create({
    data: {
      tokenHash: hashToken(token),
      lat: round(lat as number),
      lng: round(lng as number),
      utcOffset: utcOffset ?? null,
      lastSeen: new Date(),
    },
    select: { id: true },
  });

  const response: JoinResponse = { id: presence.id, token };
  return ok(response);
}
