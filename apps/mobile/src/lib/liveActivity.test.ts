import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

/**
 * The Live Activity's shape is declared in Swift twice: once for the widget
 * extension, once for the native module the app calls. Neither build system
 * can reach the other's folder, so there is no way to share the file — but
 * ActivityKit pairs the two by this type, and a silent difference between
 * them would leave the lock screen blank with nothing to explain why.
 *
 * So the drift is caught here instead.
 */
test("the two copies of RunActivityAttributes.swift are identical", () => {
  const widget = readFileSync("targets/widget/RunActivityAttributes.swift", "utf8");
  const module = readFileSync("modules/live-activity/ios/RunActivityAttributes.swift", "utf8");
  assert.equal(
    module,
    widget,
    "Les deux copies de RunActivityAttributes.swift ont divergé : recopie l'une sur l'autre.",
  );
});
