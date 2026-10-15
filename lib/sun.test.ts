import { test } from "node:test";
import assert from "node:assert/strict";
import {
  clockHoursApart,
  clockMinutes,
  distanceKm,
  formatClock,
  hoursApart,
  isDark,
  nightRing,
  partOfDay,
  solarMinutes,
  subsolarPoint,
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

test("part of day", () => {
  assert.equal(partOfDay(manila, new Date("2026-03-20T15:56:00Z")), "night");
  assert.equal(partOfDay(manila, new Date("2026-03-20T01:00:00Z")), "morning");
  assert.equal(partOfDay(manila, new Date("2026-03-20T07:00:00Z")), "afternoon");
});
