"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import type { PartOfDay } from "@/lib/sun";

/** The current time, refreshed every `intervalMs` and whenever the tab returns. */
export function useNow(intervalMs = 15_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const tick = () => setNow(new Date());
    const timer = setInterval(tick, intervalMs);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [intervalMs]);
  return now;
}

const subscribe = (onChange: () => void) => {
  window.addEventListener("resize", onChange);
  return () => window.removeEventListener("resize", onChange);
};

/** Viewport size, kept in sync with resizes. */
export function useViewport(): { width: number; height: number } {
  const key = useSyncExternalStore(
    subscribe,
    () => `${window.innerWidth}x${window.innerHeight}`,
    () => "1440x900",
  );
  const [width, height] = key.split("x").map(Number);
  return { width, height };
}

/** "9 hours ahead", "3 h 30 min behind", "your time". */
export function formatHoursApart(hours: number): string {
  if (hours === 0) return "same time as you";
  const abs = Math.abs(hours);
  const h = Math.floor(abs);
  const m = Math.round((abs - h) * 60);
  const span = m ? `${h} h ${m} min` : `${h} hour${h === 1 ? "" : "s"}`;
  return `${span} ${hours > 0 ? "ahead" : "behind"}`;
}

/** "about 11,200 km", rounded honestly (positions carry a 1–3 km offset). */
export function formatDistance(km: number): string {
  if (km < 10) return "under 10 km";
  const rounded = km < 1000 ? Math.round(km / 10) * 10 : Math.round(km / 50) * 50;
  return `about ${rounded.toLocaleString("en-US")} km`;
}

export const DAY_WORDS: Record<PartOfDay, string> = {
  night: "night",
  dawn: "dawn",
  morning: "morning",
  afternoon: "afternoon",
  evening: "evening",
  dusk: "dusk",
};
