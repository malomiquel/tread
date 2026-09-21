import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { listerCourses, type Course } from "@/lib/bd";
import { formaterAllure, formaterDate, formaterDistance, formaterDuree } from "@/lib/format";
import { couleurs, ombres } from "@/lib/theme";

export default function Historique() {
  const [courses, setCourses] = useState<Course[] | null>(null);
  const router = useRouter();

  // Recharge a chaque retour sur l'onglet : une course vient peut-etre de finir.
  useFocusEffect(
    useCallback(() => {
      let actif = true;
      listerCourses().then((c) => { if (actif) setCourses(c); }).catch(() => { if (actif) setCourses([]); });
      return () => { actif = false; };
    }, []),
  );

  const totalKm = (courses ?? []).reduce((t, c) => t + c.distance_m, 0);

  return (
    <SafeAreaView style={styles.ecran} edges={["top"]}>
      <View style={styles.entete}>
        <Text style={styles.titre}>Historique</Text>
        {courses && courses.length > 0 && (
          <Text style={styles.sousTitre}>{courses.length} course{courses.length > 1 ? "s" : ""} · {formaterDistance(totalKm)} km au total</Text>
        )}
      </View>
      <FlatList
        data={courses ?? []}
        keyExtractor={(c) => String(c.id)}
        contentContainerStyle={styles.liste}
        ListEmptyComponent={
          courses === null ? null : (
            <Text style={styles.vide}>Aucune course pour l&apos;instant. La première t&apos;attend dans l&apos;onglet Courir.</Text>
          )
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push({ pathname: "/course/[id]", params: { id: String(item.id) } })}
            style={({ pressed }) => [styles.ligne, pressed && styles.presse]}
          >
            <View style={styles.gauche}>
              <Text style={styles.date}>{item.nom ?? formaterDate(item.debut)}</Text>
              {item.nom ? <Text style={styles.quand}>{formaterDate(item.debut)}</Text> : null}
              <Text style={styles.detail}>{formaterDuree(item.duree_s)} · {formaterAllure(item.allure_moy_s_km)} /km</Text>
            </View>
            <Text style={styles.distance}>{formaterDistance(item.distance_m)} <Text style={styles.km}>km</Text></Text>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: couleurs.fond },
  entete: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  titre: { color: couleurs.texte, fontSize: 20, fontWeight: "800", letterSpacing: -0.5 },
  sousTitre: { color: couleurs.discret, fontSize: 11.5, marginTop: 2 },
  liste: { paddingHorizontal: 20, paddingBottom: 24, gap: 12 },
  vide: { color: couleurs.attenue, fontSize: 13, textAlign: "center", marginTop: 60, lineHeight: 20, paddingHorizontal: 20 },
  ligne: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: couleurs.surface, borderRadius: 16, padding: 16, ...ombres.carte,
  },
  presse: { transform: [{ scale: 0.98 }], opacity: 0.9 },
  gauche: { gap: 3 },
  date: { color: couleurs.texte, fontSize: 14, fontWeight: "600", textTransform: "capitalize" },
  quand: { color: couleurs.discret, fontSize: 11, textTransform: "capitalize" },
  detail: { color: couleurs.attenue, fontSize: 12, fontVariant: ["tabular-nums"] },
  distance: { color: couleurs.accent, fontSize: 19, fontWeight: "700", fontVariant: ["tabular-nums"] },
  km: { color: couleurs.attenue, fontSize: 11.5, fontWeight: "500" },
});
