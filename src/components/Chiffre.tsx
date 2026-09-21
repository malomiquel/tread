import { StyleSheet, Text, View } from "react-native";
import { couleurs } from "@/lib/theme";

interface Props {
  libelle: string;
  valeur: string;
  unite?: string;
  grand?: boolean;
}

/** Une mesure avec son libelle. Chiffres tabulaires pour que rien ne saute. */
export function Chiffre({ libelle, valeur, unite, grand }: Props) {
  return (
    <View style={styles.bloc}>
      <Text style={styles.libelle}>{libelle}</Text>
      <View style={styles.ligne}>
        <Text style={[styles.valeur, grand && styles.grand]}>{valeur}</Text>
        {unite ? <Text style={styles.unite}>{unite}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bloc: { flex: 1, minWidth: 120 },
  libelle: { color: couleurs.discret, fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase" },
  ligne: { flexDirection: "row", alignItems: "baseline", gap: 4, marginTop: 2 },
  valeur: { color: couleurs.texte, fontSize: 30, fontWeight: "700", fontVariant: ["tabular-nums"] },
  grand: { fontSize: 60, letterSpacing: -2, lineHeight: 64 },
  unite: { color: couleurs.attenue, fontSize: 14, fontWeight: "500" },
});
