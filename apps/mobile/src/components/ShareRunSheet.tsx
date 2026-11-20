import Ionicons from "@expo/vector-icons/Ionicons";
import { File, Paths } from "expo-file-system";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, useColorScheme, useWindowDimensions, View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Sharing from "expo-sharing";
import Svg, { Defs, Pattern, Rect } from "react-native-svg";
import { CardMapSource, type CardMapHandle } from "@/components/CardMapSource";
import { BOTTOM_VEIL, cardRegion, CARD_HEIGHT, CARD_WIDTH, ShareCard } from "@/components/ShareCard";
import { TrackOverlay } from "@/components/TrackOverlay";
import type { Run } from "@/lib/db";
import type { TrackPoint } from "@tread/core/geo";
import { projectPoint } from "@tread/core/geo";
import { gifFileName, paletteFor, pngToPixels, startGif } from "@tread/core/gif";
import { defineStrings, useStrings } from "@tread/core/i18n";
import { placeName } from "@/lib/location";
import { photoUri as keptPhotoUri } from "@/lib/photos";
import { readColour, stroke, veil, type Canvas } from "@tread/core/raster";
import { buildReplay, drawnSoFar, headAt } from "@tread/core/replay";
import { colors, floatingShadow, font, literalColors } from "@/lib/theme";
import { viewShot, type ViewShot } from "@/lib/viewShot";

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
type Kind = "image" | "photo" | "stage" | "clear" | "clearBlue" | "sticker" | "stickerBlue" | "gif";

/** The pictures, in the order they are swiped through. */
const KINDS: readonly Kind[] = ["image", "photo", "stage", "clear", "clearBlue", "sticker", "stickerBlue", "gif"];

/** The kinds with nothing behind them, previewed on checks and sent with their transparency. */
const CLEAR: readonly Kind[] = ["clear", "clearBlue", "sticker", "stickerBlue"];

/** The room between two pictures side by side. */
const PAGE_GAP = 14;
const PAGE = CARD_WIDTH + PAGE_GAP;

const shareStrings = defineStrings({
  fr: {
    mapFailed: "La carte n'a pas pu être dessinée. Vérifie ta connexion, puis réessaie.",
    mapRetry: "Redessiner la carte",
    mapUnreadable: "La carte n'a pas pu être lue.",
    tooShort: "Ce parcours est trop court pour être animé.",
    imageUnavailableTitle: "Image indisponible",
    imageUnavailableMessage:
      "Cette version de l'app ne peut pas produire l'image. Elle demande une version installée, pas Expo Go.",
    shareUnavailableTitle: "Partage indisponible",
    shareUnavailableMessage: "Impossible d'ouvrir la feuille de partage sur cet appareil.",
    imageFailed: "Image impossible",
    unexpected: "Erreur inattendue.",
    image: "Carte",
    photo: "Photo",
    stage: "Bleu",
    clear: "Transparent",
    clearBlue: "Transparent bleu",
    sticker: "Petit transparent",
    stickerBlue: "Petit transparent bleu",
    gif: "GIF",
    share: "Partager",
    close: "Fermer",
    choosePhoto: "Choisir une photo",
    changePhoto: "Changer de photo",
  },
  en: {
    mapFailed: "The map couldn't be drawn. Check your connection, then try again.",
    mapRetry: "Draw the map again",
    mapUnreadable: "The map couldn't be read.",
    tooShort: "This run is too short to animate.",
    imageUnavailableTitle: "Image unavailable",
    imageUnavailableMessage:
      "This version of the app can't make the image. It needs an installed build, not Expo Go.",
    shareUnavailableTitle: "Sharing unavailable",
    shareUnavailableMessage: "The share sheet can't be opened on this device.",
    imageFailed: "Couldn't make the image",
    unexpected: "Unexpected error.",
    image: "Map",
    photo: "Photo",
    stage: "Blue",
    clear: "Transparent",
    clearBlue: "Transparent blue",
    sticker: "Small transparent",
    stickerBlue: "Small transparent blue",
    gif: "GIF",
    share: "Share",
    close: "Close",
    choosePhoto: "Choose a photo",
    changePhoto: "Change photo",
  },
});

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
  const s = useStrings(shareStrings);
  const source = useRef<CardMapHandle>(null);
  // One picture per kind, all laid out side by side; the one in view is the one sent.
  const cards = useRef<Partial<Record<Kind, View | null>>>({});
  const { width: screenWidth } = useWindowDimensions();
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
  /**
   * The map could not be drawn — no network for the tiles, usually. Said,
   * rather than a spinner that never stops; a retry draws both again.
   */
  const [mapFailed, setMapFailed] = useState(false);
  const [mapAttempt, setMapAttempt] = useState(0);
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
  // The photo behind the photo card: one of the run's own to begin with,
  // or whatever the runner picks.
  const [photo, setPhoto] = useState<string | null>(run.photos[0] ? keptPhotoUri(run.photos[0]) : null);

  async function pickPhoto() {
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"], quality: 0.9,
    }).catch(() => null);
    const chosen = picked && !picked.canceled ? picked.assets[0]?.uri : undefined;
    if (chosen) setPhoto(chosen);
  }


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
      // Never a blank sent: the button turns into a way to try again.
      .catch(() => setMapFailed(true));
  }

  /** The same map again, without its track, for the animation to draw over. */
  function renderBareMap() {
    if (bareMap) return;
    void bareSource.current
      ?.render()
      .then(setBareMap)
      .catch(() => setMapFailed(true));
  }

  /**
   * The card as pixels, photographed once.
   *
   * Captured at the card's own size rather than at the three device pixels
   * per point a phone screen would give: nine times the pixels would be nine
   * times the decoding, and a file too large to send.
   */
  async function photograph(shot: ViewShot) {
    const uri = await shot.captureRef(cards.current.gif as View, {
      format: "png", quality: 1, result: "tmpfile",
      width: CARD_WIDTH, height: CARD_HEIGHT,
    });
    const file = new File(uri.startsWith("file://") ? uri : `file://${uri}`);
    const pixels = pngToPixels(await file.bytes());
    file.delete();
    if (!pixels) throw new Error(shareStrings().mapUnreadable);
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
    if (!replay || !region) throw new Error(shareStrings().tooShort);

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
    file.writeSync(gif.finish());
    return file.uri;
  }

  async function share() {
    if (sharing || !ready) return;
    const shot = viewShot();
    if (!shot) {
      Alert.alert(
        s.imageUnavailableTitle,
        s.imageUnavailableMessage,
      );
      return;
    }

    setSharing(true);
    try {
      const animated = kind === "gif";
      const uri = animated
        ? await makeGif(shot)
        : await shot.captureRef(cards.current[kind] as View, { format: "png", quality: 1, result: "tmpfile" });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: animated ? "image/gif" : "image/png",
          UTI: animated ? "com.compuserve.gif" : "public.png",
        });
      } else {
        Alert.alert(s.shareUnavailableTitle, s.shareUnavailableMessage);
      }
    } catch (cause) {
      Alert.alert(s.imageFailed, cause instanceof Error ? cause.message : s.unexpected);
    } finally {
      setSharing(false);
      setMade(null);
      setProgress(1);
    }
  }

  const animated = kind === "gif";
  const ready = animated ? bareMap !== null
    : kind === "image" ? mapUri !== null
    : kind === "photo" ? photo !== null
    : true;

  return (
    <View style={styles.backdrop}>
      {/* Behind everything rather than around it: wrapped around the
          pictures, it took their swipe for a tap. */}
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel={s.close} />

      <View style={styles.stack}>
        {/* Every kind side by side, swiped through like photos: the
            pictures say what they are better than their names would. */}
        <ScrollView
          horizontal
          snapToInterval={PAGE}
          decelerationRate="fast"
          showsHorizontalScrollIndicator={false}
          scrollEnabled={!sharing}
          style={{ width: screenWidth, flexGrow: 0 }}
          contentContainerStyle={{ paddingHorizontal: (screenWidth - CARD_WIDTH) / 2, gap: PAGE_GAP }}
          onMomentumScrollEnd={(event) => {
            const index = Math.round(event.nativeEvent.contentOffset.x / PAGE);
            setKind(KINDS[Math.max(0, Math.min(KINDS.length - 1, index))]);
          }}
        >
          {KINDS.map((which) => (
            <View key={which} style={styles.cardShadow} accessible accessibilityLabel={s[which]}>
              {/* A transparent picture is shown on the checks every editor
                  uses for "nothing here". Under the card, never in it: the
                  checks are not captured. */}
              {CLEAR.includes(which) ? <Checks /> : null}
              <ShareCard
                ref={(view) => { cards.current[which] = view; }}
                run={run}
                variant={which === "photo" ? "photo" : which === "stage" ? "stage" : CLEAR.includes(which) ? "clear" : "map"}
                ink={which === "clearBlue" || which === "stickerBlue" ? "blue" : "white"}
                compact={which === "sticker" || which === "stickerBlue"}
                photoUri={photo}
                points={points}
                // The animation draws its own line over the map that has
                // none; until that map arrives it shows the other one.
                mapUri={which === "gif" ? bareMap ?? mapUri : mapUri}
                place={place}
                // Only over the bare map, and gone while the file is made:
                // the frames start from a photograph of this card.
                overlay={which === "gif" && bareMap !== null && made === null
                  ? <TrackOverlay points={points} progress={progress} />
                  : null}
              />
              {/* No photo yet: the card itself asks for one. Over the card,
                  not in it, so it is never part of what is sent. */}
              {which === "photo" && photo === null ? (
                <Pressable
                  onPress={() => void pickPhoto()}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.pickPhoto, pressed && styles.pressed]}
                >
                  <Ionicons name="image-outline" size={28} color={literalColors.background.light} />
                  <Text style={styles.underText}>{s.choosePhoto}</Text>
                </Pressable>
              ) : null}
            </View>
          ))}
        </ScrollView>

        <View style={styles.bar}>
          {/* Where you are among the pictures, and how many there are. */}
          <View style={styles.dots}>
            {KINDS.map((which) => (
              <View key={which} style={[styles.dot, kind === which && styles.dotOn]} />
            ))}
          </View>

          {ready ? (
            <Pressable
              onPress={() => void share()}
              disabled={sharing}
              accessibilityRole="button"
              accessibilityLabel={s.share}
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
          ) : kind === "photo" ? (
            // Waiting on a photo, not on something loading: the button is
            // there, faded, until one is chosen.
            <View style={[styles.send, styles.sending]}>
              <Ionicons name="arrow-up" size={19} color={colors.accentText} />
            </View>
          ) : mapFailed ? (
            <Pressable
              onPress={() => {
                setMapFailed(false);
                setMapAttempt((n) => n + 1);
              }}
              accessibilityRole="button"
              accessibilityLabel={s.mapRetry}
              hitSlop={8}
              style={({ pressed }) => [styles.send, pressed && styles.pressed]}
            >
              <Ionicons name="refresh" size={19} color={colors.accentText} />
            </Pressable>
          ) : (
            <View style={styles.send}>
              <ActivityIndicator size="small" color={colors.accentText} />
            </View>
          )}
        </View>
        {/* One line of room kept under the row, whatever is chosen, so
            switching kinds never moves the picture. */}
        <View style={styles.under}>
          {kind === "photo" && photo !== null ? (
            <Pressable
              onPress={() => void pickPhoto()}
              disabled={sharing}
              accessibilityRole="button"
              hitSlop={8}
              style={({ pressed }) => [styles.photoButton, pressed && styles.pressed]}
            >
              <Ionicons name="image-outline" size={17} color={literalColors.background.light} />
              <Text style={styles.underText}>{s.changePhoto}</Text>
            </Pressable>
          ) : mapFailed ? (
            <Text style={styles.mapFailed}>{s.mapFailed}</Text>
          ) : null}
        </View>
      </View>

      {!mapUri && !mapFailed && (
        <CardMapSource key={`map-${mapAttempt}`} ref={source} points={points} onReady={renderMap} />
      )}
      {/* Drawn from the moment the sheet opens rather than when the animation
          is chosen. It takes a second or two, and asking for it on the tap is
          what made choosing the animation feel like waiting for something. */}
      {!bareMap && !mapFailed && (
        <CardMapSource key={`bare-${mapAttempt}`} ref={bareSource} points={points} bare onReady={renderBareMap} />
      )}
    </View>
  );
}

/** The grey and white checks that mean "transparent". */
function Checks() {
  return (
    <Svg width={CARD_WIDTH} height={CARD_HEIGHT} style={StyleSheet.absoluteFill}>
      <Defs>
        <Pattern id="checks" width={16} height={16} patternUnits="userSpaceOnUse">
          <Rect width={16} height={16} fill="#5a5a5a" />
          <Rect width={8} height={8} fill="#6e6e6e" />
          <Rect x={8} y={8} width={8} height={8} fill="#6e6e6e" />
        </Pattern>
      </Defs>
      <Rect width={CARD_WIDTH} height={CARD_HEIGHT} fill="url(#checks)" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: VIEWING_DARK,
    alignItems: "center", justifyContent: "center", paddingVertical: 16,
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
  dots: { flexDirection: "row", gap: 6, alignItems: "center" },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(255, 255, 255, 0.3)" },
  dotOn: { width: 18, backgroundColor: literalColors.background.light },
  pickPhoto: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "rgba(0, 0, 0, 0.35)",
  },
  under: { width: CARD_WIDTH, minHeight: 22, alignItems: "center", justifyContent: "center" },
  photoButton: { flexDirection: "row", alignItems: "center", gap: 6 },
  underText: {
    color: literalColors.background.light, fontSize: 14.5, fontFamily: font.medium, textAlign: "center",
  },
  pressed: { opacity: 0.6 },

  // Round, and the only thing on the row wearing the accent: there is one
  // action here, and it should be findable without being read.
  send: {
    minWidth: 42, height: 42, borderRadius: 21, paddingHorizontal: 12,
    alignItems: "center", justifyContent: "center", backgroundColor: colors.accent,
  },
  sending: { opacity: 0.75 },
  // On the dark backdrop, which is always dark: the light ink of the page.
  mapFailed: {
    width: CARD_WIDTH, color: literalColors.background.light, fontSize: 14.5,
    fontFamily: font.regular, textAlign: "center",
  },
  sendLabel: {
    color: colors.accentText, fontSize: 14.5, fontFamily: font.semibold,
    fontVariant: ["tabular-nums"],
  },
});
