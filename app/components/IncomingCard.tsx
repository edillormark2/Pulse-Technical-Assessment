"use client";

import type { PersonView } from "./Live";
import { formatClock } from "@/lib/sun";
import { formatDistance, formatHoursApart } from "@/lib/use-world-clock";

/** Someone is asking you. Their hour first, then a deliberate yes or an easy no. */
export default function IncomingCard({
  person,
  onAccept,
  onDecline,
}: {
  person: PersonView | null;
  onAccept: () => void;
  onDecline: () => void;
}) {
  return (
    <section className="card card-enter w-full" aria-labelledby="incoming-title">
      <h2 id="incoming-title" className="text-[15px] text-opaline-50">
        Someone wants to talk
      </h2>
      {person && (
        <>
          <p className="numeral mt-3 text-[72px] leading-[0.86] text-signal">{formatClock(person.minutes)}</p>
          <p className="mt-2 text-[14px] text-opaline-400">their {person.dayWord}</p>
          <p className="tabular mt-5 text-[15px] text-opaline-200">
            {formatHoursApart(person.hoursApart)} · {formatDistance(person.km)}
          </p>
        </>
      )}
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
