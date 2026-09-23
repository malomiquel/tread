import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { GlassPanel } from "@/components/GlassPanel";
import { listRoutes } from "@/lib/db";
import { formatDistance } from "@/lib/format";
import { defineStrings, useStrings } from "@/lib/i18n";
import { isLoop, type StoredRoute } from "@/lib/route";
import { setRoute } from "@/lib/settings";
import { colors, floatingShadow, font } from "@/lib/theme";

const routePickerStrings = defineStrings({
  fr: {
    title: "Parcours",
    none: "Sans parcours",
    noneDetail: "Aucun tracé sur la carte",
    loop: "boucle",
    oneWay: "aller",
    empty: "Aucun parcours enregistré. Tu peux en dessiner un depuis l'onglet Parcours.",
  },
  en: {
    title: "Routes",
    none: "No route",
    noneDetail: "Nothing drawn on the map",
    loop: "loop",
    oneWay: "one way",
    empty: "No saved routes. You can draw one from the Routes tab.",
  },
});

interface Props {
  visible: boolean;
  /** The route currently drawn on the map, or null for none. */
  chosen: number | null;
  onClose: () => void;
}

/**
 * The route to follow, chosen from the running screen itself.
 *
 * A route picked in the Parcours tab stays on the map from one run to the
 * next, which is what somebody running the same loop every morning wants —
 * but only if they can see it is there and put it down from where they are
 * standing. Without this sheet the only way to stop following a route was to
 * delete it.
 *
 * "Sans parcours" sits at the top rather than being the absence of a choice,
 * the same way the free run heads the session list.
 */
export function RoutePicker({ visible, chosen, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      {/* Mounted only while open, so the list is read afresh every time: a
          route drawn since the last opening has to be in it. */}
      {visible ? <Sheet chosen={chosen} onClose={onClose} /> : null}
    </Modal>
  );
}

function Sheet({ chosen, onClose }: Omit<Props, "visible">) {
  const s = useStrings(routePickerStrings);
  const [routes, setRoutes] = useState<StoredRoute[] | null>(null);

  useEffect(() => {
    let active = true;
    listRoutes()
      .then((found) => {
        if (active) setRoutes(found);
      })
      .catch(() => {
        if (active) setRoutes([]);
      });
    return () => { active = false; };
  }, []);

  const choose = (id: number | null) => {
    onClose();
    void setRoute(id);
  };

  const row = (id: number | null, name: string, detail: string) => {
    const selected = chosen === id;
    return (
      <Pressable
        key={id ?? "none"}
        onPress={() => choose(id)}
        accessibilityRole="radio"
        accessibilityState={{ selected }}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        <View style={styles.rowText}>
          <Text style={[styles.name, selected && styles.nameOn]} numberOfLines={1}>{name}</Text>
          <Text style={styles.detail} numberOfLines={1}>{detail}</Text>
        </View>
        {selected && <Ionicons name="checkmark" size={20} color={colors.accent} />}
      </Pressable>
    );
  };

  return (
    <Pressable style={styles.backdrop} onPress={onClose}>
      {/* Stops a tap inside the sheet from closing it. */}
      <Pressable onPress={() => undefined} style={styles.sheet}>
        <GlassPanel style={styles.panel}>
          <Text style={styles.title}>{s.title}</Text>
          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            {row(null, s.none, s.noneDetail)}
            {(routes ?? []).map((route) =>
              row(
                route.id,
                route.name,
                [
                  `${formatDistance(route.distanceM)} km`,
                  isLoop(route) ? s.loop : s.oneWay,
                  route.place,
                ].filter(Boolean).join(" · "),
              ))}
          </ScrollView>
          {routes !== null && routes.length === 0 ? (
            <Text style={styles.hint}>{s.empty}</Text>
          ) : null}
        </GlassPanel>
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: colors.scrim,
    alignItems: "center", justifyContent: "center", padding: 22,
  },
  sheet: { width: "100%", maxWidth: 380, ...floatingShadow },
  panel: { borderRadius: 20, paddingHorizontal: 18, paddingVertical: 16, gap: 10 },
  title: {
    color: colors.subtle, fontSize: 11, fontFamily: font.semibold,
    letterSpacing: 1.4, textTransform: "uppercase",
  },
  list: { maxHeight: 380 },
  row: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline,
  },
  pressed: { opacity: 0.55 },
  rowText: { flex: 1, gap: 2 },
  name: { color: colors.text, fontSize: 17, fontFamily: font.semibold, letterSpacing: -0.2 },
  nameOn: { color: colors.accent },
  detail: { color: colors.muted, fontSize: 13.5, fontFamily: font.regular },
  hint: { color: colors.subtle, fontSize: 13.5, fontFamily: font.regular, lineHeight: 19 },
});
