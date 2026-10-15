export type DescType = "offer" | "answer" | "ice";
const CONTROLS = ["video-request", "video-accept", "video-decline", "video-end"] as const;
export type PeerControl = (typeof CONTROLS)[number];

// The other person is a stranger, so what arrives over the data channel is
// checked like any untrusted input: bounded in size, rate and vocabulary.
/** Anything longer is not a chat line or a control word; drop it unread. */
const MAX_FRAME = 4096;
/** Matches the composer's limit. */
export const MAX_CHAT = 1000;
/** A flood of lines is dropped rather than painted: 20 per 5 seconds. */
const CHAT_BURST = 20;
const CHAT_WINDOW_MS = 5_000;

interface PeerCallbacks {
  onSignal: (type: DescType, payload: string) => void;
  onChat: (text: string) => void;
  onControl: (ctrl: PeerControl) => void;
  onRemoteStream: (stream: MediaStream | null) => void;
  onConnectionState: (state: RTCPeerConnectionState) => void;
  onChannelOpen: () => void;
  onChannelClose: () => void;
}

const ICE_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

export class PeerSession {
  private pc: RTCPeerConnection;
  private dc: RTCDataChannel | null = null;
  private readonly polite: boolean;
  private makingOffer = false;
  private ignoreOffer = false;
  private localStream: MediaStream | null = null;
  // The in-flight (or completed) camera request for the current video call.
  private videoStart: Promise<MediaStream> | null = null;
  private closed = false;
  private readonly cb: PeerCallbacks;
  private pendingCandidates: RTCIceCandidateInit[] = [];
  // Incoming signals are applied strictly one at a time, in delivery order.
  private signalChain: Promise<void> = Promise.resolve();
  // When the latest incoming chat lines arrived, for the flood limit.
  private chatTimes: number[] = [];

  constructor(initiator: boolean, cb: PeerCallbacks) {
    this.cb = cb;
    this.polite = !initiator;
    this.pc = new RTCPeerConnection(ICE_CONFIG);

    this.pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        this.cb.onSignal("ice", JSON.stringify(candidate));
      }
    };

    this.pc.onnegotiationneeded = async () => {
      try {
        this.makingOffer = true;
        await this.pc.setLocalDescription();
        if (this.pc.localDescription) {
          this.cb.onSignal("offer", JSON.stringify(this.pc.localDescription));
        }
      } finally {
        this.makingOffer = false;
      }
    };

    this.pc.ontrack = ({ streams }) => {
      this.cb.onRemoteStream(streams[0] ?? null);
    };

    this.pc.onconnectionstatechange = () => {
      this.cb.onConnectionState(this.pc.connectionState);
    };

    if (initiator) {
      this.dc = this.pc.createDataChannel("chat");
      this.wireDataChannel(this.dc);
    } else {
      this.pc.ondatachannel = (e) => {
        this.dc = e.channel;
        this.wireDataChannel(this.dc);
      };
    }
  }

  private wireDataChannel(dc: RTCDataChannel) {
    dc.onopen = () => this.cb.onChannelOpen();
    // Fires when the other side goes away (tab closed, page reloaded). Our own
    // close() sets `closed` first, so a local teardown never reports itself.
    dc.onclose = () => {
      if (!this.closed) this.cb.onChannelClose();
    };
    dc.onmessage = (e) => {
      if (typeof e.data !== "string" || e.data.length > MAX_FRAME) return;
      try {
        const msg = JSON.parse(e.data) as { t?: unknown; text?: unknown; ctrl?: unknown };
        if (msg.t === "chat" && typeof msg.text === "string" && msg.text.trim()) {
          if (this.withinChatBurst()) this.cb.onChat(msg.text.slice(0, MAX_CHAT));
        } else if (msg.t === "ctrl" && CONTROLS.includes(msg.ctrl as PeerControl)) {
          this.cb.onControl(msg.ctrl as PeerControl);
        }
      } catch {}
    };
  }

  private withinChatBurst(): boolean {
    const now = Date.now();
    this.chatTimes = this.chatTimes.filter((t) => now - t < CHAT_WINDOW_MS);
    if (this.chatTimes.length >= CHAT_BURST) return false;
    this.chatTimes.push(now);
    return true;
  }

  // A poll can deliver a whole batch at once (e.g. [offer, ice, ice]). Applied
  // concurrently, the candidates raced the in-flight setRemoteDescription, got
  // queued and were never applied, so ICE had nothing to connect with.
  handleSignal(type: DescType, payload: string): Promise<void> {
    this.signalChain = this.signalChain
      .then(() => this.applySignal(type, payload))
      .catch((err) => console.warn(`[pulse] failed to apply ${type}`, err));
    return this.signalChain;
  }

  private async applySignal(type: DescType, payload: string) {
    if (this.closed) return;
    const data = JSON.parse(payload);

    if (type === "ice") {
      // Candidates can also arrive before their description: they travel as
      // separate HTTP requests that race each other to the server.
      if (!this.pc.remoteDescription) {
        this.pendingCandidates.push(data);
        return;
      }
      try {
        await this.pc.addIceCandidate(data);
      } catch {}
      return;
    }

    const desc = data as RTCSessionDescriptionInit;
    const offerCollision =
      desc.type === "offer" &&
      (this.makingOffer || this.pc.signalingState !== "stable");
    this.ignoreOffer = !this.polite && offerCollision;
    if (this.ignoreOffer) return;

    await this.pc.setRemoteDescription(desc);
    // Queued candidates need the remote description, so apply them after it.
    // (Flushing before it made every queued addIceCandidate fail.)
    await this.flushPendingCandidates();
    if (desc.type === "offer") {
      await this.pc.setLocalDescription();
      if (this.pc.localDescription) {
        this.cb.onSignal("answer", JSON.stringify(this.pc.localDescription));
      }
    }
  }

  private async flushPendingCandidates() {
    if (this.pendingCandidates.length === 0) return;
    const queued = this.pendingCandidates;
    this.pendingCandidates = [];
    for (const candidate of queued) {
      try {
        await this.pc.addIceCandidate(candidate);
      } catch {}
    }
  }

  sendChat(text: string) {
    // Must match the tag the receiver checks in wireDataChannel().
    this.safeSend({ t: "chat", text: text.slice(0, MAX_CHAT) });
  }

  sendControl(ctrl: PeerControl) {
    this.safeSend({ t: "ctrl", ctrl });
  }

  private safeSend(obj: unknown) {
    if (this.dc && this.dc.readyState === "open") {
      this.dc.send(JSON.stringify(obj));
    }
  }

  // Idempotent: concurrent callers share one getUserMedia request. Before,
  // two quick starts opened the camera twice and leaked the first stream, and
  // a stream granted after stop/close was never released (camera stayed on).
  startVideo(): Promise<MediaStream> {
    if (!this.videoStart) {
      const attempt: Promise<MediaStream> = navigator.mediaDevices
        .getUserMedia({ video: true, audio: true })
        .then((stream) => {
          if (this.closed || this.videoStart !== attempt) {
            // Stopped or hung up while the permission prompt was open.
            for (const track of stream.getTracks()) track.stop();
            throw new Error("video was cancelled");
          }
          this.localStream = stream;
          for (const track of stream.getTracks()) {
            this.pc.addTrack(track, stream);
          }
          return stream;
        });
      attempt.catch(() => {
        if (this.videoStart === attempt) this.videoStart = null;
      });
      this.videoStart = attempt;
    }
    return this.videoStart;
  }

  /** Mute or unmute your microphone without renegotiating. */
  setMicEnabled(on: boolean) {
    for (const track of this.localStream?.getAudioTracks() ?? []) track.enabled = on;
  }

  /** Turn your camera picture off (they see black) or back on. */
  setCameraEnabled(on: boolean) {
    for (const track of this.localStream?.getVideoTracks() ?? []) track.enabled = on;
  }

  stopVideo() {
    this.videoStart = null;
    if (this.localStream) {
      for (const track of this.localStream.getTracks()) track.stop();
      for (const sender of this.pc.getSenders()) {
        if (sender.track) {
          try {
            this.pc.removeTrack(sender);
          } catch {}
        }
      }
      this.localStream = null;
    }
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    this.stopVideo();
    if (this.dc) {
      try {
        this.dc.close();
      } catch {}
    }
    try {
      this.pc.close();
    } catch {}
  }
}
