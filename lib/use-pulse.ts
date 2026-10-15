"use client";

// The whole Pulse session as one hook: presence polling, the connection state
// machine (request → accept → WebRTC → chat → video) and cleanup on exit.
// Components only render what it returns and call its actions.
import { useEffect, useRef, useState } from "react";
import { join, leave, localUtcOffset, poll, sendSignal, SessionGone, type Session } from "@/lib/api";
import { applyPrivacyOffset } from "@/lib/geo";
import { PeerSession, type DescType, type PeerControl } from "@/lib/webrtc";
import { HANDSHAKE_POLL_MS, POLL_INTERVAL_MS } from "@/lib/presence";
import type {
  DeclineReason,
  PeerDot,
  PollResponse,
  PublicSelf,
  SignalMsg,
  SignalType,
} from "@/lib/types";

export type Conn =
  | { kind: "idle" }
  | { kind: "requesting"; peerId: string }
  | { kind: "incoming"; peerId: string }
  | { kind: "connecting"; peerId: string }
  | { kind: "connected"; peerId: string };

export type VideoState = "none" | "requesting" | "incoming" | "active";

export interface ChatMessage {
  id: number;
  mine: boolean;
  text: string;
}

/** How long a finished conversation stays on screen while it dissolves. */
const ENDING_MS = 1400;

const REQUEST_TIMEOUT_MS = 30_000;
// After an accept, how long the data channel may take to open before we give up.
const CONNECT_TIMEOUT_MS = 20_000;
// How long a "disconnected" ICE connection may take to recover before we hang
// up. Left alone, ICE only declares "failed" after ~30s of silence.
const DISCONNECT_GRACE_MS = 5_000;

/** What to tell someone whose ask came back "not now", by who said it. */
const DECLINED: Record<DeclineReason | "them", string> = {
  them: "They said not now.",
  busy: "They\u2019re in another conversation.",
  away: "They just left.",
};

function declineReason(payload: string | null): DeclineReason | "them" {
  try {
    const reason = (JSON.parse(payload ?? "null") as { reason?: unknown } | null)?.reason;
    return reason === "busy" || reason === "away" ? reason : "them";
  } catch {
    return "them";
  }
}

/** About a metre: more precision than a privacy-offset dot can use. */
const round = (v: number) => Math.round(v * 1e5) / 1e5;

export function usePulse({ notify }: { notify: (message: string) => void }) {
  const [phase, setPhase] = useState<"gate" | "live">("gate");
  // Issued by the server when you join: a public id and a secret token. Held
  // in a ref, in memory only; callbacks that outlive a render read it there.
  const sessionRef = useRef<Session | null>(null);
  const [peers, setPeers] = useState<PeerDot[]>([]);
  // False until the first poll lands, so "nobody here" is never shown early.
  const [synced, setSynced] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  // Public position: the privacy-offset spot everyone else sees. It is chosen
  // once on this device and reused on any rejoin; the raw position is never
  // kept or sent.
  const [me, _setMe] = useState<PublicSelf | null>(null);
  const meRef = useRef<PublicSelf | null>(null);
  const setMe = (v: PublicSelf | null) => {
    meRef.current = v;
    _setMe(v);
  };
  // The other end of the current connection, kept even if they drop off the
  // presence list mid-call (a throttled tab can miss heartbeats).
  const [livePeer, setLivePeer] = useState<PeerDot | null>(null);
  // WebRTC link state, so a handshake shows real stages instead of a spinner.
  const [link, setLink] = useState<RTCPeerConnectionState | null>(null);
  // A conversation that just ended, kept briefly so it can dissolve on screen.
  const [ending, setEnding] = useState<{ messages: ChatMessage[] } | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  // Whether you asked (true) or answered (false) the current connection.
  const [caller, setCaller] = useState<boolean | null>(null);

  const [conn, _setConn] = useState<Conn>({ kind: "idle" });
  const connRef = useRef<Conn>(conn);
  const setConn = (c: Conn) => {
    connRef.current = c;
    _setConn(c);
    if (c.kind === "idle") setLivePeer(null);
  };

  const [video, _setVideo] = useState<VideoState>("none");
  const videoRef = useRef<VideoState>(video);
  const setVideo = (v: VideoState) => {
    videoRef.current = v;
    _setVideo(v);
  };

  const peerRef = useRef<PeerSession | null>(null);
  const msgId = useRef(0);
  const messagesRef = useRef<ChatMessage[]>([]);
  const requestTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const endingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Poll right away instead of waiting out the interval (set by the poll loop).
  const pollNow = useRef<() => void>(() => {});

  // Callbacks stored inside a PeerSession outlive the render that created
  // them, so always reach the latest `notify` through a ref.
  const notifyRef = useRef(notify);
  useEffect(() => {
    notifyRef.current = notify;
  });

  /** Send a signal as this session; the server reads who we are from the token. */
  function signal(to: string, type: SignalType, payload?: string): Promise<void> {
    const session = sessionRef.current;
    return session ? sendSignal(session, to, type, payload) : Promise.resolve();
  }

  function addMessage(mine: boolean, text: string) {
    messagesRef.current = [
      ...messagesRef.current,
      { id: msgId.current++, mine, text },
    ];
    setMessages(messagesRef.current);
  }

  function resetMedia() {
    setLocalStream(null);
    setRemoteStream(null);
    setVideo("none");
    setMicOn(true);
    setCameraOn(true);
  }

  function teardown(message?: string) {
    if (requestTimer.current) clearTimeout(requestTimer.current);
    if (connectTimer.current) clearTimeout(connectTimer.current);
    peerRef.current?.close();
    peerRef.current = null;
    resetMedia();
    setLink(null);
    setCaller(null);
    // Nothing is kept: the conversation is cleared now, and only shown for a
    // moment longer while it dissolves on screen.
    const finished = messagesRef.current;
    messagesRef.current = [];
    setMessages([]);
    if (finished.length > 0) {
      if (endingTimer.current) clearTimeout(endingTimer.current);
      setEnding({ messages: finished });
      endingTimer.current = setTimeout(() => setEnding(null), ENDING_MS);
    }
    setConn({ kind: "idle" });
    if (message) notifyRef.current(message);
  }

  // The connection died underneath us: the peer closed their tab, the network
  // dropped, or the channel never opened. Still send "end" — it releases both
  // busy flags on the server, which nobody else is going to do now.
  function dropConnection(ps: PeerSession, peerId: string, message: string) {
    if (peerRef.current !== ps) return; // already torn down or replaced
    void signal(peerId, "end");
    teardown(message);
  }

  function startPeer(peerId: string, initiator: boolean) {
    // Send to this peer one request at a time. Concurrent POSTs land in the
    // mailbox out of order, and SDP applied out of order (a stale offer after
    // a newer answer) breaks renegotiation when video starts or stops.
    let outbox: Promise<void> = Promise.resolve();
    let iceState: RTCPeerConnectionState = "new";
    const ps = new PeerSession(initiator, {
      onSignal: (type: DescType, payload: string) => {
        outbox = outbox
          .then(() => signal(peerId, type, payload))
          .catch(() => {});
      },
      onChat: (text) => addMessage(false, text),
      onControl: (ctrl) => handleControl(ctrl),
      onRemoteStream: (stream) => setRemoteStream(stream),
      onConnectionState: (state) => {
        iceState = state;
        if (peerRef.current === ps) setLink(state);
        if (state === "failed") {
          dropConnection(ps, peerId, "The connection dropped.");
        } else if (state === "disconnected") {
          // Usually the other side vanished without a goodbye (crashed, lost
          // network). It can also be a blip, so give it a moment to recover.
          setTimeout(() => {
            if (iceState === "disconnected") {
              dropConnection(ps, peerId, "They left.");
            }
          }, DISCONNECT_GRACE_MS);
        }
      },
      onChannelOpen: () => {
        if (connectTimer.current) clearTimeout(connectTimer.current);
        setConn({ kind: "connected", peerId });
      },
      onChannelClose: () => dropConnection(ps, peerId, "They left."),
    });
    peerRef.current = ps;
    setLink("new");
    setCaller(initiator);
    connectTimer.current = setTimeout(() => {
      if (connRef.current.kind === "connecting") {
        dropConnection(ps, peerId, "Couldn't open a direct line. Try again.");
      }
    }, CONNECT_TIMEOUT_MS);
  }

  function handleControl(ctrl: PeerControl) {
    const ps = peerRef.current;
    switch (ctrl) {
      case "video-request":
        if (videoRef.current === "none") setVideo("incoming");
        // We both asked at once; each side used to ignore the other's request
        // and wait forever. Treat theirs as the answer to ours.
        else if (videoRef.current === "requesting") acceptVideo();
        break;
      case "video-accept":
        if (videoRef.current === "requesting" && ps) {
          ps.startVideo()
            .then((stream) => {
              setLocalStream(stream);
              setVideo("active");
            })
            .catch(() => {
              setVideo("none");
              ps.sendControl("video-end");
              notifyRef.current("Your camera isn't available.");
            });
        }
        break;
      case "video-decline":
        if (videoRef.current === "requesting") {
          setVideo("none");
          notifyRef.current("They'd rather keep it to text.");
        }
        break;
      case "video-end":
        ps?.stopVideo();
        resetMedia();
        break;
    }
  }

  function requestConnection(peerId: string) {
    if (connRef.current.kind !== "idle") return;
    setConn({ kind: "requesting", peerId });
    setLivePeer(peers.find((p) => p.id === peerId) ?? null);
    void signal(peerId, "request");
    pollNow.current(); // switch to the handshake cadence now
    requestTimer.current = setTimeout(() => {
      if (
        connRef.current.kind === "requesting" &&
        connRef.current.peerId === peerId
      ) {
        void signal(peerId, "end");
        teardown("No answer this time.");
      }
    }, REQUEST_TIMEOUT_MS);
  }

  function cancelRequest() {
    if (connRef.current.kind === "requesting") {
      void signal(connRef.current.peerId, "end");
    }
    teardown();
  }

  // Become the callee for `peerId`: get ready for their offer, then accept.
  function acceptFrom(peerId: string) {
    startPeer(peerId, false);
    void signal(peerId, "accept");
    setConn({ kind: "connecting", peerId });
    pollNow.current(); // their offer is on its way
  }

  function acceptIncoming() {
    if (connRef.current.kind !== "incoming") return;
    acceptFrom(connRef.current.peerId);
  }

  function declineIncoming() {
    if (connRef.current.kind !== "incoming") return;
    void signal(connRef.current.peerId, "decline");
    setConn({ kind: "idle" });
  }

  function endConnection() {
    const c = connRef.current;
    if (c.kind === "connecting" || c.kind === "connected") {
      void signal(c.peerId, "end");
    }
    teardown();
  }

  function sendChat(text: string) {
    peerRef.current?.sendChat(text);
    addMessage(true, text);
  }

  function startVideoRequest() {
    if (videoRef.current !== "none" || !peerRef.current) return;
    setVideo("requesting");
    peerRef.current.sendControl("video-request");
  }

  function acceptVideo() {
    const ps = peerRef.current;
    if (!ps) return;
    ps.startVideo()
      .then((stream) => {
        setLocalStream(stream);
        ps.sendControl("video-accept");
        setVideo("active");
      })
      .catch(() => {
        ps.sendControl("video-decline");
        setVideo("none");
        notifyRef.current("Your camera isn't available.");
      });
  }

  function declineVideo() {
    peerRef.current?.sendControl("video-decline");
    setVideo("none");
  }

  function endVideo() {
    const ps = peerRef.current;
    ps?.stopVideo();
    ps?.sendControl("video-end");
    resetMedia();
  }

  /** Withdraw a video request that hasn't been answered yet. */
  function cancelVideoRequest() {
    if (videoRef.current !== "requesting") return;
    peerRef.current?.sendControl("video-end");
    setVideo("none");
  }

  function toggleMic() {
    const next = !micOn;
    peerRef.current?.setMicEnabled(next);
    setMicOn(next);
  }

  function toggleCamera() {
    const next = !cameraOn;
    peerRef.current?.setCameraEnabled(next);
    setCameraOn(next);
  }

  function processSignal(sig: SignalMsg) {
    switch (sig.type) {
      case "request": {
        const c = connRef.current;
        if (c.kind === "idle") {
          setConn({ kind: "incoming", peerId: sig.fromId });
        } else if (c.kind === "requesting" && c.peerId === sig.fromId) {
          // We tapped each other at the same moment. Declining both requests
          // would turn away two people who both want to talk, so exactly one
          // side (the smaller id) accepts and the other waits for that accept.
          if ((sessionRef.current?.id ?? "") < sig.fromId) {
            if (requestTimer.current) clearTimeout(requestTimer.current);
            acceptFrom(sig.fromId);
          }
        } else {
          void signal(sig.fromId, "decline");
        }
        break;
      }
      case "accept": {
        const c = connRef.current;
        if (c.kind === "requesting" && c.peerId === sig.fromId) {
          if (requestTimer.current) clearTimeout(requestTimer.current);
          startPeer(sig.fromId, true);
          setConn({ kind: "connecting", peerId: sig.fromId });
        } else if (c.kind === "idle") {
          // They accepted just as we cancelled or timed out. The server has
          // already marked us both busy, so hang up to release us both.
          void signal(sig.fromId, "end");
        }
        break;
      }
      case "decline": {
        const c = connRef.current;
        if (c.kind === "requesting" && c.peerId === sig.fromId) {
          if (requestTimer.current) clearTimeout(requestTimer.current);
          teardown(DECLINED[declineReason(sig.payload)]);
        }
        break;
      }
      case "offer":
      case "answer":
      case "ice": {
        const c = connRef.current;
        const peerId =
          c.kind === "connecting" || c.kind === "connected" ? c.peerId : null;
        if (peerRef.current && peerId === sig.fromId) {
          void peerRef.current.handleSignal(
            sig.type as DescType,
            sig.payload ?? "",
          );
        }
        break;
      }
      case "end": {
        const c = connRef.current;
        if (
          (c.kind === "incoming" ||
            c.kind === "connecting" ||
            c.kind === "connected") &&
          c.peerId === sig.fromId
        ) {
          if (c.kind === "incoming") setConn({ kind: "idle" });
          else teardown("They left.");
        }
        break;
      }
    }
  }

  function handlePoll(data: PollResponse) {
    setPeers(data.peers);
    setSynced(true);
    for (const s of data.signals) processSignal(s);

    // Keep the latest known position and clock of whoever we're connected to.
    const current = connRef.current;
    if (current.kind !== "idle") {
      const other = data.peers.find((p) => p.id === current.peerId);
      if (other) setLivePeer(other);
    }

    // The server is the record of who is talking to whom. If our call is gone
    // there (they hung up or left, and the goodbye was lost), end it here too.
    const call = data.call;
    const live = connRef.current;
    if ((live.kind === "connecting" || live.kind === "connected") && call?.peerId !== live.peerId) {
      if (peerRef.current) dropConnection(peerRef.current, live.peerId, "They left.");
      return;
    }
    if (live.kind === "incoming" && call?.peerId !== live.peerId) {
      setConn({ kind: "idle" });
      return;
    }

    // A request or handshake whose other side has left the map can never
    // complete, so stop waiting instead of hanging until a timeout. (A live
    // call is left alone: the P2P link can outlast a throttled tab's
    // heartbeat, and a real departure closes the data channel anyway.)
    const c = connRef.current;
    if (c.kind === "idle" || c.kind === "connected") return;
    if (data.peers.some((p) => p.id === c.peerId)) return;
    if (c.kind === "incoming") {
      setConn({ kind: "idle" });
    } else if (c.kind === "requesting") {
      teardown("They left before answering.");
    } else if (peerRef.current) {
      dropConnection(peerRef.current, c.peerId, "They left.");
    }
  }

  // The server no longer knows this session (it slept for many minutes, or a
  // beacon removed it before a back/forward restore). Any call went with it;
  // end ours and come back under a new session at the same public spot.
  async function rejoin() {
    if (connRef.current.kind !== "idle") teardown("The connection dropped.");
    const spot = meRef.current;
    if (!spot) return;
    try {
      sessionRef.current = await join(spot.lat, spot.lng);
    } catch {}
  }

  const handlePollRef = useRef(handlePoll);
  const rejoinRef = useRef(rejoin);
  useEffect(() => {
    handlePollRef.current = handlePoll;
    rejoinRef.current = rejoin;
  });

  useEffect(() => {
    if (phase !== "live") return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // One poll at a time: two in flight could drain the mailbox into two
    // responses that land out of order. A poll asked for meanwhile runs next.
    let inFlight = false;
    let again = false;

    const tick = async () => {
      if (inFlight) {
        again = true;
        return;
      }
      inFlight = true;
      if (timer) clearTimeout(timer);
      try {
        const session = sessionRef.current;
        if (session) {
          const data = await poll(session);
          if (!active) return;
          handlePollRef.current(data);
        }
      } catch (error) {
        if (error instanceof SessionGone && active) await rejoinRef.current();
      } finally {
        inFlight = false;
      }
      if (!active) return;
      const kind = connRef.current.kind;
      const handshake = kind === "requesting" || kind === "connecting";
      timer = setTimeout(tick, again ? 0 : handshake ? HANDSHAKE_POLL_MS : POLL_INTERVAL_MS);
      again = false;
    };
    pollNow.current = () => void tick();
    tick();

    return () => {
      active = false;
      if (timer) clearTimeout(timer);
      pollNow.current = () => {};
    };
  }, [phase]);

  // pagehide is the one reliable "this page is going away" event (it also
  // fires on mobile and bfcache); a beforeunload listener only sent a second,
  // racing beacon and can make the page ineligible for the bfcache.
  useEffect(() => {
    if (phase !== "live") return;
    const onLeave = () => {
      if (sessionRef.current) leave(sessionRef.current);
    };
    window.addEventListener("pagehide", onLeave);
    return () => window.removeEventListener("pagehide", onLeave);
  }, [phase]);

  /** Join the map. Rejects when the server can't be reached. */
  async function enter(lat: number, lng: number) {
    // The raw position stays on this device. Only a spot 1–3 km away is sent,
    // chosen once, so rejoining later cannot be averaged back to the truth.
    const spot = applyPrivacyOffset(lat, lng);
    const self: PublicSelf = { lat: round(spot.lat), lng: round(spot.lng), utcOffset: localUtcOffset() };
    sessionRef.current = await join(self.lat, self.lng);
    setMe(self);
    setPhase("live");
  }

  return {
    phase,
    peers,
    synced,
    me,
    conn,
    livePeer,
    link,
    caller,
    video,
    messages,
    ending,
    localStream,
    remoteStream,
    micOn,
    cameraOn,
    enter,
    cancelVideoRequest,
    toggleMic,
    toggleCamera,
    requestConnection,
    cancelRequest,
    acceptIncoming,
    declineIncoming,
    endConnection,
    sendChat,
    startVideoRequest,
    acceptVideo,
    declineVideo,
    endVideo,
  };
}
