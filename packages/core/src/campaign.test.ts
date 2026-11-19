import assert from "node:assert/strict";
import { test } from "node:test";
import { campaignOf } from "./campaign.ts";
import { buildPlan, schedule, SLOT_DAYS, type Done } from "./plan.ts";

const MONDAY = new Date(2026, 0, 5).getTime();
const RACE = new Date(2026, 2, 29).getTime();
const sessions = buildPlan({ goal: "half", weeks: 12, perWeek: 3, targetTimeS: 5400, longestMin: 60, weeklyKm: 25 });

test("a plan reads as chapters ending on the race", () => {
  const campaign = campaignOf(schedule(sessions, new Map(), MONDAY, RACE, SLOT_DAYS[3]));
  assert.ok(campaign.chapters.length >= 3);
  assert.deepEqual(campaign.chapters.map((chapter) => chapter.index), campaign.chapters.map((_, i) => i + 1));
  const last = campaign.chapters[campaign.chapters.length - 1];
  const boss = last.nodes[last.nodes.length - 1];
  assert.equal(boss.boss, true);
  assert.equal(boss.guardian, true);
  // Every chapter has at most a long run, a quality session and the race as guardians.
  for (const chapter of campaign.chapters) assert.ok(chapter.guardians >= 1 && chapter.guardians <= 3);
  assert.equal(campaign.current?.index, 1);
  assert.equal(campaign.chapters[0].nodes[0].state, "next");
});

test("guardians run are won, guardians skipped are passed, never lost", () => {
  const first = campaignOf(schedule(sessions, new Map(), MONDAY, RACE, SLOT_DAYS[3])).chapters[0];
  const done = new Map<number, Done>();
  first.nodes.forEach((node, i) => {
    done.set(node.order, { runId: node.guardian && i % 2 === 0 ? 100 + i : node.guardian ? null : 100 + i, at: MONDAY });
  });
  const chapter = campaignOf(schedule(sessions, done, MONDAY, RACE, SLOT_DAYS[3])).chapters[0];
  assert.ok(chapter.state === "done" || chapter.state === "cleared");
  assert.ok(chapter.nodes.every((node) => node.state === "won" || node.state === "passed"));
  const allRun = new Map<number, Done>(first.nodes.map((node) => [node.order, { runId: node.order, at: MONDAY }]));
  assert.equal(campaignOf(schedule(sessions, allRun, MONDAY, RACE, SLOT_DAYS[3])).chapters[0].state, "cleared");
});
