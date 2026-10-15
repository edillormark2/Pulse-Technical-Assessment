"use client";

import { Toaster, toast } from "sonner";
import EntryGate from "./components/EntryGate";
import Live from "./components/Live";
import { usePulse } from "@/lib/use-pulse";
import { useViewport } from "@/lib/use-world-clock";

export default function Home() {
  const pulse = usePulse({ notify: (text) => toast(text) });
  // Notices about the conversation appear where the conversation is.
  const { width } = useViewport();

  return (
    <>
      {pulse.phase === "gate" ? <EntryGate onReady={pulse.enter} /> : <Live pulse={pulse} />}
      <Toaster
        position={width >= 768 ? "top-right" : "top-center"}
        offset={20}
        toastOptions={{
          style: {
            background: "var(--color-lacquer-800)",
            color: "var(--color-opaline-50)",
            border: "none",
            borderRadius: 999,
            boxShadow: "var(--shadow-float)",
            fontSize: 15,
            justifyContent: "center",
          },
        }}
      />
    </>
  );
}
