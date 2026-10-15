"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { PaperPlaneRight, PhoneDisconnect, VideoCamera } from "@phosphor-icons/react";
import type { PersonView } from "./Live";
import type { ChatMessage, VideoState } from "@/lib/use-pulse";
import { formatClock } from "@/lib/sun";
import { formatDistance } from "@/lib/use-world-clock";

const MAX_MESSAGE = 1000;

/** The live conversation: their hour on top, the talk, and how to end it. */
export default function ChatCard({
  person,
  messages,
  video,
  onSend,
  onAskVideo,
  onCancelVideo,
  onAcceptVideo,
  onDeclineVideo,
  onEnd,
  className,
}: {
  person: PersonView | null;
  messages: ChatMessage[];
  video: VideoState;
  onSend: (text: string) => void;
  onAskVideo: () => void;
  onCancelVideo: () => void;
  onAcceptVideo: () => void;
  onDeclineVideo: () => void;
  onEnd: () => void;
  className?: string;
}) {
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLOListElement>(null);

  // Keep the newest message in view.
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTo({ top: list.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    onSend(text);
    setDraft("");
  }

  return (
    <section className={clsx("card card-enter flex w-full flex-col overflow-hidden p-0", className)} aria-labelledby="chat-title">
      <header className="flex items-start justify-between gap-4 px-6 pb-4 pt-5">
        <div>
          <h2 id="chat-title" className="sr-only">
            Conversation with a stranger
          </h2>
          {person ? (
            <>
              <p className="numeral text-[44px] leading-none text-signal">{formatClock(person.minutes)}</p>
              <p className="tabular mt-1.5 text-[13px] text-opaline-400">
                their {person.dayWord} · {formatDistance(person.km)}
              </p>
            </>
          ) : (
            <p className="text-[15px] text-opaline-200">Stranger</p>
          )}
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            className="icon-button"
            aria-label="Ask to turn on video"
            title="Ask to turn on video"
            onClick={onAskVideo}
            disabled={video !== "none"}
          >
            <VideoCamera size={22} />
          </button>
          <button type="button" className="icon-button icon-button--end" aria-label="End conversation" title="End conversation" onClick={onEnd}>
            <PhoneDisconnect size={22} />
          </button>
        </div>
      </header>

      {video === "requesting" && (
        <div className="mx-4 mb-2 flex items-center justify-between gap-3 rounded-2xl bg-lacquer-800 px-4 py-3" role="status">
          <p className="text-[14px] text-opaline-200">Asking to turn on video…</p>
          <button type="button" className="text-[14px] font-medium text-opaline-50 underline underline-offset-4" onClick={onCancelVideo}>
            Cancel
          </button>
        </div>
      )}
      {video === "incoming" && (
        <div className="mx-4 mb-2 rounded-2xl bg-lacquer-800 px-4 py-3" role="alert">
          <p className="text-[14px] text-opaline-50">They&rsquo;d like to turn on video.</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button type="button" className="btn btn-quiet h-10 bg-lacquer-700 text-[14px]" onClick={onDeclineVideo}>
              Not now
            </button>
            <button type="button" className="btn btn-primary h-10 text-[14px]" onClick={onAcceptVideo}>
              Turn on
            </button>
          </div>
        </div>
      )}

      <ol ref={listRef} className="flex-1 space-y-1.5 overflow-y-auto px-4 pb-2" aria-live="polite" aria-label="Messages">
        {messages.length === 0 && (
          <li className="mx-2 mt-6 text-[14px] leading-relaxed text-opaline-400">
            You&rsquo;re connected. Say hello. Messages go straight to them and vanish when either
            of you leaves.
          </li>
        )}
        {messages.map((m, i) => {
          const grouped = i > 0 && messages[i - 1].mine === m.mine;
          return (
            <li key={m.id} className={clsx("flex", m.mine ? "justify-end" : "justify-start", !grouped && "pt-1.5")}>
              <p className={clsx("bubble", m.mine ? "bubble--mine" : "bubble--theirs")}>
                <span className="sr-only">{m.mine ? "You: " : "Them: "}</span>
                {m.text}
              </p>
            </li>
          );
        })}
      </ol>

      <form onSubmit={submit} className="flex items-center gap-2 p-3">
        <label htmlFor="chat-input" className="sr-only">
          Message
        </label>
        <input
          id="chat-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={MAX_MESSAGE}
          placeholder="Say something"
          autoComplete="off"
          className="h-12 min-w-0 flex-1 rounded-full bg-lacquer-800 px-5 text-opaline-50 placeholder:text-opaline-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-opaline-50"
        />
        <button type="submit" className="btn btn-primary size-12 shrink-0 p-0" aria-label="Send" disabled={!draft.trim()}>
          <PaperPlaneRight size={20} weight="fill" />
        </button>
      </form>
    </section>
  );
}
