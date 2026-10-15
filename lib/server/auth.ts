import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";

// A session has two names. Its public id is shared with everyone online, so
// it is never a credential. Its token is a 256-bit secret held only by the
// owner's tab; the database keeps just its SHA-256, so a copy of the table
// cannot be replayed as anyone.

const TOKEN = /^[A-Za-z0-9_-]{43}$/; // 32 random bytes, base64url

export function newToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** The bearer token: the Authorization header, or (for a beacon) the body. */
function readToken(request: Request, body?: Record<string, unknown> | null): string | null {
  const header = request.headers.get("authorization");
  const token = header?.startsWith("Bearer ")
    ? header.slice(7)
    : typeof body?.token === "string"
      ? body.token
      : null;
  return token && TOKEN.test(token) ? token : null;
}

export interface Session {
  id: string;
  lastSeen: Date;
}

/** Who is calling, or null when the token is missing, malformed or unknown. */
export async function authenticate(
  request: Request,
  body?: Record<string, unknown> | null,
): Promise<Session | null> {
  const token = readToken(request, body);
  if (!token) return null;
  return prisma.presence.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { id: true, lastSeen: true },
  });
}
