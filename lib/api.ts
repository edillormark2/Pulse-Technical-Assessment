// Client-side helpers for talking to the coordination API.
import type { PollResponse, PublicSelf, SignalType } from "@/lib/types";

/** This device's clock offset in minutes east of UTC (e.g. 480 for UTC+8). */
export function localUtcOffset(): number {
  return -new Date().getTimezoneOffset();
}

/** Join (or rejoin) the map. Resolves to where everyone else will see you. */
export async function join(
  id: string,
  lat: number,
  lng: number,
): Promise<PublicSelf> {
  const utcOffset = localUtcOffset();
  const res = await fetch("/api/join", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, lat, lng, utcOffset }),
  });
  if (!res.ok) throw new Error(`join failed: ${res.status}`);
  const body = (await res.json()) as { lat: number; lng: number };
  return { lat: body.lat, lng: body.lng, utcOffset };
}

export async function poll(id: string): Promise<PollResponse> {
  const res = await fetch(`/api/poll?id=${encodeURIComponent(id)}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`poll failed: ${res.status}`);
  return res.json();
}

export async function sendSignal(
  fromId: string,
  toId: string,
  type: SignalType,
  payload?: string,
): Promise<void> {
  await fetch("/api/signal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fromId, toId, type, payload }),
  });
}

// Fire-and-forget leave that survives the tab closing. `peerId` is whoever we
// are connected to (or negotiating with): a closing tab does not shut its
// WebRTC connection down gracefully, so the server tells them for us.
export function leave(id: string, peerId?: string): void {
  const body = JSON.stringify({ id, peerId });
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
