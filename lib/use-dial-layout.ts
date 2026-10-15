"use client";

import { useSyncExternalStore } from "react";
import { useViewport } from "@/lib/use-world-clock";

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
    globeRadius = Math.max(120, outer - 26 - 22 - 14 - 18);
    padding = { top: 0, right: column, bottom: 0, left: 0 };
  } else {
    const sheet = Math.round(height * 0.38);
    const outer = Math.min(width, height - sheet - 72) / 2 - 4;
    globeRadius = Math.max(90, outer - 22 - 16 - 11 - 14);
    padding = { top: 72, right: 0, bottom: sheet, left: 0 };
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
