"use client";

import { useSyncExternalStore } from "react";
import { useViewport } from "@/lib/use-world-clock";

/**
 * The ring's geometry outward from the globe's edge, in px: a gap, the
 * engraved 24-hour band, a lane for the call arc, then people at their hour
 * outside the band, and a margin for their marks.
 */
export const DIAL = {
  desktop: { gap: 14, band: 36, arc: 5, track: 17, margin: 14, figure: 21 },
  compact: { gap: 9, band: 26, arc: 4, track: 13, margin: 11, figure: 18 },
} as const;

/** From the globe's edge to the dial's outer edge. */
export const dialExtent = (g: (typeof DIAL)[keyof typeof DIAL]) => g.gap + g.band + g.track + g.margin;

/** Phones: the header's three lines sit above the dial. */
const COMPACT_TOP = 108;

export interface DialLayout {
  /** Phones and narrow windows: dial on top, panel in a bottom sheet. */
  compact: boolean;
  /** Desktop: width of the right-hand panel column (0 when compact). */
  column: number;
  /** Radius of the globe's visible disc at rest; the dial is built around it. */
  globeRadius: number;
  /** Space kept clear of the globe's centre: the panel column or the sheet. */
  padding: { top: number; right: number; bottom: number; left: number };
  /** Where the globe's centre sits on screen. */
  center: { x: number; y: number };
}

/**
 * Dial geometry for the viewport, shared by the entry screen and the live
 * view so the ring never moves between them. Desktop keeps a right-hand
 * column for the panel at all times, so opening a card never moves the
 * globe; phones put the dial at the top and the panel in a bottom sheet.
 */
export function useDialLayout(): DialLayout {
  const { width, height } = useViewport();
  const compact = width < 768;
  let column = 0;
  let globeRadius: number;
  let padding: DialLayout["padding"];
  if (!compact) {
    column = Math.round(Math.min(440, Math.max(360, width * 0.3)));
    const outer = Math.min(width - column, height - 64) / 2 - 12;
    globeRadius = Math.max(120, outer - dialExtent(DIAL.desktop));
    padding = { top: 0, right: column, bottom: 0, left: 0 };
  } else {
    const sheet = Math.round(height * 0.38);
    const outer = Math.min(width, height - sheet - COMPACT_TOP) / 2 - 4;
    globeRadius = Math.max(90, outer - dialExtent(DIAL.compact));
    padding = { top: COMPACT_TOP, right: 0, bottom: sheet, left: 0 };
  }
  const center = {
    x: padding.left + (width - padding.left - padding.right) / 2,
    y: padding.top + (height - padding.top - padding.bottom) / 2,
  };
  return { compact, column, globeRadius, padding, center };
}

const noop = () => () => {};

/** False while rendering on the server and hydrating, true after. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}
