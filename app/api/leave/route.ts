import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticate } from "@/lib/server/auth";
import { callOf, deliver } from "@/lib/server/calls";
import { fail, ok, readJson, sameOrigin } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/leave — body { token }. Sent with navigator.sendBeacon when the tab
// closes, which cannot set headers, so the token travels in the body. Removes
// the caller from the map; their call (if any) and their mailbox go with them,
// and whoever they were talking to is told the call is over.
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return fail(403, "forbidden");
  const body = await readJson(request);
  const me = await authenticate(request, body);
  if (!me) return fail(401, "unknown session");

  const call = await callOf(me.id);
  await prisma.presence.deleteMany({ where: { id: me.id } });
  // A closing tab drops its WebRTC connection without telling the other side;
  // say goodbye on the leaver's behalf.
  if (call) await deliver(me.id, call.peerId, "end");

  return ok();
}
