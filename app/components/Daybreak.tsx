"use client";

import { useId } from "react";
import clsx from "clsx";
import {
  clockMinutes,
  DAYBREAK_AHEAD,
  formatClock,
  SUNRISE_ALTITUDE,
  sunAltitude,
  type LatLng,
} from "@/lib/sun";
import { useNow } from "@/lib/use-world-clock";

// Daybreak: a stranger whose sun is about to rise, and you, watching it come up
// with them. Everything here is computed from the real sun at their dot.

export type Whose = "their" | "your";

/** The sunrise a conversation is about: where, when, and on whose clock. */
export interface Sky {
  place: LatLng;
  sunrise: Date;
  /** The clock its time is read on, minutes east of UTC. */
  utcOffset: number;
  whose: Whose;
}

/** For two minutes after it clears the horizon, the sun is simply up. */
const JUST_UP_MS = 2 * 60_000;

/** "12:04" until sunrise; whole minutes once it is more than ten away. */
function countdown(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000));
  if (seconds >= 600) return `${Math.round(seconds / 60)} min`;
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/** The sun's state in words, ticking every second. */
export function SunriseLine({
  sunrise,
  whose,
  small = false,
  className,
}: {
  sunrise: Date;
  whose: Whose;
  small?: boolean;
  className?: string;
}) {
  const now = useNow(1000);
  const left = sunrise.getTime() - now.getTime();
  const Whose = whose === "their" ? "Their" : "Your";
  return (
    <p className={clsx("flex items-center gap-3 text-opaline-50", small ? "text-[13px]" : "text-[15px]", className)}>
      <span className="px-[7px]" aria-hidden="true">
        <span className="mark" data-state="free" data-dawn="" />
      </span>
      {/* A timer: read when asked for, never announced every second. */}
      <span role="timer">
        {left > 0 ? (
          <>
            {Whose} sun rises in{" "}
            <span className={clsx("numeral", small ? "text-[15px]" : "text-[17px]")}>{countdown(left)}</span>
          </>
        ) : -left < JUST_UP_MS ? (
          `${Whose} sun is up`
        ) : (
          `${Whose} sun came up ${Math.round(-left / 60_000)} min ago`
        )}
      </span>
    </p>
  );
}

const W = 320;
const H = 56;
const PAD = 8;
/** The sun as drawn: far larger than life, so it can be seen. */
const SUN_R = 4;

/**
 * Their sky at daybreak: the horizon as a line, the sun's real path across
 * the half hour either side of sunrise (solid where it has been, dotted
 * where it is going), and the sun itself. Sunrise is the moment the sun's
 * top edge reaches the horizon, so that is where the line is drawn: the sun
 * stays wholly below it until the second it rises, touches it then, and
 * climbs through it after.
 */
export function SunriseChart({ sky, className }: { sky: Sky; className?: string }) {
  const { place, sunrise, utcOffset, whose } = sky;
  const now = useNow(1000);
  const clip = `sky-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const start = sunrise.getTime() - DAYBREAK_AHEAD * 60_000;
  const end = sunrise.getTime() + DAYBREAK_AHEAD * 60_000;
  const samples = Array.from({ length: 25 }, (_, i) => {
    const t = start + ((end - start) * i) / 24;
    return { t, alt: sunAltitude(place, new Date(t)) };
  });
  // Near the poles the sun can barely clear the horizon: keep some height.
  const low = Math.min(...samples.map((s) => s.alt), SUNRISE_ALTITUDE - 1);
  const high = Math.max(...samples.map((s) => s.alt), SUNRISE_ALTITUDE + 1);
  const x = (t: number) => PAD + ((t - start) / (end - start)) * (W - 2 * PAD);
  const y = (alt: number) => PAD + ((high - alt) / (high - low)) * (H - 2 * PAD);
  const path = samples.map((s, i) => `${i ? "L" : "M"}${x(s.t).toFixed(1)} ${y(s.alt).toFixed(1)}`).join("");

  const t = Math.min(end, Math.max(start, now.getTime()));
  const sun = { x: x(t), y: y(sunAltitude(place, new Date(t))) };
  const horizon = y(SUNRISE_ALTITUDE) - SUN_R;
  const rise = x(sunrise.getTime());
  const risen = now.getTime() >= sunrise.getTime();
  const at = formatClock(clockMinutes(utcOffset, sunrise));

  return (
    <figure className={clsx("m-0", className)}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block h-auto w-full"
        role="img"
        aria-label={`${whose === "their" ? "Their" : "Your"} sun ${risen ? `rose at ${at}` : `rises at ${at}`}`}
      >
        <defs>
          <clipPath id={clip}>
            <rect x="0" y="0" width={sun.x} height={H} />
          </clipPath>
        </defs>
        {/* The sun's track: where it is going, then where it has been. */}
        <path d={path} fill="none" stroke="var(--color-opaline-500)" strokeWidth={1.5} strokeDasharray="1.5 4" strokeLinecap="round" />
        <path d={path} fill="none" stroke="var(--color-opaline-200)" strokeWidth={1.5} clipPath={`url(#${clip})`} />
        {/* The horizon, and above it the moment of sunrise and its time. */}
        <line x1={0} x2={W} y1={horizon} y2={horizon} className={clsx("sky-horizon", risen && "sky-horizon--risen")} />
        <line x1={rise} x2={rise} y1={horizon - 6} y2={horizon} stroke="var(--color-opaline-200)" strokeWidth={1.5} />
        <text
          x={rise - 5}
          y={horizon - 3}
          textAnchor="end"
          className="tabular"
          style={{ fontSize: 11 }}
          fill="var(--color-opaline-400)"
        >
          {at}
        </text>
        <circle cx={sun.x} cy={sun.y} r={SUN_R} className={clsx("sky-sun", risen && "sky-sun--risen")} />
      </svg>
    </figure>
  );
}

/**
 * Daybreak inside a conversation: the countdown, the sky it is happening in,
 * and, when it is theirs, a way to ask to see it.
 */
export function SkyStrip({ sky, onAskToSee }: { sky: Sky; onAskToSee?: () => void }) {
  const now = useNow(1000);
  const risen = now.getTime() >= sky.sunrise.getTime();
  return (
    <div className="px-6 pb-2 pt-3">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <SunriseLine sunrise={sky.sunrise} whose={sky.whose} />
        {onAskToSee && (
          <button
            type="button"
            className="text-[14px] font-medium text-opaline-50 underline underline-offset-4"
            onClick={onAskToSee}
          >
            Ask to see it
          </button>
        )}
      </div>
      <SunriseChart sky={sky} className="mt-1" />
      {/* Said once, at the moment it happens. */}
      <p className="sr-only" aria-live="polite">
        {risen ? `${sky.whose === "their" ? "Their" : "Your"} sun is up.` : ""}
      </p>
    </div>
  );
}
