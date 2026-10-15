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
  fromId: string;
  toId: string;
  type: SignalType;
  payload: string | null;
  createdAt: string;
}

export interface PollResponse {
  // False when the caller's presence row no longer exists (reaped or left):
  // the client must join again to reappear on the map.
  present: boolean;
  peers: PeerDot[];
  signals: SignalMsg[];
}
