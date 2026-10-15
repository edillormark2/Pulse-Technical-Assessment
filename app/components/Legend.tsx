import clsx from "clsx";
import type { MarkState } from "./Globe";

/** The state grammar in words. Your own call reads left to right: asking, connecting, talking. */
const ROWS: { states: MarkState[]; short: string; label: string }[] = [
  { states: ["free"], short: "Free", label: "Free to talk" },
  { states: ["busy"], short: "Busy", label: "In another conversation" },
  { states: ["calling", "connecting", "talking"], short: "Your call", label: "Your call: asking, connecting, talking" },
  { states: ["ringing"], short: "Asking you", label: "Asking you to talk" },
  { states: ["gone"], short: "Just left", label: "Just left" },
];

/** What each mark means; the same marks as the dial, the globe and the panels. */
export default function Legend({ row = false, className }: { row?: boolean; className?: string }) {
  return (
    <ul
      aria-label="What the marks mean"
      className={clsx("text-[13px] text-opaline-400", row ? "flex flex-wrap gap-x-5 gap-y-2" : "space-y-1.5", className)}
    >
      {ROWS.map(({ states, short, label }) => (
        <li key={short} className="flex items-center gap-2.5">
          <span className="flex items-center gap-2 px-0.5" aria-hidden="true">
            {states.map((state) => (
              <span key={state} className="mark mark--static" data-state={state} />
            ))}
          </span>
          <span aria-hidden="true">{short}</span>
          <span className="sr-only">{label}</span>
        </li>
      ))}
    </ul>
  );
}
