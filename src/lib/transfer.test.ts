import assert from "node:assert/strict";
import { test } from "node:test";
import JSZip from "jszip";
import {
  describeTransfer, packTransfer, readTransfer, transferFileName, TRANSFER_ENTRY,
  TRANSFER_FORMAT, TRANSFER_VERSION, unpackTransfer, type Transfer, type TransferRun,
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

const transfer = (over: Partial<Transfer> = {}): Transfer => ({
  format: TRANSFER_FORMAT,
  version: TRANSFER_VERSION,
  exportedAt: new Date(2026, 8, 22).getTime(),
  runs: [run(1_758_520_800_000), run(1_758_607_200_000)],
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
    "2 courses · 4 points GPS · tes réglages",
  );
  assert.equal(
    describeTransfer(transfer({ runs: [run(1)], settings: {} })),
    "1 course · 2 points GPS",
  );
});

test("the file is dated, and the entry inside it is named", () => {
  assert.equal(transferFileName(new Date(2026, 8, 22, 14).getTime()), "tread-transfert-2026-09-22.zip");
  assert.equal(TRANSFER_ENTRY, "tread.json");
});
