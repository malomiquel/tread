import assert from "node:assert/strict";
import { test } from "node:test";
import {
  hasSinglePace, SESSIONS, sessionById, sessionMinutes, stepIsDone, stepLabel, stepRemaining,
} from "./workout.ts";

test("a distance block ends on distance, whatever the clock says", () => {
  const block = { effort: "rapide" as const, metres: 400 };
  assert.equal(stepIsDone(block, 399, 9999), false, "not covered yet");
  assert.equal(stepIsDone(block, 400, 0), true, "covered, however fast");
  assert.deepEqual(stepRemaining(block, 150, 40), { metres: 250, seconds: null });
});

test("a time block ends on time, whatever the distance says", () => {
  const block = { effort: "récupération" as const, seconds: 90 };
  assert.equal(stepIsDone(block, 9999, 89), false, "not elapsed yet");
  assert.equal(stepIsDone(block, 0, 90), true, "elapsed, even standing still");
  assert.deepEqual(stepRemaining(block, 0, 30), { metres: null, seconds: 60 });
});

test("what remains never goes negative", () => {
  assert.deepEqual(stepRemaining({ effort: "rapide", metres: 400 }, 700, 0).metres, 0);
  assert.deepEqual(stepRemaining({ effort: "récupération", seconds: 90 }, 0, 200).seconds, 0);
});

test("steps say what they are", () => {
  assert.equal(stepLabel({ effort: "rapide", metres: 400 }), "400 m rapide");
  assert.equal(stepLabel({ effort: "allure", metres: 1500 }), "1,5 km allure");
  assert.equal(stepLabel({ effort: "récupération", seconds: 180 }), "3 min récupération");
});

test("every session in the catalogue holds together", () => {
  const seen = new Set<string>();
  for (const s of SESSIONS) {
    assert.ok(!seen.has(s.id), `duplicate identifier: ${s.id}`);
    seen.add(s.id);
    assert.ok(s.steps.length > 0, `${s.name} is empty`);
    for (const step of s.steps) {
      const mesures = [step.metres, step.seconds].filter((v) => v !== undefined).length;
      assert.equal(mesures, 1, `${s.name}: a block must carry exactly one measure`);
    }
    // Without an upper bound, a mistyped session would send someone out for
    // three hours.
    const minutes = sessionMinutes(s);
    assert.ok(minutes >= 20 && minutes <= 90, `${s.name} lasts ${minutes} min`);
  }
});

test("a session is found by its identifier, and only then", () => {
  assert.equal(sessionById("400")?.name, "5 × 400 m");
  assert.equal(sessionById("inexistante"), null);
  assert.equal(sessionById(null), null);
});

test("a session asks for one pace only when every block wants the same effort", () => {
  const steady = SESSIONS.find((s) => s.id === "footing")!;
  const varied = SESSIONS.find((s) => s.id === "400")!;

  assert.equal(hasSinglePace(steady), true, "a plain run asks for one pace");
  assert.equal(hasSinglePace(varied), false, "repetitions ask for several");
});
