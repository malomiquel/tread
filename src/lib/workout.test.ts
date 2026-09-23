import assert from "node:assert/strict";
import { test } from "node:test";
import {
  eased, groupLabel, groupSteps, hasSinglePace, SESSIONS, sessionById, sessionMinutes,
  stepIsDone, stepLabel, stepRemaining,
} from "./workout.ts";

test("a distance block ends on distance, whatever the clock says", () => {
  const block = { effort: "fast" as const, metres: 400 };
  assert.equal(stepIsDone(block, 399, 9999), false, "not covered yet");
  assert.equal(stepIsDone(block, 400, 0), true, "covered, however fast");
  assert.deepEqual(stepRemaining(block, 150, 40), { metres: 250, seconds: null });
});

test("a time block ends on time, whatever the distance says", () => {
  const block = { effort: "recovery" as const, seconds: 90 };
  assert.equal(stepIsDone(block, 9999, 89), false, "not elapsed yet");
  assert.equal(stepIsDone(block, 0, 90), true, "elapsed, even standing still");
  assert.deepEqual(stepRemaining(block, 0, 30), { metres: null, seconds: 60 });
});

test("what remains never goes negative", () => {
  assert.deepEqual(stepRemaining({ effort: "fast", metres: 400 }, 700, 0).metres, 0);
  assert.deepEqual(stepRemaining({ effort: "recovery", seconds: 90 }, 0, 200).seconds, 0);
});

test("steps say what they are", () => {
  assert.equal(stepLabel({ effort: "fast", metres: 400 }), "400 m rapide");
  assert.equal(stepLabel({ effort: "steady", metres: 1500 }), "1,5 km allure");
  assert.equal(stepLabel({ effort: "recovery", seconds: 180 }), "3 min récupération");
});

test("every session in the catalogue holds together", () => {
  const seen = new Set<string>();
  for (const s of SESSIONS) {
    assert.ok(!seen.has(s.id), `duplicate identifier: ${s.id}`);
    seen.add(s.id);
    assert.ok(s.steps.length > 0, `${s.name} is empty`);
    for (const step of s.steps) {
      const measures = [step.metres, step.seconds].filter((v) => v !== undefined).length;
      assert.equal(measures, 1, `${s.name}: a block must carry exactly one measure`);
    }
    // Without an upper bound, a mistyped session would send someone out for
    // three hours.
    const minutes = sessionMinutes(s);
    assert.ok(minutes >= 20 && minutes <= 90, `${s.name} lasts ${minutes} min`);
  }
});

test("a session is found by its identifier, and only then", () => {
  assert.equal(sessionById("400")?.name, "5 × 400 m");
  assert.equal(sessionById("missing"), null);
  assert.equal(sessionById(null), null);
});

test("only the blocks you hold a pace through decide whether a target fits", () => {
  const by = (id: string) => SESSIONS.find((s) => s.id === id)!;

  assert.equal(hasSinglePace(by("easy")), true, "a plain run holds one pace");
  // A long run warms up and cools down around a single sustained block: those
  // do not compete for a target, and counting them would rule it out.
  assert.equal(hasSinglePace(by("long")), true, "a long run holds one pace");

  assert.equal(hasSinglePace(by("400")), false, "five repetitions ask for several");
  assert.equal(hasSinglePace(by("threshold")), false, "three threshold blocks do too");
  assert.equal(hasSinglePace(by("pyramid")), false);
});


test("repeated blocks fold into the shape the session was designed in", () => {
  const session = sessionById("400")!;
  const groups = groupSteps(session.steps);
  // A warm-up, five repetitions of effort and recovery, a cool-down.
  assert.equal(groups.length, 3);
  assert.equal(groups[0].times, 1);
  assert.equal(groups[1].times, 5);
  assert.equal(groups[1].steps.length, 2);
  assert.equal(groups[2].times, 1);
  assert.match(groupLabel(groups[1]), /^5 × \(400 m rapide \+ 200 m récupération\)$/);
});

test("folding never loses or invents a block", () => {
  for (const session of SESSIONS) {
    const total = groupSteps(session.steps).reduce((sum, g) => sum + g.times * g.steps.length, 0);
    assert.equal(total, session.steps.length, session.id);
  }
});

test("a session with nothing to repeat is left alone", () => {
  const footing = sessionById("easy")!;
  const groups = groupSteps(footing.steps);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].times, 1);
  assert.equal(groupLabel(groups[0]), stepLabel(footing.steps[0]));

  const pyramid = groupSteps(sessionById("pyramid")!.steps);
  // Every block differs, so nothing folds and nothing is lost.
  assert.equal(pyramid.reduce((sum, g) => sum + g.times * g.steps.length, 0), 11);
});

test("folding an empty session yields nothing rather than looping", () => {
  assert.deepEqual(groupSteps([]), []);
});


test("easing takes repetitions off before anything else", () => {
  const session = sessionById("400")!;
  const lighter = eased(session, 0.7);
  const reps = groupSteps(lighter.steps).find((g) => g.times > 1)!;
  assert.equal(reps.times, 4, "five repetitions eased to four");
  // And the effort itself is untouched: four hundred metres are still four
  // hundred metres, only there are fewer of them.
  assert.deepEqual(reps.steps, groupSteps(session.steps).find((g) => g.times > 1)!.steps);
});

test("the name never outlives the blocks it describes", () => {
  for (const session of SESSIONS) {
    for (const factor of [0.7, 0.85]) {
      const lighter = eased(session, factor);
      const repeated = groupSteps(lighter.steps).find((g) => g.times > 1);
      const claimed = /^(\d+) × /.exec(lighter.name);
      if (claimed) {
        assert.equal(Number(claimed[1]), repeated?.times, `${session.id} at ${factor}: ${lighter.name}`);
      }
    }
  }
});

test("a session with nothing to repeat is shortened instead", () => {
  const long = sessionById("long")!;
  const lighter = eased(long, 0.7);
  const before = long.steps[0].seconds!;
  const after = lighter.steps[0].seconds!;
  assert.ok(after < before, "the long run was not shortened");
  assert.ok(after >= before * 0.6, "it was gutted rather than eased");
  assert.match(lighter.name, /45 min|40 min/);
});

test("the warm-up and the cool-down are never cut", () => {
  const session = sessionById("threshold")!;
  const lighter = eased(session, 0.7);
  const spare = (s: typeof session) =>
    s.steps.filter((step) => step.effort === "warmup" || step.effort === "cooldown");
  assert.deepEqual(spare(lighter), spare(session));
});

test("easing by nothing changes nothing at all", () => {
  for (const session of SESSIONS) {
    assert.equal(eased(session, 1), session);
    assert.equal(eased(session, 1.4), session);
    assert.equal(eased(session, 0), session);
  }
});
