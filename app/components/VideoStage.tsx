"use client";

import { useEffect, useRef } from "react";
import clsx from "clsx";
import {
  ChatCircle,
  Microphone,
  MicrophoneSlash,
  VideoCamera,
  VideoCameraSlash,
  X,
} from "@phosphor-icons/react";
import type { PersonView } from "./Live";
import { formatClock } from "@/lib/sun";

function useStream(ref: React.RefObject<HTMLVideoElement | null>, stream: MediaStream | null) {
  useEffect(() => {
    const el = ref.current;
    if (el && el.srcObject !== stream) el.srcObject = stream;
  }, [ref, stream]);
}

/** Face to face. Their hour stays in the corner: you are still on the dial. */
export default function VideoStage({
  person,
  localStream,
  remoteStream,
  micOn,
  cameraOn,
  onToggleMic,
  onToggleCamera,
  onEnd,
  onShowChat,
  style,
}: {
  person: PersonView | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  micOn: boolean;
  cameraOn: boolean;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onEnd: () => void;
  /** Phones only: bring the conversation up over the video. */
  onShowChat?: () => void;
  style?: React.CSSProperties;
}) {
  const remoteRef = useRef<HTMLVideoElement>(null);
  const localRef = useRef<HTMLVideoElement>(null);
  useStream(remoteRef, remoteStream);
  useStream(localRef, localStream);

  return (
    <section className="video-stage absolute inset-y-0 left-0 overflow-hidden bg-lacquer-900" style={style} aria-label="Video call">
      <video ref={remoteRef} autoPlay playsInline className="h-full w-full object-cover" />
      {!remoteStream && (
        <p className="absolute inset-0 grid place-items-center text-[15px] text-opaline-400" role="status">
          Waiting for their camera…
        </p>
      )}

      {person && (
        <div className="pointer-events-none absolute left-5 top-5 rounded-2xl bg-lacquer-900/80 px-4 py-2.5">
          <p className="numeral text-[28px] leading-none text-signal">{formatClock(person.minutes)}</p>
          <p className="mt-1 text-[12px] text-opaline-200">their {person.dayWord}</p>
        </div>
      )}

      <div className="absolute bottom-24 right-5 aspect-[4/3] w-36 overflow-hidden rounded-2xl bg-lacquer-800 shadow-[var(--shadow-float)] sm:bottom-6 sm:w-52">
        <video
          ref={localRef}
          autoPlay
          playsInline
          muted
          aria-label="Your camera"
          className={clsx(
            "h-full w-full object-cover transition-opacity duration-200",
            "-scale-x-100", // a mirror, like looking at yourself
            !cameraOn && "opacity-0",
          )}
        />
        {!cameraOn && (
          <p className="absolute inset-0 grid place-content-center justify-items-center gap-1.5 text-[12px] text-opaline-400">
            <VideoCameraSlash size={22} aria-hidden="true" />
            Your camera is off
          </p>
        )}
      </div>

      <div className="absolute inset-x-0 bottom-0 flex justify-center gap-3 pb-[max(20px,env(safe-area-inset-bottom))] pt-4">
        {/* Toggles keep one name and report their state through aria-pressed. */}
        <button
          type="button"
          className={clsx("round-control", !micOn && "round-control--off")}
          aria-label="Mute microphone"
          aria-pressed={!micOn}
          title={micOn ? "Mute microphone" : "Unmute microphone"}
          onClick={onToggleMic}
        >
          {micOn ? <Microphone size={22} /> : <MicrophoneSlash size={22} />}
        </button>
        <button
          type="button"
          className={clsx("round-control", !cameraOn && "round-control--off")}
          aria-label="Turn off camera"
          aria-pressed={!cameraOn}
          title={cameraOn ? "Turn off camera" : "Turn on camera"}
          onClick={onToggleCamera}
        >
          {cameraOn ? <VideoCamera size={22} /> : <VideoCameraSlash size={22} />}
        </button>
        {onShowChat && (
          <button type="button" className="round-control" aria-label="Show conversation" onClick={onShowChat}>
            <ChatCircle size={22} />
          </button>
        )}
        <button
          type="button"
          className="round-control round-control--end"
          aria-label="End video, keep talking"
          title="End video, keep talking"
          onClick={onEnd}
        >
          <X size={22} weight="bold" />
        </button>
      </div>
    </section>
  );
}
