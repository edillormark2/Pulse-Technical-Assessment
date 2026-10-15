"use client";

import { useState } from "react";
import { WarningCircle } from "@phosphor-icons/react";
import { DemoButton } from "./DemoVideo";
import Dial from "./Dial";
import HourFace from "./HourFace";
import { localUtcOffset } from "@/lib/api";
import { clockMinutes, formatClock } from "@/lib/sun";
import { useNow } from "@/lib/use-world-clock";
import { useDialLayout, useHydrated } from "@/lib/use-dial-layout";

type Status = "idle" | "locating" | "joining" | "error";

const BUTTON: Record<Status, string> = {
  idle: "Show me who’s awake",
  locating: "Finding you…",
  joining: "Joining…",
  error: "Try again",
};

/**
 * The face you arrive at: your own hour inside the ring, and one way in.
 * The ring sits exactly where the live dial will, so entering never moves it;
 * the globe develops inside it and strangers take their hours around it.
 */
export default function EntryGate({ onReady }: { onReady: (lat: number, lng: number) => Promise<void> }) {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  // The ring and the clock depend on this screen and this moment, so they
  // render after hydration; the words and the button are there from the start.
  const hydrated = useHydrated();
  const layout = useDialLayout();
  const now = useNow();
  const minutes = clockMinutes(localUtcOffset(), now);

  function fail(message: string) {
    setStatus("error");
    setError(message);
  }

  function enter() {
    if (!("geolocation" in navigator)) {
      fail("This browser can’t share a location, so Pulse can’t place you on the dial.");
      return;
    }
    setStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setStatus("joining");
        onReady(pos.coords.latitude, pos.coords.longitude).catch(() =>
          fail("Couldn’t reach Pulse. Check your connection, then try again."),
        );
      },
      (err) =>
        fail(
          err.code === err.PERMISSION_DENIED
            ? "Location is blocked for this site. Allow it in your browser’s site settings, then try again."
            : "Couldn’t find where you are. Check that location services are on, then try again.",
        ),
      // High accuracy + maximumAge:0 forces a fresh fix (Wi-Fi/GPS scan)
      // instead of reusing the browser's cached IP-based location.
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  }

  const busy = status === "locating" || status === "joining";

  return (
    <main className="fixed inset-0 overflow-hidden bg-lacquer-900">
      {hydrated && (
        <>
          <HourFace center={layout.center} radius={layout.globeRadius} minutes={minutes} className="hour-face--enter" />
          <Dial
            center={layout.center}
            globeRadius={layout.globeRadius}
            visible
            reveal
            myMinutes={minutes}
            people={[]}
            live={null}
            compact={layout.compact}
            onSelect={() => {}}
          />
        </>
      )}

      <header className="pointer-events-none absolute left-0 top-0 p-5 pt-[max(20px,env(safe-area-inset-top))] sm:p-8">
        <h1 className="numeral text-[34px] leading-none sm:text-[44px]">Pulse</h1>
        {hydrated && <p className="tabular fade-in mt-2 text-[15px] text-opaline-200">{formatClock(minutes)} here</p>}
      </header>

      {/* Where the live panel will be: a column on desktop, a sheet on phones. */}
      <section
        aria-labelledby="entry-title"
        className="absolute inset-x-0 bottom-0 px-5 pb-[max(24px,env(safe-area-inset-bottom))] md:inset-y-0 md:left-auto md:flex md:w-[clamp(360px,30vw,440px)] md:items-center md:px-6 md:pb-0"
      >
        <div className="card-enter max-w-[360px]">
          <h2 id="entry-title" className="text-[22px] leading-[1.2] text-opaline-50 md:text-[28px]">
            Talk to a stranger who&rsquo;s awake right now.
          </h2>
          {status === "error" ? (
            <p role="alert" className="mt-2 flex gap-2 text-[15px] leading-relaxed text-opaline-50 md:mt-3">
              <WarningCircle size={20} className="mt-[3px] shrink-0" aria-hidden="true" />
              {error}
            </p>
          ) : (
            <p className="mt-2 text-[15px] leading-relaxed text-opaline-200 md:mt-3">
              Everyone online sits on the dial at their own hour. Pick someone and ask to talk.
            </p>
          )}
          <button type="button" className="btn btn-primary mt-5 w-full md:mt-7" onClick={enter} disabled={busy} aria-busy={busy}>
            {BUTTON[status]}
          </button>
          <p className="sr-only" role="status">
            {status === "locating" ? "Finding your location" : status === "joining" ? "Joining Pulse" : ""}
          </p>
          <p className="mt-3 text-[13px] leading-normal text-opaline-400 md:mt-4">
            Pulse uses your location to place you. Others see your dot <span className="whitespace-nowrap">1&ndash;3 km</span> away, and
            nothing is kept: closing the tab removes you.
          </p>
          <DemoButton className="mt-5 md:mt-6" />
        </div>
      </section>
    </main>
  );
}
