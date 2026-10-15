"use client";

import { useCallback, useEffect, useState } from "react";
import clsx from "clsx";
import { ArrowsInSimple } from "@phosphor-icons/react";
import Globe, { type GlobeView, type MarkState } from "./Globe";
import Dial, { type DialLive, type DialPerson } from "./Dial";
import PersonCard from "./PersonCard";
import IdleNote from "./IdleNote";
import CallCard from "./CallCard";
import IncomingCard from "./IncomingCard";
import ChatCard from "./ChatCard";
import EndingCard from "./EndingCard";
import VideoStage from "./VideoStage";
import HourFace from "./HourFace";
import Legend from "./Legend";
import type { usePulse } from "@/lib/use-pulse";
import type { PeerDot, PublicSelf } from "@/lib/types";
import { localUtcOffset } from "@/lib/api";
import {
  clockHoursApart,
  clockMinutes,
  daybreak,
  distanceKm,
  formatClock,
  hoursApart,
  isDark,
  partOfDay,
  type Daybreak,
} from "@/lib/sun";
import { DAY_WORDS, formatDistance, useNow, useViewport } from "@/lib/use-world-clock";
import { DIAL, dialExtent, useDialLayout } from "@/lib/use-dial-layout";

type Pulse = ReturnType<typeof usePulse>;

/** What the interface knows about one person right now. */
export interface PersonView {
  peer: PeerDot;
  minutes: number; // their wall clock
  hoursApart: number; // their clock minus yours
  dayWord: string;
  km: number;
  /** Their sun is about to rise (or just rose): Daybreak. */
  daybreak: Daybreak | null;
}

/** The tab icon while someone is asking: the dial with a red mark (a drawn mark, not a glyph). */
const RINGING_ICON = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#0a1428"/><circle cx="32" cy="32" r="12" fill="#142344"/><circle cx="32" cy="32" r="21" fill="none" stroke="#22375f" stroke-width="8"/><path d="M50.19 42.5A21 21 0 0 1 13.81 21.5" fill="none" stroke="#dcdfe4" stroke-width="8"/><path d="M32 4V19" stroke="#f3f5f8" stroke-width="4" stroke-linecap="round"/><circle cx="50" cy="14" r="11" fill="#e5483a" stroke="#0a1428" stroke-width="4"/></svg>',
)}`;

/** How long someone who left keeps a fading mark (matches the CSS). */
const GONE_MS = 1200;

/** The desktop legend's corner box (bottom-left), for checking it clears the dial. */
const LEGEND_BOX = { width: 150, height: 150, inset: 28 };

/** How the dial describes the person you are in a conversation with. */
const LIVE_LABEL: Record<DialLive["phase"], string> = {
  calling: ", waiting for their yes",
  ringing: ", asking to talk with you",
  connecting: ", connecting to you",
  talking: ", talking with you",
};

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
    daybreak: daybreak(peer, now),
  };
}

export default function Live({ pulse }: { pulse: Pulse }) {
  const { conn, peers } = pulse;
  const now = useNow();
  const layout = useDialLayout();
  const [view, setView] = useState<GlobeView | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focus, setFocus] = useState<{ lat: number; lng: number; key: string } | null>(null);
  const [rest, setRest] = useState(0);

  // Someone who leaves keeps a fading mark for a moment, so nobody just blinks out.
  const [lastPeers, setLastPeers] = useState(peers);
  const [gone, setGone] = useState<PeerDot[]>([]);
  if (peers !== lastPeers) {
    const here = new Set(peers.map((p) => p.id));
    const left = lastPeers.filter((p) => !here.has(p.id));
    setLastPeers(peers);
    if (left.length > 0) setGone((g) => [...g.filter((p) => !here.has(p.id)), ...left]);
  }
  useEffect(() => {
    if (gone.length === 0) return;
    const t = setTimeout(() => setGone([]), GONE_MS);
    return () => clearTimeout(t);
  }, [gone]);
  const goneNow = gone.filter((g) => !peers.some((p) => p.id === g.id));

  const me: PublicSelf = pulse.me ?? { lat: 0, lng: 0, utcOffset: localUtcOffset() };
  const myMinutes = clockMinutes(me.utcOffset, now);
  const people = peers.map((p) => describe(p, me, now));
  const awakeInDark = peers.filter((p) => isDark(p, now)).length;
  const atDaybreak = people.filter((v) => v.daybreak).length;

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

  // One mark per state, shared by the globe, the dial and the panel.
  const marks: Record<string, MarkState> = {};
  if (selectedId) marks[selectedId] = "selected";
  if (liveId && livePhase) marks[liveId] = livePhase;
  for (const g of goneNow) marks[g.id] = "gone";
  const stateOf = (p: PeerDot): MarkState => marks[p.id] ?? (p.busy ? "busy" : "free");

  const dialPeople: DialPerson[] = [...people, ...goneNow.map((p) => describe(p, me, now))].map((v) => ({
    id: v.peer.id,
    deltaMinutes: Math.round(v.hoursApart * 60),
    state: stateOf(v.peer),
    dawn: v.daybreak !== null,
    label: `Stranger, ${formatClock(v.minutes)} their ${v.dayWord}, ${formatDistance(v.km)} away${
      v.daybreak ? ", at daybreak" : ""
    }${
      v.peer.id === liveId && livePhase ? LIVE_LABEL[livePhase] : v.peer.busy ? ", in another conversation" : ""
    }`,
  }));

  const selected = people.find((v) => v.peer.id === selectedId) ?? null;
  const livePerson = people.find((v) => v.peer.id === liveId) ?? null;

  // Until the globe reports in, the ring stays where the entry screen drew it.
  const dialFits = view === null || view.radius <= layout.globeRadius * 1.08;

  // On desktop the legend has the bottom-left corner when the dial leaves it free.
  const legendFits =
    !layout.compact &&
    Math.hypot(
      LEGEND_BOX.inset + LEGEND_BOX.width - layout.center.x,
      layout.center.y - LEGEND_BOX.inset - LEGEND_BOX.height,
    ) > layout.globeRadius + dialExtent(DIAL.desktop);

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

  // A request should be noticeable even from another tab: the title says so
  // and the tab's icon carries the red mark until it is answered.
  const ringing = conn.kind === "incoming";
  useEffect(() => {
    if (!ringing) return;
    const previous = document.title;
    document.title = "Someone wants to talk · Pulse";
    const icons = [...document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]')];
    const hrefs = icons.map((link) => link.href);
    for (const link of icons) link.href = RINGING_ICON;
    return () => {
      document.title = previous;
      icons.forEach((link, i) => (link.href = hrefs[i]));
    };
  }, [ringing]);

  // On phones a card can rise past the space kept for it: marks it would cover
  // step aside instead of peeking out sliced at its edge.
  const { height: viewportHeight } = useViewport();
  const [sheetHeight, setSheetHeight] = useState(0);
  const sheetRef = useCallback((el: HTMLDivElement) => {
    const observer = new ResizeObserver(() => setSheetHeight(el.offsetHeight));
    observer.observe(el);
    return () => {
      observer.disconnect();
      setSheetHeight(0);
    };
  }, []);
  const coverTop = layout.compact && sheetHeight > 0 ? viewportHeight - sheetHeight : null;

  const [chatOverVideo, setChatOverVideo] = useState(false);
  const inChat = conn.kind === "connected";
  const videoActive = pulse.video === "active";
  const livePersonView = pulse.livePeer ? describe(pulse.livePeer, me, now) : livePerson;

  // Exactly one card at a time, chosen by the state of the conversation.
  // The chat and its goodbye share one size, so ending never jumps.
  const chatHeight = layout.compact ? "h-[min(560px,62dvh)]" : "h-[min(640px,calc(100dvh-48px))]";
  let card: React.ReactNode = null;
  if (pulse.ending) {
    card = <EndingCard messages={pulse.ending.messages} className={chatHeight} />;
  } else if (conn.kind === "incoming") {
    card = <IncomingCard person={livePersonView} onAccept={pulse.acceptIncoming} onDecline={pulse.declineIncoming} />;
  } else if (conn.kind === "requesting" || conn.kind === "connecting") {
    card = (
      <CallCard
        person={livePersonView}
        phase={conn.kind === "requesting" ? "calling" : "connecting"}
        caller={conn.kind === "requesting" || pulse.caller === true}
        link={pulse.link}
        onCancel={conn.kind === "requesting" ? pulse.cancelRequest : () => pulse.endConnection()}
      />
    );
  } else if (inChat) {
    card = (
      <ChatCard
        person={livePersonView}
        messages={pulse.messages}
        video={pulse.video}
        onSend={pulse.sendChat}
        onAskVideo={pulse.startVideoRequest}
        onCancelVideo={pulse.cancelVideoRequest}
        onAcceptVideo={pulse.acceptVideo}
        onDeclineVideo={pulse.declineVideo}
        onEnd={() => pulse.endConnection()}
        className={chatHeight}
      />
    );
  } else if (selected) {
    card = <PersonCard person={selected} myMinutes={myMinutes} onAsk={ask} onClose={() => setSelectedId(null)} />;
  } else {
    // While you explore the map up close, the how-to steps aside.
    card = (
      <IdleNote
        others={pulse.synced ? peers.length : null}
        compact={layout.compact}
        withLegend={!legendFits}
        className={clsx("transition-opacity duration-300", !dialFits && "pointer-events-none opacity-0")}
      />
    );
  }
  const idle = !pulse.ending && conn.kind === "idle" && !selected;

  return (
    <main className="fixed inset-0 overflow-hidden bg-lacquer-900">
      {/* The world, out of reach while a video covers it. */}
      <div className="absolute inset-0" inert={videoActive}>
        <Globe
          peers={goneNow.length > 0 ? [...peers, ...goneNow] : peers}
          me={pulse.me}
          marks={marks}
          dawn={people.filter((v) => v.daybreak).map((v) => v.peer.id)}
          recede={conn.kind === "connected"}
          focus={focus}
          rest={rest}
          dialRadius={layout.globeRadius}
          padding={layout.padding}
          onSelect={(id) => select(id)}
          onView={setView}
        />
        {/* Your hour from the entry screen, until the globe develops over it. */}
        <HourFace
          center={layout.center}
          radius={layout.globeRadius}
          minutes={myMinutes}
          part={pulse.me ? partOfDay(pulse.me, now, myMinutes) : undefined}
          className={clsx("transition-opacity duration-700 ease-[var(--ease-out)]", view && "opacity-0")}
        />
        <Dial
          center={view ?? layout.center}
          globeRadius={layout.globeRadius}
          visible={dialFits}
          myMinutes={myMinutes}
          people={dialPeople}
          live={liveId && livePhase ? { id: liveId, phase: livePhase } : null}
          compact={layout.compact}
          coverTop={coverTop}
          onSelect={(id) => select(id, true)}
        />

        {/* Zoomed in, the map runs under the header: a scrim keeps it legible. */}
        <div
          aria-hidden="true"
          className={clsx(
            "pointer-events-none absolute inset-x-0 top-0 h-44 bg-[linear-gradient(to_bottom,rgb(15_27_51/0.92),rgb(15_27_51/0))] transition-opacity duration-300",
            dialFits ? "opacity-0" : "opacity-100",
          )}
        />
        <header className="pointer-events-none absolute left-0 top-0 p-5 pt-[max(20px,env(safe-area-inset-top))] sm:p-8">
          <h1 className="numeral text-[34px] leading-none sm:text-[44px]">Pulse</h1>
          <p className="tabular mt-2 text-[15px] text-opaline-200">
            {formatClock(myMinutes)} here
            {pulse.synced && (
              <span className="fade-in">
                {" "}
                · {peers.length} {peers.length === 1 ? "person" : "people"} awake
              </span>
            )}
          </p>
          {peers.length > 0 && (
            <p className="tabular mt-1 text-[13px] text-opaline-400">
              {awakeInDark === 0 ? "Nobody else is in the dark" : `${awakeInDark} of them in the dark`}
              {atDaybreak > 0 && ` · ${atDaybreak} at daybreak`}
            </p>
          )}
        </header>

        {/* The state legend keeps its corner while the dial is at rest; zoomed in,
            the way back to the dial takes the same spot. */}
        {legendFits && (
          <Legend
            className={clsx(
              "absolute bottom-7 left-7 transition-opacity duration-300",
              !dialFits && "pointer-events-none opacity-0",
            )}
          />
        )}
        {view && !dialFits && (
          <button
            type="button"
            className={clsx(
              "btn btn-quiet card-enter absolute h-10 px-4 text-[14px] shadow-[var(--shadow-float)]",
              // Phones: under Mapbox's logo row at the header's right.
              layout.compact ? "right-3 top-[calc(max(20px,env(safe-area-inset-top))+102px)]" : "bottom-8 left-8",
            )}
            onClick={() => setRest((n) => n + 1)}
          >
            <ArrowsInSimple size={18} />
            Back to the dial
          </button>
        )}
      </div>

      {videoActive && (
        <VideoStage
          person={livePersonView}
          localStream={pulse.localStream}
          remoteStream={pulse.remoteStream}
          micOn={pulse.micOn}
          cameraOn={pulse.cameraOn}
          onToggleMic={pulse.toggleMic}
          onToggleCamera={pulse.toggleCamera}
          onEnd={pulse.endVideo}
          onShowChat={layout.compact ? () => setChatOverVideo(true) : undefined}
          style={{ right: layout.compact ? 0 : layout.column }}
        />
      )}

      {layout.compact ? (
        (!videoActive || chatOverVideo) &&
        card && (
          <div
            // The idle note sits centred in the sheet's space; cards rise from the bottom.
            ref={sheetRef}
            data-panel="sheet"
            className={clsx(
              "absolute inset-x-0 bottom-0 px-3 pb-[max(12px,env(safe-area-inset-bottom))]",
              idle && "flex flex-col justify-center",
            )}
            style={idle ? { height: layout.padding.bottom } : undefined}
          >
            {videoActive && (
              <button type="button" className="btn btn-quiet mb-2 h-10 w-full text-[14px]" onClick={() => setChatOverVideo(false)}>
                Back to video
              </button>
            )}
            {card}
          </div>
        )
      ) : (
        <aside
          data-panel="side"
          className="absolute inset-y-0 right-0 flex items-center px-6"
          style={{ width: layout.column }}
          aria-label="Conversation"
        >
          {card}
        </aside>
      )}
    </main>
  );
}
