"use client";

import { useState } from "react";
import EntryGate from "./components/EntryGate";
import WorldMap from "./components/WorldMap";
import ConnectionPrompt from "./components/ConnectionPrompt";
import ChatPanel from "./components/ChatPanel";
import VideoPanel from "./components/VideoPanel";
import { usePulse } from "@/lib/use-pulse";

export default function Home() {
  const [notice, setNotice] = useState<string | null>(null);
  const pulse = usePulse({
    notify: (text) => {
      setNotice(text);
      window.setTimeout(() => setNotice(null), 3500);
    },
  });
  const { conn, video } = pulse;

  if (pulse.phase === "gate") {
    return <EntryGate onReady={pulse.enter} />;
  }

  const inChat = conn.kind === "connecting" || conn.kind === "connected";

  return (
    <main className="fixed inset-0 overflow-hidden">
      <WorldMap
        peers={pulse.peers}
        me={pulse.me}
        onPeerClick={pulse.requestConnection}
        canConnect={conn.kind === "idle"}
      />

      {notice && (
        <div className="absolute left-1/2 top-20 z-30 -translate-x-1/2 rounded-full bg-zinc-800/90 px-4 py-2 text-sm text-zinc-100 shadow-lg backdrop-blur">
          {notice}
        </div>
      )}

      {conn.kind === "requesting" && (
        <div className="absolute left-1/2 top-20 z-30 flex -translate-x-1/2 items-center gap-3 rounded-full bg-zinc-800/90 px-4 py-2 text-sm text-zinc-100 shadow-lg backdrop-blur">
          <span>Requesting connection…</span>
          <button
            onClick={pulse.cancelRequest}
            className="rounded-full bg-zinc-700 px-3 py-1 text-xs hover:bg-zinc-600"
          >
            Cancel
          </button>
        </div>
      )}

      {conn.kind === "incoming" && (
        <ConnectionPrompt
          title="A stranger wants to connect"
          acceptLabel="Accept"
          declineLabel="Decline"
          onAccept={pulse.acceptIncoming}
          onDecline={pulse.declineIncoming}
        />
      )}

      {inChat && (
        <ChatPanel
          messages={pulse.messages}
          connected={conn.kind === "connected"}
          videoBusy={video !== "none"}
          onSend={pulse.sendChat}
          onStartVideo={pulse.startVideoRequest}
          onEnd={() => pulse.endConnection()}
        />
      )}

      {video === "requesting" && (
        <div className="absolute bottom-24 left-1/2 z-30 -translate-x-1/2 rounded-full bg-zinc-800/90 px-4 py-2 text-sm text-zinc-100 shadow-lg backdrop-blur">
          Waiting for stranger to accept video…
        </div>
      )}

      {video === "incoming" && (
        <ConnectionPrompt
          title="Start video call?"
          subtitle="The stranger wants to turn on video."
          acceptLabel="Accept"
          declineLabel="Decline"
          onAccept={pulse.acceptVideo}
          onDecline={pulse.declineVideo}
        />
      )}

      {video === "active" && (
        <VideoPanel
          localStream={pulse.localStream}
          remoteStream={pulse.remoteStream}
          onEnd={pulse.endVideo}
        />
      )}
    </main>
  );
}
