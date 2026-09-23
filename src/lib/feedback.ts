import { defineStrings, speechLocale } from "./i18n";
import { getUnitSystem } from "./units";
import * as Speech from "expo-speech";
import { Platform, Vibration } from "react-native";

/**
 * How long one buzz of the vibration motor lasts.
 *
 * iOS decides this and will not be told otherwise, so it is the one number
 * here that is observed rather than chosen. Android is given the same figure
 * so that a pattern feels the same on both.
 */
const BUZZ_MS = 400;

/**
 * Interval between the start of one buzz and the next.
 *
 * It has to clear BUZZ_MS with room to spare. Buzzes were spaced 420ms for a
 * 400ms buzz, and the system ignores a trigger arriving while the motor is
 * already running, so every pattern quietly lost one: three read as two, two
 * read as one. The silence between is what makes them countable.
 */
const GAP_MS = 650;

/**
 * A pattern of motor buzzes.
 *
 * Everything the app says while running goes through the vibration motor
 * rather than the Taptic Engine. Feedback generators are the language of the
 * interface — a button answering a finger that is already on the glass — and
 * they are far too polite for a phone strapped to an arm or buried in a
 * pocket. The motor is what the system itself uses for a call.
 *
 * The cost is that the motor has exactly one texture and one length on iOS,
 * so nothing here can be made softer or longer. Count and spacing are the
 * only two things left to say something with.
 */
function buzz(times: number, gapMs = 0): void {
  // A pattern already playing makes the module drop whatever arrives next, so
  // a kilometre landing on a change of block would silently swallow one of
  // the two. Clearing the flag first means the newer event always wins.
  Vibration.cancel();
  if (times <= 1) {
    Vibration.vibrate(BUZZ_MS);
    return;
  }

  // The same array means two different things: iOS reads it as the delays
  // between buzzes, Android as alternating silence and buzz. One shape cannot
  // satisfy both, so each is built the way its platform will read it.
  if (Platform.OS === "ios") {
    Vibration.vibrate([0, ...Array<number>(times - 1).fill(gapMs)]);
    return;
  }
  const pattern = [0];
  for (let i = 0; i < times; i += 1) {
    pattern.push(BUZZ_MS);
    if (i < times - 1) pattern.push(Math.max(gapMs - BUZZ_MS, 0));
  }
  Vibration.vibrate(pattern);
}

/**
 * Kilometre feedback, spoken and felt.
 *
 * This is the one feature that matters most while actually running, because
 * you cannot read a screen mid-stride. A vibration tells you a kilometre has
 * gone by, and the voice gives you its time without you lifting the phone.
 */
/** What the voice says, written to be heard rather than read. */
const spokenWords = defineStrings({
  fr: {
    kilometre: (km: number, minutes: number, seconds: number) => `${
      getUnitSystem() === "metric" ? "Kilomètre" : "Mile"} ${km}. ${
      minutes > 0
        ? `${minutes} minute${minutes > 1 ? "s" : ""} ${seconds > 0 ? `${seconds}` : ""}`
        : `${seconds} secondes`}`,
    sessionDone: "Séance terminée",
    autoPaused: "Pause automatique",
    autoResumed: "Reprise",
    drift: (seconds: number, slow: boolean) =>
      `${seconds} seconde${seconds > 1 ? "s" : ""} ${slow ? "trop lent" : "trop rapide"}`,
  },
  en: {
    kilometre: (km: number, minutes: number, seconds: number) => `${
      getUnitSystem() === "metric" ? "Kilometre" : "Mile"} ${km}. ${
      minutes > 0
        ? `${minutes} minute${minutes > 1 ? "s" : ""}${seconds > 0 ? ` ${seconds}` : ""}`
        : `${seconds} seconds`}`,
    sessionDone: "Session complete",
    autoPaused: "Auto-paused",
    autoResumed: "Resumed",
    drift: (seconds: number, slow: boolean) =>
      `${seconds} second${seconds > 1 ? "s" : ""} ${slow ? "too slow" : "too fast"}`,
  },
});

/**
 * The run paused or resumed by itself. Always felt, spoken when the voice is
 * on: a watch that stops counting without a word is a watch that seems
 * broken the first time it happens.
 */
export function announceAutoPause(paused: boolean, spoken: boolean): void {
  buzz(paused ? 2 : 1, GAP_MS);
  if (!spoken) return;
  const words = spokenWords();
  Speech.speak(paused ? words.autoPaused : words.autoResumed, { language: speechLocale(), rate: 1 });
}

export function announceKilometre(km: number, splitS: number, spoken: boolean): void {
  // The buzz fires whatever happens: it is the part that works with headphones
  // out, music playing, or the phone deep in a pocket.
  //
  // One buzz, alone. It is the only single in the set, so it needs no counting
  // to recognise: the silence straight after it is what names it.
  buzz(1);
  if (!spoken) return;

  const minutes = Math.floor(splitS / 60);
  const seconds = Math.round(splitS % 60);
  Speech.speak(spokenWords().kilometre(km, minutes, seconds), { language: speechLocale(), rate: 1 });
}


/**
 * The next block of a structured session, spoken as the last one ends.
 *
 * This is what makes a session runnable at all: intervals are precisely the
 * moment you cannot look at a phone, because you are either flat out or
 * bent over recovering. The buzz marks the change, the voice says what the
 * change is.
 */
export function announceStep(label: string | null, spoken: boolean): void {
  // Two for a change of block, three for the end of the session. The count
  // rises with how final the thing is, not with how urgently it must be acted
  // on: a block change is one of many and comes back in a few minutes, the
  // end comes once and closes everything.
  if (label) buzz(2, GAP_MS);
  else buzz(3, GAP_MS);
  if (!spoken) return;
  Speech.speak(label ?? spokenWords().sessionDone, { language: speechLocale(), rate: 1 });
}

/**
 * How far off the target pace you are, said out loud.
 *
 * Only the gap, never the pace itself: mid-effort, "twelve seconds too slow"
 * is an instruction you can act on, while "five minutes forty-two a
 * kilometre" is arithmetic you have to do first.
 */
export function announcePace(driftS: number, spoken: boolean): void {
  // No buzz here, and the only one of the four without one.
  //
  // The motor has three things left to say — one, two or three — and all
  // three are spoken for. A fourth would have to be longer than the end of a
  // session, which is absurd for the smallest signal of the set, and giving
  // this one buzz would make it indistinguishable from a kilometre.
  //
  // It costs nothing, because a buzz was never enough here anyway: it can say
  // that you have drifted but not which way, so it sends you to the screen
  // instead of saving you the trip. The other three are complete without a
  // word; this one is the voice or it is nothing.
  if (!spoken) return;
  const seconds = Math.abs(driftS);
  Speech.speak(spokenWords().drift(seconds, driftS > 0), { language: speechLocale(), rate: 1 });
}

/** Silence any pending speech, on finishing or discarding a run. */
export function stopSpeaking(): void {
  void Speech.stop().catch(() => undefined);
}
