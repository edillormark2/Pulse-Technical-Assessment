import { prisma } from "@/lib/prisma";
import { hashToken, isToken } from "@/lib/server/token";

/** The bearer token: the Authorization header, or (for a beacon) the body. */
function readToken(request: Request, body?: Record<string, unknown> | null): string | null {
  const header = request.headers.get("authorization");
  const token = header?.startsWith("Bearer ")
    ? header.slice(7)
    : typeof body?.token === "string"
      ? body.token
      : null;
  return isToken(token) ? token : null;
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
