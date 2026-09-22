import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect, useRouter, useScrollToTop } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/Button";
import { SwipeToDelete } from "@/components/SwipeToDelete";
import { deleteRoute, listRoutes } from "@/lib/db";
import { formatDistance } from "@/lib/format";
import { useTabBarSpace } from "@/lib/layout";
import { isLoop, type StoredRoute } from "@/lib/route";
import { setRoute, useSettings } from "@/lib/settings";
import { colors, font } from "@/lib/theme";

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

  const load = useCallback(() => {
    listRoutes().then(setRoutes).catch(() => setRoutes([]));
  }, []);

  // Reloaded on every arrival: the last thing somebody did before coming back
  // here was probably draw the route they are about to pick.
  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

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
                  ? "Touche un parcours pour le suivre à la prochaine course"
                  : "Celui qui est coché sera tracé sur la carte"}
              </Text>
            ) : null}
          </View>
          <Pressable
            onPress={() => router.push("/route/new")}
            accessibilityRole="button"
            accessibilityLabel="Dessiner un parcours"
            hitSlop={10}
            style={({ pressed }) => [styles.draw, pressed && styles.pressed]}
          >
            <Ionicons name="add" size={23} color={colors.text} />
          </Pressable>
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
                  Aucun parcours pour l&apos;instant. Dessines-en un en touchant la carte : chaque
                  point rejoint le précédent en suivant les rues.
                </Text>
                <Button label="Dessiner un parcours" onPress={() => router.push("/route/new")} />
              </View>
            )
          }
          renderItem={({ item }) => {
            const on = chosen === item.id;
            return (
              <SwipeToDelete label={item.name} onDelete={() => remove(item)}>
                <Pressable
                  // Tapping the one already chosen puts it back to running
                  // free: choosing and unchoosing should cost the same.
                  onPress={() => void setRoute(on ? null : item.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                >
                  <View style={styles.rowText}>
                    <Text style={[styles.name, on && styles.nameOn]} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.detail}>
                      {isLoop(item) ? "Boucle" : "Aller"} · {item.waypoints.length} points
                    </Text>
                  </View>
                  <Text style={[styles.distance, on && styles.nameOn]}>
                    {formatDistance(item.distanceM)}
                    <Text style={styles.km}> km</Text>
                  </Text>
                  {on ? <Ionicons name="checkmark" size={20} color={colors.accent} /> : null}
                </Pressable>
              </SwipeToDelete>
            );
          }}
        />
      </View>
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
  row: {
    flexDirection: "row", alignItems: "center", gap: 14,
    paddingHorizontal: GUTTER, paddingVertical: 15,
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline,
  },
  rowPressed: { backgroundColor: colors.sunken },
  rowText: { flex: 1, gap: 3 },
  name: { color: colors.text, fontSize: 20.5, fontFamily: font.semibold, letterSpacing: -0.2 },
  nameOn: { color: colors.accent },
  detail: { color: colors.muted, fontFamily: font.regular, fontSize: 15.5 },
  distance: {
    color: colors.text, fontSize: 26, fontFamily: font.semibold,
    letterSpacing: -0.7, fontVariant: ["tabular-nums"],
  },
  km: { color: colors.subtle, fontSize: 14, fontFamily: font.semibold, letterSpacing: 0 },
});
