import { test } from "node:test";
import assert from "node:assert/strict";
import {
  customIdOf, customSessionId, defaultName, expand, measureLabel, nudge, parseGroups, starterGroups,
  switchMeasure, toSession,
} from "./customSession.ts";

test("groups unroll into the steps the tracker follows", () => {
  const steps = expand(starterGroups());
  assert.equal(steps.length, 1 + 5 * 2 + 1);
  assert.deepEqual(steps[1], { effort: "fast", metres: 400 });
  assert.deepEqual(steps[2], { effort: "recovery", metres: 200 });
  assert.deepEqual(steps[0], { effort: "warmup", seconds: 600 });
});

test("a custom session's id round-trips, and nothing else is one", () => {
  assert.equal(customIdOf(customSessionId(7)), 7);
  assert.equal(customIdOf("400"), null);
  assert.equal(customIdOf(null), null);
});

test("an unnamed session is named after its repeated part", () => {
  assert.equal(defaultName(starterGroups()), "5 × 400 m rapide");
  assert.equal(defaultName([{ times: 1, blocks: [{ effort: "steady", measure: "seconds", value: 2700 }] }]), "45 min allure");
  const named = toSession({ id: 3, name: "  Côtes  ", groups: starterGroups() });
  assert.equal(named.name, "Côtes");
  assert.equal(named.id, "custom-3");
  assert.equal(toSession({ id: 3, name: " ", groups: starterGroups() }).name, "5 × 400 m rapide");
});

test("measures read the way a coach would say them", () => {
  assert.equal(measureLabel({ measure: "metres", value: 400 }), "400 m");
  assert.equal(measureLabel({ measure: "metres", value: 1500 }), "1,5 km");
  assert.equal(measureLabel({ measure: "seconds", value: 45 }), "45 s");
  assert.equal(measureLabel({ measure: "seconds", value: 600 }), "10 min");
  assert.equal(measureLabel({ measure: "seconds", value: 150 }), "2 min 30");
});

test("steps grow with the size, and come back down the same way", () => {
  assert.equal(nudge(400, "metres", 1), 500);
  assert.equal(nudge(1000, "metres", 1), 1500);
  assert.equal(nudge(1000, "metres", -1), 900);
  assert.equal(nudge(100, "metres", -1), 100);
  assert.equal(nudge(60, "seconds", 1), 75);
  assert.equal(nudge(120, "seconds", -1), 105);
  assert.equal(nudge(600, "seconds", 1), 660);
  assert.equal(nudge(600, "seconds", -1), 570);
  assert.equal(nudge(15, "seconds", -1), 15);
});

test("switching measure keeps the block about as long", () => {
  assert.deepEqual(switchMeasure({ effort: "fast", measure: "metres", value: 1000 }), { effort: "fast", measure: "seconds", value: 300 });
  assert.deepEqual(switchMeasure({ effort: "fast", measure: "seconds", value: 90 }), { effort: "fast", measure: "metres", value: 300 });
});

test("stored groups are checked, and junk reads as none", () => {
  assert.deepEqual(parseGroups(JSON.stringify(starterGroups())), starterGroups());
  assert.equal(parseGroups("{"), null);
  assert.equal(parseGroups("[]"), null);
  assert.deepEqual(
    parseGroups(JSON.stringify([{ times: 99, blocks: [{ effort: "fast", measure: "metres", value: 400 }, { effort: "nap" }] }])),
    [{ times: 30, blocks: [{ effort: "fast", measure: "metres", value: 400 }] }],
  );
});
