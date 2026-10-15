import clsx from "clsx";

const LEGEND = [
  { label: "Free to talk", short: "Free", mark: "bg-opaline-50" },
  { label: "In another conversation", short: "Busy", mark: "shadow-[inset_0_0_0_2px_var(--color-opaline-200)]" },
  { label: "Talking with you", short: "With you", mark: "bg-signal" },
];

/**
 * What the panel says before you pick anyone: how to start, what marks mean.
 * `others` is null until the first presence poll lands, so the empty state
 * never flashes before anyone could have been found.
 */
export default function IdleNote({ others, compact = false }: { others: number | null; compact?: boolean }) {
  const quiet = others === 0;
  return (
    <div
      className={clsx(
        "card-enter text-[15px] leading-relaxed text-opaline-200",
        compact ? "px-2" : "max-w-[320px]",
      )}
    >
      <p className={clsx("leading-snug text-opaline-50", compact ? "text-[19px]" : "text-[20px]")}>
        {quiet ? "It’s quiet right now." : compact ? "Tap someone on the dial." : "Pick someone on the dial or the globe."}
      </p>
      <p className={compact ? "mt-1.5" : "mt-3"}>
        {quiet
          ? "Strangers appear on the dial at their own hour as they join. To try Pulse alone, open it in a second window."
          : "You’ll see their hour and how far away they are before you ask."}
      </p>
      <ul
        className={clsx(
          "text-opaline-400",
          compact ? "mt-5 flex flex-wrap gap-x-5 gap-y-2 text-[13px]" : "mt-8 space-y-3 text-[14px]",
        )}
      >
        {LEGEND.map(({ label, short, mark }) => (
          <li key={label} className="flex items-center gap-2.5">
            <span className={clsx("h-[9px] w-[9px] rounded-full", mark)} aria-hidden="true" />
            {compact ? (
              <>
                <span aria-hidden="true">{short}</span>
                <span className="sr-only">{label}</span>
              </>
            ) : (
              label
            )}
          </li>
        ))}
      </ul>
      {!compact && (
        <p className="mt-8 text-[13px] text-opaline-500">
          Your dot sits <span className="whitespace-nowrap">1–3 km</span> from where you are. Nothing is
          stored; closing this tab removes you.
        </p>
      )}
    </div>
  );
}
