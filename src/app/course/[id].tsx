import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { Bouton } from "@/components/Bouton";
import { Carte } from "@/components/Carte";
import { Chiffre } from "@/components/Chiffre";
import { lireCourse, supprimerCourse, type Course } from "@/lib/bd";
import { formaterAllure, formaterDate, formaterDistance, formaterDuree } from "@/lib/format";
import { fractionnes, type Point } from "@/lib/geo";
import { couleurs, ombres } from "@/lib/theme";

export default function DetailCourse() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [donnees, setDonnees] = useState<{ course: Course; points: Point[] } | null | undefined>(undefined);

  useEffect(() => {
    let actif = true;
    lireCourse(Number(id)).then((d) => { if (actif) setDonnees(d); }).catch(() => { if (actif) setDonnees(null); });
    return () => { actif = false; };
  }, [id]);

  if (donnees === undefined) {
    return <View style={styles.centre}><ActivityIndicator color={couleurs.accent} /></View>;
  }
  if (donnees === null) {
    return <View style={styles.centre}><Text style={styles.attenue}>Course introuvable.</Text></View>;
  }

  const { course, points } = donnees;
  const splits = fractionnes(points);
  const plusRapide = splits.filter((s) => !s.partiel).reduce<number | null>((m, s) => (m === null || s.dureeS < m ? s.dureeS : m), null);

  function supprimer() {
    Alert.alert("Supprimer cette course ?", "Cette action est définitive.", [
      { text: "Annuler", style: "cancel" },
      { text: "Supprimer", style: "destructive", onPress: () => { void supprimerCourse(course.id).then(() => router.back()); } },
    ]);
  }

  return (
    <ScrollView style={styles.ecran} contentContainerStyle={styles.contenu}>
      <Text style={styles.date}>{formaterDate(course.debut)}</Text>

      <View style={styles.mesures}>
        <Chiffre libelle="Distance" valeur={formaterDistance(course.distance_m)} unite="km" grand />
        <View style={styles.rangee}>
          <Chiffre libelle="Durée" valeur={formaterDuree(course.duree_s)} />
          <Chiffre libelle="Allure moyenne" valeur={formaterAllure(course.allure_moy_s_km)} unite="/km" />
        </View>
      </View>

      <Carte points={points} cadrer style={styles.carte} />

      {splits.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitre}>Fractionnés</Text>
          {splits.map((s) => {
            const allure = s.dureeS / (s.distanceM / 1000);
            const record = !s.partiel && plusRapide !== null && s.dureeS === plusRapide && splits.filter((x) => !x.partiel).length > 1;
            return (
              <View key={s.km} style={styles.split}>
                <Text style={styles.splitKm}>{s.partiel ? `${formaterDistance(s.distanceM)} km` : `km ${s.km}`}</Text>
                <View style={styles.barreFond}>
                  <View style={[styles.barre, { width: `${Math.min(100, (plusRapide ?? allure) / allure * 100)}%` }, record && styles.barreRecord]} />
                </View>
                <Text style={[styles.splitAllure, record && styles.record]}>{formaterAllure(allure)}</Text>
              </View>
            );
          })}
        </View>
      )}

      <Text style={styles.attenue}>{points.length} points GPS enregistrés</Text>
      <Bouton libelle="Supprimer la course" variante="danger" onPress={supprimer} style={styles.supprimer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: couleurs.fond },
  contenu: { padding: 20, gap: 18, paddingBottom: 40 },
  centre: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: couleurs.fond },
  date: { color: couleurs.attenue, fontSize: 13, textTransform: "capitalize" },
  mesures: {
    gap: 16,
    backgroundColor: couleurs.surface,
    borderRadius: 20,
    padding: 20,
    ...ombres.carte,
  },
  rangee: { flexDirection: "row", gap: 12 },
  carte: { height: 280 },
  section: {
    gap: 12,
    backgroundColor: couleurs.surface,
    borderRadius: 20,
    padding: 18,
    ...ombres.carte,
  },
  sectionTitre: { color: couleurs.discret, fontSize: 10, fontWeight: "600", letterSpacing: 1, textTransform: "uppercase" },
  split: { flexDirection: "row", alignItems: "center", gap: 12 },
  splitKm: { color: couleurs.attenue, width: 58, fontSize: 12, fontVariant: ["tabular-nums"] },
  barreFond: { flex: 1, height: 8, borderRadius: 4, backgroundColor: couleurs.bordure, overflow: "hidden" },
  barre: { height: "100%", borderRadius: 4, backgroundColor: "rgba(22, 163, 74, 0.35)" },
  barreRecord: { backgroundColor: couleurs.accent },
  splitAllure: { color: couleurs.texte, width: 52, textAlign: "right", fontSize: 13, fontWeight: "600", fontVariant: ["tabular-nums"] },
  record: { color: couleurs.accent },
  attenue: { color: couleurs.discret, fontSize: 11, textAlign: "center" },
  supprimer: { flex: 0 },
});
