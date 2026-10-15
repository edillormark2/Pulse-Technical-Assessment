import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { STALE_MS } from "@/lib/presence";
import { authenticate } from "@/lib/server/auth";
import { allow, inCooldown, startCooldown } from "@/lib/server/rate-limit";
import {
  callOf,
  connectCall,
  deliver,
  endCall,
  markMutual,
  mayAnswer,
  startCall,
} from "@/lib/server/calls";
import {
  DECLINE_COOLDOWN_MS,
  MAX_ICE,
  MAX_SDP,
  REQUEST_LIMIT,
  SIGNAL_LIMIT,
} from "@/lib/server/limits";
import { fail, isPublicId, ok, readJson, sameOrigin } from "@/lib/server/http";
import type { DeclineReason, SignalType } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TYPES: SignalType[] = ["request", "accept", "decline", "offer", "answer", "ice", "end"];

/** What an ask may say it is for: only these exact payloads are passed on. */
const INTENTS = new Set(['{"intent":"sunrise"}']);

/** What a client may attach to each signal: SDP and ICE carry JSON; the rest nothing. */
function payloadProblem(type: SignalType, payload: unknown): string | null {
  if (type === "request") {
    const none = payload === undefined || payload === null;
    return none || (typeof payload === "string" && INTENTS.has(payload)) ? null : "unexpected payload";
  }
  const limit = type === "offer" || type === "answer" ? MAX_SDP : type === "ice" ? MAX_ICE : 0;
  if (limit === 0) return payload === undefined || payload === null ? null : "unexpected payload";
  if (typeof payload !== "string" || payload.length === 0) return "missing payload";
  return payload.length > limit ? "payload too large" : null;
}

/** "Not now", said by the server for someone who cannot answer. */
async function autoDecline(me: string, them: string, reason: DeclineReason) {
  await deliver(them, me, "decline", JSON.stringify({ reason }));
  return ok({ declined: reason });
}

async function ask(me: string, them: string, intent: string | null): Promise<Response> {
  if (!(await allow(`request:${me}`, REQUEST_LIMIT.limit, REQUEST_LIMIT.windowMs))) {
    return fail(429, "too many requests", { "Retry-After": "30" });
  }
  const target = await prisma.presence.findUnique({ where: { id: them }, select: { lastSeen: true } });
  if (!target || Date.now() - target.lastSeen.getTime() > STALE_MS) return autoDecline(me, them, "away");
  // Someone who just said "not now" is not asked again for a minute; the asker
  // simply hears "not now" again.
  if (await inCooldown(`declined:${them}:${me}`, DECLINE_COOLDOWN_MS)) {
    await deliver(them, me, "decline");
    return ok({ declined: true });
  }
  if (await startCall(me, them)) {
    await deliver(me, them, "request", intent);
    return ok();
  }
  // They asked us at the same moment: the clients pick who accepts.
  const mine = await callOf(me);
  if (mine?.peerId === them && mine.state === "ringing") {
    await markMutual(me);
    await deliver(me, them, "request", intent);
    return ok();
  }
  return autoDecline(me, them, "busy");
}

// POST /api/signal — Authorization: Bearer <token>; body { to, type, payload? }.
// The sender is whoever the token belongs to, and every signal is checked
// against the call the server knows about: you can only ask someone free,
// only answer someone who asked you, and only exchange SDP/ICE with the
// person you are connected to.
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return fail(403, "forbidden");
  const body = await readJson(request);
  if (!body) return fail(400, "invalid body");
  const session = await authenticate(request);
  if (!session) return fail(401, "unknown session");
  const me = session.id;

  const { to, type, payload } = body;
  if (!isPublicId(to) || to === me) return fail(400, "invalid recipient");
  if (typeof type !== "string" || !TYPES.includes(type as SignalType)) {
    return fail(400, "invalid type");
  }
  const signal = type as SignalType;
  const problem = payloadProblem(signal, payload);
  if (problem) return fail(problem === "payload too large" ? 413 : 400, problem);

  if (!(await allow(`signal:${me}`, SIGNAL_LIMIT.limit, SIGNAL_LIMIT.windowMs))) {
    return fail(429, "too many signals", { "Retry-After": "5" });
  }

  switch (signal) {
    case "request":
      return ask(me, to, typeof payload === "string" ? payload : null);

    case "accept": {
      if (!(await mayAnswer(me, to)) || !(await connectCall(me, to))) {
        return fail(409, "no request to accept");
      }
      await deliver(me, to, "accept");
      return ok();
    }

    case "decline": {
      if (!(await mayAnswer(me, to))) return fail(409, "no request to decline");
      await endCall(me, to);
      await startCooldown(`declined:${me}:${to}`);
      await deliver(me, to, "decline");
      return ok();
    }

    case "offer":
    case "answer":
    case "ice": {
      const mine = await callOf(me);
      if (mine?.peerId !== to || mine.state !== "connected") {
        return fail(409, "not connected to them");
      }
      await deliver(me, to, signal, payload as string);
      return ok();
    }

    case "end": {
      // Idempotent: hanging up a call that already ended is fine.
      const mine = await callOf(me);
      if (mine?.peerId === to) {
        await endCall(me, to);
        await deliver(me, to, "end");
      }
      return ok();
    }
  }
}
