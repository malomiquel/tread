import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { listerCourses, records, type Course, type Records } from "@/lib/bd";
import { formaterAllure, formaterDenivele, formaterDistance, formaterDuree } from "@/lib/format";
import { couleurs, ombres } from "@/lib/theme";

const SEMAINES_AFFICHEES = 6;

/** Lundi zéro heure de la semaine contenant cet instant. */
function debutSemaine(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}

interface Semaine {
  debut: number;
  distanceM: number;
  dureeS: number;
  courses: number;
}

function parSemaine(courses: Course[]): Semaine[] {
  const cumuls = new Map<number, Semaine>();
  const depart = debutSemaine(Date.now());
  // On prépare les semaines vides d'abord : une semaine sans course doit
  // apparaître comme une barre à zéro, pas disparaître du graphique.
  for (let i = SEMAINES_AFFICHEES - 1; i >= 0; i--) {
    const debut = depart - i * 7 * 86_400_000;
    cumuls.set(debut, { debut, distanceM: 0, dureeS: 0, courses: 0 });
  }
  for (const c of courses) {
    const cle = debutSemaine(c.debut);
    const s = cumuls.get(cle);
    if (!s) continue;
    s.distanceM += c.distance_m;
    s.dureeS += c.duree_s;
    s.courses += 1;
  }
  return [...cumuls.values()];
}

function Record({ libelle, valeur, detail }: { libelle: string; valeur: string; detail?: string }) {
  return (
    <View style={styles.record}>
      <View style={styles.recordGauche}>
        <Text style={styles.recordLibelle}>{libelle}</Text>
        {detail ? <Text style={styles.recordDetail}>{detail}</Text> : null}
      </View>
      <Text style={styles.recordValeur}>{valeur}</Text>
    </View>
  );
}

export default function Progression() {
  const [semaines, setSemaines] = useState<Semaine[] | null>(null);
  const [rec, setRec] = useState<Records | null>(null);

  useFocusEffect(
    useCallback(() => {
      let actif = true;
      Promise.all([listerCourses(), records()])
        .then(([courses, r]) => {
          if (!actif) return;
          setSemaines(parSemaine(courses));
          setRec(r);
        })
        .catch(() => undefined);
      return () => {
        actif = false;
      };
    }, []),
  );

  if (!semaines || !rec) return <SafeAreaView style={styles.ecran} edges={["top"]} />;

  const courante = semaines[semaines.length - 1];
  const maxi = Math.max(...semaines.map((s) => s.distanceM), 1);
  const jamaisCouru = rec.totalCourses === 0;

  return (
    <SafeAreaView style={styles.ecran} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.contenu}>
        <Text style={styles.titre}>Progression</Text>

        {jamaisCouru ? (
          <Text style={styles.vide}>
            Rien à afficher pour le moment. Tes statistiques se construiront course après course.
          </Text>
        ) : (
          <>
            <View style={styles.carte}>
              <Text style={styles.sectionTitre}>Cette semaine</Text>
              <View style={styles.ligneHero}>
                <Text style={styles.hero}>{formaterDistance(courante.distanceM)}</Text>
                <Text style={styles.heroUnite}>km</Text>
              </View>
              <Text style={styles.sousHero}>
                {courante.courses} course{courante.courses > 1 ? "s" : ""} · {formaterDuree(courante.dureeS)}
              </Text>

              <View style={styles.graphique}>
                {semaines.map((s, i) => (
                  <View key={s.debut} style={styles.colonne}>
                    <View style={styles.barreZone}>
                      <View
                        style={[
                          styles.barre,
                          { height: `${Math.max(2, (s.distanceM / maxi) * 100)}%` },
                          i === semaines.length - 1 && styles.barreCourante,
                        ]}
                      />
                    </View>
                    <Text style={styles.semaineLibelle}>
                      {i === semaines.length - 1 ? "auj." : `-${semaines.length - 1 - i}`}
                    </Text>
                  </View>
                ))}
              </View>
              <Text style={styles.legende}>Distance par semaine, {SEMAINES_AFFICHEES} dernières</Text>
            </View>

            <View style={styles.carte}>
              <Text style={styles.sectionTitre}>Records</Text>
              {rec.plusLongue && (
                <Record
                  libelle="Plus longue sortie"
                  valeur={`${formaterDistance(rec.plusLongue.distance_m)} km`}
                  detail={rec.plusLongue.nom ?? undefined}
                />
              )}
              {rec.meilleurKm?.meilleur_km_s != null && (
                <Record
                  libelle="Kilomètre le plus rapide"
                  valeur={`${formaterAllure(rec.meilleurKm.meilleur_km_s)}`}
                  detail={rec.meilleurKm.nom ?? undefined}
                />
              )}
              {rec.plusRapide?.allure_moy_s_km != null && (
                <Record
                  libelle="Meilleure allure moyenne"
                  valeur={`${formaterAllure(rec.plusRapide.allure_moy_s_km)}`}
                  detail="sur 2 km minimum"
                />
              )}
              {rec.plusDeDenivele?.denivele_m != null && rec.plusDeDenivele.denivele_m > 0 && (
                <Record
                  libelle="Plus fort dénivelé"
                  valeur={`${formaterDenivele(rec.plusDeDenivele.denivele_m)} m`}
                  detail={rec.plusDeDenivele.nom ?? undefined}
                />
              )}
            </View>

            <View style={styles.carte}>
              <Text style={styles.sectionTitre}>Depuis le début</Text>
              <Record libelle="Courses" valeur={String(rec.totalCourses)} />
              <Record libelle="Distance" valeur={`${formaterDistance(rec.totalDistanceM)} km`} />
              <Record libelle="Temps" valeur={formaterDuree(rec.totalDureeS)} />
              <Record libelle="Dénivelé" valeur={`${formaterDenivele(rec.totalDeniveleM)} m`} />
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: couleurs.fond },
  contenu: { padding: 20, gap: 14, paddingBottom: 32 },
  titre: { color: couleurs.texte, fontSize: 20, fontWeight: "800", letterSpacing: -0.5 },
  vide: { color: couleurs.attenue, fontSize: 13, textAlign: "center", marginTop: 60, lineHeight: 20 },
  carte: { backgroundColor: couleurs.surface, borderRadius: 20, padding: 18, gap: 10, ...ombres.carte },
  sectionTitre: {
    color: couleurs.discret, fontSize: 10, fontWeight: "600", letterSpacing: 1, textTransform: "uppercase",
  },
  ligneHero: { flexDirection: "row", alignItems: "baseline", gap: 5 },
  hero: {
    color: couleurs.texte, fontSize: 40, fontWeight: "800", letterSpacing: -1.8, fontVariant: ["tabular-nums"],
  },
  heroUnite: { color: couleurs.attenue, fontSize: 15, fontWeight: "600" },
  sousHero: { color: couleurs.attenue, fontSize: 12, marginTop: -6, fontVariant: ["tabular-nums"] },
  graphique: { flexDirection: "row", alignItems: "flex-end", gap: 8, height: 90, marginTop: 6 },
  colonne: { flex: 1, alignItems: "center", gap: 6 },
  barreZone: { flex: 1, width: "100%", justifyContent: "flex-end" },
  barre: { width: "100%", borderRadius: 6, backgroundColor: couleurs.accentDoux },
  barreCourante: { backgroundColor: couleurs.accent },
  semaineLibelle: { color: couleurs.discret, fontSize: 10, fontVariant: ["tabular-nums"] },
  legende: { color: couleurs.discret, fontSize: 10.5 },
  record: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: couleurs.bordure,
  },
  recordGauche: { flex: 1, gap: 1 },
  recordLibelle: { color: couleurs.texte, fontSize: 13, fontWeight: "500" },
  recordDetail: { color: couleurs.discret, fontSize: 11 },
  recordValeur: {
    color: couleurs.accent, fontSize: 15, fontWeight: "700", fontVariant: ["tabular-nums"],
  },
});
