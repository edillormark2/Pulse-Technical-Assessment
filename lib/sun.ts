// Sun and clock math for the World Time dial. Pure functions, no imports, so
// they run in the browser and under `node --test` alike.
//
// Accuracy target is "looks right on a globe": the low-precision solar
// position from the Astronomical Almanac is good to ~0.01° in declination,
// far finer than a dot placed 1–3 km from its owner.

const DEG = Math.PI / 180;
const MINUTES_PER_DAY = 1440;

export interface LatLng {
  lat: number;
  lng: number;
}

/** Wrap any longitude into [-180, 180). */
export function wrapLng(lng: number): number {
  return ((((lng + 180) % 360) + 360) % 360) - 180;
}

function daysSinceJ2000(date: Date): number {
  return date.getTime() / 86_400_000 + 2440587.5 - 2451545.0;
}

/** Sun's declination and right ascension (degrees) plus sidereal time. */
function solarCoordinates(date: Date) {
  const n = daysSinceJ2000(date);
  const meanLongitude = (280.46 + 0.9856474 * n) % 360;
  const meanAnomaly = ((357.528 + 0.9856003 * n) % 360) * DEG;
  const eclipticLongitude =
    (meanLongitude +
      1.915 * Math.sin(meanAnomaly) +
      0.02 * Math.sin(2 * meanAnomaly)) *
    DEG;
  const obliquity = (23.439 - 0.0000004 * n) * DEG;
  const declination = Math.asin(
    Math.sin(obliquity) * Math.sin(eclipticLongitude),
  );
  const rightAscension = Math.atan2(
    Math.cos(obliquity) * Math.sin(eclipticLongitude),
    Math.cos(eclipticLongitude),
  );
  const siderealTime = (280.46061837 + 360.98564736629 * n) % 360;
  return {
    declination: declination / DEG,
    rightAscension: rightAscension / DEG,
    siderealTime,
  };
}

/** The point on Earth where the sun is directly overhead right now. */
export function subsolarPoint(date: Date): LatLng {
  const { declination, rightAscension, siderealTime } = solarCoordinates(date);
  return { lat: declination, lng: wrapLng(rightAscension - siderealTime) };
}

/** Sun altitude above the horizon at a place, in degrees (negative = below). */
export function sunAltitude({ lat, lng }: LatLng, date: Date): number {
  const { declination, rightAscension, siderealTime } = solarCoordinates(date);
  const hourAngle = (siderealTime + lng - rightAscension) * DEG;
  const phi = lat * DEG;
  const delta = declination * DEG;
  return (
    Math.asin(
      Math.sin(phi) * Math.sin(delta) +
        Math.cos(phi) * Math.cos(delta) * Math.cos(hourAngle),
    ) / DEG
  );
}

/** Dark enough to count as night: the sun is below civil twilight (-6°). */
export function isDark(place: LatLng, date: Date): boolean {
  return sunAltitude(place, date) < -6;
}

/**
 * Night as a GeoJSON polygon ring: every place where the sun sits below
 * `altitude` degrees. Altitude 0 is the terminator; -6 and -12 give the
 * civil and nautical twilight edges for a soft gradient.
 */
export function nightRing(date: Date, altitude = 0, step = 2): [number, number][] {
  const { declination, rightAscension, siderealTime } = solarCoordinates(date);
  const delta = declination * DEG;
  const target = Math.sin(altitude * DEG);
  const ring: [number, number][] = [];
  for (let lng = -180; lng <= 180; lng += step) {
    const hourAngle = (siderealTime + lng - rightAscension) * DEG;
    // Solve sin(φ)·sin(δ) + cos(φ)·cos(δ)·cos(H) = sin(alt) for φ.
    const a = Math.sin(delta);
    const b = Math.cos(delta) * Math.cos(hourAngle);
    const r = Math.hypot(a, b);
    const ratio = Math.max(-1, Math.min(1, target / r));
    let lat = (Math.asin(ratio) - Math.atan2(b, a)) / DEG;
    if (lat < -90) lat += 180;
    if (lat > 90) lat -= 180;
    ring.push([lng, Math.max(-90, Math.min(90, lat))]);
  }
  // Close over the pole that is in darkness (the one tilted away from the sun).
  const darkPole = declination > 0 ? -90 : 90;
  ring.push([180, darkPole], [-180, darkPole], ring[0]);
  return ring;
}

/** Local mean solar time at a longitude, in minutes after midnight. */
export function solarMinutes(lng: number, date: Date): number {
  const utcMinutes =
    date.getUTCHours() * 60 + date.getUTCMinutes() + date.getUTCSeconds() / 60;
  const minutes = utcMinutes + lng * 4; // the sun crosses 1° of longitude in 4 min
  return ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
}

/**
 * Wall-clock time for a UTC offset (minutes east of UTC, e.g. +480 for
 * Manila), in minutes after midnight. This is what the person's own clock
 * shows, daylight saving included; solar time can be hours off it.
 */
export function clockMinutes(utcOffset: number, date: Date): number {
  const minutes = date.getTime() / 60_000 + utcOffset;
  return ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
}

/** Their clock minus ours in hours, folded into (-12, 12]. */
export function clockHoursApart(myOffset: number, theirOffset: number): number {
  let diff = (theirOffset - myOffset) / 60;
  while (diff > 12) diff -= 24;
  while (diff <= -12) diff += 24;
  return diff;
}

/** "06:42" from minutes after midnight. */
export function formatClock(minutes: number): string {
  const whole = Math.floor(minutes) % MINUTES_PER_DAY;
  const h = Math.floor(whole / 60);
  const m = whole % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Their sun-time minus ours, in hours, folded into (-12, 12]. */
export function hoursApart(myLng: number, theirLng: number): number {
  let diff = wrapLng(theirLng - myLng) / 15;
  if (diff <= -12) diff += 24;
  return diff;
}

/** Great-circle distance in kilometres. */
export function distanceKm(a: LatLng, b: LatLng): number {
  const dLat = (b.lat - a.lat) * DEG;
  const dLng = (b.lng - a.lng) * DEG;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * DEG) * Math.cos(b.lat * DEG) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export type PartOfDay = "night" | "dawn" | "morning" | "afternoon" | "evening" | "dusk";

/**
 * How someone's day looks right now. Darkness comes from the real sun at
 * their dot; morning/afternoon/evening follow the clock they actually see
 * (`clock`, minutes after midnight) so "12:25" never reads as "morning".
 * Without a known clock, their sun-time stands in.
 */
export function partOfDay(place: LatLng, date: Date, clock?: number): PartOfDay {
  const altitude = sunAltitude(place, date);
  const hour = (clock ?? solarMinutes(place.lng, date)) / 60;
  if (altitude < -6) return "night";
  if (altitude < 0) return hour < 12 ? "dawn" : "dusk";
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

/** Part of day from a wall clock alone, for before anyone knows where you are. */
export function partOfClock(minutes: number): PartOfDay {
  const hour = minutes / 60;
  if (hour < 5 || hour >= 21) return "night";
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}
