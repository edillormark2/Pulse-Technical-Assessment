import { test } from "node:test";
import assert from "node:assert/strict";
import { applyPrivacyOffset } from "./geo.ts";
import { distanceKm } from "./sun.ts";

const manila = { lat: 14.5995, lng: 120.9842 };

test("privacy offset always lands 1-3 km away", () => {
  for (let i = 0; i < 500; i++) {
    const p = applyPrivacyOffset(manila.lat, manila.lng);
    const d = distanceKm(manila, p);
    assert.ok(d >= 0.99 && d <= 3.01, `offset ${d} km`);
  }
});
