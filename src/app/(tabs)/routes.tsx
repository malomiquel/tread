import Ionicons from "@expo/vector-icons/Ionicons";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { useFocusEffect, useRouter, useScrollToTop } from "expo-router";
import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator, Alert, FlatList, Image, Pressable, StyleSheet, Text, useColorScheme, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Polyline } from "react-native-svg";
import { Button } from "@/components/Button";
import { SwipeToDelete } from "@/components/SwipeToDelete";
import { RouteSnapshot, type RouteSnapshotHandle } from "@/components/RouteSnapshot";
import { deleteRoute, listRoutes, saveRoute, setRoutePreview } from "@/lib/db";
import { formatDistance } from "@/lib/format";
import { useTabBarSpace } from "@/lib/layout";
import { parseGpxLine } from "@/lib/gpx";
import { placeName } from "@/lib/location";
import { autoRouteName, drawnLine, isLoop, routeFromLine, thumbnail, type StoredRoute } from "@/lib/route";
import { setRoute, useSettings } from "@/lib/settings";
import { colors, font, literalColors } from "@/lib/theme";

/**
 * The shape of the picture kept of each route, and so of the row it sits in.
 *
 * The same ratio the snapshot is taken at, so nothing is cropped or
 * stretched between the two.
 */
const PREVIEW_RATIO = 800 / 340;

/** Side of the drawn shape, for routes with no picture. */
const SHAPE = 96;

/**
 * What a route looks like: its map if one was kept, its bare shape otherwise.
 *
 * The picture is taken once, when the route is drawn, and only routes drawn
 * before the app learned to do that have none. Those fall back to the shape
 * alone, which is recognisable anyway — nobody identifies their saturday loop
 * by the street names on it.
 */
function RouteLook({ route }: { route: StoredRoute }) {
  const scheme = useColorScheme() === "dark" ? "dark" : "light";

  if (route.preview) {
    return <Image source={{ uri: route.preview }} style={styles.preview} resizeMode="cover" />;
  }

  const shape = thumbnail(drawnLine(route), SHAPE);
  return (
    <View style={[styles.preview, styles.shapeOnly]}>
      {shape.length > 1 ? (
        <Svg width={SHAPE} height={SHAPE}>
          <Polyline
            points={shape.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ")}
            stroke={literalColors.track[scheme]}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </Svg>
      ) : null}
    </View>
  );
}

/**
 * The routes drawn to be run.
 *
 * A tab rather than a button on the map, which is where this started. A route
 * outlives the run it was drawn for — it is used again next week, renamed,
 * thrown away — and none of that belongs behind a control that only exists
 * while you are standing on a start line.
 *
 * Choosing one here is the same act as choosing it there: the running screen
 * reads the same setting and draws whatever it names under your track.
 */
export default function RoutesScreen() {
  const list = useRef<FlatList<StoredRoute>>(null);
  useScrollToTop(list);
  const router = useRouter();
  const tabBarSpace = useTabBarSpace();
  const chosen = useSettings().routeId;
  const [routes, setRoutes] = useState<StoredRoute[] | null>(null);
  const [importing, setImporting] = useState(false);
  const camera = useRef<RouteSnapshotHandle>(null);
  /** Routes already photographed in this session, so none is done twice. */
  const shot = useRef(new Set<number>());

  /**
   * Photograph the routes that have no picture yet, one at a time.
   *
   * A route drawn in the editor is photographed there, by the map that is
   * already on screen with it. One that arrived from a file has never been on
   * any map — so the list takes it here, off screen, the first time it shows
   * it. Doing it for anything missing a picture rather than at the moment of
   * import also mends the routes drawn before the app took pictures at all.
   *
   * One at a time because they share one map, and quietly: a picture that
   * cannot be taken leaves the row drawing the bare shape, which is what it
   * was doing anyway.
   */
  const photograph = useCallback(async (found: StoredRoute[]) => {
    for (const route of found) {
      if (route.preview || shot.current.has(route.id) || route.waypoints.length < 2) continue;
      shot.current.add(route.id);

      const taken = await camera.current?.capture(route);
      if (!taken) continue;
      await setRoutePreview(route.id, taken).catch(() => undefined);
      setRoutes((current) => (current ?? []).map((item) =>
        (item.id === route.id ? { ...item, preview: taken } : item)));
    }
  }, []);

  const load = useCallback(() => {
    listRoutes()
      .then((found) => {
        setRoutes(found);
        void photograph(found);
      })
      .catch(() => setRoutes([]));
  }, [photograph]);

  // Reloaded on every arrival: the last thing somebody did before coming back
  // here was probably draw the route they are about to pick.
  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  /**
   * Bring routes in from GPX files.
   *
   * The format every planner and every watch speaks, which is what makes a
   * route drawn on a computer runnable here — and the same door the runs
   * already come in through.
   *
   * What arrives is a line with no decisions in it, so handles are invented
   * along it at even intervals: the geometry is kept exactly as the file has
   * it, and the handles are only somewhere to take hold. An imported route is
   * then editable like a drawn one, which is the whole point of importing it
   * rather than just looking at it.
   */
  async function importGpx() {
    if (importing) return;
    setImporting(true);
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        // Loose on purpose: a GPX arrives declared as XML, as plain text or
        // as nothing at all depending on where it was written.
        type: ["application/gpx+xml", "application/xml", "text/xml", "*/*"],
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (picked.canceled) return;

      let added = 0;
      let empty = 0;
      for (const asset of picked.assets) {
        try {
          const { name, line } = parseGpxLine(await new File(asset.uri).text());
          if (line.length < 2) {
            empty += 1;
            continue;
          }

          const place = await placeName(line[0].lat, line[0].lng);
          // No picture: the map that would take one is not on screen here.
          // The list draws the bare shape instead, which is recognisable
          // enough, and a route opened and saved once gets its picture.
          await saveRoute(
            name?.trim() || autoRouteName(Date.now()),
            routeFromLine(line),
            { place, preview: null },
          );
          added += 1;
        } catch {
          empty += 1;
        }
      }

      load();
      Alert.alert(
        "Import terminé",
        [
          added > 0 ? `${added} parcours ajouté${added > 1 ? "s" : ""}` : null,
          empty > 0 ? `${empty} fichier${empty > 1 ? "s" : ""} sans tracé` : null,
        ].filter(Boolean).join(" · ") || "Aucun tracé dans ces fichiers.",
      );
    } catch (cause) {
      Alert.alert("Import impossible", cause instanceof Error ? cause.message : "Erreur inattendue.");
    } finally {
      setImporting(false);
    }
  }

  function remove(route: StoredRoute) {
    Alert.alert(
      "Supprimer ce parcours ?",
      `${route.name}, ${formatDistance(route.distanceM)} km. Tes courses ne sont pas touchées.`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: () => {
            // A deleted route must stop being the chosen one, or the running
            // screen would keep a setting pointing at nothing.
            if (chosen === route.id) void setRoute(null);
            setRoutes((current) => (current ?? []).filter((item) => item.id !== route.id));
            void deleteRoute(route.id).catch(load);
          },
        },
      ],
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.fill}>
        <View style={styles.head}>
          <View style={styles.headText}>
            <Text style={styles.title}>Parcours</Text>
            {routes && routes.length > 0 ? (
              <Text style={styles.subtitle}>
                {chosen === null
                  ? "Touche pour modifier, ▶ pour partir courir dessus"
                  : "Celui qui est coché sera tracé sur ta carte"}
              </Text>
            ) : null}
          </View>
          <View style={styles.ways}>
            {/* Two ways in, because a route can be drawn here or brought from
                anywhere else: a planner on a computer, a watch, a friend. */}
            <Pressable
              onPress={() => void importGpx()}
              disabled={importing}
              accessibilityRole="button"
              accessibilityLabel="Importer un parcours GPX"
              hitSlop={10}
              style={({ pressed }) => [styles.draw, pressed && styles.pressed]}
            >
              {importing ? (
                <ActivityIndicator size="small" color={colors.accent} />
              ) : (
                <Ionicons name="download-outline" size={20} color={colors.text} />
              )}
            </Pressable>
            <Pressable
              onPress={() => router.push({ pathname: "/route/[id]", params: { id: "new" } })}
              accessibilityRole="button"
              accessibilityLabel="Dessiner un parcours"
              hitSlop={10}
              style={({ pressed }) => [styles.draw, pressed && styles.pressed]}
            >
              <Ionicons name="add" size={23} color={colors.text} />
            </Pressable>
          </View>
        </View>

        <FlatList
          ref={list}
          data={routes ?? []}
          keyExtractor={(route) => String(route.id)}
          contentContainerStyle={{ paddingBottom: tabBarSpace + 60 }}
          ListEmptyComponent={
            routes === null ? null : (
              <View style={styles.emptyBlock}>
                <Text style={styles.empty}>
                  Aucun parcours pour l&apos;instant. Dessines-en un en touchant la carte — chaque
                  point rejoint le précédent en suivant les rues — ou importe un fichier GPX.
                </Text>
                    <Button
                  label="Dessiner un parcours"
                  onPress={() => router.push({ pathname: "/route/[id]", params: { id: "new" } })}
                />
              </View>
            )
          }
          renderItem={({ item }) => {
            const on = chosen === item.id;
            return (
              <SwipeToDelete label={item.name} onDelete={() => remove(item)}>
                <View style={styles.card}>
                  {/* The picture opens the route, the way a row of the history
                      opens a run. Everything a list holds should be openable
                      by touching it. */}
                  <Pressable
                    onPress={() => router.push({ pathname: "/route/[id]", params: { id: String(item.id) } })}
                    accessibilityRole="button"
                    accessibilityLabel={`${item.name}, modifier`}
                    style={({ pressed }) => [styles.body, pressed && styles.pressedRow]}
                  >
                    <RouteLook route={item} />

                    <View style={styles.caption}>
                      <View style={styles.captionText}>
                        <Text style={[styles.name, on && styles.nameOn]} numberOfLines={1}>
                          {item.name}
                        </Text>
                        <Text style={styles.detail} numberOfLines={1}>
                          {formatDistance(item.distanceM)} km · {isLoop(item) ? "boucle" : "aller"}
                          {item.place ? ` · ${item.place}` : ""}
                          {on ? " · sur ta carte" : ""}
                        </Text>
                      </View>

                      {/* Choosing it and setting off are one act, so they are
                          one button. Nobody picks a route in order to look at
                          it. */}
                      <Pressable
                        onPress={() => {
                          void setRoute(item.id);
                          router.push("/record");
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={`Courir ${item.name}`}
                        hitSlop={10}
                        style={({ pressed }) => [styles.go, pressed && styles.pressed]}
                      >
                        <Ionicons name="play" size={19} color={colors.accentText} style={styles.play} />
                      </Pressable>
                    </View>
                  </Pressable>
                </View>
              </SwipeToDelete>
            );
          }}
        />
      </View>

      {/* Parked off screen, and only ever asked for a picture of a route that
          has none. */}
      <RouteSnapshot ref={camera} />
    </SafeAreaView>
  );
}

const GUTTER = 20;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  fill: { flex: 1 },
  head: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8,
    paddingHorizontal: GUTTER, paddingTop: 10, paddingBottom: 14,
  },
  headText: { flex: 1 },
  title: { color: colors.text, fontSize: 32, fontFamily: font.bold, letterSpacing: -0.6 },
  subtitle: { color: colors.subtle, fontFamily: font.regular, fontSize: 15, marginTop: 3 },
  ways: { flexDirection: "row", gap: 8 },
  draw: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: "center", justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.hairline,
  },
  pressed: { opacity: 0.6 },

  emptyBlock: { marginTop: 56, paddingHorizontal: GUTTER, gap: 18 },
  empty: {
    color: colors.muted, fontFamily: font.regular, fontSize: 17.5,
    textAlign: "center", lineHeight: 27.5,
  },

  // The same plain list the history uses, separated by rules rather than by
  // cards: two lists of the same kind of thing should not be set differently.
  // Edge to edge, told apart by a rule rather than by floating on its own
  // surface — the way the history sets its runs, and for the same reason: two
  // lists of the same kind of thing should not be set differently.
  //
  // It is also what makes the swipe look right. A rounded card inset from the
  // margins leaves the red showing as a square band around a shape that is
  // neither, and matching the corners does not fix it: a picture in a box it
  // does not fill never looks like it belongs there.
  //
  // Opaque, because the delete action sits behind it.
  card: {
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline,
  },
  body: { backgroundColor: colors.sunken },
  pressedRow: { opacity: 0.85 },
  preview: { width: "100%", aspectRatio: PREVIEW_RATIO },
  // Only for the routes drawn before there were pictures: the shape alone,
  // centred on the same ground the picture would have covered.
  shapeOnly: { alignItems: "center", justifyContent: "center" },

  // No background of its own: it sits on the card's grey, which is what
  // holds the name and the picture together as one object rather than two
  // things stacked.
  caption: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: GUTTER, paddingVertical: 13,
  },
  captionText: { flex: 1, gap: 2 },
  name: { color: colors.text, fontSize: 19, fontFamily: font.semibold, letterSpacing: -0.2 },
  nameOn: { color: colors.accent },
  detail: { color: colors.muted, fontFamily: font.regular, fontSize: 14.5 },
  go: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: "center", justifyContent: "center", backgroundColor: colors.accent,
  },
  // A play triangle centred geometrically reads as off-centre: its mass sits
  // left of its box.
  play: { marginLeft: 2 },
});
