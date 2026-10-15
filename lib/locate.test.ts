import { test } from "node:test";
import assert from "node:assert/strict";
import { APPROXIMATE, locate, locationProblem, PRECISE } from "./locate.ts";

const DENIED = 1;
const UNAVAILABLE = 2;
const TIMEOUT = 3;

/** A browser whose location answers come from a script: a fix, or an error code. */
function scriptedGeo(answers: ("fix" | number)[]) {
  const asked: PositionOptions[] = [];
  const geo = {
    getCurrentPosition(onFix: PositionCallback, onError: PositionErrorCallback, options: PositionOptions) {
      asked.push(options);
      const answer = answers.shift();
      assert.ok(answer !== undefined, "asked more times than expected");
      if (answer === "fix") onFix({ coords: { latitude: 14.6, longitude: 121 } } as GeolocationPosition);
      else onError({ code: answer, message: "" } as GeolocationPositionError);
    },
  } as unknown as Geolocation;
  return { geo, asked };
}

test("a precise fix is used when it comes, with no second try", async () => {
  const { geo, asked } = scriptedGeo(["fix"]);
  assert.equal((await locate(geo)).coords.latitude, 14.6);
  assert.deepEqual(asked, [PRECISE]);
});

test("after a timeout or no position, one approximate try follows", async () => {
  for (const first of [TIMEOUT, UNAVAILABLE]) {
    const { geo, asked } = scriptedGeo([first, "fix"]);
    assert.equal((await locate(geo)).coords.longitude, 121);
    assert.deepEqual(asked, [PRECISE, APPROXIMATE]);
  }
});

test("a block is final: no second try", async () => {
  const { geo, asked } = scriptedGeo([DENIED]);
  await assert.rejects(locate(geo), { code: DENIED });
  assert.deepEqual(asked, [PRECISE]);
});

test("when both tries fail, the second failure is the one reported", async () => {
  const { geo } = scriptedGeo([TIMEOUT, UNAVAILABLE]);
  await assert.rejects(locate(geo), { code: UNAVAILABLE });
});

test("the first try is fresh and precise; the fallback takes a recent or rough position", () => {
  assert.equal(PRECISE.enableHighAccuracy, true);
  assert.equal(PRECISE.maximumAge, 0);
  assert.equal(APPROXIMATE.enableHighAccuracy, false);
  assert.ok((APPROXIMATE.maximumAge ?? 0) > 0);
});

test("a block, a timeout and a missing position each get their own message", () => {
  const messages = [DENIED, TIMEOUT, UNAVAILABLE, undefined].map(locationProblem);
  assert.match(messages[0], /blocked/);
  assert.match(messages[1], /took too long/);
  assert.match(messages[2], /Couldn’t find where you are/);
  assert.equal(messages[3], messages[2], "an unknown failure reads like a missing position");
  assert.equal(new Set(messages.slice(0, 3)).size, 3);
});
