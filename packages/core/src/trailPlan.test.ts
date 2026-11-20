import assert from "node:assert/strict";
import { test } from "node:test";
import { effortKm } from "./geo.ts";
import {
  buildPlan, sessionKind, sessionTargetName, suggestedDays, trailCategory, trailEstimateMin,
  trailLongCeilingMin, trailOfPlan, trailReadiness, trailSpec, TRAIL_SLOT_DAYS, SLOT_DAYS,
  type PerWeek, type PlannedSession, type TrailRace,
} from "./plan.ts";
import { campaignOf } from "./campaign.ts";
import { eased, isEffortSession, rpeZone, sessionEffort, sessionName, stepLabel } from "./workout.ts";

const SHORT: TrailRace = { distanceM: 20_000, gainM: 800 };
const LONG: TrailRace = { distanceM: 42_000, gainM: 2000 };
const ULTRA: TrailRace = { distanceM: 100_000, gainM: 6000 };

const trail = (race: TrailRace, weeks: number, perWeek: PerWeek, longestMin: number, targetTimeS = 0) =>
  buildPlan({ goal: "trail", weeks, perWeek, targetTimeS, longestMin, weeklyKm: 40, trail: race });

const minutesOf = (planned: PlannedSession): number =>
  planned.session.steps.reduce((total, step) => total + (step.seconds ?? 0), 0) / 60;

test("a trail is sized by its effort, not its distance", () => {
  // The ITRA measure: a kilometre for every hundred metres of climbing.
  assert.equal(effortKm(20_000, 1000), 30);
  assert.equal(trailCategory(SHORT), "short");
  assert.equal(trailCategory(LONG), "long");
  assert.equal(trailCategory(ULTRA), "ultra");
  // Forty kilometres flat is a long trail; forty with 4 000 m is an ultra's.
  assert.equal(trailCategory({ distanceM: 40_000, gainM: 0 }), "short");
  assert.equal(trailCategory({ distanceM: 40_000, gainM: 4000 }), "ultra");
});

test("the longer the trail, the longer the plan and its taper", () => {
  const [short, long, ultra] = [SHORT, LONG, ULTRA].map(trailSpec);
  assert.ok(short.maxWeeks < long.maxWeeks && long.maxWeeks < ultra.maxWeeks);
  assert.ok(short.minWeeks < long.minWeeks && long.minWeeks < ultra.minWeeks);
  assert.ok(short.taperWeeks <= long.taperWeeks && long.taperWeeks < ultra.taperWeeks);
});

test("a bigger race takes longer, and its first guess errs long", () => {
  assert.ok(trailEstimateMin(SHORT) < trailEstimateMin(LONG));
  assert.ok(trailEstimateMin(LONG) < trailEstimateMin(ULTRA));
  // Seven and a half minutes an effort kilometre or more: a cautious guess.
  for (const race of [SHORT, LONG, ULTRA]) {
    assert.ok(trailEstimateMin(race) >= 7 * effortKm(race.distanceM, race.gainM));
  }
});

test("a trail plan ends on its race, with every session by time and effort", () => {
  for (const [race, weeks] of [[SHORT, 12], [LONG, 16], [ULTRA, 24]] as const) {
    const plan = trail(race, weeks, 3, 120);
    assert.ok(plan.length > 0);
    assert.equal(plan.at(-1)!.kind, "race");
    assert.equal(plan.filter((p) => p.kind === "race").length, 1);
    for (const planned of plan) {
      assert.equal(planned.targetSKm, null, `${planned.session.id} carries a pace`);
      assert.ok(isEffortSession(planned.session), planned.session.id);
      assert.ok(sessionEffort(planned.session) !== null, `${planned.session.id} has no effort`);
      assert.ok(sessionKind(planned.session.id) !== null, `${planned.session.id} is not recognised`);
      if (planned.kind === "race") continue;
      // Time, never distance: a trail kilometre is not a road kilometre.
      assert.ok(planned.session.steps.every((step) => step.metres === undefined && step.seconds !== undefined));
    }
  }
});

test("the quality work is on a slope, and hiking and descending are trained", () => {
  const kinds = new Set(trail(ULTRA, 24, 4, 150).map((p) => p.kind));
  for (const kind of ["hills", "climb", "hike", "downhill"] as const) assert.ok(kinds.has(kind), `no ${kind}`);
  assert.ok(!kinds.has("interval") && !kinds.has("tempo"), "road work in a trail plan");
});

test("a trail long run never grows more than ten percent a week", () => {
  for (const [race, weeks, start] of [[SHORT, 16, 40], [LONG, 20, 60], [ULTRA, 28, 90]] as const) {
    const longs = trail(race, weeks, 3, start)
      .filter((p) => p.kind === "long" && p.session.id.startsWith("trail-long-"));
    let previous = longs[0] ? minutesOf(longs[0]) : 0;
    let since = longs[0]?.week ?? 1;
    assert.ok(previous <= Math.max(20, start), "the first long run was beyond the runner");
    for (const planned of longs.slice(1)) {
      const minutes = minutesOf(planned);
      // Ten percent a week since the longest so far — a step-back week in
      // between does not reset the clock — plus the rounding to five minutes.
      const allowed = previous * 1.1 ** (planned.week - since) + 5;
      assert.ok(minutes <= allowed, `week ${planned.week}: ${previous} to ${minutes}`);
      if (minutes >= previous) {
        previous = minutes;
        since = planned.week;
      }
    }
  }
});

test("a trail long run is capped, and the taper falls away from it", () => {
  for (const race of [SHORT, LONG, ULTRA]) {
    const plan = trail(race, 28, 3, 240);
    const longs = plan.filter((p) => p.kind === "long").map(minutesOf);
    const ceiling = trailLongCeilingMin(trailCategory(race), trailEstimateMin(race));
    assert.ok(Math.max(...longs) <= ceiling, `${Math.max(...longs)} over ${ceiling}`);
    // Never more than five hours, however long the race.
    assert.ok(Math.max(...longs) <= 300);
    // A taper of more than the race week has a long run in it, and a shorter one.
    if (trailSpec(race).taperWeeks < 2) continue;
    const last = plan.filter((p) => p.kind === "long").at(-1)!;
    assert.ok(minutesOf(last) < Math.max(...longs), "the last long run was the longest");
  }
});

test("an ultra trains on back-to-back weekends, a short trail does not", () => {
  const ultra = trail(ULTRA, 24, 3, 150);
  const pairs = ultra.filter((p) => p.session.id.startsWith("trail-b2b-"));
  assert.ok(pairs.length >= 4, `${pairs.length} back-to-backs`);
  for (const second of pairs) {
    // Right after the long run, and shorter than it.
    const first = ultra.find((p) => p.order === second.order - 1)!;
    assert.ok(first.session.id.startsWith("trail-long-"));
    assert.ok(minutesOf(second) < minutesOf(first));
    assert.notEqual(second.phase, "base");
    assert.notEqual(second.phase, "taper");
  }
  assert.equal(trail(SHORT, 12, 3, 60).filter((p) => p.session.id.startsWith("trail-b2b-")).length, 0);
});

test("a long run asks for climbing in proportion to the race", () => {
  const flat = trail({ distanceM: 30_000, gainM: 0 }, 12, 3, 60);
  const steep = trail({ distanceM: 30_000, gainM: 2000 }, 12, 3, 60);
  const gainOf = (plan: PlannedSession[]) =>
    Math.max(...plan.filter((p) => p.session.id.startsWith("trail-long-"))
      .map((p) => Number(p.session.id.split("-").at(-1))));
  assert.equal(gainOf(flat), 0);
  assert.ok(gainOf(steep) > 300, `${gainOf(steep)} m`);
});

test("a beginner's trail plan is run-walk and easy running, nothing hard", () => {
  const plan = trail({ distanceM: 8000, gainM: 100 }, 16, 3, 0);
  assert.ok(plan.length > 0, "an eight kilometre trail in sixteen weeks was refused");
  assert.ok(plan.filter((p) => p.week === 1).every((p) => p.session.id.startsWith("runwalk-")));
  const kinds = new Set(plan.map((p) => p.kind));
  for (const kind of ["hills", "climb", "hike", "downhill", "interval", "tempo"] as const) {
    assert.ok(!kinds.has(kind), `${kind} in a first programme`);
  }
});

test("a long trail is refused to somebody still learning to run", () => {
  const verdict = trailReadiness({ race: LONG, weeks: 20, perWeek: 3, longestMin: 10, targetTimeS: 0 });
  assert.equal(verdict.verdict, "tooFar");
  assert.equal(verdict.concern, "novice");
  assert.deepEqual(trail(LONG, 20, 3, 10), []);
});

test("a race too far for the time left is refused, a stretch is flagged", () => {
  // Forty minutes today, an ultra in twelve weeks: not a plan, a gamble.
  const far = trailReadiness({ race: ULTRA, weeks: 12, perWeek: 4, longestMin: 40, targetTimeS: 0 });
  assert.equal(far.verdict, "tooFar");
  assert.equal(far.concern, "longRun");
  assert.ok(far.reachedMin < far.neededMin / 2);
  assert.deepEqual(trail(ULTRA, 12, 4, 40), []);

  // Two hours today: within reach, but short of what the race asks.
  const tight = trailReadiness({ race: ULTRA, weeks: 12, perWeek: 4, longestMin: 120, targetTimeS: 0 });
  assert.equal(tight.verdict, "tight");
  assert.ok(trail(ULTRA, 12, 4, 120).length > 0, "a stretch is still a plan");

  // The same runner with time enough.
  assert.equal(trailReadiness({ race: ULTRA, weeks: 28, perWeek: 4, longestMin: 120, targetTimeS: 0 }).verdict, "ok");
});

test("an ultra needs more than one run a week", () => {
  assert.equal(trailReadiness({ race: ULTRA, weeks: 28, perWeek: 1, longestMin: 240, targetTimeS: 0 }).concern, "rhythm");
  assert.equal(trailReadiness({ race: ULTRA, weeks: 28, perWeek: 2, longestMin: 240, targetTimeS: 0 }).verdict, "tight");
});

test("a course outside what a plan takes on is refused", () => {
  for (const race of [{ distanceM: 2000, gainM: 0 }, { distanceM: 300_000, gainM: 20_000 }]) {
    assert.equal(trailReadiness({ race, weeks: 20, perWeek: 4, longestMin: 240, targetTimeS: 0 }).concern, "distance");
  }
});

test("a target time sizes the long run when there is one", () => {
  // A quick short trail asks for a shorter long run than a slow one.
  const quick = trailLongCeilingMin("short", 100);
  const slow = trailLongCeilingMin("short", 200);
  assert.ok(quick < slow);
  const plan = trail(SHORT, 12, 3, 60, 100 * 60);
  assert.ok(plan.length > 0);
});

test("a stored trail plan gives its course back", () => {
  const plan = trail(LONG, 16, 3, 90);
  assert.deepEqual(trailOfPlan(plan), LONG);
  assert.equal(trailOfPlan(buildPlan({ goal: "half", weeks: 12, perWeek: 3, targetTimeS: 5400, longestMin: 60, weeklyKm: 30 })), null);
});

test("a trail session says its effort where a road one says its pace", () => {
  const plan = trail(SHORT, 12, 3, 60);
  const hills = plan.find((p) => p.kind === "hills")!;
  assert.equal(sessionTargetName(hills.session, hills.targetSKm), "effort 8/10");
  const long = plan.find((p) => p.kind === "long")!;
  assert.equal(sessionTargetName(long.session, long.targetSKm), "effort 4/10");
  // The long run is endurance, the hills threshold and above.
  assert.equal(rpeZone(4), 1);
  assert.equal(rpeZone(8), 3);
});

test("trail sessions read as what they are, in both languages", async () => {
  const { setLanguage } = await import("./i18n.ts");
  const plan = trail(ULTRA, 24, 4, 150);
  const named = (prefix: string) => sessionName(plan.find((p) => p.session.id.startsWith(prefix))!.session);
  assert.match(named("trail-hills-"), /^\d+ × .+ en côte$/);
  assert.match(named("trail-hike-"), /de marche en côte$/);
  assert.match(named("race-trail"), /^Trail 100 km · 6000 m D\+$/);
  assert.equal(stepLabel({ effort: "walk", seconds: 600, terrain: "climb" }), "10 min marche en montée");
  setLanguage("en");
  try {
    assert.match(named("trail-hills-"), /hill repeats$/);
    assert.match(named("trail-hike-"), /power hiking$/);
    assert.match(named("trail-b2b-"), /^Back-to-back /);
    assert.equal(stepLabel({ effort: "steady", seconds: 120, terrain: "descent" }), "2 min steady downhill");
  } finally {
    setLanguage("fr");
  }
});

test("an eased trail session keeps its shape and its name", () => {
  for (const planned of trail(ULTRA, 24, 4, 150)) {
    const lighter = eased(planned.session, 0.7);
    assert.ok(isEffortSession(lighter));
    assert.equal(sessionName(lighter), lighter.name, lighter.id);
  }
});

test("a trail plan proposes a weekend for its back-to-backs", () => {
  for (const perWeek of [2, 3, 4] as const) {
    const days = TRAIL_SLOT_DAYS[perWeek];
    assert.equal(days.length, perWeek);
    assert.ok(days.includes(6) && days.includes(0), `${perWeek} a week has no weekend`);
  }
  assert.deepEqual(suggestedDays(3, "ultra"), TRAIL_SLOT_DAYS[3]);
  assert.deepEqual(suggestedDays(3, "short"), SLOT_DAYS[3]);
  assert.deepEqual(suggestedDays(3, null), SLOT_DAYS[3]);
});

test("a trail plan's slope sessions are its campaign's guardians", () => {
  const plan = trail(SHORT, 12, 3, 60);
  const scheduled = plan.map((p) => ({ ...p, at: p.order, runId: null, settled: false }));
  const campaign = campaignOf(scheduled);
  assert.ok(campaign.chapters.length > 0);
  const guardians = campaign.chapters.flatMap((chapter) => chapter.nodes).filter((node) => node.guardian);
  assert.ok(guardians.some((node) => node.kind === "hills" || node.kind === "climb" || node.kind === "downhill"));
});
