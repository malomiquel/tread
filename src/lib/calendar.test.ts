import { test } from "node:test";
import assert from "node:assert/strict";
import { markScale, monthsSince, monthWeeks, runsByDay } from "./calendar.ts";

test("a month is laid out Monday first", () => {
  // September 2026 begins on a Tuesday and has 30 days.
  const weeks = monthWeeks(2026, 8);
  assert.equal(weeks.length, 5);
  assert.equal(weeks[0].days[0], null);
  assert.equal(weeks[0].days[1]?.date, 1);
  assert.equal(new Date(weeks[0].start).getDay(), 1);
  assert.equal(weeks[4].days[2]?.date, 30);
  assert.equal(weeks[4].days[3], null);
});

test("runs are gathered by day", () => {
  const morning = new Date(2026, 8, 23, 7).getTime();
  const evening = new Date(2026, 8, 23, 19).getTime();
  const days = runsByDay([
    { id: 2, startedAt: evening, distanceM: 3000 },
    { id: 1, startedAt: morning, distanceM: 5000 },
  ]);
  const day = days.get(new Date(2026, 8, 23).getTime());
  assert.deepEqual(day, { distanceM: 8000, runIds: [1, 2] });
});

test("months run from now back to the oldest run", () => {
  const months = monthsSince(new Date(2025, 10, 20).getTime(), new Date(2026, 1, 3).getTime());
  assert.deepEqual(months, [
    { year: 2026, month: 1 }, { year: 2026, month: 0 }, { year: 2025, month: 11 }, { year: 2025, month: 10 },
  ]);
});

test("marks grow with distance, and never vanish", () => {
  assert.equal(markScale(0, 10_000), 0.35);
  assert.equal(markScale(10_000, 10_000), 1);
  assert.ok(markScale(2500, 10_000) > 0.35 && markScale(2500, 10_000) < 1);
});
