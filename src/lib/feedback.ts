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

/** Barely a pause: consecutive buzzes run together into one rattle. */
const TIGHT_MS = 420;

/** Long enough to hear the silence, so the buzzes are counted, not felt as one. */
const WIDE_MS = 900;

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
  const time =
    minutes > 0
      ? `${minutes} minute${minutes > 1 ? "s" : ""} ${seconds > 0 ? `${seconds}` : ""}`
      : `${seconds} secondes`;

  Speech.speak(`Kilomètre ${km}. ${time}`, { language: "fr-FR", rate: 1 });
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
  // A change of block rattles: three buzzes run together, which is the most
  // insistent thing the motor can do, because it is the one moment that asks
  // you to change what your legs are doing this second. The end of a session
  // asks for nothing, so it gets two spaced buzzes instead — the pause
  // between them is the point.
  if (label) buzz(3, TIGHT_MS);
  else buzz(2, WIDE_MS);
  if (!spoken) return;
  Speech.speak(label ?? "Séance terminée", { language: "fr-FR", rate: 1 });
}

/**
 * How far off the target pace you are, said out loud.
 *
 * Only the gap, never the pace itself: mid-effort, "twelve seconds too slow"
 * is an instruction you can act on, while "five minutes forty-two a
 * kilometre" is arithmetic you have to do first.
 */
export function announcePace(driftS: number, spoken: boolean): void {
  // Two buzzes run together. This one should be the gentlest of the four and
  // instead it cannot be: the motor has no quiet setting, and the single buzz
  // is already spoken for by the kilometre. It is told apart from a change of
  // block only by being a shorter rattle.
  buzz(2, TIGHT_MS);
  if (!spoken) return;
  const seconds = Math.abs(driftS);
  const sens = driftS > 0 ? "trop lent" : "trop rapide";
  Speech.speak(`${seconds} seconde${seconds > 1 ? "s" : ""} ${sens}`, {
    language: "fr-FR",
    rate: 1,
  });
}

/** Silence any pending speech, on finishing or discarding a run. */
export function stopSpeaking(): void {
  void Speech.stop().catch(() => undefined);
}
