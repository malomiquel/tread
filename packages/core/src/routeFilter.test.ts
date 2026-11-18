import { test } from "node:test";
import assert from "node:assert/strict";
import { findRoutes, type RouteFacts } from "./routeFilter.ts";

const route = (id: number, over: Partial<RouteFacts>): RouteFacts => ({
  id, name: `Route ${id}`, place: null, createdAt: id, distanceM: 5000, loop: true,
  start: { lat: 48 + id * 0.01, lng: 2 }, runs: 0, ...over,
});

const routes = [
  route(1, { name: "Foulée de Chartres", place: "Chartres, France", distanceM: 5500, runs: 3 }),
  route(2, { name: "Bord de l'Eure", distanceM: 3000, loop: false }),
  route(3, { name: "Grande boucle", distanceM: 12_000, runs: 1 }),
];
const none = { query: "", filters: [], sort: "recent" as const, here: null };

test("search ignores accents and case, and looks at the place too", () => {
  assert.deepEqual(findRoutes(routes, { ...none, query: "foulee" }).map((r) => r.id), [1]);
  assert.deepEqual(findRoutes(routes, { ...none, query: "chartres" }).map((r) => r.id), [1]);
  assert.deepEqual(findRoutes(routes, { ...none, query: "zzz" }), []);
});

test("filters of one kind widen, of different kinds narrow", () => {
  assert.deepEqual(findRoutes(routes, { ...none, filters: ["short", "long"] }).map((r) => r.id), [3, 2]);
  assert.deepEqual(findRoutes(routes, { ...none, filters: ["loop", "short"] }).map((r) => r.id), []);
  assert.deepEqual(findRoutes(routes, { ...none, filters: ["neverRun"] }).map((r) => r.id), [2]);
});

test("each sort orders the way it says", () => {
  assert.deepEqual(findRoutes(routes, none).map((r) => r.id), [3, 2, 1]);
  assert.deepEqual(findRoutes(routes, { ...none, sort: "distance" }).map((r) => r.id), [2, 1, 3]);
  assert.deepEqual(findRoutes(routes, { ...none, sort: "mostRun" }).map((r) => r.id), [1, 3, 2]);
  assert.deepEqual(findRoutes(routes, { ...none, sort: "name" }).map((r) => r.id), [2, 1, 3]);
  const here = { lat: 48.03, lng: 2 };
  assert.deepEqual(findRoutes(routes, { ...none, sort: "nearby", here }).map((r) => r.id), [3, 2, 1]);
});
