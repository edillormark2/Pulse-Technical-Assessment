import { test } from "node:test";
import assert from "node:assert/strict";
import {
  clockHoursApart,
  clockMinutes,
  DAYBREAK_AFTER,
  DAYBREAK_AHEAD,
  daybreak,
  distanceKm,
  formatClock,
  hoursApart,
  isDark,
  nextSunrise,
  nightRing,
  partOfClock,
  partOfDay,
  solarMinutes,
  subsolarPoint,
  SUNRISE_ALTITUDE,
  sunAltitude,
} from "./sun.ts";

const near = (actual: number, expected: number, tolerance: number) =>
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${expected} ±${tolerance}, got ${actual}`,
  );

const manila = { lat: 14.5995, lng: 120.9842 };
const sanFrancisco = { lat: 37.7749, lng: -122.4194 };

test("subsolar latitude follows the solstices", () => {
  near(subsolarPoint(new Date("2026-06-21T12:00:00Z")).lat, 23.43, 0.1);
  near(subsolarPoint(new Date("2026-12-21T12:00:00Z")).lat, -23.43, 0.1);
});

test("subsolar point sits near Greenwich at noon UTC on an equinox", () => {
  const p = subsolarPoint(new Date("2026-03-20T12:00:00Z"));
  near(p.lat, 0, 0.5);
  near(p.lng, 0, 3); // equation of time shifts it a couple of degrees
});

test("sun altitude: high at local noon, far below at local midnight", () => {
  // Manila's solar noon is ~03:56 UTC.
  near(sunAltitude(manila, new Date("2026-03-20T03:56:00Z")), 75.4, 1.5);
  assert.ok(sunAltitude(manila, new Date("2026-03-20T15:56:00Z")) < -60);
  assert.equal(isDark(manila, new Date("2026-03-20T15:56:00Z")), true);
  assert.equal(isDark(manila, new Date("2026-03-20T03:56:00Z")), false);
});

test("night ring is a closed polygon that excludes the subsolar point", () => {
  const date = new Date("2026-06-21T12:00:00Z");
  const ring = nightRing(date);
  assert.deepEqual(ring[0], ring[ring.length - 1]);
  for (const [lng, lat] of ring) {
    assert.ok(lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90);
  }
  // In June the south pole is in darkness, so the ring closes over it.
  assert.ok(ring.some(([, lat]) => lat === -90));
  // Antipode of the subsolar point is midnight: its sun is far below.
  const sub = subsolarPoint(date);
  assert.ok(sunAltitude({ lat: -sub.lat, lng: sub.lng + 180 }, date) < -60);
});

test("solar time advances 4 minutes per degree of longitude", () => {
  const noonUtc = new Date("2026-01-01T12:00:00Z");
  assert.equal(solarMinutes(0, noonUtc), 720);
  near(solarMinutes(manila.lng, new Date("2026-01-01T00:00:00Z")), 483.9, 0.1);
  near(solarMinutes(-90, noonUtc), 360, 0.001);
});

test("clock formatting and hour differences", () => {
  assert.equal(formatClock(402), "06:42");
  assert.equal(formatClock(1439.9), "23:59");
  near(hoursApart(manila.lng, sanFrancisco.lng), 7.8, 0.1); // SF is ~7.8 h "ahead" eastward of Manila by sun
  near(hoursApart(sanFrancisco.lng, manila.lng), -7.8, 0.1);
  near(hoursApart(170, -170), 1.333, 0.01); // across the antimeridian
});

test("wall-clock time honours the person's own UTC offset", () => {
  const when = new Date("2026-10-15T13:42:00Z");
  assert.equal(formatClock(clockMinutes(480, when)), "21:42"); // Manila, UTC+8
  assert.equal(formatClock(clockMinutes(-420, when)), "06:42"); // SF in daylight time
  assert.equal(formatClock(clockMinutes(345, when)), "19:27"); // Kathmandu, UTC+5:45
  assert.equal(clockHoursApart(480, -420), 9); // SF reads 9 hours later on the dial
  assert.equal(clockHoursApart(-420, 480), -9);
  // Niue (UTC-11) reads one hour behind Kiribati (UTC+14), a calendar day apart.
  assert.equal(clockHoursApart(840, -660), -1);
});

test("distance Manila to San Francisco is about 11,200 km", () => {
  near(distanceKm(manila, sanFrancisco), 11_200, 150);
});

test("part of day follows the person's own clock when known", () => {
  // Sydney in daylight saving: the sun says ~11:30 but clocks say 12:25.
  const sydney = { lat: -33.87, lng: 151.21 };
  const when = new Date("2026-10-15T01:25:00Z");
  assert.equal(partOfDay(sydney, when, clockMinutes(660, when)), "afternoon");
  assert.equal(partOfDay(sydney, when), "morning"); // sun-time fallback
});

test("part of day", () => {
  assert.equal(partOfDay(manila, new Date("2026-03-20T15:56:00Z")), "night");
  assert.equal(partOfDay(manila, new Date("2026-03-20T01:00:00Z")), "morning");
  assert.equal(partOfDay(manila, new Date("2026-03-20T07:00:00Z")), "afternoon");
});

test("part of day from the clock alone, before a location is known", () => {
  const at = (h: number, m = 0) => partOfClock(h * 60 + m);
  assert.equal(at(0), "night");
  assert.equal(at(4, 59), "night");
  assert.equal(at(5), "morning");
  assert.equal(at(11, 59), "morning");
  assert.equal(at(12), "afternoon");
  assert.equal(at(17), "evening");
  assert.equal(at(20, 59), "evening");
  assert.equal(at(21), "night");
});

test("both ends of a call name the same hour the same way", () => {
  // San Francisco in October: dark by 19:40, but by the clock it is still evening.
  const sf = { lat: 37.77, lng: -122.42 };
  const evening = new Date("2026-10-16T02:40:00Z"); // 19:40 PDT
  assert.equal(partOfDay(sf, evening, clockMinutes(-420, evening)), "evening");
  assert.equal(partOfDay(sf, evening, clockMinutes(-420, evening)), partOfClock(clockMinutes(-420, evening)));
  // Just after sunset the sun adds dusk.
  const dusk = new Date("2026-10-16T01:50:00Z"); // 18:50 PDT
  assert.equal(partOfDay(sf, dusk, clockMinutes(-420, dusk)), "dusk");
});

const minutesBetween = (a: Date, b: Date) => (a.getTime() - b.getTime()) / 60_000;

test("sunrise matches published times within a few minutes", () => {
  // San Francisco, 15 Oct 2026: published as 07:17–07:18 PDT (14:18 UTC).
  const sf = nextSunrise(sanFrancisco, new Date("2026-10-15T13:00:00Z"));
  assert.ok(sf);
  near(minutesBetween(sf, new Date("2026-10-15T14:17:30Z")), 0, 2);
  // Manila, 15 Oct 2026: about 05:47 PHT (21:47 UTC the evening before).
  const mnl = nextSunrise(manila, new Date("2026-10-14T21:00:00Z"));
  assert.ok(mnl);
  near(minutesBetween(mnl, new Date("2026-10-14T21:47:00Z")), 0, 2);
});

test("at the sunrise found, the sun's edge is on the horizon and climbing", () => {
  const at = nextSunrise(sanFrancisco, new Date("2026-10-15T13:00:00Z"))!;
  near(sunAltitude(sanFrancisco, at), SUNRISE_ALTITUDE, 0.02);
  assert.ok(sunAltitude(sanFrancisco, new Date(at.getTime() - 60_000)) < SUNRISE_ALTITUDE);
});

test("no sunrise while the sun is up, or through polar night", () => {
  assert.equal(nextSunrise(sanFrancisco, new Date("2026-10-15T20:00:00Z")), null);
  const longyearbyen = { lat: 78.22, lng: 15.65 };
  assert.equal(nextSunrise(longyearbyen, new Date("2026-12-20T09:00:00Z"), 24 * 60), null);
});

test("daybreak runs from half an hour before sunrise to ten minutes after", () => {
  const sunrise = nextSunrise(sanFrancisco, new Date("2026-10-15T13:00:00Z"))!;
  const at = (offsetMin: number) => daybreak(sanFrancisco, new Date(sunrise.getTime() + offsetMin * 60_000));
  near(at(-20)!.minutes, 20, 0.05);
  near(at(5)!.minutes, -5, 0.05);
  assert.equal(at(-45), null);
  assert.equal(at(15), null);
});

test("skipping the search far from the horizon never misses a daybreak", () => {
  // Every five minutes for a day, from the equator to past the Arctic Circle,
  // daybreak must agree with the full search it skips.
  const places = [manila, sanFrancisco, { lat: 0, lng: 0 }, { lat: -45, lng: 170 }, { lat: 69.65, lng: 18.96 }];
  for (const day of ["2026-03-20", "2026-06-21", "2026-10-15", "2026-12-21"]) {
    for (const place of places) {
      for (let m = 0; m < 24 * 60; m += 5) {
        const now = new Date(Date.parse(`${day}T00:00:00Z`) + m * 60_000);
        const full =
          nextSunrise(place, now, DAYBREAK_AHEAD) ??
          nextSunrise(place, new Date(now.getTime() - DAYBREAK_AFTER * 60_000), DAYBREAK_AFTER);
        assert.equal(daybreak(place, now)?.sunrise.getTime(), full?.getTime(), `${day} +${m} min at ${place.lat},${place.lng}`);
      }
    }
  }
});
