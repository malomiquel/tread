import { test } from "node:test";
import assert from "node:assert/strict";
import { locate, nextTurn, OFF_ROUTE_M, routeLine } from "./guidance.ts";

// About 111 m of latitude, 74 m of longitude per 0.001° at 48°N.
const north = (m: number) => m / 110_540;
const east = (m: number) => m / (111_320 * Math.cos((48 * Math.PI) / 180));

// 300 m north, then 300 m east: one right turn at 300 m.
const lShape = [
  { lat: 48, lng: 2 },
  { lat: 48 + north(150), lng: 2 },
  { lat: 48 + north(300), lng: 2 },
  { lat: 48 + north(300), lng: 2 + east(150) },
  { lat: 48 + north(300), lng: 2 + east(300) },
];

test("a route knows its length and its turns", () => {
  const line = routeLine(lShape);
  assert.ok(line);
  assert.ok(Math.abs(line.totalM - 600) < 3);
  assert.equal(line.turns.length, 1);
  assert.equal(line.turns[0].direction, "right");
  assert.ok(Math.abs(line.turns[0].alongM - 300) < 3);
  assert.equal(routeLine([lShape[0]]), null);
});

test("the runner is placed along the route, and how far off it", () => {
  const line = routeLine(lShape)!;
  const onIt = locate(line, { lat: 48 + north(100), lng: 2 + east(5) }, null);
  assert.ok(Math.abs(onIt.alongM - 100) < 3);
  assert.ok(Math.abs(onIt.offM - 5) < 1);
  const away = locate(line, { lat: 48 + north(100), lng: 2 + east(80) }, 100);
  assert.ok(away.offM > OFF_ROUTE_M);
});

test("the next turn and the distance to it", () => {
  const line = routeLine(lShape)!;
  const next = nextTurn(line, 220);
  assert.ok(next && Math.abs(next.inM - 80) < 3);
  assert.equal(nextTurn(line, 400), null);
});

test("an out-and-back keeps the runner on the leg they are running", () => {
  // 300 m north and straight back down the same street.
  const outAndBack = routeLine([
    { lat: 48, lng: 2 }, { lat: 48 + north(300), lng: 2 }, { lat: 48 + north(3), lng: 2 },
  ])!;
  assert.equal(outAndBack.turns[0].direction, "uturn");
  // 100 m up the street, on the way back: 500 m along, not 100.
  const back = locate(outAndBack, { lat: 48 + north(100), lng: 2 }, 480);
  assert.ok(Math.abs(back.alongM - 500) < 5);
  const out = locate(outAndBack, { lat: 48 + north(100), lng: 2 }, 80);
  assert.ok(Math.abs(out.alongM - 100) < 5);
});
