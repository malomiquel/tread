import assert from "node:assert/strict";
import { test } from "node:test";
import {
  SESSIONS, sessionById, sessionMinutes, stepIsDone, stepLabel, stepRemaining,
} from "./workout.ts";

test("a distance block ends on distance, whatever the clock says", () => {
  const bloc = { effort: "rapide" as const, metres: 400 };
  assert.equal(stepIsDone(bloc, 399, 9999), false, "pas encore parcouru");
  assert.equal(stepIsDone(bloc, 400, 0), true, "parcouru, même instantanément");
  assert.deepEqual(stepRemaining(bloc, 150, 40), { metres: 250, seconds: null });
});

test("a time block ends on time, whatever the distance says", () => {
  const bloc = { effort: "récupération" as const, seconds: 90 };
  assert.equal(stepIsDone(bloc, 9999, 89), false, "pas encore écoulé");
  assert.equal(stepIsDone(bloc, 0, 90), true, "écoulé, même sans bouger");
  assert.deepEqual(stepRemaining(bloc, 0, 30), { metres: null, seconds: 60 });
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
  const vus = new Set<string>();
  for (const s of SESSIONS) {
    assert.ok(!vus.has(s.id), `identifiant en double : ${s.id}`);
    vus.add(s.id);
    assert.ok(s.steps.length > 0, `${s.name} est vide`);
    for (const step of s.steps) {
      const mesures = [step.metres, step.seconds].filter((v) => v !== undefined).length;
      assert.equal(mesures, 1, `${s.name} : un bloc doit avoir une mesure et une seule`);
    }
    // Sans borne haute, une séance mal saisie enverrait courir trois heures.
    const minutes = sessionMinutes(s);
    assert.ok(minutes >= 20 && minutes <= 90, `${s.name} dure ${minutes} min`);
  }
});

test("a session is found by its identifier, and only then", () => {
  assert.equal(sessionById("400")?.name, "5 × 400 m");
  assert.equal(sessionById("inexistante"), null);
  assert.equal(sessionById(null), null);
});
