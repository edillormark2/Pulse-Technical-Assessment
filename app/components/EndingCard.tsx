"use client";

import { useLayoutEffect, useRef } from "react";
import clsx from "clsx";
import type { ChatMessage } from "@/lib/use-pulse";

/**
 * A conversation that just ended, dissolving where it stood: the same card at
 * the same size, the messages in their places, the newest going first.
 * Nothing is kept.
 */
export default function EndingCard({ messages, className }: { messages: ChatMessage[]; className?: string }) {
  const listRef = useRef<HTMLOListElement>(null);
  const shown = messages.slice(-12);

  // Show the end of the conversation, the way the chat had it scrolled.
  useLayoutEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, []);

  return (
    <section className={clsx("card flex w-full flex-col overflow-hidden p-0", className)} aria-labelledby="ending-title">
      {/* As tall as the chat's header, so the messages don't move. */}
      <header className="min-h-[106px] px-6 pb-4 pt-5">
        <h2 id="ending-title" className="fade-in text-[17px] text-opaline-50">
          Conversation ended
        </h2>
        <p className="fade-in mt-1.5 text-[13px] text-opaline-400">Nothing was kept.</p>
      </header>
      <ol ref={listRef} className="flex-1 space-y-1.5 overflow-hidden px-4 pb-2" aria-hidden="true">
        {shown.map((m, i) => {
          const grouped = i > 0 && shown[i - 1].mine === m.mine;
          return (
            <li key={m.id} className={clsx("flex", m.mine ? "justify-end" : "justify-start", !grouped && "pt-1.5")}>
              <p
                className={clsx("bubble bubble--dissolve", m.mine ? "bubble--mine" : "bubble--theirs")}
                style={{ animationDelay: `${(shown.length - 1 - i) * 35}ms` }}
              >
                {m.text}
              </p>
            </li>
          );
        })}
      </ol>
      {/* Where the message box was. */}
      <div className="h-[72px] shrink-0" aria-hidden="true" />
    </section>
  );
}
