"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import type { MarkState } from "./Globe";

/** A person as the dial sees them: an hour, a state, a description. */
export interface DialPerson {
  id: string;
  /** Their clock minus yours, in minutes, folded into (-720, 720]. */
  deltaMinutes: number;
  state: MarkState;
  /** Accessible description, e.g. "Stranger, 06:42 their morning, 11,200 km away". */
  label: string;
}

export interface DialLive {
  id: string;
  phase: "calling" | "ringing" | "connecting" | "talking";
}

const DEG = Math.PI / 180;
const MAX_FAN = 7;

/** Screen angle (degrees, 0 = 3 o'clock, clockwise) for a clock offset from yours. */
const angleOf = (deltaMinutes: number) => -90 + deltaMinutes * 0.25;

function polar(c: number, r: number, deg: number): [number, number] {
  return [c + r * Math.cos(deg * DEG), c + r * Math.sin(deg * DEG)];
}

/** SVG arc from a0 to a1 (degrees) at radius r, clockwise unless `ccw`. */
function arc(c: number, r: number, a0: number, a1: number, ccw = false): string {
  let sweep = (ccw ? a0 - a1 : a1 - a0) % 360;
  if (sweep < 0) sweep += 360;
  const [x0, y0] = polar(c, r, a0);
  const [x1, y1] = polar(c, r, ccw ? a0 - sweep : a0 + sweep);
  return `M${x0} ${y0}A${r} ${r} 0 ${sweep > 180 ? 1 : 0} ${ccw ? 0 : 1} ${x1} ${y1}`;
}

/**
 * Fan out people who share an hour (same time zone) so their marks never sit
 * on top of each other; more than MAX_FAN at one hour collapse into "+n".
 */
function layout(people: DialPerson[], spacing: number) {
  const groups = new Map<number, DialPerson[]>();
  for (const p of people) {
    const key = Math.round(p.deltaMinutes / 15); // offsets come in 15-minute steps
    groups.set(key, [...(groups.get(key) ?? []), p]);
  }
  const placed: { person: DialPerson; angle: number }[] = [];
  const overflow: { angle: number; count: number }[] = [];
  for (const group of groups.values()) {
    const base = angleOf(group[0].deltaMinutes);
    const shown = group.slice(0, MAX_FAN);
    shown.forEach((person, i) => {
      placed.push({ person, angle: base + (i - (shown.length - 1) / 2) * spacing });
    });
    if (group.length > MAX_FAN) overflow.push({ angle: base, count: group.length - MAX_FAN });
  }
  // Clockwise from you: the order keyboard and screen-reader users move in.
  placed.sort((a, b) => ((a.angle + 90 + 360) % 360) - ((b.angle + 90 + 360) % 360));
  return { placed, overflow };
}

export default function Dial({
  center,
  globeRadius,
  visible,
  myMinutes,
  people,
  live,
  compact,
  reveal = false,
  onSelect,
}: {
  center: { x: number; y: number } | null;
  /** The globe's radius at rest; the dial is built around it. */
  globeRadius: number;
  /** False while zoomed in past the dial: it steps aside for the map. */
  visible: boolean;
  /** Your wall-clock minutes after midnight (your hour sits at 12 o'clock). */
  myMinutes: number;
  people: DialPerson[];
  live: DialLive | null;
  compact: boolean;
  /** Turn the ring into place as it first appears (the entry screen). */
  reveal?: boolean;
  onSelect: (id: string) => void;
}) {
  const track = globeRadius + (compact ? 11 : 13); // people
  const r1 = globeRadius + (compact ? 22 : 26); // band inner edge
  const r2 = r1 + (compact ? 16 : 22); // band outer edge
  const numerals = r2 + (compact ? 11 : 14);
  const size = Math.ceil(2 * (numerals + 16));
  const c = size / 2;
  const bandMid = (r1 + r2) / 2;
  const bandWidth = r2 - r1;

  // The day/night band turns once a day; you stay at the top.
  const hourAngle = (hour: number) => angleOf(hour * 60 - myMinutes);
  // On arrival the hours light up clockwise from yours, 25 ms apart.
  const revealDelay = (hour: number) =>
    reveal ? { animationDelay: `${300 + Math.floor((((hour * 60 - myMinutes) / 60) % 24 + 24) % 24) * 25}ms` } : undefined;
  const { placed, overflow } = layout(people, compact ? 4.6 : 3.4);

  // Measured reveal: people present when you arrive appear in hour order from
  // yours outward, once. Anyone joining later simply fades in.
  const [revealNow, setRevealNow] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setRevealNow(false), 2500);
    return () => clearTimeout(t);
  }, []);

  // The call arc always starts at your hour and runs the short way to theirs:
  // clockwise to people ahead of you, anticlockwise to people behind.
  const liveMark = live ? placed.find((p) => p.person.id === live.id) : undefined;
  const callArc =
    live && liveMark && live.phase !== "calling"
      ? { d: arc(c, r2 + 4, -90, liveMark.angle, liveMark.angle < -90), talking: live.phase === "talking" }
      : null;

  // On goodbye the arc pulls back into your hour instead of vanishing.
  const [shownArc, setShownArc] = useState(callArc);
  const [retracting, setRetracting] = useState<string | null>(null);
  if (callArc?.d !== shownArc?.d || callArc?.talking !== shownArc?.talking) {
    if (!callArc && shownArc?.talking) setRetracting(shownArc.d);
    setShownArc(callArc);
  }
  useEffect(() => {
    if (!retracting) return;
    const t = setTimeout(() => setRetracting(null), 700);
    return () => clearTimeout(t);
  }, [retracting]);

  if (!center) return null;
  return (
    <div
      className={clsx(
        "pointer-events-none absolute transition-opacity duration-[240ms] ease-[var(--ease-out)]",
        visible ? "opacity-100" : "opacity-0",
        reveal && "dial-enter",
      )}
      style={{ left: center.x - c, top: center.y - c, width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" className="absolute inset-0">
        {/* The 24-hour band: night all round, the day arc laid over it. */}
        <circle cx={c} cy={c} r={bandMid} fill="none" stroke="var(--color-lacquer-700)" strokeWidth={bandWidth} />
        <path d={arc(c, bandMid, hourAngle(6), hourAngle(18))} fill="none" stroke="var(--color-opaline-200)" strokeWidth={bandWidth} />
        {Array.from({ length: 24 }, (_, h) => {
          const a = hourAngle(h);
          const day = h >= 6 && h < 18;
          const [x0, y0] = polar(c, r1 + 2, a);
          const [x1, y1] = polar(c, h % 6 === 0 ? r2 - 2 : r1 + (compact ? 5 : 7), a);
          return (
            <line
              key={h}
              x1={x0}
              y1={y0}
              x2={x1}
              y2={y1}
              stroke={day ? "var(--color-lacquer-700)" : "var(--color-opaline-500)"}
              strokeWidth={h % 6 === 0 ? 2 : 1.25}
              strokeLinecap="round"
              className={reveal ? "dial-hour-in" : undefined}
              style={revealDelay(h)}
            />
          );
        })}
        {[0, 6, 12, 18].map((h) => {
          const [x, y] = polar(c, numerals, hourAngle(h));
          return (
            <text
              key={h}
              x={x}
              y={y}
              dy="0.35em"
              textAnchor="middle"
              className={clsx("tabular font-display", reveal && "dial-hour-in")}
              style={{ fontStretch: "75%", fontWeight: 600, fontSize: compact ? 11 : 13, ...revealDelay(h) }}
              fill="var(--color-opaline-400)"
            >
              {String(h).padStart(2, "0")}
            </text>
          );
        })}

        {/* You: a bright notch across the band at 12 o'clock. */}
        <line x1={c} y1={c - r1 + 1} x2={c} y2={c - r2 - 4} stroke="var(--color-opaline-50)" strokeWidth={3} strokeLinecap="round" />
        <path d={`M${c - 5} ${c - r1 + 8}L${c + 5} ${c - r1 + 8}L${c} ${c - r1 + 2}Z`} fill="var(--color-opaline-50)" />

        {/* Waits develop: while asking, a red hand sweeps the 30-second window. */}
        {/* Mounted when the request goes out, so it runs in step with the 30 s timer. */}
        {live?.phase === "calling" && (
          <g key={`sweep-${live.id}`}>
            <path d={arc(c, r2 + 4, -90, 269.9)} pathLength={1} className="dial-countdown" />
            <g className="dial-sweep" style={{ transformOrigin: `${c}px ${c}px` }}>
              <line x1={c} y1={c - r1 + 2} x2={c} y2={c - r2 - 6} stroke="var(--color-signal)" strokeWidth={2} strokeLinecap="round" />
            </g>
          </g>
        )}

        {/* The call arc: from your hour to theirs, dotted until you are talking. */}
        {callArc && (
          <path
            key={`arc-${live!.id}-${callArc.talking}`}
            d={callArc.d}
            pathLength={1}
            className={clsx("dial-arc", callArc.talking ? "dial-arc--solid" : "dial-arc--dotted")}
          />
        )}
        {!callArc && retracting && (
          <path key={`retract-${retracting}`} d={retracting} pathLength={1} className="dial-arc dial-arc--retract" />
        )}
      </svg>

      {/* People: real buttons, clockwise from you, so the dial is also the list. */}
      {placed.length > 0 && (
        <ol aria-label="People online, by their local time" className="absolute inset-0 m-0 list-none p-0">
          {placed.map(({ person, angle }, i) => {
            const [x, y] = polar(c, track, angle);
            return (
              <li key={person.id}>
                <button
                  type="button"
                  aria-label={person.label}
                  aria-pressed={person.state === "selected"}
                  data-state={person.state}
                  onClick={() => onSelect(person.id)}
                  disabled={!visible}
                  className={clsx("dial-mark pointer-events-auto", revealNow && "dial-mark--reveal")}
                  style={{
                    left: x,
                    top: y,
                    animationDelay: revealNow ? `${Math.min(i * 45, 600)}ms` : undefined,
                  }}
                >
                  <span className="dial-mark__core" />
                </button>
              </li>
            );
          })}
        </ol>
      )}
      {overflow.map(({ angle, count }) => {
        const [x, y] = polar(c, track - (compact ? 14 : 18), angle);
        return (
          <span
            key={angle}
            className="tabular absolute -translate-x-1/2 -translate-y-1/2 text-[11px] font-medium text-opaline-400"
            style={{ left: x, top: y }}
          >
            +{count}
          </span>
        );
      })}
    </div>
  );
}
