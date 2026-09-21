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

/** Spoken confirmation when the app pauses or resumes on its own. */
export function announceAutoPause(paused: boolean, spoken: boolean): void {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
  if (!spoken) return;
  Speech.speak(paused ? "Pause" : "Reprise", { language: "fr-FR" });
}

/** Silence any pending speech, on finishing or discarding a run. */
export function stopSpeaking(): void {
  void Speech.stop().catch(() => undefined);
}
