import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from "react-native";
import { couleurs } from "@/lib/theme";

interface Props {
  libelle: string;
  onPress: () => void;
  variante?: "principal" | "secondaire" | "danger";
  desactive?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Bouton({ libelle, onPress, variante = "principal", desactive, style }: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={desactive}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.base, styles[variante], pressed && styles.presse, desactive && styles.desactive, style,
      ]}
    >
      <Text style={[styles.texte, variante === "principal" && styles.textePrincipal, variante === "danger" && styles.texteDanger]}>
        {libelle}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { flex: 1, minHeight: 56, borderRadius: 14, alignItems: "center", justifyContent: "center", paddingHorizontal: 18 },
  principal: { backgroundColor: couleurs.accent },
  secondaire: { backgroundColor: couleurs.surface, borderWidth: 1, borderColor: couleurs.bordure },
  danger: { backgroundColor: "rgba(248,113,113,0.12)", borderWidth: 1, borderColor: "rgba(248,113,113,0.35)" },
  presse: { transform: [{ scale: 0.96 }] },
  desactive: { opacity: 0.4 },
  texte: { color: couleurs.texte, fontSize: 16, fontWeight: "600" },
  textePrincipal: { color: couleurs.accentTexte },
  texteDanger: { color: couleurs.danger },
});
