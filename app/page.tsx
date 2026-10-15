"use client";

import { Toaster, toast } from "sonner";
import EntryGate from "./components/EntryGate";
import Live from "./components/Live";
import { usePulse } from "@/lib/use-pulse";

export default function Home() {
  const pulse = usePulse({ notify: (text) => toast(text) });

  return (
    <>
      {pulse.phase === "gate" ? <EntryGate onReady={pulse.enter} /> : <Live pulse={pulse} />}
      <Toaster
        position="top-center"
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
