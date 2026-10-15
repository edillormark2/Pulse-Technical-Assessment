"use client";

// The whole Pulse session as one hook: presence polling, the connection state
// machine (request → accept → WebRTC → chat → video) and cleanup on exit.
// Components only render what it returns and call its actions.
import { useEffect, useRef, useState } from "react";
import { join, leave, poll, sendSignal } from "@/lib/api";
import { PeerSession, type DescType, type PeerControl } from "@/lib/webrtc";
import { POLL_INTERVAL_MS } from "@/lib/presence";
import type { PeerDot, PollResponse, PublicSelf, SignalMsg } from "@/lib/types";

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

export function usePulse({ notify }: { notify: (message: string) => void }) {
  const [phase, setPhase] = useState<"gate" | "live">("gate");
  const [sessionId] = useState(() => crypto.randomUUID());
  const [peers, setPeers] = useState<PeerDot[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  // Raw position: kept on this device only, to rejoin after being reaped.
  const [myLocation, setMyLocation] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  // Public position: the privacy-offset spot everyone else sees.
  const [me, setMe] = useState<PublicSelf | null>(null);
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

  // Callbacks stored inside a PeerSession outlive the render that created
  // them, so always reach the latest `notify` through a ref.
  const notifyRef = useRef(notify);
  useEffect(() => {
    notifyRef.current = notify;
  });

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
    void sendSignal(sessionId, peerId, "end");
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
          .then(() => sendSignal(sessionId, peerId, type, payload))
          .catch(() => {});
      },
      onChat: (text) => addMessage(false, text),
      onControl: (ctrl) => handleControl(ctrl),
      onRemoteStream: (stream) => setRemoteStream(stream),
      onConnectionState: (state) => {
        iceState = state;
        if (peerRef.current === ps) setLink(state);
        if (state === "failed") {
          dropConnection(ps, peerId, "The connection dropped. Nothing was kept.");
        } else if (state === "disconnected") {
          // Usually the other side vanished without a goodbye (crashed, lost
          // network). It can also be a blip, so give it a moment to recover.
          setTimeout(() => {
            if (iceState === "disconnected") {
              dropConnection(ps, peerId, "They left. Nothing was kept.");
            }
          }, DISCONNECT_GRACE_MS);
        }
      },
      onChannelOpen: () => {
        if (connectTimer.current) clearTimeout(connectTimer.current);
        setConn({ kind: "connected", peerId });
      },
      onChannelClose: () => dropConnection(ps, peerId, "They left. Nothing was kept."),
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
    void sendSignal(sessionId, peerId, "request");
    requestTimer.current = setTimeout(() => {
      if (
        connRef.current.kind === "requesting" &&
        connRef.current.peerId === peerId
      ) {
        void sendSignal(sessionId, peerId, "end");
        teardown("No answer this time.");
      }
    }, REQUEST_TIMEOUT_MS);
  }

  function cancelRequest() {
    if (connRef.current.kind === "requesting") {
      void sendSignal(sessionId, connRef.current.peerId, "end");
    }
    teardown();
  }

  // Become the callee for `peerId`: get ready for their offer, then accept.
  function acceptFrom(peerId: string) {
    startPeer(peerId, false);
    void sendSignal(sessionId, peerId, "accept");
    setConn({ kind: "connecting", peerId });
  }

  function acceptIncoming() {
    if (connRef.current.kind !== "incoming") return;
    acceptFrom(connRef.current.peerId);
  }

  function declineIncoming() {
    if (connRef.current.kind !== "incoming") return;
    void sendSignal(sessionId, connRef.current.peerId, "decline");
    setConn({ kind: "idle" });
  }

  function endConnection() {
    const c = connRef.current;
    if (c.kind === "connecting" || c.kind === "connected") {
      void sendSignal(sessionId, c.peerId, "end");
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
          if (sessionId < sig.fromId) {
            if (requestTimer.current) clearTimeout(requestTimer.current);
            acceptFrom(sig.fromId);
          }
        } else {
          void sendSignal(sessionId, sig.fromId, "decline");
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
          void sendSignal(sessionId, sig.fromId, "end");
        }
        break;
      }
      case "decline": {
        const c = connRef.current;
        if (c.kind === "requesting" && c.peerId === sig.fromId) {
          if (requestTimer.current) clearTimeout(requestTimer.current);
          teardown("They said not now.");
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
          else teardown("They left. Nothing was kept.");
        }
        break;
      }
    }
  }

  function handlePoll(data: PollResponse) {
    setPeers(data.peers);
    for (const s of data.signals) processSignal(s);

    // Keep the latest known position and clock of whoever we're connected to.
    const current = connRef.current;
    if (current.kind !== "idle") {
      const other = data.peers.find((p) => p.id === current.peerId);
      if (other) setLivePeer(other);
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
      dropConnection(peerRef.current, c.peerId, "They left. Nothing was kept.");
    }
  }

  const handlePollRef = useRef(handlePoll);
  useEffect(() => {
    handlePollRef.current = handlePoll;
  });

  useEffect(() => {
    if (phase !== "live" || !sessionId) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = async () => {
      try {
        const data = await poll(sessionId);
        if (!active) return;
        if (!data.present && myLocation) {
          // Our row is gone: reaped after a throttled background tab missed
          // heartbeats, or deleted by the pagehide beacon before a bfcache
          // restore. Nobody can see us until we join again.
          const self = await join(sessionId, myLocation.lat, myLocation.lng);
          if (active) setMe(self);
        }
        handlePollRef.current(data);
      } catch {}
      if (active) timer = setTimeout(tick, POLL_INTERVAL_MS);
    };
    tick();

    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [phase, sessionId, myLocation]);

  // pagehide is the one reliable "this page is going away" event (it also
  // fires on mobile and bfcache); a beforeunload listener only sent a second,
  // racing beacon and can make the page ineligible for the bfcache.
  useEffect(() => {
    if (!sessionId || phase !== "live") return;
    const onLeave = () => {
      const c = connRef.current;
      leave(sessionId, c.kind === "idle" ? undefined : c.peerId);
    };
    window.addEventListener("pagehide", onLeave);
    return () => window.removeEventListener("pagehide", onLeave);
  }, [sessionId, phase]);

  /** Join the map. Rejects when the server can't be reached. */
  async function enter(lat: number, lng: number) {
    const self = await join(sessionId, lat, lng);
    setMyLocation({ lat, lng });
    setMe(self);
    setPhase("live");
  }

  return {
    phase,
    peers,
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
