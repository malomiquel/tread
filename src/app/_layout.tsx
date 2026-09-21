import "@/lib/suivi"; // definit la tache GPS de fond des le demarrage, hors de tout ecran
import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { initialiserBd } from "@/lib/bd";
import { couleurs } from "@/lib/theme";

export default function Racine() {
  const [pret, setPret] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    initialiserBd()
      .then(() => setPret(true))
      .catch((e: unknown) => setErreur(e instanceof Error ? e.message : "Base de données inaccessible."));
  }, []);

  if (erreur) {
    return (
      <View style={styles.centre}>
        <Text style={styles.erreur}>{erreur}</Text>
      </View>
    );
  }
  if (!pret) {
    return (
      <View style={styles.centre}>
        <ActivityIndicator color={couleurs.accent} />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: couleurs.fond },
        headerTintColor: couleurs.texte,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: couleurs.fond },
      }}
    >
      <Stack.Screen name="(onglets)" options={{ headerShown: false }} />
      <Stack.Screen name="course/[id]" options={{ title: "Course" }} />
    </Stack>
  );
}

const styles = StyleSheet.create({
  centre: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: couleurs.fond, padding: 24 },
  erreur: { color: couleurs.danger, textAlign: "center" },
});
