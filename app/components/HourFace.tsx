import clsx from "clsx";
import { formatClock, partOfClock } from "@/lib/sun";
import { DAY_WORDS } from "@/lib/use-world-clock";

/**
 * Your hour, billed inside the ring before the world fills it: the face you
 * arrive at, and what the globe develops over once it has loaded.
 */
export default function HourFace({
  center,
  radius,
  minutes,
  className,
}: {
  center: { x: number; y: number };
  radius: number;
  minutes: number;
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={clsx(
        "pointer-events-none absolute grid place-items-center rounded-full bg-lacquer-850 text-center",
        className,
      )}
      style={{ left: center.x - radius, top: center.y - radius, width: radius * 2, height: radius * 2 }}
    >
      <div className="hour-face__text">
        <p className="numeral leading-[0.86] text-opaline-50" style={{ fontSize: Math.round(radius * 0.42) }}>
          {formatClock(minutes)}
        </p>
        <p className="mt-3 text-[15px] text-opaline-400">your {DAY_WORDS[partOfClock(minutes)]}</p>
      </div>
    </div>
  );
}
