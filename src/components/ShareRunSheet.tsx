import Ionicons from "@expo/vector-icons/Ionicons";
import { File, Paths } from "expo-file-system";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, Alert, Modal, Platform, Pressable, StyleSheet, Text, TurboModuleRegistry,
  useColorScheme, View,
} from "react-native";
import * as Sharing from "expo-sharing";
import { CardMapSource, type CardMapHandle } from "@/components/CardMapSource";
import { BOTTOM_VEIL, cardRegion, CARD_HEIGHT, CARD_WIDTH, ShareCard } from "@/components/ShareCard";
import { TrackOverlay } from "@/components/TrackOverlay";
import type { Run } from "@/lib/db";
import type { TrackPoint } from "@/lib/geo";
import { projectPoint } from "@/lib/geo";
import { gifFileName, paletteFor, pngToPixels, startGif } from "@/lib/gif";
import { placeName } from "@/lib/location";
import { readColour, stroke, veil, type Canvas } from "@/lib/raster";
import { buildReplay, drawnSoFar, headAt } from "@/lib/replay";
import { colors, floatingShadow, font, literalColors } from "@/lib/theme";

/**
 * How many frames the animation is made of, and how long each is held.
 *
 * Thirty at eighty milliseconds is about two and a half seconds of drawing,
 * which is as long as anybody watches a picture in a message before scrolling
 * past it.
 *
 * It used to be a capture and a PNG decode per frame — the two most expensive
 * things a phone can be asked for, done forty times, which took the better
 * part of a minute and showed every step of it. The card is now photographed
 * once and the line drawn into those pixels directly, so a frame costs a
 * palette pass and nothing else.
 */
const FRAMES = 30;
const FRAME_MS = 80;

/** Matches the weight the card's own map draws its track at. */
const STROKE_RADIUS = 1.3;

/**
 * How long the finished run is held before the loop starts again.
 *
 * Long enough to read the distance, and no longer. At a second and a half the
 * animation read as having stopped and then thought better of it — the eye
 * finishes with a picture well before a clock does, and the wait after the
 * last stroke is the part of a loop nobody is watching for.
 */
const HOLD_MS = 650;

/** How long the preview takes to draw the run, matching the file it describes. */
const PREVIEW_MS = FRAMES * FRAME_MS;

/** What the sheet is set to produce. */
type Kind = "image" | "gif";

/**
 * The dark behind the card, darker than the app's own scrim and fixed in
 * both appearances.
 *
 * Every other dialog in the app veils a page somebody is coming back to, so
 * it lets that page show through. This one is not a dialog over a page: it is
 * a picture being looked at, and what surrounds a picture should get out of
 * its way. The card carries its own colours whatever the phone is set to —
 * it has to, since it outlives the moment it was made — and the room it is
 * held up in follows the same rule.
 */
const VIEWING_DARK = "rgba(0, 0, 0, 0.82)";

/**
 * Waits for what was just set to have been drawn.
 *
 * Two frames rather than one: the first is the one React renders into, the
 * second is the one the native view has actually been laid out and drawn in.
 * Capturing after a single frame catches the previous state often enough to
 * show up as an animation that stutters backwards.
 */
const drawn = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });

type ViewShot = typeof import("react-native-view-shot");

let loaded: ViewShot | null | undefined;

/**
 * The screenshot library, or null where its native half is missing.
 *
 * Probed rather than imported, and the distinction matters more here than
 * anywhere else in the app: this library resolves its native module with
 * `getEnforcing`, which throws at import time. A plain import therefore takes
 * down the whole run screen wherever the native side is absent — Expo Go, for
 * one — rather than merely disabling the button it belongs to.
 *
 * The same shape as the HealthKit guard, for the same reason: ask the
 * registry first, because asking the registry cannot throw.
 */
function viewShot(): ViewShot | null {
  if (loaded !== undefined) return loaded;
  if (Platform.OS === "web") return (loaded = null);
  try {
    loaded = TurboModuleRegistry.get("RNViewShot")
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      ? (require("react-native-view-shot") as ViewShot)
      : null;
  } catch {
    loaded = null;
  }
  return loaded;
}

/** Whether a run can be turned into a picture on this device at all. */
export const canShareImage = (): boolean => viewShot() !== null;

interface Props {
  visible: boolean;
  run: Run;
  points: TrackPoint[];
  /**
   * The map, already rendered by the screen underneath while the user was
   * reading it. Supplied, the sheet opens finished; absent — the picture
   * failed, or arrived late — it falls back to drawing its own.
   */
  preparedMapUri?: string | null;
  onClose: () => void;
}

/**
 * The sheet's body is mounted only while it is open, and that is deliberate
 * rather than an optimisation. A modal keeps its children alive when it
 * closes, so a map that has already announced itself ready would never
 * announce it again — reopening would show a card whose map never redraws.
 * Unmounting starts the whole sequence over, and clears the rendered file
 * along the way, which is right anyway since the phone may have switched to
 * dark in the meantime.
 */
export function ShareRunSheet({ visible, run, points, preparedMapUri, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      {visible ? (
        <Sheet run={run} points={points} preparedMapUri={preparedMapUri} onClose={onClose} />
      ) : null}
    </Modal>
  );
}

/**
 * The preview and the share sheet for a run's picture.
 *
 * The map is shown live at first and only then replaced by the file it was
 * rendered to. That order matters: a map view captured along with everything
 * around it can come back blank, while a map asked to draw itself to a file
 * always draws. And because the swap happens before the button becomes
 * available, what is shared is exactly what was on screen.
 */
function Sheet({ run, points, preparedMapUri, onClose }: Omit<Props, "visible">) {
  // The map is photographed in the appearance the phone is in, so the line
  // drawn over it has to follow — a dark cobalt over a dark map is a route
  // nobody can see.
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const source = useRef<CardMapHandle>(null);
  const card = useRef<View>(null);
  // Seeded rather than derived: the body is mounted afresh each time the sheet
  // opens, so whatever was ready at that moment is simply where it starts.
  const [mapUri, setMapUri] = useState<string | null>(preparedMapUri ?? null);
  /** Where the run started, once the lookup answers. Null is a fine answer. */
  const [place, setPlace] = useState<string | null>(null);
  const [kind, setKind] = useState<Kind>("image");
  /**
   * The same map without its track, for the animation to draw its own over.
   *
   * A second picture rather than the one above, because the line has to come
   * from one place or the other: baked into the photograph it cannot move,
   * drawn on top of a photograph that already has one it would be doubled.
   */
  const bareSource = useRef<CardMapHandle>(null);
  const [bareMap, setBareMap] = useState<string | null>(null);
  /** How far along the drawing is, from nought to one. */
  const [progress, setProgress] = useState(1);
  /** Frames written so far, while an animation is being made. */
  const [made, setMade] = useState<number | null>(null);

  // Looked up from the first fix rather than the last: a run that ends
  // somewhere else started here, and where you set off is what you would say
  // if somebody asked.
  useEffect(() => {
    let live = true;
    const start = points[0];
    if (!start) return;
    void placeName(start.lat, start.lng).then((found) => live && setPlace(found));
    return () => { live = false; };
  }, [points]);
  const [sharing, setSharing] = useState(false);

  /**
   * The preview draws itself, over and over, while the animation is the
   * chosen kind.
   *
   * It is the same line the file will hold, so this is not decoration: it is
   * the only way to know what is about to be shared before spending the
   * seconds it takes to make it. Still while the file is being written, since
   * the card is being read from at that moment.
   */
  useEffect(() => {
    if (kind !== "gif" || bareMap === null || sharing) return;
    const startedAt = Date.now();
    const timer = setInterval(() => {
      const loop = (Date.now() - startedAt) % (PREVIEW_MS + HOLD_MS);
      setProgress(Math.min(1, loop / PREVIEW_MS));
    }, 60);
    return () => {
      clearInterval(timer);
      setProgress(1);
    };
  }, [kind, bareMap, sharing]);

  /** Only ever runs when the screen underneath did not get there first. */
  function renderMap() {
    if (mapUri) return;
    void source.current
      ?.render()
      .then(setMapUri)
      .catch(() => {
        /* the share button stays out of reach rather than sending a blank */
      });
  }

  /** The same map again, without its track, for the animation to draw over. */
  function renderBareMap() {
    if (bareMap) return;
    void bareSource.current
      ?.render()
      .then(setBareMap)
      .catch(() => {
        /* the animation stays out of reach rather than sending a blank */
      });
  }

  /**
   * The card as pixels, photographed once.
   *
   * Captured at the card's own size rather than at the three device pixels
   * per point a phone screen would give: nine times the pixels would be nine
   * times the decoding, and a file too large to send.
   */
  async function photograph(shot: ViewShot) {
    const uri = await shot.captureRef(card, {
      format: "png", quality: 1, result: "tmpfile",
      width: CARD_WIDTH, height: CARD_HEIGHT,
    });
    const file = new File(uri.startsWith("file://") ? uri : `file://${uri}`);
    const pixels = pngToPixels(await file.bytes());
    file.delete();
    if (!pixels) throw new Error("La carte n'a pas pu être lue.");
    return pixels;
  }

  /**
   * Draws the run into one GIF.
   *
   * One photograph, thirty frames. The card is captured once without its
   * line, and every frame after that is the same pixels with a little more
   * route drawn into them — so the line only ever grows, and a frame costs
   * the few hundred dabs of colour it adds plus the palette pass, rather
   * than a screen capture and a PNG decode.
   *
   * The finished frame is built first, before any of the others, and it is
   * the only one holding every colour the animation will ever show — map,
   * whole line, type. Its palette is then the palette of the file, which
   * saves quantising each frame against a different table, the visible
   * symptom of which is a map that flickers between shades as the line grows.
   */
  async function makeGif(shot: ViewShot) {
    const replay = buildReplay(points, 400);
    const region = cardRegion(points);
    if (!replay || !region) throw new Error("Ce parcours est trop court pour être animé.");

    setMade(0);
    await drawn();
    const photo = await photograph(shot);
    const canvas: Canvas = { rgba: photo.rgba, width: photo.width, height: photo.height };
    const scale = photo.width / CARD_WIDTH;
    const ink = readColour(literalColors.track[scheme]);
    const dim = veil(photo.height, BOTTOM_VEIL * scale);
    const at = (point: { lat: number; lng: number }) => {
      const { x, y } = projectPoint(region, point, CARD_WIDTH, CARD_HEIGHT);
      return { x: x * scale, y: y * scale };
    };

    /** Draws the route up to a given share of the way through. */
    const drawUpTo = (share: number) => {
      for (const leg of drawnSoFar(replay, headAt(replay, share))) {
        for (let i = 1; i < leg.length; i += 1) {
          stroke(canvas, at(leg[i - 1]), at(leg[i]), ink, STROKE_RADIUS * scale, dim);
        }
      }
    };

    // The whole line first, for its colours, on a copy that is then thrown
    // away — the frames have to start from a card with nothing drawn on it.
    const bare = photo.rgba.slice();
    drawUpTo(1);
    const finished = photo.rgba.slice();
    const palette = paletteFor(finished);
    canvas.rgba.set(bare);

    const gif = startGif(photo.width, photo.height, palette);
    for (let index = 0; index < FRAMES; index += 1) {
      const share = index / (FRAMES - 1);
      // Only the new stretch is drawn: what came before is already in the
      // buffer, because the line never shrinks.
      for (const leg of drawnSoFar(replay, headAt(replay, share))) {
        for (let i = 1; i < leg.length; i += 1) {
          stroke(canvas, at(leg[i - 1]), at(leg[i]), ink, STROKE_RADIUS * scale, dim);
        }
      }
      gif.add(canvas.rgba, FRAME_MS);
      setMade(index + 1);
      // Handed back to the interface every few frames so the count moves and
      // the sheet still answers a tap.
      if (index % 5 === 0) await drawn();
    }
    // The end, held: a loop that snaps back the instant it arrives never lets
    // anybody read the distance it just spent two seconds drawing.
    gif.add(finished, HOLD_MS);

    const file = new File(Paths.cache, gifFileName(run.name, run.startedAt));
    file.create({ overwrite: true });
    file.write(gif.finish());
    return file.uri;
  }

  async function share() {
    if (sharing || !ready) return;
    const shot = viewShot();
    if (!shot) {
      Alert.alert(
        "Image indisponible",
        "Cette version de l'app ne peut pas produire l'image. Elle demande une version installée, pas Expo Go.",
      );
      return;
    }

    setSharing(true);
    try {
      const animated = kind === "gif";
      const uri = animated
        ? await makeGif(shot)
        : await shot.captureRef(card, { format: "png", quality: 1, result: "tmpfile" });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: animated ? "image/gif" : "image/png",
          UTI: animated ? "com.compuserve.gif" : "public.png",
        });
      } else {
        Alert.alert("Partage indisponible", "Impossible d'ouvrir la feuille de partage sur cet appareil.");
      }
    } catch (cause) {
      Alert.alert("Image impossible", cause instanceof Error ? cause.message : "Erreur inattendue.");
    } finally {
      setSharing(false);
      setMade(null);
      setProgress(1);
    }
  }

  const animated = kind === "gif";
  /**
   * The animation needs its own photograph of the map, without the track.
   *
   * Until it arrives the card keeps the one it already has, line and all, so
   * that choosing the animation never empties the picture in front of you.
   * The two are the same map at the same framing, so the swap, when it comes,
   * moves nothing.
   */
  const showBare = animated && bareMap !== null;
  const ready = animated ? bareMap !== null : mapUri !== null;

  return (
    <Pressable style={styles.backdrop} onPress={onClose}>
      {/* Stops a tap on the card from closing the sheet. */}
      <Pressable onPress={() => undefined} style={styles.stack}>
        <View style={styles.cardShadow}>
          <ShareCard
            ref={card}
            run={run}
            // The animation draws its own line, so it is given the map that
            // has none; the still keeps the one with the track drawn in.
            mapUri={showBare ? bareMap : mapUri}
            place={place}
            // Only over the bare map. Over the other one it would be a second
            // line on top of the one already in the photograph.
            overlay={showBare ? <TrackOverlay points={points} progress={progress} /> : null}
          />
        </View>

        {/* One row under the picture, and nothing else.
            What was here before was two buttons the width of the card — a
            cancel that repeated what tapping the backdrop already does, and
            a share sized as though it were the page's subject. It is not:
            the picture is. So the choice of what to send sits on the left,
            the sending on the right, and both are as small as a thumb allows.

            The row is also where the next option goes — a card without the
            map, a square crop — which is the other reason it is a row rather
            than a pair of buttons. */}
        <View style={styles.bar}>
          <View style={styles.kinds}>
            {([["image", "Image"], ["gif", "GIF"]] as const).map(([which, label]) => (
              <Pressable
                key={which}
                onPress={() => setKind(which)}
                disabled={sharing}
                accessibilityRole="button"
                accessibilityState={{ selected: kind === which }}
                hitSlop={6}
                style={({ pressed }) => [
                  styles.kind,
                  kind === which && styles.kindOn,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.kindLabel, kind === which && styles.kindLabelOn]}>
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>

          {ready ? (
            <Pressable
              onPress={() => void share()}
              disabled={sharing}
              accessibilityRole="button"
              accessibilityLabel="Partager"
              hitSlop={8}
              style={({ pressed }) => [styles.send, pressed && styles.pressed, sharing && styles.sending]}
            >
              {/* The count only while there is one. A label that changes
                  width mid-press would jump the row about. */}
              {made !== null ? (
                <Text style={styles.sendLabel}>{`${made} / ${FRAMES}`}</Text>
              ) : sharing ? (
                <ActivityIndicator size="small" color={colors.accentText} />
              ) : (
                <Ionicons name="arrow-up" size={19} color={colors.accentText} />
              )}
            </Pressable>
          ) : (
            <View style={styles.send}>
              <ActivityIndicator size="small" color={colors.accentText} />
            </View>
          )}
        </View>
      </Pressable>

      {!mapUri && <CardMapSource ref={source} points={points} onReady={renderMap} />}
      {/* Drawn from the moment the sheet opens rather than when the animation
          is chosen. It takes a second or two, and asking for it on the tap is
          what made choosing the animation feel like waiting for something. */}
      {!bareMap && <CardMapSource ref={bareSource} points={points} bare onReady={renderBareMap} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: VIEWING_DARK,
    alignItems: "center", justifyContent: "center", padding: 16,
  },
  // A card this tall leaves little room around it, so the margins stay narrow
  // and everything under it is one row.
  stack: { alignItems: "center", gap: 14 },
  // The shadow sits on a wrapper rather than on the card: the card is what
  // gets captured, and a shadow would be baked into the shared image.
  cardShadow: { width: CARD_WIDTH, height: CARD_HEIGHT, ...floatingShadow },
  // Sits under the card, edge to edge with it, so the picture keeps the whole
  // of the attention and the controls read as its caption.
  bar: {
    width: CARD_WIDTH, flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", gap: 12,
  },
  kinds: { flexDirection: "row", gap: 4, padding: 3, borderRadius: 16, backgroundColor: colors.background },
  kind: { paddingHorizontal: 13, paddingVertical: 6, borderRadius: 13 },
  kindOn: { backgroundColor: colors.accentSoft },
  kindLabel: { color: colors.muted, fontSize: 14, fontFamily: font.medium },
  kindLabelOn: { color: colors.accent, fontFamily: font.semibold },
  pressed: { opacity: 0.6 },

  // Round, and the only thing on the row wearing the accent: there is one
  // action here, and it should be findable without being read.
  send: {
    minWidth: 42, height: 42, borderRadius: 21, paddingHorizontal: 12,
    alignItems: "center", justifyContent: "center", backgroundColor: colors.accent,
  },
  sending: { opacity: 0.75 },
  sendLabel: {
    color: colors.accentText, fontSize: 14.5, fontFamily: font.semibold,
    fontVariant: ["tabular-nums"],
  },
});
