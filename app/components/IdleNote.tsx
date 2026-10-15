/**
 * What the panel says before you pick anyone: how to start, what marks mean.
 * `others` is null until the first presence poll lands, so the empty state
 * never flashes before anyone could have been found.
 */
export default function IdleNote({ others }: { others: number | null }) {
  return (
    <div className="card-enter max-w-[320px] text-[15px] leading-relaxed text-opaline-200">
      {others === 0 ? (
        <>
          <p className="text-[20px] leading-snug text-opaline-50">It&rsquo;s quiet right now.</p>
          <p className="mt-3">
            Strangers appear on the dial at their own hour as they join. To try Pulse alone,
            open it in a second window.
          </p>
        </>
      ) : (
        <>
          <p className="text-[20px] leading-snug text-opaline-50">
            Pick someone on the dial or the globe.
          </p>
          <p className="mt-3">You&rsquo;ll see their hour and how far away they are before you ask.</p>
        </>
      )}
      <ul className="mt-8 space-y-3 text-[14px] text-opaline-400">
        <li className="flex items-center gap-3">
          <span className="h-[9px] w-[9px] rounded-full bg-opaline-50" aria-hidden="true" />
          Free to talk
        </li>
        <li className="flex items-center gap-3">
          <span className="h-[9px] w-[9px] rounded-full shadow-[inset_0_0_0_2px_var(--color-opaline-200)]" aria-hidden="true" />
          In another conversation
        </li>
        <li className="flex items-center gap-3">
          <span className="h-[9px] w-[9px] rounded-full bg-signal" aria-hidden="true" />
          Talking with you
        </li>
      </ul>
      <p className="mt-8 text-[13px] text-opaline-500">
        Your dot sits <span className="whitespace-nowrap">1–3 km</span> from where you are. Nothing is stored; closing this tab removes you.
      </p>
    </div>
  );
}
