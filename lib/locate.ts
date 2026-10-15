// Asking the browser where you are: a precise fix first, then whatever it has.

/** A fresh, precise fix (Wi-Fi or GPS), never the browser's cached guess. */
export const PRECISE: PositionOptions = { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 };

/** The fallback: an approximate or recent position is enough to place you. */
export const APPROXIMATE: PositionOptions = { enableHighAccuracy: false, timeout: 15_000, maximumAge: 10 * 60_000 };

// GeolocationPositionError codes, from the spec.
const PERMISSION_DENIED = 1;
const TIMEOUT = 3;

function attempt(geo: Geolocation, options: PositionOptions): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => geo.getCurrentPosition(resolve, reject, options));
}

/**
 * Where you are. Pulse moves your dot 1–3 km and the dial needs only your
 * time zone, so when the precise fix fails (no GPS, a slow Wi-Fi scan, a
 * system prompt left waiting) one approximate try follows. A block is final:
 * asking again would only nag. If both tries fail, the second error stands.
 */
export async function locate(geo: Geolocation): Promise<GeolocationPosition> {
  try {
    return await attempt(geo, PRECISE);
  } catch (err) {
    if ((err as GeolocationPositionError | undefined)?.code === PERMISSION_DENIED) throw err;
    return attempt(geo, APPROXIMATE);
  }
}

/** What to say when locating fails, by the browser's error code. */
export function locationProblem(code: number | undefined): string {
  if (code === PERMISSION_DENIED) {
    return "Location is blocked for this site. Allow it in your browser’s site settings, then try again.";
  }
  if (code === TIMEOUT) {
    return "Finding you took too long. If your device asked to share your location, allow it, then try again.";
  }
  return "Couldn’t find where you are. Check that location is on for this browser, then try again.";
}
