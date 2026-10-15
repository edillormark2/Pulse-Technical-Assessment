import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { STALE_MS, SIGNAL_TTL_MS } from "@/lib/presence";
import { authenticate } from "@/lib/server/auth";
import { POLL_MIN_MS, RETAIN_MS, RING_MS } from "@/lib/server/limits";
import { fail, ok, sameOrigin } from "@/lib/server/http";
import type { CallState, PollResponse } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Housekeeping, run on a share of polls rather than every one: forget
 * sessions that went quiet (their calls and mailboxes go with them),
 * unanswered asks, undelivered signals and old rate-limit windows.
 */
async function sweep(now: number) {
  await prisma.presence.deleteMany({ where: { lastSeen: { lt: new Date(now - RETAIN_MS) } } });
  await prisma.callMember.deleteMany({
    where: { state: "ringing", createdAt: { lt: new Date(now - RING_MS) } },
  });
  await prisma.signal.deleteMany({ where: { createdAt: { lt: new Date(now - SIGNAL_TTL_MS) } } });
  await prisma.rateLimit.deleteMany({ where: { windowStart: { lt: new Date(now - 60 * 60_000) } } });
}

// POST /api/poll — Authorization: Bearer <token>. The single endpoint that
// drives the live map: it heartbeats the caller, returns who is online, the
// caller's call as the server sees it, and drains the caller's mailbox. A
// POST, because it changes state, and so the token never sits in a URL.
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return fail(403, "forbidden");
  const me = await authenticate(request);
  if (!me) return fail(401, "unknown session");

  // Heartbeat, at most once per POLL_MIN_MS: a tighter loop gets a 429.
  const now = Date.now();
  const beat = await prisma.presence.updateMany({
    where: { id: me.id, lastSeen: { lt: new Date(now - POLL_MIN_MS) } },
    data: { lastSeen: new Date(now) },
  });
  if (beat.count === 0) return fail(429, "polling too fast", { "Retry-After": "1" });

  if (Math.random() < 0.125) await sweep(now);

  const [peers, call, inbox] = await Promise.all([
    prisma.presence.findMany({
      where: { id: { not: me.id }, lastSeen: { gte: new Date(now - STALE_MS) } },
      select: { id: true, lat: true, lng: true, utcOffset: true, call: { select: { state: true } } },
    }),
    prisma.callMember.findUnique({
      where: { personId: me.id },
      select: { peerId: true, state: true },
    }),
    prisma.signal.findMany({
      where: { toId: me.id },
      orderBy: { createdAt: "asc" },
      take: 200,
    }),
  ]);

  // Drain exactly what was read, so a signal inserted meanwhile is never lost.
  if (inbox.length > 0) {
    await prisma.signal.deleteMany({ where: { id: { in: inbox.map((s) => s.id) } } });
  }

  const response: PollResponse = {
    peers: peers.map((p) => ({
      id: p.id,
      lat: p.lat,
      lng: p.lng,
      busy: p.call !== null, // asking, being asked, or talking
      utcOffset: p.utcOffset,
    })),
    call: call ? { peerId: call.peerId, state: call.state as CallState["state"] } : null,
    signals: inbox.map((s) => ({
      id: s.id,
      fromId: s.fromId,
      type: s.type as PollResponse["signals"][number]["type"],
      payload: s.payload,
      createdAt: s.createdAt.toISOString(),
    })),
  };
  return ok(response);
}
