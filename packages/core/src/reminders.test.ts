import assert from "node:assert/strict";
import { test } from "node:test";
import {
  plannedReminders, readReminderWhen, reminderAt, reminderText, type Plannable,
} from "./reminders.ts";

/** Midnight of a day, the way the plan lays its sessions out. */
const day = (year: number, month: number, date: number) =>
  new Date(year, month, date).getTime();

const session = (at: number, over: Partial<Plannable> = {}): Plannable => ({
  at,
  name: "6 × 400 m",
  kind: "Intervalles",
  minutes: 42,
  pace: "4'30\"",
  weather: null,
  settled: false,
  ...over,
});

test("the evening reminder lands at seven the day before", () => {
  const at = reminderAt(day(2026, 8, 24), "evening");
  assert.deepEqual(new Date(at!), new Date(2026, 8, 23, 19, 0, 0, 0));
});

test("the morning reminder lands at half six on the day", () => {
  const at = reminderAt(day(2026, 8, 24), "morning");
  assert.deepEqual(new Date(at!), new Date(2026, 8, 24, 6, 30, 0, 0));
});

test("the evening before the first of a month is the last of the one before", () => {
  const at = reminderAt(day(2026, 9, 1), "evening");
  assert.deepEqual(new Date(at!), new Date(2026, 8, 30, 19, 0, 0, 0));
});

test("turned off, nothing is ever due", () => {
  assert.equal(reminderAt(day(2026, 8, 24), "off"), null);
  assert.deepEqual(plannedReminders([session(day(2026, 8, 24))], "off", day(2026, 8, 20)), []);
});

test("the notification names the session and dates it in a word", () => {
  assert.deepEqual(reminderText(session(day(2026, 8, 24)), "evening"), {
    title: "Demain · 6 × 400 m",
    body: "Intervalles, 42 min, allure 4'30\"/km",
  });
  assert.equal(reminderText(session(day(2026, 8, 24)), "morning").title, "Aujourd'hui · 6 × 400 m");
});

test("the weather goes on a line of its own, never into the same sentence", () => {
  const rainy = session(day(2026, 8, 24), { weather: "Pluie, 8° à 12°, vent 27 km/h" });
  assert.equal(
    reminderText(rainy, "evening").body,
    "Intervalles, 42 min, allure 4'30\"/km\nPluie, 8° à 12°, vent 27 km/h",
  );
});

test("sessions already run or passed are not reminded about", () => {
  const sessions = [
    session(day(2026, 8, 22), { settled: true }),
    session(day(2026, 8, 24)),
  ];
  const due = plannedReminders(sessions, "evening", day(2026, 8, 20));
  assert.equal(due.length, 1);
  assert.deepEqual(new Date(due[0].at), new Date(2026, 8, 23, 19, 0, 0, 0));
});

test("a moment already gone is not scheduled at all", () => {
  // Asked on the 23rd at nine in the evening: that day's reminder is two
  // hours late, and firing it now would be worse than silence.
  const now = new Date(2026, 8, 23, 21, 0).getTime();
  const due = plannedReminders(
    [session(day(2026, 8, 24)), session(day(2026, 8, 26))], "evening", now,
  );
  assert.equal(due.length, 1);
  assert.deepEqual(new Date(due[0].at), new Date(2026, 8, 25, 19, 0, 0, 0));
});

test("only so many are ever pending, and they are the nearest ones", () => {
  const sessions = Array.from({ length: 30 }, (_, i) => session(day(2026, 8, 24) + i * 86_400_000));
  const due = plannedReminders(sessions, "morning", day(2026, 8, 20), 10);
  assert.equal(due.length, 10);
  assert.deepEqual(new Date(due[0].at), new Date(2026, 8, 24, 6, 30, 0, 0));
  assert.deepEqual(new Date(due[9].at), new Date(2026, 9, 3, 6, 30, 0, 0));
});

test("two reminders for the same day never collide", () => {
  const due = plannedReminders(
    [session(day(2026, 8, 24)), session(day(2026, 8, 26))], "evening", day(2026, 8, 1),
  );
  assert.equal(new Set(due.map((reminder) => reminder.id)).size, due.length);
});

test("an unrecognised preference means off", () => {
  assert.equal(readReminderWhen(undefined), "off");
  assert.equal(readReminderWhen("nope"), "off");
  assert.equal(readReminderWhen("evening"), "evening");
  assert.equal(readReminderWhen("morning"), "morning");
});
