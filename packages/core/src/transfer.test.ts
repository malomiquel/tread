import assert from "node:assert/strict";
import { test } from "node:test";
import JSZip from "jszip";
import {
  describeTransfer, packTransfer, readTransfer, restoredSummary, transferFileName, TRANSFER_ENTRY,
  TRANSFER_FORMAT, TRANSFER_VERSION, unpackTransfer, type Transfer, type TransferRoute,
  type TransferRun,
} from "./transfer.ts";

const run = (startedAt: number, points = 2): TransferRun => ({
  startedAt,
  endedAt: startedAt + 1_800_000,
  distanceM: 6000,
  durationS: 1800,
  avgPaceSKm: 300,
  name: "Course matinale",
  elevationGainM: 42,
  fastestKmS: 290,
  cadenceSpm: 172,
  exertion: 3,
  sessionId: null,
  blocks: [],
  weather: { temperatureC: 8, feelsLikeC: 4, windKmh: 18, precipitationMm: 0, code: 3, day: true },
  heart: { avgBpm: 148, maxBpm: 172, zonesS: [0, 1100, 550, 160, 0], maxHeartRate: 190 },
  points: Array.from({ length: points }, (_, i) => ({
    ts: startedAt + i * 1000, lat: 48.45 + i / 10_000, lng: 1.49, alt: 128,
    accuracy: 5, speed: 3.3, segment: 0,
  })),
});

const loop: TransferRoute = {
  name: "Boucle du canal",
  createdAt: new Date(2026, 3, 12).getTime(),
  waypoints: [{ lat: 48.45, lng: 1.49 }, { lat: 48.46, lng: 1.5 }],
  legs: [[{ lat: 48.45, lng: 1.49 }, { lat: 48.455, lng: 1.495 }, { lat: 48.46, lng: 1.5 }]],
  place: "Chartres, France",
};

const transfer = (over: Partial<Transfer> = {}): Transfer => ({
  format: TRANSFER_FORMAT,
  version: TRANSFER_VERSION,
  exportedAt: new Date(2026, 8, 22).getTime(),
  runs: [run(1_758_520_800_000), run(1_758_607_200_000)],
  routes: [loop],
  plan: null,
  settings: { voice: "true", weeklyGoalM: "30000" },
  ...over,
});

test("everything survives the round trip", async () => {
  const sent = transfer();
  const back = await unpackTransfer(await packTransfer(sent));
  assert.deepEqual(back, sent);
});

test("the zip is far smaller than the json it holds", async () => {
  // A history is mostly coordinates, and coordinates deflate. This is the
  // difference between a file somebody sends and one they give up on.
  const many = transfer({ runs: [run(1_758_520_800_000, 5000)] });
  const packed = await packTransfer(many);
  const raw = JSON.stringify(many).length;
  // base64 costs a third on top, so the comparison is made against the bytes.
  assert.ok((packed.length * 3) / 4 < raw / 4, `${(packed.length * 3) / 4} vs ${raw}`);
});

test("a file from another app is refused", async () => {
  assert.equal(readTransfer("{}"), null);
  assert.equal(readTransfer("pas du json"), null);
  assert.equal(readTransfer(JSON.stringify({ format: "autre-chose", version: 1, runs: [] })), null);
});

test("a file from a newer version of the app is refused, not guessed at", () => {
  const future = JSON.stringify({ ...transfer(), version: TRANSFER_VERSION + 1 });
  assert.equal(readTransfer(future), null);
  // Its own version, and anything older, is read.
  assert.ok(readTransfer(JSON.stringify(transfer())));
});

test("a zip of something else is turned away", async () => {
  // Exactly what a GPX archive is: a zip, with courses inside, not this.
  const zip = new JSZip();
  zip.file("course.gpx", "<gpx></gpx>");
  assert.equal(await unpackTransfer(await zip.generateAsync({ type: "base64" })), null);
  assert.equal(await unpackTransfer("pas un zip du tout"), null);
});

test("a run without the two fields the import keys on is dropped", () => {
  const broken = JSON.stringify({
    ...transfer(),
    runs: [{ name: "sans date" }, { startedAt: 1, points: "pas un tableau" }, run(42)],
  });
  const read = readTransfer(broken);
  assert.equal(read?.runs.length, 1);
  assert.equal(read?.runs[0].startedAt, 42);
});

test("a plan without its sessions is no plan", () => {
  const withPlan = readTransfer(JSON.stringify(transfer({
    plan: { raceAt: 1, sessions: [], goal: "10k", weeks: 8, perWeek: 3,
      targetTimeS: 2400, createdAt: 1, days: [1, 3, 5], done: [] } as never,
  })));
  assert.ok(withPlan?.plan);
  assert.equal(readTransfer(JSON.stringify(transfer({ plan: { raceAt: 1 } as never })))?.plan, null);
});

test("settings that are not strings do not travel", () => {
  const read = readTransfer(JSON.stringify(transfer({
    settings: { voice: "true", weeklyGoalM: 30_000 as never, reminder: "evening" },
  })));
  assert.deepEqual(read?.settings, { voice: "true", reminder: "evening" });
});

test("the confirmation says what is in the file before it is written", () => {
  assert.equal(
    describeTransfer(transfer()),
    "2 courses · 4 points GPS · 1 parcours · tes réglages",
  );
  assert.equal(
    describeTransfer(transfer({ runs: [run(1)], routes: [], settings: {} })),
    "1 course · 2 points GPS",
  );
});

test("the file is dated, and the entry inside it is named", () => {
  assert.equal(transferFileName(new Date(2026, 8, 22, 14).getTime()), "tread-transfert-2026-09-22.zip");
  assert.equal(TRANSFER_ENTRY, "tread.json");
});

test("a file written before routes travelled reads as having none", () => {
  const old = transfer() as Partial<Transfer>;
  delete old.routes;
  assert.deepEqual(readTransfer(JSON.stringify(old))?.routes, []);
});

test("a route without its shape does not travel", () => {
  const read = readTransfer(JSON.stringify(transfer({
    routes: [loop, { name: "Cassée", createdAt: 1 } as never, { ...loop, place: 42 as never }],
  })));
  assert.equal(read?.routes.length, 2);
  // A place that is not a word arrives as no place rather than as a number.
  assert.equal(read?.routes[1].place, null);
});

test("the chosen route stays on the phone that chose it", () => {
  // Its id names a row on the old phone, and a different route — or none —
  // on the new one.
  const read = readTransfer(JSON.stringify(transfer({
    settings: { voice: "true", routeId: "3" },
  })));
  assert.deepEqual(read?.settings, { voice: "true" });
});

test("the summary counts what arrived and says what was kept", () => {
  assert.equal(
    restoredSummary({ added: 3, known: 1, routes: 2, plan: false, settings: true }, true),
    "3 courses ajoutées · 1 déjà connue · 2 parcours ajoutés · programme ignoré : celui d'ici a été gardé · réglages repris",
  );
  assert.equal(
    restoredSummary({ added: 0, known: 0, routes: 0, plan: false, settings: false }, false),
    "Rien de nouveau.",
  );
});

test("a file written before the code spoke English is brought up to date", () => {
  const old = transfer({
    runs: [{
      ...run(1_758_520_800_000),
      sessionId: "seuil-eased",
      blocks: [{ effort: "rapide" as never, targetMetres: 400, targetSeconds: null, distanceM: 402, durationS: 88 }],
    }],
    plan: {
      goal: "half", raceAt: 1, weeks: 10, perWeek: 3, targetTimeS: 6000, createdAt: 0, days: [1, 3, 6],
      sessions: [{
        order: 0, week: 1, phase: "base", kind: "easy", targetSKm: 360,
        session: { id: "footing", name: "Footing 30 min", steps: [{ effort: "allure" as never, seconds: 1800 }] },
      }],
      done: [],
    },
  });
  const read = readTransfer(JSON.stringify(old));
  assert.equal(read?.runs[0].sessionId, "threshold-eased");
  assert.equal(read?.runs[0].blocks[0].effort, "fast");
  assert.equal(read?.plan?.sessions[0].session.id, "easy");
  assert.equal(read?.plan?.sessions[0].session.steps[0].effort, "steady");
});
