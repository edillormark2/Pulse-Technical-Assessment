import clsx from "clsx";
import type { ChatMessage } from "@/lib/use-pulse";

/** A conversation that just ended, dissolving: nothing is kept. */
export default function EndingCard({ messages, className }: { messages: ChatMessage[]; className?: string }) {
  const shown = messages.slice(-8);
  return (
    <section className={clsx("card flex w-full flex-col justify-end overflow-hidden", className)} aria-hidden="true">
      <ol className="space-y-1.5">
        {shown.map((m, i) => (
          <li key={m.id} className={clsx("flex", m.mine ? "justify-end" : "justify-start")}>
            <p
              className={clsx("bubble bubble--dissolve", m.mine ? "bubble--mine" : "bubble--theirs")}
              style={{ animationDelay: `${(shown.length - 1 - i) * 45}ms` }}
            >
              {m.text}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
