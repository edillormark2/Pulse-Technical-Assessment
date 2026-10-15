import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/leave — body { id, peerId? }. Removes the presence row and any
// pending signals to/from this user, then ends the call with `peerId` if one
// was in progress. Called via navigator.sendBeacon on tab close, so the body
// may arrive as text — parse defensively.
export async function POST(request: NextRequest) {
  let id: unknown;
  let peerId: unknown;
  try {
    const text = await request.text();
    const body = text ? JSON.parse(text) : null;
    id = body?.id;
    peerId = body?.peerId;
  } catch {
    id = undefined;
  }

  if (typeof id !== "string" || !id) {
    return Response.json({ error: "invalid id" }, { status: 400 });
  }

  // Independent cleanup deletes — no atomicity needed (and interactive
  // transactions are unreliable over a PgBouncer pooler).
  await prisma.signal.deleteMany({
    where: { OR: [{ toId: id }, { fromId: id }] },
  });
  await prisma.presence.deleteMany({ where: { id } });

  // A closing tab drops its WebRTC connection without telling the other side,
  // which would otherwise sit in a frozen call (camera on) until ICE gives up
  // ~30s later. Say goodbye on the leaver's behalf, after the cleanup above so
  // this "end" is not deleted with the rest.
  if (typeof peerId === "string" && peerId && peerId !== id) {
    await prisma.signal.create({
      data: { fromId: id, toId: peerId, type: "end", payload: null },
    });
    await prisma.presence.updateMany({
      where: { id: peerId },
      data: { busy: false },
    });
  }

  return Response.json({ ok: true });
}
