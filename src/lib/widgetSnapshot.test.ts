import assert from "node:assert/strict";
import { test } from "node:test";
import { widgetSnapshot } from "./widgetSnapshot.ts";

const now = new Date(2026, 8, 23, 9).getTime();

test("the week and the goal, written out for the widget", () => {
  const snapshot = widgetSnapshot({
    weekDistanceM: 18_400, weekRuns: 3, weekDurationS: 9730, goalM: 25_000, next: null, now,
  });
  assert.equal(snapshot.distance, "18,4");
  assert.equal(snapshot.unit, "km");
  assert.equal(snapshot.detail, "3 courses · 2:42:10");
  assert.ok(Math.abs((snapshot.goalShare ?? 0) - 0.736) < 0.001);
  assert.equal(snapshot.goalText, "6,60 km pour tenir 25,0 km");
  assert.equal(snapshot.next, null);
});

test("a goal already met is said so, and never shows over full", () => {
  const snapshot = widgetSnapshot({
    weekDistanceM: 30_000, weekRuns: 4, weekDurationS: 10_000, goalM: 25_000, next: null, now,
  });
  assert.equal(snapshot.goalShare, 1);
  assert.equal(snapshot.goalText, "Objectif de 25,0 km atteint");
});

test("no goal and no runs still make a widget", () => {
  const snapshot = widgetSnapshot({ weekDistanceM: 0, weekRuns: 0, weekDurationS: 0, goalM: null, next: null, now });
  assert.equal(snapshot.goalShare, null);
  assert.equal(snapshot.goalText, null);
  assert.equal(snapshot.detail, "0 course");
});

test("the next session says when, what, and at what pace", () => {
  const tomorrow = new Date(2026, 8, 24, 7).getTime();
  const snapshot = widgetSnapshot({
    weekDistanceM: 0, weekRuns: 0, weekDurationS: 0, goalM: null, now,
    next: { at: tomorrow, name: "Footing 40 min", kind: "Footing", targetSKm: 340 },
  });
  assert.deepEqual(snapshot.next, { when: "Demain", name: "Footing 40 min", detail: "Footing · 5'40\"/km" });
  const today = widgetSnapshot({ ...{ weekDistanceM: 0, weekRuns: 0, weekDurationS: 0, goalM: null, now }, next: { at: now, name: "x", kind: "y", targetSKm: 300 } });
  assert.equal(today.next?.when, "Aujourd'hui");
});
