import { useKeepAwake } from "expo-keep-awake";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Bouton } from "@/components/Bouton";
import { Carte } from "@/components/Carte";
import { Chiffre } from "@/components/Chiffre";
import { formaterAllure, formaterDistance, formaterDuree } from "@/lib/format";
import { allureInstantanee, allureSecParKm, distanceTotaleM } from "@/lib/geo";
import { usePositionInitiale } from "@/lib/position";
import { abandonner, demarrer, dureeActiveS, mettreEnPause, reprendre, terminer, useSuivi } from "@/lib/suivi";
import { couleurs, ombres } from "@/lib/theme";

/**
 * Garde l'ecran allume tant que ce composant est monte. Dans Expo Go, le GPS
 * s'arrete avec l'ecran ; on ne le monte donc que pendant une course.
 */
function EcranVeille() {
  useKeepAwake();
  return null;
}

export default function Courir() {
  const suivi = useSuivi();
  const router = useRouter();
  const { position, autorisee } = usePositionInitiale();
  const [maintenant, setMaintenant] = useState(() => Date.now());
  const [clotureEnCours, setClotureEnCours] = useState(false);

  useEffect(() => {
    if (suivi.etat === "inactif") return;
    const id = setInterval(() => setMaintenant(Date.now()), 1000);
    return () => clearInterval(id);
  }, [suivi.etat]);

  const enCourse = suivi.etat !== "inactif";
  const distance = distanceTotaleM(suivi.points);
  const duree = dureeActiveS(suivi, maintenant);
  const allureMoy = allureSecParKm(distance, duree);
  const allureInst = suivi.etat === "en_cours" ? allureInstantanee(suivi.points, maintenant) : null;

  // Au repos, on explique ou en est la localisation plutot que de laisser
  // croire que la carte est cassee quand elle reste sur son cadrage par defaut.
  const messageRepos =
    autorisee === false ? "Localisation refusée, la carte ne peut pas te situer"
    : position === null ? "Recherche de ta position…"
    : "Le GPS démarre avec la course";

  const signal =
    suivi.precisionM === null ? "Recherche du GPS…"
    : suivi.precisionM <= 10 ? `GPS précis, ±${Math.round(suivi.precisionM)} m`
    : suivi.precisionM <= 30 ? `GPS moyen, ±${Math.round(suivi.precisionM)} m`
    : `GPS faible, ±${Math.round(suivi.precisionM)} m, points ignorés`;

  async function cloturer() {
    setClotureEnCours(true);
    const id = await terminer();
    setClotureEnCours(false);
    if (id !== null) router.push({ pathname: "/course/[id]", params: { id: String(id) } });
  }

  function confirmerFin() {
    if (distance < 100) {
      Alert.alert("Course très courte", "Moins de 100 m enregistrés. La garder quand même ?", [
        { text: "Abandonner", style: "destructive", onPress: () => void abandonner() },
        { text: "Garder", onPress: () => void cloturer() },
        { text: "Continuer", style: "cancel" },
      ]);
      return;
    }
    Alert.alert("Terminer la course ?", undefined, [
      { text: "Continuer", style: "cancel" },
      { text: "Terminer", onPress: () => void cloturer() },
    ]);
  }

  return (
    <SafeAreaView style={styles.ecran} edges={["top"]}>
      {enCourse && <EcranVeille />}
      <View style={styles.entete}>
        <Text style={styles.titre}>{enCourse ? (suivi.etat === "en_pause" ? "En pause" : "Course en cours") : "Prêt à courir"}</Text>
        <Text style={[styles.signal, ((enCourse && suivi.precisionM !== null && suivi.precisionM > 30) || autorisee === false) && styles.signalFaible]}>
          {enCourse ? signal : messageRepos}
          {enCourse && !suivi.modeFond ? " · écran maintenu allumé" : ""}
        </Text>
      </View>

      <View style={styles.mesures}>
        <Chiffre libelle="Distance" valeur={formaterDistance(distance)} unite="km" grand />
        <View style={styles.rangee}>
          <Chiffre libelle="Durée" valeur={formaterDuree(duree)} />
          <Chiffre libelle="Allure" valeur={formaterAllure(allureInst ?? allureMoy)} unite="/km" />
          <Chiffre libelle="Moyenne" valeur={formaterAllure(allureMoy)} unite="/km" />
        </View>
      </View>

      <Carte points={suivi.points} suivre centreInitial={position} style={styles.carte} />

      {suivi.erreur && <Text style={styles.erreur}>{suivi.erreur}</Text>}

      <View style={styles.actions}>
        {!enCourse && <Bouton libelle="Démarrer" onPress={() => void demarrer()} />}
        {suivi.etat === "en_cours" && (
          <>
            <Bouton libelle="Pause" variante="secondaire" onPress={mettreEnPause} />
            <Bouton libelle="Terminer" variante="danger" onPress={confirmerFin} desactive={clotureEnCours} />
          </>
        )}
        {suivi.etat === "en_pause" && (
          <>
            <Bouton libelle="Reprendre" onPress={reprendre} />
            <Bouton libelle="Terminer" variante="danger" onPress={confirmerFin} desactive={clotureEnCours} />
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: couleurs.fond, paddingHorizontal: 20, gap: 16 },
  entete: { paddingTop: 8 },
  titre: { color: couleurs.texte, fontSize: 26, fontWeight: "800", letterSpacing: -0.8 },
  signal: { color: couleurs.discret, fontSize: 12.5, marginTop: 3, fontWeight: "500" },
  signalFaible: { color: couleurs.pause },
  mesures: {
    gap: 16,
    backgroundColor: couleurs.surface,
    borderRadius: 20,
    padding: 20,
    ...ombres.carte,
  },
  rangee: { flexDirection: "row", gap: 12, paddingTop: 2 },
  carte: { flex: 1, minHeight: 200, borderRadius: 20 },
  erreur: { color: couleurs.danger, fontSize: 13 },
  actions: { flexDirection: "row", gap: 12, paddingBottom: 12 },
});
