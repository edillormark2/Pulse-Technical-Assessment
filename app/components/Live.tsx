"use client";

import { useState } from "react";
import Globe, { type GlobeView, type MarkState } from "./Globe";
import Dial, { type DialLive, type DialPerson } from "./Dial";
import PersonCard from "./PersonCard";
import IdleNote from "./IdleNote";
import ConnectionPrompt from "./ConnectionPrompt";
import ChatPanel from "./ChatPanel";
import VideoPanel from "./VideoPanel";
import type { usePulse } from "@/lib/use-pulse";
import type { PeerDot, PublicSelf } from "@/lib/types";
import { localUtcOffset } from "@/lib/api";
import {
  clockHoursApart,
  clockMinutes,
  distanceKm,
  formatClock,
  hoursApart,
  isDark,
  partOfDay,
} from "@/lib/sun";
import { DAY_WORDS, formatDistance, useNow, useViewport } from "@/lib/use-world-clock";

type Pulse = ReturnType<typeof usePulse>;

/** What the interface knows about one person right now. */
export interface PersonView {
  peer: PeerDot;
  minutes: number; // their wall clock
  hoursApart: number; // their clock minus yours
  dayWord: string;
  km: number;
}

function describe(peer: PeerDot, me: PublicSelf, now: Date): PersonView {
  const apart =
    peer.utcOffset === null
      ? Math.round(hoursApart(me.lng, peer.lng) * 4) / 4 // no clock shared: estimate by the sun
      : clockHoursApart(me.utcOffset, peer.utcOffset);
  const minutes =
    peer.utcOffset === null
      ? clockMinutes(me.utcOffset + apart * 60, now)
      : clockMinutes(peer.utcOffset, now);
  return {
    peer,
    minutes,
    hoursApart: apart,
    dayWord: DAY_WORDS[partOfDay(peer, now, minutes)],
    km: distanceKm(me, peer),
  };
}

/**
 * Dial geometry for the viewport. Desktop keeps a right-hand column for the
 * panel at all times, so opening a card never moves the globe; phones put the
 * dial at the top and the panel in a bottom sheet.
 */
function useDialLayout() {
  const { width, height } = useViewport();
  const compact = width < 768;
  if (!compact) {
    const column = Math.round(Math.min(440, Math.max(360, width * 0.3)));
    const outer = Math.min(width - column, height - 64) / 2 - 12;
    return {
      compact,
      column,
      globeRadius: Math.max(120, outer - 26 - 22 - 14 - 18),
      padding: { top: 0, right: column, bottom: 0, left: 0 },
    };
  }
  const sheet = Math.round(height * 0.38);
  const outer = Math.min(width, height - sheet - 72) / 2 - 4;
  return {
    compact,
    column: 0,
    globeRadius: Math.max(90, outer - 22 - 16 - 11 - 14),
    padding: { top: 72, right: 0, bottom: sheet, left: 0 },
  };
}

export default function Live({ pulse }: { pulse: Pulse }) {
  const { conn, video, peers } = pulse;
  const now = useNow();
  const layout = useDialLayout();
  const [view, setView] = useState<GlobeView | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focus, setFocus] = useState<{ lat: number; lng: number; key: string } | null>(null);

  const me: PublicSelf = pulse.me ?? { lat: 0, lng: 0, utcOffset: localUtcOffset() };
  const myMinutes = clockMinutes(me.utcOffset, now);
  const people = peers.map((p) => describe(p, me, now));
  const awakeInDark = peers.filter((p) => isDark(p, now)).length;

  const liveId = conn.kind === "idle" ? null : conn.peerId;
  const livePhase: DialLive["phase"] | null =
    conn.kind === "requesting"
      ? "calling"
      : conn.kind === "incoming"
        ? "ringing"
        : conn.kind === "connecting"
          ? "connecting"
          : conn.kind === "connected"
            ? "talking"
            : null;

  // One mark per state, shared by the globe and the dial.
  const marks: Record<string, MarkState> = {};
  if (selectedId) marks[selectedId] = "selected";
  if (liveId && livePhase) {
    marks[liveId] = livePhase === "connecting" ? "talking" : livePhase;
  }
  const stateOf = (p: PeerDot): MarkState => marks[p.id] ?? (p.busy ? "busy" : "free");

  const dialPeople: DialPerson[] = people.map((v) => ({
    id: v.peer.id,
    deltaMinutes: Math.round(v.hoursApart * 60),
    state: stateOf(v.peer),
    label: `Stranger, ${formatClock(v.minutes)} their ${v.dayWord}, ${formatDistance(v.km)} away${
      v.peer.busy ? ", in another conversation" : ""
    }`,
  }));

  const selected = people.find((v) => v.peer.id === selectedId) ?? null;
  const livePerson = people.find((v) => v.peer.id === liveId) ?? null;

  const dialFits = view !== null && view.radius <= layout.globeRadius * 1.08;

  function select(id: string | null, fromDial = false) {
    if (conn.kind !== "idle") return; // the live call owns the panel
    setSelectedId(id);
    const person = id ? peers.find((p) => p.id === id) : null;
    if (fromDial && person) setFocus({ lat: person.lat, lng: person.lng, key: `${person.id}-${Date.now()}` });
  }

  function ask() {
    if (!selected) return;
    pulse.requestConnection(selected.peer.id);
    setSelectedId(null);
  }

  const inChat = conn.kind === "connecting" || conn.kind === "connected";

  return (
    <main className="fixed inset-0 overflow-hidden bg-lacquer-950">
      <Globe
        peers={peers}
        me={pulse.me}
        marks={marks}
        live={livePerson ? { lat: livePerson.peer.lat, lng: livePerson.peer.lng, talking: conn.kind === "connected" } : null}
        focus={focus}
        dialRadius={layout.globeRadius}
        padding={layout.padding}
        onSelect={(id) => select(id)}
        onView={setView}
      />
      <Dial
        center={view}
        globeRadius={layout.globeRadius}
        visible={dialFits}
        myMinutes={myMinutes}
        people={dialPeople}
        live={liveId && livePhase ? { id: liveId, phase: livePhase } : null}
        compact={layout.compact}
        onSelect={(id) => select(id, true)}
      />

      <header className="pointer-events-none absolute left-0 top-0 p-5 sm:p-8">
        <h1 className="numeral text-[34px] leading-none sm:text-[44px]">Pulse</h1>
        <p className="tabular mt-2 text-[15px] text-opaline-200">
          {formatClock(myMinutes)} here · {peers.length} {peers.length === 1 ? "person" : "people"} awake
        </p>
        {peers.length > 0 && (
          <p className="tabular mt-1 text-[13px] text-opaline-400">
            {awakeInDark === 0 ? "Nobody else is in the dark right now" : `${awakeInDark} of them in the dark`}
          </p>
        )}
      </header>

      {!layout.compact && (
        <aside
          className="absolute inset-y-0 right-0 flex items-center px-8"
          style={{ width: layout.column }}
          aria-label="Selected person"
        >
          {selected && conn.kind === "idle" ? (
            <PersonCard person={selected} myMinutes={myMinutes} onAsk={ask} onClose={() => setSelectedId(null)} />
          ) : (
            conn.kind === "idle" && <IdleNote others={peers.length} />
          )}
        </aside>
      )}
      {layout.compact && selected && conn.kind === "idle" && (
        <div className="absolute inset-x-0 bottom-0 px-4 pb-[max(16px,env(safe-area-inset-bottom))]">
          <PersonCard person={selected} myMinutes={myMinutes} onAsk={ask} onClose={() => setSelectedId(null)} />
        </div>
      )}

      {conn.kind === "requesting" && (
        <div className="absolute left-1/2 top-20 z-30 flex -translate-x-1/2 items-center gap-3 rounded-full bg-lacquer-850 px-4 py-2 text-sm text-opaline-50">
          <span>Asking…</span>
          <button onClick={pulse.cancelRequest} className="rounded-full bg-lacquer-700 px-3 py-1 text-xs">
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
        <VideoPanel localStream={pulse.localStream} remoteStream={pulse.remoteStream} onEnd={pulse.endVideo} />
      )}
    </main>
  );
}
