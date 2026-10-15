// Client-side helpers for talking to the coordination API.
import type { JoinResponse, PollResponse, SignalType } from "@/lib/types";

/** This device's clock offset in minutes east of UTC (e.g. 480 for UTC+8). */
export function localUtcOffset(): number {
  return -new Date().getTimezoneOffset();
}

/**
 * Your session: the public id everyone sees, and the secret token only this
 * tab holds. It lives in memory, never in storage or a URL.
 */
export type Session = JoinResponse;

/** The server no longer knows this session (it expired or left): join again. */
export class SessionGone extends Error {}

const auth = (session: Session) => ({ Authorization: `Bearer ${session.token}` });

/** Join the map at a position that is already privacy-offset on this device. */
export async function join(lat: number, lng: number): Promise<Session> {
  const res = await fetch("/api/join", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lat, lng, utcOffset: localUtcOffset() }),
  });
  if (!res.ok) throw new Error(`join failed: ${res.status}`);
  return (await res.json()) as Session;
}

export async function poll(session: Session): Promise<PollResponse> {
  const res = await fetch("/api/poll", {
    method: "POST",
    headers: auth(session),
    cache: "no-store",
  });
  if (res.status === 401) throw new SessionGone();
  if (!res.ok) throw new Error(`poll failed: ${res.status}`);
  return (await res.json()) as PollResponse;
}

export async function sendSignal(
  session: Session,
  to: string,
  type: SignalType,
  payload?: string,
): Promise<void> {
  await fetch("/api/signal", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...auth(session) },
    body: JSON.stringify({ to, type, payload }),
  });
}

// Fire-and-forget leave that survives the tab closing. A beacon cannot set
// headers, so the token travels in its body; the server ends any call on our
// behalf, since a closing tab drops its WebRTC connection without a goodbye.
export function leave(session: Session): void {
  const body = JSON.stringify({ token: session.token });
  if (typeof navigator !== "undefined" && navigator.sendBeacon) {
    navigator.sendBeacon("/api/leave", body);
  } else {
    void fetch("/api/leave", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    });
  }
}
