import { test } from "node:test";
import assert from "node:assert/strict";
import { backupName, backupsIn, backupsToDrop, backupTime, copyDue, fingerprint } from "./backup.ts";

test("a copy's name carries its time, and only copies are read as copies", () => {
  const at = new Date(2026, 8, 24, 7, 15).getTime();
  assert.equal(backupName(at), "tread-copie-2026-09-24-0715.zip");
  assert.equal(backupTime(backupName(at)), at);
  assert.equal(backupTime("photo.jpg"), null);
  assert.equal(backupTime("tread-transfert-2026-09-24.zip"), null);
});

test("copies are sorted newest first and the oldest dropped past seven", () => {
  const names = Array.from({ length: 9 }, (_, i) => backupName(new Date(2026, 8, 1 + i, 8).getTime()));
  const shuffled = [...names].reverse().concat(["notes.txt"]);
  assert.equal(backupsIn(shuffled)[0], names[8]);
  assert.deepEqual(backupsToDrop(shuffled), [names[1], names[0]]);
  assert.deepEqual(backupsToDrop(names.slice(0, 3)), []);
});

test("a copy is written when something changed, not twice in a row", () => {
  const now = Date.now();
  const same = fingerprint({ runs: 12, lastRun: 99 });
  assert.equal(copyDue(null, now, same), true);
  assert.equal(copyDue({ at: now - 3_600_000, fingerprint: same }, now, same), false);
  const changed = fingerprint({ runs: 13, lastRun: 100 });
  assert.equal(copyDue({ at: now - 3_600_000, fingerprint: same }, now, changed), true);
  assert.equal(copyDue({ at: now - 30_000, fingerprint: same }, now, changed), false);
  assert.equal(fingerprint({ b: 1, a: null }), "a:-|b:1");
});
