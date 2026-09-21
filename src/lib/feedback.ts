import * as Haptics from "expo-haptics";
import * as Speech from "expo-speech";
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
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
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
  void Haptics.notificationAsync(
    label ? Haptics.NotificationFeedbackType.Warning : Haptics.NotificationFeedbackType.Success,
  ).catch(() => undefined);
  if (!spoken) return;
  Speech.speak(label ?? "Séance terminée", { language: "fr-FR", rate: 1 });
}

/** Silence any pending speech, on finishing or discarding a run. */
export function stopSpeaking(): void {
  void Speech.stop().catch(() => undefined);
}
