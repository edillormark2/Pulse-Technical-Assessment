import { test } from "node:test";
import assert from "node:assert/strict";
import { applyPrivacyOffset, greatCirclePath } from "./geo.ts";
import { distanceKm } from "./sun.ts";

const manila = { lat: 14.5995, lng: 120.9842 };
const sanFrancisco = { lat: 37.7749, lng: -122.4194 };

test("privacy offset always lands 1-3 km away", () => {
  for (let i = 0; i < 500; i++) {
    const p = applyPrivacyOffset(manila.lat, manila.lng);
    const d = distanceKm(manila, p);
    assert.ok(d >= 0.99 && d <= 3.01, `offset ${d} km`);
  }
});

test("great circle starts and ends at the two people", () => {
  const path = greatCirclePath(manila, sanFrancisco, 32);
  assert.equal(path.length, 33);
  assert.ok(Math.abs(path[0][0] - manila.lng) < 1e-6 && Math.abs(path[0][1] - manila.lat) < 1e-6);
  const [lng, lat] = path[32];
  assert.ok(Math.abs(((lng - sanFrancisco.lng + 540) % 360) - 180) < 1e-6);
  assert.ok(Math.abs(lat - sanFrancisco.lat) < 1e-6);
});

test("great circle crossing the Pacific stays continuous (no antimeridian jump)", () => {
  const path = greatCirclePath(manila, sanFrancisco, 64);
  for (let i = 1; i < path.length; i++) {
    assert.ok(Math.abs(path[i][0] - path[i - 1][0]) < 20, `jump at ${i}`);
  }
  // Manila to SF arcs north over the Pacific, well above both endpoints.
  assert.ok(Math.max(...path.map(([, lat]) => lat)) > 45);
});

test("coincident points produce a degenerate but valid path", () => {
  const path = greatCirclePath(manila, manila, 4);
  assert.equal(path.length, 5);
  for (const [lng, lat] of path) {
    assert.ok(Number.isFinite(lng) && Number.isFinite(lat));
  }
});
