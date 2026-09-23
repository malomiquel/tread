import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_LIMIT_M, nudgeDistance, shoeOrder, wearOf, type Shoe } from "./shoes.ts";

const KM = 1000;
const MILE = 1609.344;

test("a pair wears in three states", () => {
  assert.equal(wearOf({ distanceM: 300 * KM, limitM: DEFAULT_LIMIT_M }).wear, "fresh");
  assert.equal(wearOf({ distanceM: 650 * KM, limitM: DEFAULT_LIMIT_M }).wear, "soon");
  assert.equal(wearOf({ distanceM: 712 * KM, limitM: DEFAULT_LIMIT_M }).wear, "worn");
  assert.ok(Math.abs(wearOf({ distanceM: 350 * KM, limitM: DEFAULT_LIMIT_M }).share - 0.5) < 1e-9);
});

test("distance settings move fifty units at a time, within bounds", () => {
  assert.equal(nudgeDistance(700 * KM, KM, 1, 0, 2000 * KM), 750 * KM);
  assert.equal(nudgeDistance(700 * KM, KM, -1, 0, 2000 * KM), 650 * KM);
  assert.equal(nudgeDistance(0, KM, -1, 0, 2000 * KM), 0);
  // 700 km is not a round number of miles: the first step lands on one.
  assert.equal(nudgeDistance(700 * KM, MILE, 1, 0, 2000 * KM), Math.round(450 * MILE));
  assert.equal(nudgeDistance(700 * KM, MILE, -1, 0, 2000 * KM), Math.round(400 * MILE));
});

test("the default pair comes first, retired ones last", () => {
  const shoe = (id: number, isDefault: boolean, retired: boolean, addedAt: number): Shoe =>
    ({ id, name: String(id), addedAt, startM: 0, limitM: DEFAULT_LIMIT_M, retired, isDefault, distanceM: 0, runs: 0 });
  const order = shoeOrder([shoe(1, false, true, 5), shoe(2, false, false, 3), shoe(3, true, false, 1), shoe(4, false, false, 4)]);
  assert.deepEqual(order.map((s) => s.id), [3, 4, 2, 1]);
});
