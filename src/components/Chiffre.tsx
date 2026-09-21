import { StyleSheet, Text, View } from "react-native";
import { couleurs } from "@/lib/theme";

interface Props {
  libelle: string;
  valeur: string;
  unite?: string;
  grand?: boolean;
}

/** Une mesure avec son libellé. Chiffres tabulaires pour que rien ne saute. */
export function Chiffre({ libelle, valeur, unite, grand }: Props) {
  return (
    <View style={styles.bloc}>
      <Text style={styles.libelle}>{libelle}</Text>
      <View style={styles.ligne}>
        <Text style={[styles.valeur, grand && styles.grand]}>{valeur}</Text>
        {unite ? <Text style={[styles.unite, grand && styles.uniteGrande]}>{unite}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bloc: { flex: 1, minWidth: 96 },
  libelle: {
    color: couleurs.discret,
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  ligne: { flexDirection: "row", alignItems: "baseline", gap: 5, marginTop: 3 },
  valeur: {
    color: couleurs.texte,
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: -0.6,
    fontVariant: ["tabular-nums"],
  },
  // Le chiffre héros : très grand, très serré, c'est lui qu'on lit en courant.
  grand: { fontSize: 52, fontWeight: "800", letterSpacing: -2.5, lineHeight: 56 },
  unite: { color: couleurs.attenue, fontSize: 12, fontWeight: "600" },
  uniteGrande: { fontSize: 16 },
});
