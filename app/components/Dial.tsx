"use client";

import { useEffect, useId, useState } from "react";
import clsx from "clsx";
import type { MarkState } from "./Globe";
import { DIAL } from "@/lib/use-dial-layout";

/** A person as the dial sees them: an hour, a state, a description. */
export interface DialPerson {
  id: string;
  /** Their clock minus yours, in minutes, folded into (-720, 720]. */
  deltaMinutes: number;
  state: MarkState;
  /** Their sun rises within half an hour (or just rose): the mark sits on a horizon. */
  dawn?: boolean;
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

/** A pie slice from the centre, clockwise from a0 to a1: clips ink to the day or the night. */
function sector(c: number, r: number, a0: number, a1: number): string {
  let sweep = (a1 - a0) % 360;
  if (sweep < 0) sweep += 360;
  const [x0, y0] = polar(c, r, a0);
  const [x1, y1] = polar(c, r, a0 + sweep);
  return `M${c} ${c}L${x0} ${y0}A${r} ${r} 0 ${sweep > 180 ? 1 : 0} 1 ${x1} ${y1}Z`;
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
  coverTop = null,
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
  /** Light the hours up as the ring first appears (the entry screen). */
  reveal?: boolean;
  /** Phones: where a panel's top edge sits on screen; marks under it step aside. */
  coverTop?: number | null;
  onSelect: (id: string) => void;
}) {
  const g = compact ? DIAL.compact : DIAL.desktop;
  const r1 = globeRadius + g.gap; // band inner edge
  const r2 = r1 + g.band; // band outer edge
  const arcR = r2 + g.arc; // the call arc, the countdown and the sweep's tip
  const track = r2 + g.track; // people, at their hour
  const size = Math.ceil(2 * (track + g.margin));
  const c = size / 2;
  const bandMid = (r1 + r2) / 2;
  const clip = useId().replace(/[^a-zA-Z0-9]/g, "");

  // The band turns once a day; you stay at the top.
  const hourAngle = (hour: number) => angleOf(hour * 60 - myMinutes);
  // Day runs 06 to 18, widened just enough that both figures sit wholly on
  // the opaline instead of straddling its edge.
  const dayPad = ((g.figure * 0.62) / bandMid) * (180 / Math.PI);
  const dawn = hourAngle(6) - dayPad;
  const dusk = hourAngle(18) + dayPad;
  // On arrival the hours light up clockwise from yours, 25 ms apart.
  const revealDelay = (hour: number) =>
    reveal ? { animationDelay: `${300 + Math.floor((((hour * 60 - myMinutes) / 60) % 24 + 24) % 24) * 25}ms` } : undefined;
  // People who share an hour fan out about a mark's width apart.
  const { placed, overflow } = layout(people, (compact ? 13 : 16) / track / DEG);

  // Measured reveal: people present when you arrive appear in hour order from
  // yours outward, once. Anyone joining later simply fades in.
  const [revealNow, setRevealNow] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setRevealNow(false), 2500);
    return () => clearTimeout(t);
  }, []);

  // The call arc always starts at your hour and runs the short way to theirs:
  // clockwise to people ahead of you, anticlockwise to people behind. It only
  // exists once they said yes: dotted while the line opens, solid once you talk.
  const liveMark = live ? placed.find((p) => p.person.id === live.id) : undefined;
  const callArc =
    live && liveMark && (live.phase === "connecting" || live.phase === "talking")
      ? { d: arc(c, arcR, -90, liveMark.angle, liveMark.angle < -90), talking: live.phase === "talking" }
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

  // Waits develop: asking and being asked both show the 30-second window.
  const waiting = live && (live.phase === "calling" || live.phase === "ringing") ? live : null;

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
        <defs>
          <clipPath id={`${clip}day`}>
            <path d={sector(c, r2 + 2, dawn, dusk)} />
          </clipPath>
          <clipPath id={`${clip}night`}>
            <path d={sector(c, r2 + 2, dusk, dawn)} />
          </clipPath>
        </defs>

        {/* The 24-hour band: enamel night all round, the opaline day laid over it. */}
        <circle cx={c} cy={c} r={bandMid} fill="none" stroke="var(--color-lacquer-700)" strokeWidth={g.band} />
        <path d={arc(c, bandMid, dawn, dusk)} fill="none" stroke="var(--color-opaline-200)" strokeWidth={g.band} />

        {/* Engraved hours: a figure every third hour, a tick at the rim between.
            The ink follows the enamel under it: dark on the day, light on the night. */}
        {(["day", "night"] as const).map((side) => {
          const ink = side === "day" ? "var(--color-lacquer-700)" : "var(--color-opaline-200)";
          return (
            <g key={side} clipPath={`url(#${clip}${side})`}>
              {Array.from({ length: 24 }, (_, h) => {
                const a = hourAngle(h);
                if (h % 3 === 0) {
                  const [x, y] = polar(c, bandMid, a);
                  return (
                    <text
                      key={h}
                      x={x}
                      y={y}
                      dy="0.36em"
                      textAnchor="middle"
                      fill={ink}
                      className={clsx("tabular font-display", reveal && "dial-hour-in")}
                      style={{ fontStretch: "72%", fontWeight: 650, fontSize: g.figure, ...revealDelay(h) }}
                    >
                      {String(h).padStart(2, "0")}
                    </text>
                  );
                }
                const [x0, y0] = polar(c, r2 - 3, a);
                const [x1, y1] = polar(c, r2 - (compact ? 7 : 9), a);
                return (
                  <line
                    key={h}
                    x1={x0}
                    y1={y0}
                    x2={x1}
                    y2={y1}
                    stroke={ink}
                    strokeWidth={1.5}
                    strokeLinecap="round"
                    className={reveal ? "dial-hour-in" : undefined}
                    style={revealDelay(h)}
                  />
                );
              })}
            </g>
          );
        })}

        {/* You: an index across the band at 12 o'clock, outlined so it reads on
            the day and the night side alike. */}
        <line x1={c} y1={c - r1 + 3} x2={c} y2={c - r2 - 4} stroke="var(--color-lacquer-900)" strokeWidth={6} strokeLinecap="round" />
        <line x1={c} y1={c - r1 + 3} x2={c} y2={c - r2 - 4} stroke="var(--color-opaline-50)" strokeWidth={2.5} strokeLinecap="round" />
        <path
          d={`M${c - 5} ${c - r1 + Math.min(10, g.gap)}L${c + 5} ${c - r1 + Math.min(10, g.gap)}L${c} ${c - r1 + 3}Z`}
          fill="var(--color-opaline-50)"
        />

        {/* Waits develop: a red hand sweeps the 30-second window, on both sides of
            the ask. Mounted when the ask starts, so it runs in step with it. */}
        {waiting && (
          <g key={`sweep-${waiting.id}-${waiting.phase}`}>
            <path d={arc(c, arcR, -90, 269.9)} pathLength={1} className="dial-countdown" />
            <g className="dial-sweep" style={{ transformOrigin: `${c}px ${c}px` }}>
              <line x1={c} y1={c - r1 + 3} x2={c} y2={c - arcR - 3} stroke="var(--color-signal)" strokeWidth={2} strokeLinecap="round" />
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

      {/* People: real buttons outside the band, clockwise from you, so the dial
          is also the list. Someone who just left keeps a fading mark a moment. */}
      {placed.length > 0 && (
        <ol aria-label="People online, by their local time" className="absolute inset-0 m-0 list-none p-0">
          {placed.map(({ person, angle }, i) => {
            const [x, y] = polar(c, track, angle);
            const gone = person.state === "gone";
            // Under a phone's panel (or touching its edge), a mark steps aside.
            const covered = coverTop !== null && center.y - c + y > coverTop - 12;
            const away = gone || covered;
            return (
              <li key={person.id} aria-hidden={away || undefined}>
                <button
                  type="button"
                  aria-label={person.label}
                  aria-pressed={person.state === "selected"}
                  onClick={() => onSelect(person.id)}
                  disabled={!visible || away}
                  tabIndex={away ? -1 : undefined}
                  className={clsx(
                    "dial-mark transition-opacity duration-200",
                    covered ? "opacity-0" : "pointer-events-auto",
                    revealNow && "dial-mark--reveal",
                  )}
                  style={{
                    left: x,
                    top: y,
                    animationDelay: revealNow ? `${Math.min(i * 45, 600)}ms` : undefined,
                  }}
                >
                  <span className="mark" data-state={person.state} data-dawn={person.dawn || undefined} />
                </button>
              </li>
            );
          })}
        </ol>
      )}
      {overflow.map(({ angle, count }) => {
        const [x, y] = polar(c, track + (compact ? 12 : 15), angle);
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
