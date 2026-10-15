import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { SignalType } from "@/lib/types";

// The server, not the clients, knows who is calling whom. A call is two
// CallMember rows (one per person); everything a client may say about a call
// is checked against them.

/** This person's side of their call, if they are in one. */
export function callOf(personId: string) {
  return prisma.callMember.findUnique({
    where: { personId },
    select: { peerId: true, role: true, state: true },
  });
}

/**
 * Reserve both people for a new call. Both rows go in one INSERT, and the
 * primary key on personId makes it fail whole if either is already in a
 * call, so two requests racing for the same person can never both win.
 */
export async function startCall(callerId: string, calleeId: string): Promise<boolean> {
  try {
    await prisma.callMember.createMany({
      data: [
        { personId: callerId, peerId: calleeId, role: "caller", state: "ringing" },
        { personId: calleeId, peerId: callerId, role: "callee", state: "ringing" },
      ],
    });
    return true;
  } catch (error) {
    // P2002: one of them is already in a call. P2003: one of them just left.
    if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2003"].includes(error.code)) {
      return false;
    }
    throw error;
  }
}

/** They asked each other at the same moment: either side may now accept. */
export async function markMutual(personId: string): Promise<void> {
  await prisma.callMember.updateMany({
    where: { personId, state: "ringing" },
    data: { role: "caller" },
  });
}

/**
 * Whether `personId` may answer (accept or decline) the ringing call with
 * `peerId`: only the person who was asked, or either one of a mutual ask.
 */
export async function mayAnswer(personId: string, peerId: string): Promise<boolean> {
  const [mine, theirs] = await Promise.all([callOf(personId), callOf(peerId)]);
  if (!mine || mine.peerId !== peerId || mine.state !== "ringing") return false;
  if (theirs?.peerId !== personId) return false;
  return mine.role === "callee" || (mine.role === "caller" && theirs.role === "caller");
}

/** Ringing becomes connected for both, or for neither. */
export async function connectCall(a: string, b: string): Promise<boolean> {
  const updated = await prisma.callMember.updateMany({
    where: {
      state: "ringing",
      OR: [
        { personId: a, peerId: b },
        { personId: b, peerId: a },
      ],
    },
    data: { state: "connected" },
  });
  return updated.count === 2;
}

export async function endCall(a: string, b: string): Promise<void> {
  await prisma.callMember.deleteMany({
    where: {
      OR: [
        { personId: a, peerId: b },
        { personId: b, peerId: a },
      ],
    },
  });
}

/**
 * Drop one message in `toId`'s mailbox. Returns false when the recipient no
 * longer exists (the mailbox is tied to their presence).
 */
export async function deliver(
  fromId: string,
  toId: string,
  type: SignalType,
  payload: string | null = null,
): Promise<boolean> {
  try {
    await prisma.signal.create({ data: { fromId, toId, type, payload } });
    return true;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") return false;
    throw error;
  }
}
