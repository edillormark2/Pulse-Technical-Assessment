// Server-side budgets. Generous for a person, tight for a script.

/** New sessions per network: enough for a household or an office behind one IP. */
export const JOIN_LIMIT = { limit: 30, windowMs: 10 * 60_000 };

/** All signals per session; a handshake sends a dozen or two ICE candidates. */
export const SIGNAL_LIMIT = { limit: 150, windowMs: 10_000 };

/** Asking someone to talk, per session. */
export const REQUEST_LIMIT = { limit: 10, windowMs: 60_000 };

/** Fastest heartbeat accepted; the client's quickest cadence is 400 ms. */
export const POLL_MIN_MS = 100;

/** A presence row lingers this long after its last poll, so a tab that slept
 *  can come back as itself; it stops showing on the map after STALE_MS. */
export const RETAIN_MS = 10 * 60_000;

/** An unanswered ask expires on the server a little after the client's 30 s. */
export const RING_MS = 40_000;

/** After a "not now", the same person cannot ask again for this long. */
export const DECLINE_COOLDOWN_MS = 60_000;

/** Largest signal payloads: an SDP description, an ICE candidate. */
export const MAX_SDP = 32 * 1024;
export const MAX_ICE = 4 * 1024;
