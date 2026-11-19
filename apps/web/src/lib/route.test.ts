import assert from "node:assert/strict";
import { test } from "node:test";
import { routeLengthM, routeShape } from "./route.ts";

const line = Array.from({ length: 301 }, (_, i) => ({ lat: 48.85 + i * 0.0001, lng: 2.35 }));

test("a route's length follows its line", () => {
  // 300 steps of a ten-thousandth of a degree of latitude: about 3.3 km.
  assert.ok(Math.abs(routeLengthM(line) - 3336) < 10);
  assert.equal(routeLengthM([]), 0);
});

test("its tile keeps about sixty points, the last one included", () => {
  const shape = routeShape(line);
  assert.ok(shape.length <= 62 && shape.length >= 59);
  assert.deepEqual(shape[shape.length - 1], [line[300].lat, line[300].lng]);
});
