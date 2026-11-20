/**
 * Training plans: a programme built backwards from a race date.
 *
 * Everything here is pure. A plan is a decision about the next three months
 * of someone's legs, so it has to be provable rather than merely plausible,
 * and that means no clock, no database and no navigation in this file.
 *
 * ## Where the numbers come from
 *
 * Every constant below carries one of three tags, because they are not worth
 * the same and a reader cannot tell them apart by looking. Most of this file
 * is the third kind.
 *
 * - **PUBLISHED** — traceable to a paper, named in place. Riegel's exponent
 *   and its correction for recreational runners; the shape of the taper,
 *   after Bosquet's meta-analysis (Med Sci Sports Exerc, 2007), which finds
 *   roughly two weeks at forty to sixty percent of volume, intensity held,
 *   worth about three percent of performance; the intensity split, after
 *   Seiler's work on polarised training.
 *
 * - **CONVENTION** — what coaches broadly agree on, without a trial behind
 *   it. The weekly increase, the easy week every fourth, the refusal to run
 *   the race distance in training. Some of it is actively unproven: Buist
 *   (Am J Sports Med, 2008) randomised novice runners onto a graded
 *   programme and found no reduction in injuries at all.
 *
 * - **CHOSEN** — I picked it. It is consistent with the rest and looks like
 *   what commercial plans produce, and no study says the number.
 *
 * What none of it accounts for: injury history, age, sleep, life load,
 * terrain, heart rate. A generated plan is a defensible starting point, not
 * a prescription, and the app should never pretend otherwise.
 */

// The extension is spelled out because this is a value import, not a type
// one: node runs these modules directly for the tests and resolves paths the
// way the web does, without guessing at extensions.
import { formatPace } from "./format.ts";
import { effortKm } from "./geo.ts";
import { defineStrings } from "./i18n.ts";
import { paceUnit } from "./units.ts";
import {
  eased, isEffortSession, raceName, rpeName, sessionEffort, trailGainOf, type Session, type Step,
} from "./workout.ts";

/** A road race a plan can be built for, trained by pace. */
export type Goal = "fiveK" | "tenK" | "half" | "marathon";

/**
 * Anything a plan can be built for: a road race, or a trail race, which is
 * described by its distance and its climbing rather than picked from a list
 * (see "Trail plans" below).
 */
export type PlanGoal = Goal | "trail";

export interface GoalSpec {
  id: Goal;
  /** Displayed. */
  name: string;
  distanceM: number;
  minWeeks: number;
  maxWeeks: number;
  /** Weeks of reduced load before the race, the last of which holds it. */
  taperWeeks: number;
  /** A first guess at a finish time, for someone with no history to go on. */
  defaultTimeS: number;
}

export const GOALS: GoalSpec[] = [
  { id: "fiveK", name: "5 km", distanceM: 5000, minWeeks: 6, maxWeeks: 12, taperWeeks: 1, defaultTimeS: 1500 },
  { id: "tenK", name: "10 km", distanceM: 10_000, minWeeks: 6, maxWeeks: 14, taperWeeks: 1, defaultTimeS: 3120 },
  { id: "half", name: "Semi-marathon", distanceM: 21_097, minWeeks: 8, maxWeeks: 16, taperWeeks: 2, defaultTimeS: 6900 },
  { id: "marathon", name: "Marathon", distanceM: 42_195, minWeeks: 12, maxWeeks: 20, taperWeeks: 3, defaultTimeS: 14_400 },
];

export const goalById = (id: string | null): GoalSpec | null =>
  GOALS.find((g) => g.id === id) ?? null;

/**
 * A goal's name in the interface's language. `GoalSpec.name` is the French
 * one, kept as the name a race session is stored under.
 */
export const goalName = (id: PlanGoal): string => raceName(id) ?? id;

/**
 * The endurance exponent, and why it is not one number.
 *
 * PUBLISHED, with a published correction. Riegel (American Scientist, 1981)
 * fits T₂ = T₁ × (D₂/D₁)^n to race records and lands on n = 1.06. That value
 * describes the runners those records came from — people who race often and
 * train a great deal — and it is measurably optimistic for everybody else.
 * Vickers and Vertosick (BMC Sports Science, 2016) fit the same shape to
 * recreational runners and find the exponent climbs with distance and falls
 * with weekly volume, landing nearer 1.1 to 1.2 over a marathon.
 *
 * The practical consequence of the flat 1.06 was a marathon pace roughly
 * twenty five minutes too quick off a ten kilometre time, handed to somebody
 * as the pace to train at for three months.
 *
 * So the exponent rises with the distance instead. The anchors below are
 * CHOSEN inside the range those papers describe; nothing states 1.10 for a
 * half. What is not arbitrary is the direction: further always costs more.
 */
const ENDURANCE_ANCHORS: readonly (readonly [metres: number, exponent: number])[] = [
  [5_000, 1.06],
  [10_000, 1.07],
  [21_097, 1.1],
  [42_195, 1.15],
];

/**
 * The weekly volume the anchors above describe.
 *
 * CHOSEN. Forty kilometres a week is the middle of the recreational range,
 * and the point at which the volume correction does nothing at all.
 */
const REFERENCE_WEEKLY_KM = 40;

/**
 * How training volume bends the exponent, by kilometres a week.
 *
 * PUBLISHED in direction, CHOSEN in size. Vickers and Vertosick find weekly
 * volume is a real term in how much a runner slows over distance: the more
 * you run, the less the marathon costs you relative to your ten. It is the
 * measurable form of an idea McMillan made popular long before — that two
 * runners with the same ten kilometre time do not have the same marathon,
 * one being built for speed and the other for distance.
 *
 * What the papers do not hand over is a coefficient to paste in, so these
 * three points are mine. They are worth roughly twenty minutes either side
 * of a four hour marathon, which is about the spread the literature implies
 * and small enough not to invent a runner who does not exist.
 */
const VOLUME_ANCHORS: readonly (readonly [weeklyKm: number, shift: number])[] = [
  [15, 0.035],
  [REFERENCE_WEEKLY_KM, 0],
  [80, -0.03],
];

function volumeShift(weeklyKm: number): number {
  if (!Number.isFinite(weeklyKm) || weeklyKm <= 0) return VOLUME_ANCHORS[0][1];
  const first = VOLUME_ANCHORS[0];
  const last = VOLUME_ANCHORS[VOLUME_ANCHORS.length - 1];
  if (weeklyKm <= first[0]) return first[1];
  if (weeklyKm >= last[0]) return last[1];

  for (let i = 1; i < VOLUME_ANCHORS.length; i += 1) {
    const [lowKm, lowShift] = VOLUME_ANCHORS[i - 1];
    const [highKm, highShift] = VOLUME_ANCHORS[i];
    if (weeklyKm <= highKm) {
      const along = (Math.log(weeklyKm) - Math.log(lowKm)) / (Math.log(highKm) - Math.log(lowKm));
      return lowShift + (highShift - lowShift) * along;
    }
  }
  return last[1];
}

/**
 * How steeply time grows with distance around a given race length.
 *
 * Interpolated on log distance, because five to ten kilometres is the same
 * kind of step as ten to twenty — not a quarter of the step from ten to
 * forty, which is what interpolating on plain metres would claim.
 */
export function enduranceExponent(distanceM: number, weeklyKm = REFERENCE_WEEKLY_KM): number {
  const first = ENDURANCE_ANCHORS[0];
  const last = ENDURANCE_ANCHORS[ENDURANCE_ANCHORS.length - 1];

  const base = (() => {
    if (!(distanceM > first[0])) return first[1];
    if (distanceM >= last[0]) return last[1];
    for (let i = 1; i < ENDURANCE_ANCHORS.length; i += 1) {
      const [lowM, lowN] = ENDURANCE_ANCHORS[i - 1];
      const [highM, highN] = ENDURANCE_ANCHORS[i];
      if (distanceM <= highM) {
        const along = (Math.log(distanceM) - Math.log(lowM)) / (Math.log(highM) - Math.log(lowM));
        return lowN + (highN - lowN) * along;
      }
    }
    return last[1];
  })();

  // Scaled by how far up the ladder the distance sits, so volume counts for
  // everything over a marathon and nothing over five kilometres — which is
  // right, because nobody's five is decided by how much they run in a week.
  const reach = (base - first[1]) / (last[1] - first[1]);
  return base + reach * volumeShift(weeklyKm);
}

/**
 * What the same runner would be expected to do over another distance.
 *
 * The exponent is taken from the longer of the two distances, whichever way
 * the conversion runs. That is what makes the pair reversible — a ten
 * projected to a marathon and back again returns the ten it started from —
 * and reversibility is not a nicety here: the pace ladder is built by
 * projecting one target out to four distances, and a set of paces that
 * disagreed with itself would have the runner chasing two different races.
 */
export function equivalentTimeS(
  refDistanceM: number,
  refTimeS: number,
  targetDistanceM: number,
  weeklyKm = REFERENCE_WEEKLY_KM,
): number | null {
  if (![refDistanceM, refTimeS, targetDistanceM].every((n) => Number.isFinite(n) && n > 0)) {
    return null;
  }
  const exponent = enduranceExponent(Math.max(refDistanceM, targetDistanceM), weeklyKm);
  return refTimeS * (targetDistanceM / refDistanceM) ** exponent;
}

/** Every pace a plan needs, in seconds per kilometre. */
export interface Paces {
  /** Conversational. Most of the plan is run here. */
  easy: number;
  /** A shade quicker than easy, held for an hour or more. */
  long: number;
  marathon: number;
  half: number;
  tenK: number;
  fiveK: number;
  /** Short repetitions, quicker than 5 km pace. */
  interval: number;
}

/**
 * The whole pace ladder, derived from one target performance.
 *
 * From the time you mean to run, not the time you have run. A plan trains
 * the runner you intend to be on race day — that is its entire purpose — and
 * asking for a recent result instead would train the one you already are.
 * The projection stays anchored in reality all the same, because the target
 * time is itself prefilled from your best run.
 */
export function pacesFrom(
  goalDistanceM: number,
  goalTimeS: number,
  weeklyKm = REFERENCE_WEEKLY_KM,
): Paces | null {
  const at = (distanceM: number): number | null => {
    const time = equivalentTimeS(goalDistanceM, goalTimeS, distanceM, weeklyKm);
    return time === null ? null : (time / distanceM) * 1000;
  };
  const fiveK = at(5000);
  const tenK = at(10_000);
  const half = at(21_097);
  const marathon = at(42_195);
  if (fiveK === null || tenK === null || half === null || marathon === null) return null;

  return {
    // PUBLISHED in spirit, CHOSEN in figure. That most training should sit
    // well below race intensity is Seiler's polarised distribution, and a
    // minute or so slower than marathon pace is where Daniels' easy pace
    // falls. The exact seventy and forty five are mine.
    //
    // Defined off marathon pace rather than off any race result, because
    // that is the pace a body can repeat day after day.
    easy: marathon + 70,
    long: marathon + 45,
    marathon,
    half,
    tenK,
    fiveK,
    interval: fiveK - 8,
  };
}

/**
 * How many days a week the runner actually turns up.
 *
 * One and two are offered because they are what many people will really do,
 * and a programme built for a rhythm nobody holds is worth nothing. What
 * changes at low volume is not the plan's ambition but what it gives up: the
 * easy run goes first, then the quality session, because the long run is the
 * one that prepares a distance.
 */
export type PerWeek = 1 | 2 | 3 | 4;

/** Where a week sits in the arc of the plan. */
export type Phase = "base" | "build" | "peak" | "taper";

const phaseNames = defineStrings<Record<Phase, string>>({
  fr: { base: "fondation", build: "développement", peak: "spécifique", taper: "affûtage" },
  en: { base: "base", build: "build", peak: "peak", taper: "taper" },
});

/** Displayed. */
export const phaseName = (phase: Phase): string => phaseNames()[phase];

/** What a given session is for. */
export type Kind =
  | "easy" | "long" | "interval" | "tempo" | "race"
  // A trail plan's own work, run by effort on a slope rather than by pace.
  | "hills" | "climb" | "hike" | "downhill";

const kindNames = defineStrings<Record<Kind, string>>({
  fr: {
    easy: "Footing", long: "Sortie longue", interval: "Fractionné", tempo: "Seuil", race: "Course",
    hills: "Côtes", climb: "Seuil en côte", hike: "Marche en côte", downhill: "Descente",
  },
  en: {
    easy: "Easy run", long: "Long run", interval: "Intervals", tempo: "Threshold", race: "Race",
    hills: "Hill repeats", climb: "Uphill tempo", hike: "Power hiking", downhill: "Downhill",
  },
});

/** Displayed. */
export const kindName = (kind: Kind): string => kindNames()[kind];

const feelWords = defineStrings({ fr: { feel: "à ton aise" }, en: { feel: "by feel" } });

/** A session's pace as shown beside it: "5'40\"/km", or "by feel" when it has none. */
export const targetName = (targetSKm: number | null): string =>
  targetSKm === null ? feelWords().feel : `${formatPace(targetSKm)}${paceUnit()}`;

/**
 * What a planned session asks for, as shown beside it: its pace on the road,
 * its effort on a trail ("effort 7/10"), "by feel" when it asks for neither.
 */
export function sessionTargetName(session: Session, targetSKm: number | null): string {
  if (isEffortSession(session)) {
    const rpe = sessionEffort(session);
    if (rpe !== null) return rpeName(rpe);
  }
  return targetName(targetSKm);
}

/**
 * What kind of session a run followed, from the id it was stored with.
 *
 * Library sessions and generated ones name themselves differently — "threshold"
 * against "tempo-3-8" — but they are the same kinds of work, and a history
 * badge should call them the same thing.
 */
export function sessionKind(id: string | null): Kind | null {
  if (!id) return null;
  const base = id.replace(/-eased$/, "");
  if (base.startsWith("trail-easy-")) return "easy";
  if (base.startsWith("trail-long-") || base.startsWith("trail-b2b-")) return "long";
  if (base.startsWith("trail-hills-")) return "hills";
  if (base.startsWith("trail-climb-")) return "climb";
  if (base.startsWith("trail-hike-")) return "hike";
  if (base.startsWith("trail-descent-")) return "downhill";
  if (base === "easy" || base.startsWith("easy-")) return "easy";
  if (base === "long" || base.startsWith("long-")) return "long";
  if (base === "400" || base === "pyramid" || base.startsWith("interval-")) return "interval";
  if (base === "threshold" || base.startsWith("tempo-")) return "tempo";
  if (base.startsWith("race-")) return "race";
  return null;
}

export interface PlannedSession {
  /** Position in the programme, and the key a finished run is tied to. */
  order: number;
  /** 1-based. */
  week: number;
  phase: Phase;
  kind: Kind;
  session: Session;
  /**
   * The pace to hold through the session's paced blocks, in s/km, or null
   * for a session run by feel: a beginner's, where the only pace worth
   * holding is one they can talk at.
   */
  targetSKm: number | null;
}

export interface PlanInput {
  goal: PlanGoal;
  weeks: number;
  perWeek: PerWeek;
  /** The finish time the plan trains for. */
  targetTimeS: number;
  /**
   * How long the runner's longest run is today, in minutes. Zero for someone
   * who has never run.
   *
   * Without it a plan can only guess, and it guesses from the race, which is
   * how a beginner ends up handed a ninety minute run in their first week.
   */
  longestMin: number;
  /** Kilometres a week today, measured or declared. */
  weeklyKm: number;
  /**
   * The course, for a trail race. Ignored on the road. On a trail
   * `targetTimeS` may be zero, which means the goal is to finish.
   */
  trail?: TrailRace | null;
}

/** Weeks a plan may run for, given its race. */
export function clampWeeks(goal: Pick<GoalSpec, "minWeeks" | "maxWeeks">, weeks: number): number {
  if (!Number.isFinite(weeks)) return goal.minWeeks;
  return Math.min(goal.maxWeeks, Math.max(goal.minWeeks, Math.round(weeks)));
}

/**
 * Which phase a week belongs to.
 *
 * CHOSEN: the forty and seventy five percent marks are mine. The ordering —
 * foundation, then development, then race-specific work — is CONVENTION,
 * and about as settled as coaching gets.
 *
 * The taper is counted back from the race, so it is never eaten by a short
 * plan: what shrinks when there are only eight weeks is the foundation, which
 * can be shortened, and not the sharpening, which cannot.
 */
export function phaseOfWeek(week: number, weeks: number, taperWeeks: number): Phase {
  if (week > weeks - taperWeeks) return "taper";
  const working = weeks - taperWeeks;
  if (week <= Math.round(working * 0.4)) return "base";
  if (week <= Math.round(working * 0.75)) return "build";
  return "peak";
}

/**
 * How hard a week leans, as a multiplier on its volume.
 *
 * CHOSEN for the climb from 0.7 to 1.0 and the 0.75 of an easy week.
 * CONVENTION for stepping back every fourth. PUBLISHED for the taper, which
 * lands where Bosquet's meta-analysis puts it: a steep drop in volume over
 * the last two weeks with the intensity left alone.
 *
 * Every fourth week steps back. Fitness is built while recovering from work,
 * not while doing it, and a plan that only ever climbs produces a runner who
 * is tired on race day rather than sharp. The taper then falls away steeply:
 * the last week before a race is almost nothing, and that is not a wasted
 * week, it is the point of one.
 */
export function loadOfWeek(week: number, weeks: number, taperWeeks: number): number {
  const phase = phaseOfWeek(week, weeks, taperWeeks);
  if (phase === "taper") {
    const left = weeks - week; // 0 on the race week itself
    return left === 0 ? 0.35 : 0.5 + 0.15 * left;
  }
  const working = weeks - taperWeeks;
  const climb = 0.7 + 0.3 * ((week - 1) / Math.max(1, working - 1));
  return week % 4 === 0 ? climb * 0.75 : climb;
}

const repeat = (times: number, ...block: Step[]): Step[] =>
  Array.from({ length: times }, () => block).flat();

/** "1 h 15", "45 min" — displayed. */
function durationName(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${String(rest).padStart(2, "0")}`;
}

/**
 * Longest run the plan would build to, in minutes, by race.
 *
 * CHOSEN. These are four numbers I picked to resemble what mainstream plans
 * build towards. A ceiling, not an aim. What a runner actually reaches depends on where they
 * started, and most people will never touch these figures — which is correct.
 */
export const LONG_PEAK_MIN: Record<Goal, number> = {
  fiveK: 70,
  tenK: 85,
  half: 105,
  marathon: 150,
};

/**
 * How much the long run may grow week on week.
 *
 * CONVENTION, and weak convention at that. Everybody repeats ten percent a
 * week; Buist randomised novices onto exactly such a graded programme and
 * found no fewer injuries than the ungraded one. Eight is the cautious end
 * of a rule that has not earned its certainty.
 *
 * The reasoning behind it is sound even where the number is not: connective
 * tissue adapts far more slowly than the heart and lungs, so the fact that
 * you can run the extra half hour is exactly the reason not to.
 */
const LONG_GROWTH = 1.08;

/** CHOSEN: the shortest long run worth calling one. */
const LONG_FLOOR_MIN = 20;

/**
 * The most of the race a long run may ever cover.
 *
 * CONVENTION. Every serious marathon plan stops around thirty two kilometres
 * or three hours, and no trial establishes it — the reasoning is a recovery
 * cost that buys nothing. The percentages are CHOSEN to land there.
 *
 * You do not run the race before the race. Covering the distance in training
 * buys nothing that a shorter run has not already bought, and costs weeks of
 * recovery taken out of the middle of the plan — a runner who has done their
 * half in training turns up to it tired rather than sharp. Every serious
 * marathon plan stops around three hours or thirty-two kilometres for exactly
 * this reason.
 *
 * It only binds over the longer races. A ten kilometre runner doing eighty
 * five minutes easy is well past their race duration and none the worse for
 * it, because the effort is nothing alike.
 */
const LONG_RACE_SHARE: Record<Goal, number> = {
  fiveK: Number.POSITIVE_INFINITY,
  tenK: Number.POSITIVE_INFINITY,
  half: 0.85,
  marathon: 0.75,
};

/** The longest a long run may be, given the race and the time being chased. */
export function longCeilingMin(goal: Goal, raceMin: number): number {
  const share = LONG_RACE_SHARE[goal];
  const fromRace = Number.isFinite(share) && raceMin > 0
    ? raceMin * share
    : Number.POSITIVE_INFINITY;
  return Math.min(LONG_PEAK_MIN[goal], fromRace);
}

const round5 = (minutes: number): number => Math.max(5, Math.round(minutes / 5) * 5);

/**
 * How long the long run is in a given week, starting from what the runner
 * can already do.
 *
 * This is the figure the whole plan turns on, and the one that was wrong.
 * Sizing it from the race alone produced a ninety minute run in week one for
 * somebody who had never run — a plan that is not merely useless but an
 * injury written down in advance. It grows from where you are, by a
 * percentage, and stops at whatever the weeks allow.
 */
export function longMinutes(
  goal: Goal,
  week: number,
  weeks: number,
  taperWeeks: number,
  startMin: number,
  raceMin: number,
): number {
  // Floored to a multiple of five before anything else, because every figure
  // here is rounded to five at the end and rounding up through the ceiling
  // would quietly undo it.
  const peak = Math.floor(longCeilingMin(goal, raceMin) / 5) * 5;
  return longMinutesTo(peak, week, weeks, taperWeeks, startMin);
}

/**
 * The long run's growth towards a given ceiling, whatever set the ceiling:
 * the road race's share above, or a trail's (see `trailLongCeilingMin`).
 */
function longMinutesTo(
  peak: number,
  week: number,
  weeks: number,
  taperWeeks: number,
  startMin: number,
): number {
  const start = Math.min(Math.max(startMin, LONG_FLOOR_MIN), peak);
  const working = Math.max(1, weeks - taperWeeks);
  const at = (w: number): number => Math.min(peak, start * LONG_GROWTH ** (w - 1));

  if (week > working) {
    // The taper falls back from whatever was actually reached, not from the
    // ceiling the plan never got to.
    const left = weeks - week;
    return round5(at(working) * (left === 0 ? 0.35 : 0.5 + 0.15 * left));
  }
  // Every fourth week steps back, the long run included — it is the run that
  // most needs the week off.
  return round5(week % 4 === 0 ? at(week) * 0.75 : at(week));
}

/**
 * The longest stretch a plan has you running without stopping, in minutes,
 * the race aside: what it actually builds to.
 */
export function longestRunMin(sessions: readonly PlannedSession[]): number {
  let longest = 0;
  for (const planned of sessions) {
    if (planned.kind === "race") continue;
    for (const step of planned.session.steps) {
      if (step.effort === "steady" && step.seconds !== undefined) longest = Math.max(longest, step.seconds / 60);
    }
  }
  return Math.round(longest);
}

/** What the plan will have you running at its longest, for the warning. */
export function longestReachedMin(
  goal: Goal,
  weeks: number,
  taperWeeks: number,
  startMin: number,
  raceMin: number,
): number {
  return longMinutes(goal, Math.max(1, weeks - taperWeeks), weeks, taperWeeks, startMin, raceMin);
}

/** A session before it knows where in the programme it sits. */
type Unplaced = Omit<PlannedSession, "order" | "week" | "phase">;

function easySession(startMin: number, paces: Paces): Unplaced {
  // Proportional to the long run rather than fixed, for the same reason: a
  // fifty minute footing is a small thing to a regular runner and a whole
  // afternoon to someone who has just started.
  const minutes = Math.min(50, round5(Math.max(LONG_FLOOR_MIN, startMin) * 0.6));
  return {
    kind: "easy",
    targetSKm: paces.easy,
    session: {
      id: `easy-${minutes}`,
      name: `Footing ${durationName(minutes)}`,
      steps: [{ effort: "steady", seconds: minutes * 60 }],
    },
  };
}

function longSession(minutes: number, paces: Paces): Unplaced {
  return {
    kind: "long",
    targetSKm: paces.long,
    session: {
      id: `long-${minutes}`,
      name: `Sortie longue ${durationName(minutes)}`,
      // One block, as the catalogue's long run already is: splitting it into
      // a warm-up and a cool-down announces three things where there is only
      // one to do.
      steps: [{ effort: "steady", seconds: minutes * 60 }],
    },
  };
}

function intervalSession(phase: Phase, load: number, paces: Paces): Unplaced {
  // CHOSEN, all of it — the distances, the recoveries, the counts. The shape
  // is CONVENTION: repetitions lengthen as the plan goes on, short and sharp
  // to build speed while there is time, longer and closer to race pace once
  // there is not.
  const shape = phase === "base"
    ? { metres: 400, recovery: 200, base: 5 }
    : phase === "build"
      ? { metres: 800, recovery: 300, base: 4 }
      : { metres: 1000, recovery: 300, base: 4 };
  const reps = shape.base + Math.round(load * 2);

  return {
    kind: "interval",
    targetSKm: phase === "peak" ? paces.tenK : paces.interval,
    session: {
      id: `interval-${shape.metres}-${reps}`,
      name: `${reps} × ${shape.metres} m`,
      steps: [
        { effort: "warmup", seconds: 900 },
        ...repeat(
          reps,
          { effort: "fast", metres: shape.metres },
          { effort: "recovery", metres: shape.recovery },
        ),
        { effort: "cooldown", seconds: 600 },
      ],
    },
  };
}

function tempoSession(phase: Phase, load: number, paces: Paces): Unplaced {
  // CHOSEN. The direction is CONVENTION: threshold work consolidates into
  // fewer, longer blocks as race day nears, until it is simply the pace held
  // for a stretch.
  const blocks = phase === "peak" ? 2 : 3;
  const minutes = Math.round(phase === "peak" ? 12 + 8 * load : 6 + 4 * load);

  return {
    kind: "tempo",
    targetSKm: phase === "base" ? paces.tenK : paces.half,
    session: {
      id: `tempo-${blocks}-${minutes}`,
      name: `${blocks} × ${minutes} min au seuil`,
      steps: [
        { effort: "warmup", seconds: 900 },
        ...repeat(
          blocks,
          { effort: "steady", seconds: minutes * 60 },
          { effort: "recovery", seconds: 180 },
        ),
        { effort: "cooldown", seconds: 600 },
      ],
    },
  };
}

function racePace(goal: Goal, paces: Paces): number {
  if (goal === "fiveK") return paces.fiveK;
  if (goal === "tenK") return paces.tenK;
  if (goal === "half") return paces.half;
  return paces.marathon;
}

function raceSession(goal: GoalSpec, paces: Paces): Unplaced {
  return {
    kind: "race",
    targetSKm: racePace(goal.id, paces),
    session: {
      id: `race-${goal.id}`,
      name: goal.name,
      steps: [{ effort: "steady", metres: goal.distanceM }],
    },
  };
}

/**
 * Under this, the runner cannot yet run for twenty minutes without stopping,
 * and the plan starts them walking.
 *
 * CONVENTION: twenty minutes of continuous running is where every beginner
 * programme hands over from run-walk to running.
 */
export const NOVICE_BELOW_MIN = 20;

/** True when a plan starts from run-walk rather than running. */
export const isNovice = (longestMin: number): boolean => longestMin < NOVICE_BELOW_MIN;

/**
 * The run-walk ladder, a rung a week, from a minute's running to ten.
 *
 * PUBLISHED in shape: it follows the NHS "Couch to 5K" programme, which
 * takes someone who has never run to thirty minutes over nine weeks by
 * alternating running and walking and lengthening the running. The rungs
 * themselves are CHOSEN to fit it into one session shape per week.
 *
 * Someone who has never run is not unfit at running, they are unused to it:
 * the heart and lungs manage a minute's jog on day one, the tendons and
 * shins do not manage twenty. The walking is what lets the legs catch up.
 */
export const RUN_WALK: readonly { runS: number; walkS: number; times: number }[] = [
  { runS: 60, walkS: 90, times: 8 },
  { runS: 90, walkS: 120, times: 6 },
  { runS: 120, walkS: 120, times: 5 },
  { runS: 180, walkS: 90, times: 5 },
  { runS: 300, walkS: 150, times: 3 },
  { runS: 480, walkS: 180, times: 2 },
  { runS: 600, walkS: 120, times: 2 },
];

/** The first continuous run once the ladder is climbed, in minutes. */
const GRADUATE_MIN = NOVICE_BELOW_MIN;

/**
 * The rung to start on: running blocks of half what the runner can already
 * run without stopping, so the first week is one they finish.
 */
export function firstRung(longestMin: number): number {
  const half = (longestMin * 60) / 2;
  let rung = 0;
  RUN_WALK.forEach((step, index) => {
    if (step.runS <= half) rung = index;
  });
  return rung;
}

/**
 * The rung a week stands on, or null once the ladder is climbed. One rung a
 * week, holding still every fourth: the step back every plan takes.
 */
export function rungOfWeek(week: number, longestMin: number): number | null {
  const climbed = week - 1 - Math.floor((week - 1) / 4);
  const held = week % 4 === 0 ? climbed - 1 : climbed;
  const rung = firstRung(longestMin) + Math.max(0, held);
  return rung < RUN_WALK.length ? rung : null;
}

/** Brisk walking either side, as every beginner programme opens and closes. */
const WALK_AROUND_S = 300;

function runWalkSession(rung: number): Unplaced {
  const { runS, walkS, times } = RUN_WALK[rung];
  return {
    kind: "easy",
    targetSKm: null,
    session: {
      id: `runwalk-${runS}-${walkS}-${times}`,
      name: `Course-marche ${times} × ${runS / 60} min`,
      steps: [
        { effort: "walk", seconds: WALK_AROUND_S },
        ...repeat(times, { effort: "steady", seconds: runS }, { effort: "walk", seconds: walkS }).slice(0, -1),
        { effort: "walk", seconds: WALK_AROUND_S },
      ],
    },
  };
}

/**
 * A beginner's easy run once off the ladder: the twenty minutes they have
 * just learnt to run, by feel. Not scaled down as a regular runner's is —
 * shorter would be a step back down the ladder.
 */
function graduateEasy(): Unplaced {
  return {
    kind: "easy",
    targetSKm: null,
    session: {
      id: `easy-${GRADUATE_MIN}`,
      name: `Footing ${durationName(GRADUATE_MIN)}`,
      steps: [{ effort: "steady", seconds: GRADUATE_MIN * 60 }],
    },
  };
}

/**
 * A beginner's week. Run-walk while the ladder lasts, every session alike;
 * then easy running and a long run growing from twenty minutes. Never a
 * repetition nor a block at threshold: in a first programme speed comes from
 * running more, and a first injury from running fast.
 */
function noviceWeek(
  perWeek: PerWeek,
  week: number,
  graduatedAt: number | null,
  longestMin: number,
  /** The long run of a week off the ladder, given how long ago it was left. */
  longOf: (weeksOff: number) => Unplaced,
  easy: () => Unplaced = graduateEasy,
): Unplaced[] {
  const rung = rungOfWeek(week, longestMin);
  if (rung !== null || graduatedAt === null) {
    return Array.from({ length: perWeek }, () => runWalkSession(rung ?? RUN_WALK.length - 1));
  }
  return [...Array.from({ length: perWeek - 1 }, easy), longOf(week - graduatedAt + 1)];
}

/** The first week off the run-walk ladder, or null for a plan too short to climb it. */
function graduationWeek(weeks: number, longestMin: number): number | null {
  if (!isNovice(longestMin)) return null;
  return Array.from({ length: weeks }, (_, i) => i + 1).find((w) => rungOfWeek(w, longestMin) === null) ?? null;
}

/**
 * What an ordinary week holds, by volume.
 *
 * CHOSEN. The one-a-week arrangement in particular — a quality session every
 * third week — has nothing behind it but the reasoning written here.
 *
 * The order of sacrifice is deliberate. At four there is room for everything.
 * At three the second quality session goes, so repetitions and threshold
 * alternate week by week. At two the easy run goes, since a run whose only
 * job is to add mileage is the first thing that stops earning its place. At
 * one only the long run remains, interrupted every third week by a quality
 * session — without it a runner loses all their speed, and with too much of
 * it they never build the endurance the race asks for.
 */
function weekBody(
  perWeek: PerWeek,
  week: number,
  phase: Phase,
  load: number,
  paces: Paces,
  longMin: number,
  startMin: number,
): Unplaced[] {
  const quality = week % 2 === 1
    ? intervalSession(phase, load, paces)
    : tempoSession(phase, load, paces);
  const long = longSession(longMin, paces);

  if (perWeek === 1) return [week % 3 === 0 ? quality : long];
  if (perWeek === 2) return [quality, long];
  if (perWeek === 3) return [quality, easySession(startMin, paces), long];
  return [
    intervalSession(phase, load, paces),
    easySession(startMin, paces),
    tempoSession(phase, load, paces),
    long,
  ];
}

/**
 * The programme, as an ordered list of sessions without dates.
 *
 * Dates are deliberately absent. They belong to `schedule`, which lays this
 * list onto a calendar afresh every time it is asked — that is what lets a
 * missed week slide instead of piling up as a column of failures.
 */
export function buildPlan(input: PlanInput): PlannedSession[] {
  if (input.goal === "trail") return buildTrailPlan(input);
  const goal = goalById(input.goal);
  if (!goal) return [];
  const paces = pacesFrom(goal.distanceM, input.targetTimeS, input.weeklyKm);
  if (!paces) return [];

  const weeks = clampWeeks(goal, input.weeks);
  const sessions: PlannedSession[] = [];
  let order = 0;
  const novice = isNovice(input.longestMin);
  // The first week off the ladder, for a beginner who climbs it in time.
  const graduatedAt = graduationWeek(weeks, input.longestMin);
  const raceMin = input.targetTimeS / 60;

  for (let week = 1; week <= weeks; week += 1) {
    const phase = phaseOfWeek(week, weeks, goal.taperWeeks);
    const load = loadOfWeek(week, weeks, goal.taperWeeks);

    // Race week is its own shape at any volume: a couple of short runs to
    // stay loose, then the race. At one session a week there is nothing to
    // stay loose from, so it is the race alone.
    // A beginner stays loose the way they have been running: on the last
    // rung they climbed, or easy by feel if they were off the ladder before
    // race week.
    const loosen = (): Unplaced => {
      if (!novice) return easySession(input.longestMin, paces);
      if (graduatedAt !== null && graduatedAt < week) return graduateEasy();
      return runWalkSession(Math.min(rungOfWeek(week - 1, input.longestMin) ?? RUN_WALK.length - 1, RUN_WALK.length - 1));
    };
    const body: Unplaced[] = week === weeks
      ? [
          ...Array.from({ length: Math.min(2, input.perWeek - 1) }, loosen),
          raceSession(goal, paces),
        ]
      : novice
        ? noviceWeek(input.perWeek, week, graduatedAt, input.longestMin, (weeksOff) => ({
          ...longSession(
            longMinutes(goal.id, weeksOff, weeks - (graduatedAt ?? 1) + 1, goal.taperWeeks, GRADUATE_MIN, raceMin),
            paces,
          ),
          targetSKm: null,
        }))
        : weekBody(
          input.perWeek, week, phase, load, paces,
          longMinutes(
            goal.id, week, weeks, goal.taperWeeks, input.longestMin, input.targetTimeS / 60,
          ),
          input.longestMin,
        );

    for (const part of body) {
      order += 1;
      sessions.push({ order, week, phase, ...part });
    }
  }
  return sessions;
}

/*
 * ## Trail plans
 *
 * A trail race is not a slower road race. The same kilometre can take four
 * minutes on a track and twenty up a mountain, so almost everything the road
 * plans are built on — a target pace, a pace ladder, a long run sized by the
 * race's duration at that pace — stops meaning anything. What carries over is
 * the skeleton: phases, a step back every fourth week, a long run growing
 * from what the runner can already do, a taper counted back from the race,
 * and run-walk for somebody who cannot yet run twenty minutes.
 *
 * What changes, and why:
 *
 * - **The race is its distance and its climbing.** Sized by effort
 *   kilometres, the distance plus one for every hundred metres of D+
 *   (`effortKm`, the measure ITRA rates races by). A 20 km with 1 000 m of
 *   climbing is a 30 km race to prepare for, not a 20.
 * - **Sessions are in time and effort, never pace.** Every block carries an
 *   effort on Borg's 0 to 10 scale, read against a heart-rate zone for a
 *   runner with a watch. The run screen gives no pace verdict on them.
 * - **The quality work is on a slope.** Hill repeats build strength while
 *   there is time; uphill tempo is the trail's threshold session; power
 *   hiking is trained because every runner walks the steep climbs of a long
 *   race and almost nobody practises it; descending is trained because it is
 *   what wrecks the quadriceps, and technique is what spares them.
 * - **Ultras get back-to-back weekends.** A long run on Saturday and a
 *   shorter one on Sunday teaches running on tired legs without the recovery
 *   cost of one enormous run — CONVENTION in every ultra plan, without a
 *   trial behind it.
 * - **The plan refuses what it cannot prepare.** A long run grows by eight
 *   percent a week at most, so the date decides how far it can get. When it
 *   cannot get near what the race asks, the plan says so, and below half of
 *   it the plan is not made at all.
 */

/** A trail race, as the runner describes it. */
export interface TrailRace {
  distanceM: number;
  /** Positive elevation gain over the course, the D+. */
  gainM: number;
}

/**
 * Three sizes of trail, by effort kilometres.
 *
 * PUBLISHED boundaries, after ITRA's categories: under 45 effort kilometres
 * is their XXS and XS, 45 to 75 their S, and from 75 — their M, a race of ten
 * hours and more for most of the field — the preparation is an ultra's, with
 * back-to-back weekends and the longest build. The three names are CHOSEN.
 */
export type TrailCategory = "short" | "long" | "ultra";

const TRAIL_SHORT_BELOW_EKM = 45;
const TRAIL_ULTRA_FROM_EKM = 75;

/** CHOSEN: the bounds a generated plan will take on, either way. */
export const TRAIL_MIN_DISTANCE_M = 5000;
export const TRAIL_MAX_EFFORT_KM = 300;

export function trailCategory(race: TrailRace): TrailCategory {
  const size = effortKm(race.distanceM, race.gainM);
  if (size < TRAIL_SHORT_BELOW_EKM) return "short";
  return size < TRAIL_ULTRA_FROM_EKM ? "long" : "ultra";
}

const trailCategoryNames = defineStrings<Record<TrailCategory, string>>({
  fr: { short: "Trail court", long: "Trail long", ultra: "Ultra-trail" },
  en: { short: "Short trail", long: "Long trail", ultra: "Ultra trail" },
});

/** Displayed. */
export const trailCategoryName = (category: TrailCategory): string => trailCategoryNames()[category];

/** What the length of a trail plan depends on. */
export interface TrailSpec {
  category: TrailCategory;
  effortKm: number;
  minWeeks: number;
  maxWeeks: number;
  taperWeeks: number;
}

/**
 * How long a trail plan may run, and how long its taper is.
 *
 * CHOSEN in figure, CONVENTION in direction: the longer the race, the longer
 * the build, because the long run that prepares it starts from where the
 * runner is and may only grow so fast. The floor is low on purpose — twelve
 * weeks for an ultra, which only somebody already running four hours can
 * make use of — because whether the weeks are enough depends on the runner,
 * and that is `trailReadiness`'s call, made in words, not a greyed-out day
 * on a calendar. The ceiling is where a build stops adding and starts
 * wearing: twenty eight weeks, past which nobody stays sharp. The taper grows
 * too — Bosquet's two weeks for anything a marathon's length, three before an
 * ultra, whose fatigue takes longer to clear — and a short trail of a couple
 * of hours keeps the road's one week.
 */
export function trailSpec(race: TrailRace): TrailSpec {
  const size = effortKm(race.distanceM, race.gainM);
  const category = trailCategory(race);
  if (category === "short") {
    return { category, effortKm: size, minWeeks: 6, maxWeeks: 16, taperWeeks: size < 30 ? 1 : 2 };
  }
  if (category === "long") return { category, effortKm: size, minWeeks: 10, maxWeeks: 20, taperWeeks: 2 };
  return { category, effortKm: size, minWeeks: 12, maxWeeks: 28, taperWeeks: 3 };
}

/**
 * A first guess at how long the race takes, in minutes, for somebody who
 * gave no target time.
 *
 * CHOSEN. Seven and a half minutes an effort kilometre over twenty of them
 * is the back half of a typical field, and the time per effort kilometre
 * grows slowly with the size of the race — the same idea as Riegel's
 * exponent, at a CHOSEN 1.1. It only sizes the long run, never a pace, and it
 * errs long, which caps the long run lower rather than higher.
 */
export function trailEstimateMin(race: TrailRace): number {
  const size = effortKm(race.distanceM, race.gainM);
  if (!(size > 0)) return 0;
  return 7.5 * size * (size / 20) ** 0.1;
}

/** The race's duration as the plan reads it: the target when there is one. */
function trailRaceMin(race: TrailRace, targetTimeS: number): number {
  return targetTimeS > 0 ? targetTimeS / 60 : trailEstimateMin(race);
}

/**
 * The longest a trail long run may be, in minutes.
 *
 * CONVENTION for the shape, CHOSEN for the figures. A short trail can be
 * out-run in training, as a road ten can, because a long run is easier than
 * a race; ninety percent of its duration and at least seventy five minutes.
 * From a long trail on, the race lasts far longer than any training run
 * should — nobody runs ten hours to prepare for ten hours, the recovery
 * would cost the next two weeks — so the share falls and a ceiling binds:
 * four hours for a long trail, five for an ultra, where the back-to-back
 * weekend supplies the rest of the time on feet.
 */
const TRAIL_LONG_PEAK_MIN: Record<TrailCategory, number> = { short: 150, long: 240, ultra: 300 };
const TRAIL_LONG_RACE_SHARE: Record<TrailCategory, number> = { short: 0.9, long: 0.6, ultra: 0.4 };

export function trailLongCeilingMin(category: TrailCategory, raceMin: number): number {
  const share = Math.max(75, raceMin * TRAIL_LONG_RACE_SHARE[category]);
  return Math.floor(Math.min(TRAIL_LONG_PEAK_MIN[category], share) / 5) * 5;
}

/**
 * The long run a race actually asks for, in minutes: the ceiling, or three
 * quarters of a short race's duration when that is less (CHOSEN). The
 * ceiling is what the plan grows towards when there is time; this is what it
 * has to reach for the race to be prepared at all — an hour's trail does not
 * need seventy five minutes in training to be finished well.
 */
export function trailLongNeededMin(category: TrailCategory, raceMin: number): number {
  return Math.min(trailLongCeilingMin(category, raceMin), round5(raceMin * 0.75));
}

/**
 * The second day of a back-to-back weekend, given the first.
 *
 * CONVENTION: the second run is the shorter one, around half to two thirds
 * of the first. CHOSEN: sixty percent, never over three hours, and only once
 * the Saturday has reached two hours — before that there is no fatigue worth
 * running on, only fatigue.
 */
export function backToBackMin(longMin: number): number | null {
  if (longMin < 120) return null;
  return Math.min(180, round5(longMin * 0.6));
}

/**
 * The days a trail plan proposes. CHOSEN: the long run keeps Sunday, and
 * from two days a week the day before it is Saturday, so a back-to-back
 * weekend falls on two days in a row rather than five days apart. Only a
 * suggestion, as on the road.
 */
export const TRAIL_SLOT_DAYS: Record<PerWeek, number[]> = {
  1: [0],
  2: [6, 0],
  3: [3, 6, 0],
  4: [2, 4, 6, 0],
};

/** The days to propose for a plan, before the runner picks their own. */
export function suggestedDays(perWeek: PerWeek, category: TrailCategory | null): number[] {
  return category === "long" || category === "ultra" ? TRAIL_SLOT_DAYS[perWeek] : SLOT_DAYS[perWeek];
}

/** Why a trail plan is a stretch, or out of reach. */
export type TrailConcern =
  /** A course outside what a generated plan takes on. */
  | "distance"
  /** Someone still learning to run twenty minutes, before a long trail. */
  | "novice"
  /** Too few days a week for the back-to-back weekends an ultra needs. */
  | "rhythm"
  /** The long run cannot grow near enough to what the race asks. */
  | "longRun";

export interface TrailReadiness {
  /** "ok", a plan worth warning about, or no plan at all. */
  verdict: "ok" | "tight" | "tooFar";
  concern: TrailConcern | null;
  /** The longest run the plan reaches, and what the race asks, in minutes. */
  reachedMin: number;
  neededMin: number;
}

export interface TrailReadinessInput {
  race: TrailRace;
  weeks: number;
  perWeek: PerWeek;
  longestMin: number;
  /** Zero to finish. */
  targetTimeS: number;
}

/**
 * Whether the time left can prepare this race, from where the runner is.
 *
 * CHOSEN thresholds, on a CONVENTION: the long run has to get within reach
 * of what the race asks. Eighty percent of the ceiling is a plan that does
 * its job; under it the plan is made but the runner is told; under half, the
 * gap would be bridged on race day, and a plan that sends someone into the
 * mountains for six hours on the strength of three hours of training is not
 * one this app will write. Also refused, whatever the dates: a long trail
 * for somebody still on run-walk, and an ultra on one run a week.
 */
export function trailReadiness(input: TrailReadinessInput): TrailReadiness {
  const { race, perWeek, longestMin, targetTimeS } = input;
  const spec = trailSpec(race);
  const weeks = clampWeeks(spec, input.weeks);
  const raceMin = trailRaceMin(race, targetTimeS);
  const neededMin = trailLongNeededMin(spec.category, raceMin);
  const reachedMin = isNovice(longestMin)
    ? longestRunMin(buildTrailSessions({ ...input, weeks }, spec))
    : trailLongMinutes(
      spec, Math.max(1, weeks - spec.taperWeeks), weeks, longestMin, trailLongCeilingMin(spec.category, raceMin),
    );
  const result = (verdict: TrailReadiness["verdict"], concern: TrailConcern | null): TrailReadiness =>
    ({ verdict, concern, reachedMin, neededMin });

  if (!(race.distanceM >= TRAIL_MIN_DISTANCE_M) || !(race.gainM >= 0) || spec.effortKm > TRAIL_MAX_EFFORT_KM) {
    return result("tooFar", "distance");
  }
  if (isNovice(longestMin) && spec.category !== "short") return result("tooFar", "novice");
  if (spec.category === "ultra" && perWeek === 1) return result("tooFar", "rhythm");
  if (reachedMin < neededMin * 0.5) return result("tooFar", "longRun");
  if (reachedMin < neededMin * 0.8) return result("tight", "longRun");
  if (spec.category === "ultra" && perWeek === 2) return result("tight", "rhythm");
  return result("ok", null);
}

/** A trail long run in a given week, grown from where the runner is. */
function trailLongMinutes(spec: TrailSpec, week: number, weeks: number, startMin: number, ceilingMin: number): number {
  return longMinutesTo(ceilingMin, week, weeks, spec.taperWeeks, startMin);
}

/** CHOSEN: warm-up and cool-down of every slope session, in seconds. */
const TRAIL_WARMUP_S = 900;
const TRAIL_COOLDOWN_S = 600;

const round50 = (metres: number): number => Math.round(metres / 50) * 50;

/**
 * The trail sessions, each with what it is for.
 *
 * Every figure in them is CHOSEN; the shapes are CONVENTION, the same
 * progression as the road's repetitions: short and hard while there is time
 * to build strength, longer and closer to the race's effort as it nears.
 * The efforts are on Borg's 0 to 10 scale.
 */
function trailEasy(minutes: number): Unplaced {
  return {
    kind: "easy",
    targetSKm: null,
    session: {
      id: `trail-easy-${minutes}`,
      name: `Footing trail ${durationName(minutes)}`,
      steps: [{ effort: "steady", seconds: minutes * 60, rpe: 3 }],
    },
  };
}

/**
 * The long run, on hills, with a climbing target: the race's climbing per
 * hour, over the hours of the run, at half in the base phase and eighty
 * percent after (CHOSEN). It is the run that teaches the legs the race's
 * ground, and the D+ is written into it so it can be read back.
 */
function trailLong(minutes: number, gainM: number): Unplaced {
  return {
    kind: "long",
    targetSKm: null,
    session: {
      id: `trail-long-${minutes}-${gainM}`,
      name: `Sortie longue vallonnée ${durationName(minutes)}`,
      steps: [{ effort: "steady", seconds: minutes * 60, terrain: "hills", rpe: 4 }],
    },
  };
}

function trailBackToBack(minutes: number): Unplaced {
  return {
    kind: "long",
    targetSKm: null,
    session: {
      id: `trail-b2b-${minutes}`,
      name: `Enchaînement ${durationName(minutes)}`,
      steps: [{ effort: "steady", seconds: minutes * 60, terrain: "hills", rpe: 4 }],
    },
  };
}

/**
 * Hill repeats: strength, the trail's answer to the road's repetitions.
 * A minute hard in the base phase, two to three later; an ultra's are longer
 * and a notch easier, because its race is never run at that intensity.
 * Jogged back down, which is the recovery.
 */
function trailHills(phase: Phase, load: number, category: TrailCategory): Unplaced {
  const shape = phase === "base"
    ? { seconds: 60, recovery: 90, base: 6, rpe: 8 }
    : category === "ultra"
      ? { seconds: 180, recovery: 150, base: 4, rpe: 7 }
      : { seconds: 120, recovery: 120, base: 5, rpe: 8 };
  const reps = shape.base + Math.round(load * 2);
  return {
    kind: "hills",
    targetSKm: null,
    session: {
      id: `trail-hills-${shape.seconds}-${reps}`,
      name: `${reps} × ${secondsWords(shape.seconds)} en côte`,
      steps: [
        { effort: "warmup", seconds: TRAIL_WARMUP_S },
        ...repeat(
          reps,
          { effort: "fast", seconds: shape.seconds, terrain: "climb", rpe: shape.rpe },
          { effort: "recovery", seconds: shape.recovery, terrain: "descent", rpe: 2 },
        ),
        { effort: "cooldown", seconds: TRAIL_COOLDOWN_S },
      ],
    },
  };
}

/**
 * Uphill tempo: the threshold session, on a long climb. Blocks consolidate
 * as the race nears, as the road's do, and an ultra's grow longer still.
 */
function trailClimb(phase: Phase, load: number, category: TrailCategory): Unplaced {
  const blocks = phase === "peak" || phase === "taper" ? 2 : 3;
  const minutes = Math.round(
    blocks === 2
      ? category === "short" ? 12 + 8 * load : 15 + 10 * load
      : 6 + 4 * load,
  );
  const recovery = Math.max(3, Math.round(minutes / 2));
  return {
    kind: "climb",
    targetSKm: null,
    session: {
      id: `trail-climb-${blocks}-${minutes}`,
      name: `${blocks} × ${minutes} min de montée`,
      steps: [
        { effort: "warmup", seconds: TRAIL_WARMUP_S },
        ...repeat(
          blocks,
          { effort: "steady", seconds: minutes * 60, terrain: "climb", rpe: 7 },
          { effort: "recovery", seconds: recovery * 60, terrain: "descent", rpe: 2 },
        ),
        { effort: "cooldown", seconds: TRAIL_COOLDOWN_S },
      ],
    },
  };
}

/**
 * Power hiking on a steep climb. On any slope past about fifteen percent,
 * walking hard is as fast as running and costs less (CONVENTION, and what
 * the front of every ultra field does); it is a skill, and untrained it is
 * a slow stroll. Longer blocks before a long race, because its climbs are.
 */
function trailHike(phase: Phase, load: number, category: TrailCategory): Unplaced {
  const long = category !== "short" && (phase === "peak" || phase === "taper");
  const blocks = long ? 3 : 4;
  const minutes = Math.round(long ? 10 + 10 * load : 5 + 5 * load);
  return {
    kind: "hike",
    targetSKm: null,
    session: {
      id: `trail-hike-${blocks}-${minutes}`,
      name: `${blocks} × ${minutes} min de marche en côte`,
      steps: [
        { effort: "warmup", seconds: TRAIL_WARMUP_S },
        ...repeat(
          blocks,
          { effort: "walk", seconds: minutes * 60, terrain: "climb", rpe: 6 },
          { effort: "recovery", seconds: 180, terrain: "descent", rpe: 2 },
        ),
        { effort: "cooldown", seconds: TRAIL_COOLDOWN_S },
      ],
    },
  };
}

/**
 * Downhill technique: short descents at a controlled effort, walked or
 * jogged back up. Descending is where a trail runner's legs are lost —
 * eccentric work the quadriceps are not used to — and the only protection
 * is having done it before, a little more each time (CONVENTION).
 */
function trailDescent(load: number): Unplaced {
  const reps = 4 + Math.round(load * 2);
  return {
    kind: "downhill",
    targetSKm: null,
    session: {
      id: `trail-descent-120-${reps}`,
      name: `${reps} × 2 min de descente`,
      steps: [
        { effort: "warmup", seconds: TRAIL_WARMUP_S },
        ...repeat(
          reps,
          { effort: "steady", seconds: 120, terrain: "descent", rpe: 5 },
          { effort: "recovery", seconds: 180, terrain: "climb", rpe: 3 },
        ),
        { effort: "cooldown", seconds: TRAIL_COOLDOWN_S },
      ],
    },
  };
}

/**
 * The race, at the effort to start it at. CHOSEN: the longer the race, the
 * lower — a short trail is raced, an ultra is managed.
 */
function trailRaceSession(race: TrailRace, category: TrailCategory): Unplaced {
  const gain = Math.round(race.gainM);
  return {
    kind: "race",
    targetSKm: null,
    session: {
      id: `race-trail-${gain}`,
      name: `Trail ${Math.round(race.distanceM / 1000)} km · ${gain} m D+`,
      steps: [{
        effort: "steady",
        metres: race.distanceM,
        terrain: "hills",
        rpe: category === "short" ? 7 : category === "long" ? 6 : 5,
      }],
    },
  };
}

/** "1 min", "1 min 30" — the French name stored with a session. */
function secondsWords(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest === 0 ? `${minutes} min` : `${minutes} min ${String(rest).padStart(2, "0")}`;
}

type TrailWork = "hills" | "climb" | "hike" | "descent";

/**
 * Which slope session each week brings, in turn, by race and phase.
 *
 * CHOSEN. The order is the point: strength first (hills), then the race's
 * own efforts (climbing at threshold, hiking, descending), more hiking and
 * less speed the longer the race. A short trail is mostly run; an ultra's
 * climbs are mostly walked, so its plan practises walking them.
 */
const TRAIL_ROTATION: Record<TrailCategory, Record<Phase, readonly TrailWork[]>> = {
  short: {
    base: ["hills", "hills"],
    build: ["hills", "climb", "descent"],
    peak: ["climb", "descent", "hills"],
    taper: ["climb"],
  },
  long: {
    base: ["hills", "hike"],
    build: ["climb", "hills", "descent", "hike"],
    peak: ["climb", "hike", "descent"],
    taper: ["climb"],
  },
  ultra: {
    base: ["hike", "hills"],
    build: ["climb", "hike", "descent", "hills"],
    peak: ["hike", "climb", "descent"],
    taper: ["hike"],
  },
};

function trailWork(work: TrailWork, phase: Phase, load: number, category: TrailCategory): Unplaced {
  if (work === "hills") return trailHills(phase, load, category);
  if (work === "climb") return trailClimb(phase, load, category);
  if (work === "hike") return trailHike(phase, load, category);
  return trailDescent(load);
}

/**
 * A trail week, by volume. The road's order of sacrifice, with one addition:
 * on an ultra's back-to-back weekends the second long run takes the place of
 * whatever would otherwise go — the easy run, or at two days a week the
 * slope session, which comes back the week after.
 */
function trailWeekBody(
  perWeek: PerWeek,
  week: number,
  phase: Phase,
  load: number,
  category: TrailCategory,
  long: Unplaced,
  backToBack: Unplaced | null,
  startMin: number,
): Unplaced[] {
  const rotation = TRAIL_ROTATION[category][phase];
  const quality = trailWork(rotation[week % rotation.length], phase, load, category);
  const second = trailWork(rotation[(week + 1) % rotation.length], phase, load, category);
  const easy = trailEasy(Math.min(50, round5(Math.max(LONG_FLOOR_MIN, startMin) * 0.6)));

  if (perWeek === 1) return [category === "short" && week % 3 === 0 ? quality : long];
  if (backToBack) {
    if (perWeek === 2) return [long, backToBack];
    if (perWeek === 3) return [quality, long, backToBack];
    return [quality, easy, long, backToBack];
  }
  if (perWeek === 2) return [quality, long];
  if (perWeek === 3) return [quality, easy, long];
  // At four, the second slope session is a different one, never the same twice.
  return [quality, easy, second.session.id === quality.session.id ? trailDescent(load) : second, long];
}

/** Builds the sessions without checking readiness; `buildTrailPlan` does. */
function buildTrailSessions(input: Omit<TrailReadinessInput, "race"> & { race: TrailRace }, spec: TrailSpec): PlannedSession[] {
  const { race, perWeek, longestMin, targetTimeS } = input;
  const weeks = clampWeeks(spec, input.weeks);
  const raceMin = trailRaceMin(race, targetTimeS);
  const ceiling = trailLongCeilingMin(spec.category, raceMin);
  const gainPerMin = raceMin > 0 ? race.gainM / raceMin : 0;
  const gainFor = (minutes: number, phase: Phase): number =>
    round50(gainPerMin * minutes * (phase === "base" ? 0.5 : 0.8));
  const novice = isNovice(longestMin);
  const graduatedAt = graduationWeek(weeks, longestMin);

  const sessions: PlannedSession[] = [];
  let order = 0;
  for (let week = 1; week <= weeks; week += 1) {
    const phase = phaseOfWeek(week, weeks, spec.taperWeeks);
    const load = loadOfWeek(week, weeks, spec.taperWeeks);

    // As on the road: race week is a couple of short runs and the race.
    const loosen = (): Unplaced => {
      if (!novice) return trailEasy(Math.min(40, round5(Math.max(LONG_FLOOR_MIN, longestMin) * 0.5)));
      if (graduatedAt !== null && graduatedAt < week) return trailEasy(GRADUATE_MIN);
      return runWalkSession(Math.min(rungOfWeek(week - 1, longestMin) ?? RUN_WALK.length - 1, RUN_WALK.length - 1));
    };

    let body: Unplaced[];
    if (week === weeks) {
      body = [...Array.from({ length: Math.min(2, perWeek - 1) }, loosen), trailRaceSession(race, spec.category)];
    } else if (novice) {
      // A beginner's trail plan is the road's, run on trails: the ladder,
      // then easy running and a long run growing from twenty minutes, all by
      // feel. No hills, no hiking blocks, nothing hard.
      body = noviceWeek(perWeek, week, graduatedAt, longestMin, (weeksOff) => {
        const minutes = longMinutesTo(
          ceiling, weeksOff, weeks - (graduatedAt ?? 1) + 1, spec.taperWeeks, GRADUATE_MIN,
        );
        return trailLong(minutes, gainFor(minutes, "base"));
      }, () => trailEasy(GRADUATE_MIN));
    } else {
      const longMin = trailLongMinutes(spec, week, weeks, longestMin, ceiling);
      const backToBack = spec.category === "ultra"
        && (phase === "build" || phase === "peak")
        && week % 4 !== 0
        ? backToBackMin(longMin)
        : null;
      body = trailWeekBody(
        perWeek, week, phase, load, spec.category,
        trailLong(longMin, gainFor(longMin, phase)),
        backToBack === null ? null : trailBackToBack(backToBack),
        longestMin,
      );
    }

    for (const part of body) {
      order += 1;
      sessions.push({ order, week, phase, ...part });
    }
  }
  return sessions;
}

/**
 * A trail programme, or nothing when the race is out of reach in the time
 * left (see `trailReadiness`). Every session in it is run by time and
 * effort; none carries a pace.
 */
function buildTrailPlan(input: PlanInput): PlannedSession[] {
  const race = input.trail;
  if (!race) return [];
  const readiness = trailReadiness({ ...input, race });
  if (readiness.verdict === "tooFar") return [];
  return buildTrailSessions({ ...input, race }, trailSpec(race));
}

/**
 * The course a stored trail programme was built for, read back from its race
 * session — `race-trail-<D+>`, over the distance — so that nothing about the
 * stored shape of a programme had to change for trail plans to exist.
 */
export function trailOfPlan(sessions: readonly PlannedSession[]): TrailRace | null {
  const race = sessions.find((planned) => planned.kind === "race" && planned.session.id.startsWith("race-trail"));
  const metres = race?.session.steps[0]?.metres;
  if (!race || metres === undefined) return null;
  return { distanceM: metres, gainM: trailGainOf(race.session.id) };
}

/** Projected finish, for the line under the goal. */
export function projectedTimeS(goal: GoalSpec, paces: Paces): number {
  return (racePace(goal.id, paces) * goal.distanceM) / 1000;
}

const DAY_MS = 86_400_000;

/** Midnight local, so two days compare as days and not as instants. */
export function startOfDay(ms: number): number {
  const date = new Date(ms);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

/** Whole days from one to the other, by calendar and not by elapsed time. */
export function daysBetween(fromMs: number, toMs: number): number {
  return Math.round((startOfDay(toMs) - startOfDay(fromMs)) / DAY_MS);
}

/**
 * The days a plan proposes, as `Date.getDay` numbers, before anyone says
 * otherwise.
 *
 * CHOSEN, and only a default — the runner picks their own.
 *
 * Sunday is the fixed point at every volume, because that is where the long
 * run goes. Tuesday joins it, then Thursday, then Friday. Monday and Saturday
 * are left alone even at four: one of them is where a missed session actually
 * gets made up, and a plan that fills every day leaves nowhere to put a life.
 *
 * All of it is only a suggestion. A runner who works Sundays needs a
 * programme that knows it, and a plan landing on days somebody cannot train
 * is a plan they stop opening.
 */
export const SLOT_DAYS: Record<PerWeek, number[]> = {
  1: [0],
  2: [2, 0],
  3: [2, 4, 0],
  4: [2, 4, 5, 0],
};

/**
 * Chosen days, made safe to schedule against.
 *
 * Stored days come back from a database and from older versions of this app,
 * so they are checked rather than trusted: anything that is not the right
 * count of real, distinct weekdays falls back to the suggestion.
 */
export function normaliseDays(days: readonly number[] | null | undefined, perWeek: PerWeek): number[] {
  const clean = [...new Set((days ?? []).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))];
  return clean.length === perWeek ? clean.sort((a, b) => a - b) : SLOT_DAYS[perWeek];
}

/** Every training day between two dates, race day excluded. */
export function slotDates(fromMs: number, raceMs: number, days: readonly number[]): number[] {
  const wanted = new Set(days);
  const race = startOfDay(raceMs);
  const slots: number[] = [];
  for (let day = startOfDay(fromMs); day < race; day += DAY_MS) {
    if (wanted.has(new Date(day).getDay())) slots.push(day);
  }
  return slots;
}

export interface Done {
  /**
   * The run that settled it, or null when it was simply passed over.
   *
   * Skipping and running are both ways of putting a session behind you, and
   * the plan treats them alike — but a log claiming you ran something you
   * declined would be a lie told by your own app, so the two stay
   * distinguishable everywhere they are shown.
   */
  runId: number | null;
  at: number;
}

export interface ScheduledSession extends PlannedSession {
  /** Midnight of the day it falls on. */
  at: number;
  /** The run that settled it: null both for a skipped one and a pending one. */
  runId: number | null;
  /** True once it is behind you, however it got there. */
  settled: boolean;
}

/**
 * Lay the sessions still to do onto the days still left.
 *
 * The sliding rule, and the reason no date is ever stored.
 *
 * What remains starts on the first training day available, today included.
 * An earlier version packed everything against the race instead, which was
 * right when there was too much to fit and wrong the rest of the time: one
 * spare slot anywhere and the whole plan shifted a week later, so a runner
 * who set up a monday programme on a monday was told to start the monday
 * after.
 *
 * The sharpening still lands where it has to, because it is the front that
 * gives way. When more sessions remain than there are days to hold them the
 * earliest are dropped rather than crammed in: missing the foundation costs
 * some of your ceiling, skipping the sharpening costs you the race itself.
 * And once anything has been dropped there is no slack left, so the last
 * session sits against the race by arithmetic rather than by rule.
 */
export function schedule(
  sessions: PlannedSession[],
  done: Map<number, Done>,
  todayMs: number,
  raceMs: number,
  days: readonly number[],
): ScheduledSession[] {
  const slots = slotDates(todayMs, raceMs, days);
  const remaining = sessions.filter((s) => !done.has(s.order) && s.kind !== "race");
  const kept = remaining.slice(Math.max(0, remaining.length - slots.length));

  const placed = new Map<number, number>();
  kept.forEach((session, i) => placed.set(session.order, slots[i]));

  const out: ScheduledSession[] = [];
  for (const session of sessions) {
    const finished = done.get(session.order);
    if (finished) {
      out.push({ ...session, at: startOfDay(finished.at), runId: finished.runId, settled: true });
      continue;
    }
    if (session.kind === "race") {
      out.push({ ...session, at: startOfDay(raceMs), runId: null, settled: false });
      continue;
    }
    const at = placed.get(session.order);
    // Absent means dropped: more was missed than the remaining days can hold.
    if (at !== undefined) out.push({ ...session, at, runId: null, settled: false });
  }
  return out.sort((a, b) => a.at - b.at || a.order - b.order);
}

/**
 * How hard a session felt, said by the runner afterwards.
 *
 * Five levels, because three is too coarse to show a trend and ten asks for a
 * precision nobody has about their own legs.
 */
export type Exertion = 1 | 2 | 3 | 4 | 5;

const exertionNames = defineStrings<Record<Exertion, string>>({
  fr: { 1: "Très facile", 2: "Facile", 3: "Correct", 4: "Dur", 5: "Très dur" },
  en: { 1: "Very easy", 2: "Easy", 3: "Fine", 4: "Hard", 5: "Very hard" },
});

/** Displayed. */
export const exertionName = (level: Exertion): string => exertionNames()[level];

/**
 * How much to take off the coming sessions, given how the last ones felt.
 *
 * CHOSEN, and the only part of the plan that reacts to anything. The method
 * screen admits the programme cannot know your sleep, your work or your
 * legs — this is the one channel through which it can be told, and the
 * runner is the only instrument available.
 *
 * Two readings, not one: a single hard session is training working as
 * intended, and easing off after every tough workout would build nothing at
 * all. Two in a row is a pattern, and the cost of easing when you did not
 * need to is a slightly light week, while the cost of not easing when you did
 * is the rest of the plan.
 *
 * `recent` is newest first.
 */
export function easeFactor(recent: readonly Exertion[]): number {
  const [last, before] = recent;
  if (last === undefined || before === undefined) return 1;
  if (last === 5 && before === 5) return 0.7;
  if (last >= 4 && before >= 4) return 0.85;
  return 1;
}

/** The next thing to do, or null once the race is behind you. */
export function nextSession(scheduled: ScheduledSession[]): ScheduledSession | null {
  return scheduled.find((s) => !s.settled) ?? null;
}

/**
 * What the run button should offer, given a programme.
 *
 * Going running and following a programme are the same act when one exists,
 * and asking somebody to remember which screen to start from is asking them
 * to do the filing. The next session due is what a plan is for; proposing
 * anything else would make the programme something you consult rather than
 * something you follow.
 *
 * Already eased if recent sessions were hard, because the session offered has
 * to be the session that would be run — a proposal that ignores the easing
 * would quietly undo it.
 */
export function nextToRun(
  sessions: PlannedSession[],
  done: Map<number, Done>,
  days: readonly number[],
  raceMs: number,
  recent: readonly Exertion[],
  todayMs: number,
): { session: Session; order: number; at: number; kind: Kind; targetSKm: number | null } | null {
  const next = nextSession(schedule(sessions, done, todayMs, raceMs, days));
  if (!next) return null;
  const factor = next.kind === "race" ? 1 : easeFactor(recent);
  return {
    session: factor < 1 ? eased(next.session, factor) : next.session,
    order: next.order,
    at: next.at,
    kind: next.kind,
    targetSKm: next.targetSKm,
  };
}

/**
 * Sessions actually run, as opposed to merely settled.
 *
 * What a progress bar should count. Skipping a session moves the programme
 * on, and pretending it also moved the runner on would make the one number
 * they glance at the least honest thing on the screen.
 */
export function ranCount(done: Map<number, Done>): number {
  return [...done.values()].filter((entry) => entry.runId !== null).length;
}

/** How much of the programme is behind you, 0 to 1. */
export function planProgress(sessions: PlannedSession[], doneCount: number): number {
  if (sessions.length === 0) return 0;
  return Math.min(1, Math.max(0, doneCount) / sessions.length);
}
