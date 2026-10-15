"use client";

import type { PersonView } from "./Live";
import { SunriseLine } from "./Daybreak";
import { formatClock } from "@/lib/sun";
import { formatDistance, formatHoursApart } from "@/lib/use-world-clock";

/** Someone is asking you. Their hour first, then a deliberate yes or an easy no. */
export default function IncomingCard({
  person,
  sunrise,
  onAccept,
  onDecline,
}: {
  person: PersonView | null;
  /** They asked to watch your sunrise, and it is near: when it is. */
  sunrise: Date | null;
  onAccept: () => void;
  onDecline: () => void;
}) {
  return (
    <section className="card card-enter w-full" aria-labelledby="incoming-title">
      <h2 id="incoming-title" className="flex items-center gap-2.5 text-[15px] text-opaline-50">
        <span className="mark" data-state="ringing" aria-hidden="true" />
        {sunrise ? "Someone wants to watch your sunrise" : "Someone wants to talk"}
      </h2>
      {person && (
        <>
          <p className="numeral mt-3 text-[72px] leading-[0.86] text-opaline-50">{formatClock(person.minutes)}</p>
          <p className="mt-2 text-[14px] text-opaline-400">their {person.dayWord}</p>
          <p className="tabular mt-5 text-[15px] text-opaline-200">
            {formatHoursApart(person.hoursApart)} · {formatDistance(person.km)}
          </p>
        </>
      )}
      {sunrise && <SunriseLine sunrise={sunrise} whose="your" className="mt-4" />}
      <div className="mt-6 grid grid-cols-2 gap-3">
        <button type="button" className="btn btn-quiet" onClick={onDecline}>
          Not now
        </button>
        <button type="button" className="btn btn-primary" onClick={onAccept}>
          Talk
        </button>
      </div>
      <p className="mt-3 text-[13px] text-opaline-400">
        If you say not now, they&rsquo;re simply told you said not now.
      </p>
    </section>
  );
}
