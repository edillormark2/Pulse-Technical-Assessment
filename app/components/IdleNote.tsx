import clsx from "clsx";
import Legend from "./Legend";

/**
 * What the panel says before you pick anyone: how to start and, where the
 * legend has no corner of its own, what the marks mean. `others` is null until
 * the first presence poll lands, so the empty state never flashes before
 * anyone could have been found.
 */
export default function IdleNote({
  others,
  compact = false,
  withLegend = true,
  className,
}: {
  others: number | null;
  compact?: boolean;
  /** Desktop pins the legend bottom-left when it fits there; then the note leaves it out. */
  withLegend?: boolean;
  className?: string;
}) {
  const quiet = others === 0;
  return (
    <div
      className={clsx(
        "card-enter text-[15px] leading-relaxed text-opaline-200",
        compact ? "px-2" : "max-w-[320px]",
        className,
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
      {withLegend && <Legend row={compact} className={compact ? "mt-5" : "mt-8"} />}
      {!compact && (
        <p className="mt-8 text-[13px] text-opaline-500">
          Your dot sits <span className="whitespace-nowrap">1–3 km</span> from where you are. Nothing is
          stored; closing this tab removes you.
        </p>
      )}
    </div>
  );
}
