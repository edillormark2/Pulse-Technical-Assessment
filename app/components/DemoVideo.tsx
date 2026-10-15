"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from "react";
import clsx from "clsx";
import { X } from "@phosphor-icons/react";

/** The narrated walkthrough. Versioned names, so the files can be cached for good. */
const DEMO = {
  av1: "/demo/pulse-demo-v1.av1.mp4",
  h264: "/demo/pulse-demo-v1.mp4",
  poster: "/demo/pulse-demo-v1.jpg",
  captions: "/demo/pulse-demo-v1.vtt",
  length: "1:34",
  spoken: "1 minute 34 seconds",
};

type Demo = { open: () => void; close: () => void };

const DemoContext = createContext<Demo | null>(null);

function useDemo(): Demo {
  const demo = useContext(DemoContext);
  if (!demo) throw new Error("useDemo needs a DemoProvider");
  return demo;
}

/**
 * One player for the page: a native modal dialog (it traps focus, closes on
 * Escape and makes the page inert) that downloads nothing until it is opened:
 * no poster and preload="none" until then.
 */
export function DemoProvider({ children, yieldTo }: { children: ReactNode; /** Close for something that matters more, like someone asking you. */ yieldTo?: boolean }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const open = useCallback(() => {
    const dialog = dialogRef.current;
    const video = videoRef.current;
    if (!dialog || !video || dialog.open) return;
    if (!video.poster) video.poster = DEMO.poster;
    dialog.showModal();
    // Started inside the click, so browsers allow sound; if one still refuses,
    // the player's own controls are there.
    video.play().catch(() => {});
  }, []);

  const close = useCallback(() => dialogRef.current?.close(), []);

  useEffect(() => {
    if (yieldTo) close();
  }, [yieldTo, close]);

  const demo = useMemo(() => ({ open, close }), [open, close]);

  return (
    <DemoContext.Provider value={demo}>
      {children}
      <dialog
        ref={dialogRef}
        className="demo-dialog"
        aria-labelledby="demo-title"
        onClose={() => videoRef.current?.pause()}
        // A click on the backdrop lands on the dialog itself.
        onClick={(e) => e.target === e.currentTarget && close()}
      >
        <div className="demo-dialog__bar">
          <div>
            <h2 id="demo-title" className="text-[17px] text-opaline-50">
              How Pulse works
            </h2>
            <p className="tabular mt-0.5 text-[13px] text-opaline-400">A narrated walkthrough · {DEMO.length}</p>
          </div>
          <button type="button" className="icon-button" aria-label="Close the demo" onClick={close}>
            <X size={22} />
          </button>
        </div>
        <video ref={videoRef} className="demo-dialog__video" controls playsInline preload="none">
          {/* AV1 where the browser can decode it (about half the size), H.264 everywhere else. */}
          <source src={DEMO.av1} type='video/mp4; codecs="av01.0.08M.08, mp4a.40.2"' />
          <source src={DEMO.h264} type='video/mp4; codecs="avc1.640028, mp4a.40.2"' />
          <track kind="captions" src={DEMO.captions} srcLang="en" label="English" />
        </video>
      </dialog>
    </DemoContext.Provider>
  );
}

// The play disc breathes on the first pill a visit shows, then never again.
let pinged = false;

/** The way in: a quiet pill with a play disc that breathes a few times, then rests. */
export function DemoButton({ className }: { className?: string }) {
  const demo = useDemo();
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (pinged || !ref.current) return;
    pinged = true;
    ref.current.dataset.ping = "";
  }, []);
  return (
    <button
      ref={ref}
      type="button"
      className={clsx("demo-chip", className)}
      onClick={demo.open}
      aria-haspopup="dialog"
      aria-label={`Watch the demo, ${DEMO.spoken}`}
    >
      <span className="demo-chip__play" aria-hidden="true">
        <svg width="12" height="12" viewBox="0 0 12 12">
          <path d="M3.2 1.9 L10.2 6 L3.2 10.1 Z" fill="currentColor" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
        </svg>
      </span>
      Watch the demo
      <span className="demo-chip__time" aria-hidden="true">
        {DEMO.length}
      </span>
    </button>
  );
}
