import assert from "node:assert/strict";
import { test } from "node:test";
import { pickLanguage, pickUnits } from "./language.ts";

test("a language chosen in the settings wins over the browser's", () => {
  assert.equal(pickLanguage("en", "fr-FR,fr;q=0.9"), "en");
  assert.equal(pickLanguage("fr", "en-US"), "fr");
});

test("without a choice, French only when the browser leads with it", () => {
  assert.equal(pickLanguage(undefined, "fr-CA,en;q=0.8"), "fr");
  assert.equal(pickLanguage(undefined, "de-DE,fr;q=0.9"), "en");
  assert.equal(pickLanguage("xx", null), "en");
});

test("the phone's units win, else miles only where the region measures in them", () => {
  assert.equal(pickUnits("imperial", "fr-FR"), "imperial");
  assert.equal(pickUnits("auto", "en-US,en;q=0.9"), "imperial");
  assert.equal(pickUnits(undefined, "en-GB"), "imperial");
  assert.equal(pickUnits(undefined, "en-AU"), "metric");
});
