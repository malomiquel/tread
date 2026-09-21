import * as Haptics from "expo-haptics";
import * as Speech from "expo-speech";
/**
 * A pattern of heavy taps, spaced.
 *
 * Built rather than borrowed. The system's ready-made notification patterns
 * are softer than a plain impact and two of them are nearly the same rhythm,
 * so success and warning were indistinguishable through a pocket. Counting
 * taps and spacing them is what makes one pattern tell itself apart from
 * another when nobody is looking at the phone.
 */
function buzz(times: number, gapMs: number, style = Haptics.ImpactFeedbackStyle.Heavy): void {
  for (let tap = 0; tap < times; tap += 1) {
    setTimeout(() => {
      void Haptics.impactAsync(style).catch(() => undefined);
    }, tap * gapMs);
  }
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
  // Two taps, unhurried: a kilometre is a thing that happened, not a thing to
  // do about it.
  buzz(2, 150);
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
  // Three quick taps for a change of block, one long one for the end of the
  // session. The urgency is in the rhythm: a block change asks for something
  // immediately, a finished session asks for nothing at all.
  if (label) buzz(3, 90);
  else buzz(1, 0);
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
  // One light tap, and deliberately the weakest of the three: drifting off
  // pace is a nudge, not an event.
  buzz(1, 0, Haptics.ImpactFeedbackStyle.Light);
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
