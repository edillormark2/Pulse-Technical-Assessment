"use client";

import clsx from "clsx";
import type { PersonView } from "./Live";
import { formatClock } from "@/lib/sun";

type Stage = { label: string; detail?: string; status: "done" | "current" | "pending" };

/** What the WebRTC link is doing, in words (waits develop, never a spinner). */
function linkDetail(link: RTCPeerConnectionState | null): string {
  switch (link) {
    case "connecting":
      return "Finding a route between your two devices";
    case "connected":
      return "Almost there";
    default:
      return "Swapping connection details";
  }
}

/** Asking, then connecting: every step of the wait, in order. */
export default function CallCard({
  person,
  phase,
  caller,
  link,
  onCancel,
}: {
  person: PersonView | null;
  phase: "calling" | "connecting";
  /** You asked (true) or you said yes to their request (false). */
  caller: boolean;
  link: RTCPeerConnectionState | null;
  onCancel: () => void;
}) {
  const stages: Stage[] = caller
    ? [
        { label: "Asked", status: "done" },
        {
          label: "Waiting for their yes",
          detail: phase === "calling" ? "They have 30 seconds to answer" : undefined,
          status: phase === "calling" ? "current" : "done",
        },
        {
          label: "Opening a direct line",
          detail: phase === "connecting" ? linkDetail(link) : undefined,
          status: phase === "connecting" ? "current" : "pending",
        },
      ]
    : [
        { label: "You said yes", status: "done" },
        { label: "Opening a direct line", detail: linkDetail(link), status: "current" },
      ];

  return (
    <section className="card card-enter w-full" aria-labelledby="call-card-title">
      <h2 id="call-card-title" className="text-[15px] text-opaline-200">
        {caller ? "Asking a stranger to talk" : "Connecting"}
      </h2>
      {person && (
        <>
          <p className="numeral mt-3 text-[72px] leading-[0.86] text-opaline-50">{formatClock(person.minutes)}</p>
          <p className="mt-2 text-[14px] text-opaline-400">their {person.dayWord}</p>
        </>
      )}

      <ol className="mt-7 space-y-4" aria-live="polite">
        {stages.map((s) => (
          <li key={s.label} className="flex gap-3" aria-current={s.status === "current" ? "step" : undefined}>
            <span className={clsx("stage-mark mt-[7px]", `stage-mark--${s.status}`)} aria-hidden="true" />
            <div>
              <p className={clsx("text-[15px]", s.status === "pending" ? "text-opaline-500" : "text-opaline-50")}>
                {s.label}
                {s.status === "done" && <span className="sr-only"> (done)</span>}
              </p>
              {s.detail && <p className="mt-0.5 text-[13px] text-opaline-400">{s.detail}</p>}
            </div>
          </li>
        ))}
      </ol>

      <button type="button" className="btn btn-quiet mt-7 w-full" onClick={onCancel}>
        {phase === "calling" ? "Cancel" : "Hang up"}
      </button>
    </section>
  );
}
