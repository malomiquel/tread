import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";
import { getSettings } from "@/lib/settings";

/**
 * The cards' sounds, made for them (ElevenLabs sound effects, trimmed and
 * levelled) and shipped inside the app, so nothing is ever fetched to play
 * one. Only the cards make a sound: a run, a record or a button does not.
 *
 * Quiet by design: they mix with whatever is already playing, never pause a
 * runner's music, and follow the silent switch, as every sound that is not a
 * call or an alarm should. The setting in Settings › App turns them all off.
 */
const SOURCES = {
  cardFlip: require("../../assets/sounds/card-flip.m4a"),
  cardTrait: require("../../assets/sounds/card-trait.m4a"),
  cardRare: require("../../assets/sounds/card-rare.m4a"),
  cardLegendary: require("../../assets/sounds/card-legendary.m4a"),
} as const;

export type Sound = keyof typeof SOURCES;

/** One player per sound, made on first use and kept: replaying one is a seek, not a load. */
const players = new Map<Sound, AudioPlayer>();
let ready: Promise<void> | null = null;

function prepare(): Promise<void> {
  ready ??= setAudioModeAsync({ playsInSilentMode: false, interruptionMode: "mixWithOthers" }).catch(() => undefined);
  return ready;
}

/**
 * Plays a sound from its start, cutting off the same sound if it was still
 * ringing. Silent when sounds are off; never throws, since no sound is worth
 * a failed tap.
 */
export function playSound(sound: Sound): void {
  if (!getSettings().sounds) return;
  void prepare().then(() => {
    try {
      let player = players.get(sound);
      if (!player) {
        player = createAudioPlayer(SOURCES[sound]);
        players.set(sound, player);
      } else {
        void player.seekTo(0).catch(() => undefined);
      }
      player.play();
    } catch {
      // A sound that cannot play is simply not heard.
    }
  });
}
