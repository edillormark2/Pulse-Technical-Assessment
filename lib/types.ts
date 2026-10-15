// Shared types across client + API.

// Signal mailbox message types.
export type SignalType =
  | "request" // connection request (tap a dot)
  | "accept" // recipient accepted
  | "decline" // recipient declined (or auto-declined while busy)
  | "offer" // WebRTC SDP offer
  | "answer" // WebRTC SDP answer
  | "ice" // WebRTC ICE candidate
  | "end"; // hang up / leave the connection

export interface PeerDot {
  id: string;
  lat: number;
  lng: number;
  busy: boolean;
  // Minutes east of UTC on the person's own clock; null if they didn't share it.
  utcOffset: number | null;
}

/** Where you appear to everyone else (already privacy-offset), and your clock. */
export interface PublicSelf {
  lat: number;
  lng: number;
  utcOffset: number;
}

export interface SignalMsg {
  id: string;
  fromId: string; // set by the server from the sender's token, never claimed
  type: SignalType;
  payload: string | null;
  createdAt: string;
}

/** What an ask is for, carried in a request's payload. */
export type Intent = "sunrise";

/** Why the server said "not now" on someone's behalf (a decline's payload). */
export type DeclineReason = "busy" | "away";

/** Your side of a call, as the server records it. */
export interface CallState {
  peerId: string;
  state: "ringing" | "connected";
}

export interface PollResponse {
  peers: PeerDot[];
  signals: SignalMsg[];
  /** Your call as the server sees it; null when you are in none. */
  call: CallState | null;
}

/** A new session: the public id everyone sees, and the secret only you hold. */
export interface JoinResponse {
  id: string;
  token: string;
}
