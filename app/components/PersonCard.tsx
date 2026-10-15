"use client";

import { X } from "@phosphor-icons/react";
import type { PersonView } from "./Live";
import { formatClock } from "@/lib/sun";
import { formatDistance, formatHoursApart } from "@/lib/use-world-clock";
import { SunriseLine } from "./Daybreak";

/** Someone you picked: their hour billed largest, then yours, then the gap. */
export default function PersonCard({
  person,
  myMinutes,
  onAsk,
  onClose,
}: {
  person: PersonView;
  myMinutes: number;
  onAsk: () => void;
  onClose: () => void;
}) {
  const busy = person.peer.busy;
  return (
    <section className="card card-enter w-full" aria-labelledby="person-card-title">
      <div className="flex items-center justify-between">
        <h2 id="person-card-title" className="flex items-center gap-2.5 text-[15px] text-opaline-200">
          <span className="mark" data-state={busy ? "busy" : "free"} aria-hidden="true" />
          Stranger
        </h2>
        <button type="button" className="icon-button -mr-2" aria-label="Close" onClick={onClose}>
          <X size={18} />
        </button>
      </div>

      <div className="mt-3 flex items-end gap-6">
        <div>
          <p className="numeral text-[72px] leading-[0.86] text-opaline-50">{formatClock(person.minutes)}</p>
          <p className="mt-2 text-[14px] text-opaline-400">their {person.dayWord}</p>
        </div>
        <div className="pb-[3px]">
          <p className="numeral text-[32px] leading-none text-opaline-200">{formatClock(myMinutes)}</p>
          <p className="mt-2 text-[14px] text-opaline-400">yours</p>
        </div>
      </div>

      <p className="tabular mt-5 text-[15px] text-opaline-200">
        {formatHoursApart(person.hoursApart)} · {formatDistance(person.km)}
      </p>
      {person.daybreak && <SunriseLine sunrise={person.daybreak.sunrise} whose="their" className="mt-4" />}

      {busy ? (
        <p className="mt-6 text-[15px] text-opaline-200">In another conversation right now.</p>
      ) : (
        <>
          <button type="button" className="btn btn-primary mt-6 w-full" onClick={onAsk}>
            {person.daybreak ? "Watch their sunrise" : "Ask to talk"}
          </button>
          <p className="mt-3 text-[13px] text-opaline-400">They can say yes or no. Nothing is kept.</p>
        </>
      )}
    </section>
  );
}
