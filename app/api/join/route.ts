import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { applyPrivacyOffset, isValidLatLng } from "@/lib/geo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Real-world UTC offsets run from UTC-12:00 to UTC+14:00, in 15-minute steps.
function isValidUtcOffset(v: unknown): v is number {
  return (
    typeof v === "number" && Number.isInteger(v) && v >= -720 && v <= 840 && v % 15 === 0
  );
}

// POST /api/join — body { id, lat, lng, utcOffset? } (raw coords).
// Applies a 1–3 km privacy offset and upserts the presence row. Raw
// coordinates are never stored. Responds with the offset position, so the
// client can show its owner exactly where everyone else sees them.
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }

  const { id, lat, lng, utcOffset } = (body ?? {}) as Record<string, unknown>;

  if (typeof id !== "string" || id.length < 8 || id.length > 64) {
    return Response.json({ error: "invalid id" }, { status: 400 });
  }
  if (!isValidLatLng(lat, lng)) {
    return Response.json({ error: "invalid coordinates" }, { status: 400 });
  }
  if (utcOffset !== undefined && !isValidUtcOffset(utcOffset)) {
    return Response.json({ error: "invalid utcOffset" }, { status: 400 });
  }

  const offset = applyPrivacyOffset(lat as number, lng as number);
  const clock = utcOffset ?? null;

  await prisma.presence.upsert({
    where: { id },
    create: {
      id,
      lat: offset.lat,
      lng: offset.lng,
      utcOffset: clock,
      busy: false,
      lastSeen: new Date(),
    },
    update: {
      lat: offset.lat,
      lng: offset.lng,
      utcOffset: clock,
      lastSeen: new Date(),
    },
  });

  return Response.json({ ok: true, lat: offset.lat, lng: offset.lng });
}
