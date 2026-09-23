import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ScrollView, StyleSheet } from "react-native";
import { SettingRow } from "@/components/SettingRow";
import { SettingsGroup } from "@/components/SettingsGroup";
import { listShoes } from "@/lib/db";
import { formatDistance } from "@/lib/format";
import { defineStrings, plural, useStrings } from "@/lib/i18n";
import { shoeOrder, wearOf, type Shoe } from "@/lib/shoes";
import { colors } from "@/lib/theme";
import { distanceUnit } from "@/lib/units";

const strings = defineStrings({
  fr: {
    inUse: "En service",
    retired: "Retirées",
    add: "Ajouter une paire",
    distance: (value: string) => `${value} ${distanceUnit()}`,
    isDefault: "Par défaut",
    runs: (count: number) => plural(count, "course", "courses"),
    soon: "bientôt à remplacer",
    worn: "à remplacer",
    footer: "Chaque nouvelle course est comptée pour la paire par défaut. Change la paire d'une course depuis sa page.",
    empty: "Ajoute ta paire actuelle : ses kilomètres se compteront tout seuls.",
  },
  en: {
    inUse: "In use",
    retired: "Retired",
    add: "Add a pair",
    distance: (value: string) => `${value} ${distanceUnit()}`,
    isDefault: "Default",
    runs: (count: number) => plural(count, "run", "runs"),
    soon: "due for replacing soon",
    worn: "due for replacing",
    footer: "Every new run counts for the default pair. Change a run's pair from its page.",
    empty: "Add the pair you run in now: its distance will count itself.",
  },
});

/** The line under a pair: default or not, its runs, and whether it is worn. */
function detailOf(shoe: Shoe, s: ReturnType<typeof strings>): string {
  const { wear } = wearOf(shoe);
  return [
    shoe.isDefault ? s.isDefault : null,
    s.runs(shoe.runs),
    !shoe.retired && wear !== "fresh" ? (wear === "worn" ? s.worn : s.soon) : null,
  ].filter(Boolean).join(" · ");
}

/**
 * Every pair of running shoes, with how far each has gone.
 *
 * In the settings rather than on the profile: which pair is on the runner's
 * feet is set once and changes a few times a year, which is what the settings
 * are for.
 */
export default function ShoesScreen() {
  const s = useStrings(strings);
  const router = useRouter();
  const [shoes, setShoes] = useState<Shoe[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void listShoes()
        .then((found) => {
          if (active) setShoes(shoeOrder(found));
        })
        .catch(() => undefined);
      return () => { active = false; };
    }, []),
  );

  const inUse = (shoes ?? []).filter((shoe) => !shoe.retired);
  const retired = (shoes ?? []).filter((shoe) => shoe.retired);
  const open = (id: number | "new") => router.push({ pathname: "/settings/shoe/[id]", params: { id: String(id) } });

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <SettingsGroup title={s.inUse} footer={inUse.length > 0 ? s.footer : s.empty}>
        {inUse.map((shoe) => (
          <SettingRow
            key={shoe.id}
            icon="footsteps-outline"
            label={shoe.name}
            detail={detailOf(shoe, s)}
            value={s.distance(formatDistance(shoe.distanceM))}
            onPress={() => open(shoe.id)}
          />
        ))}
        <SettingRow icon="add" label={s.add} onPress={() => open("new")} />
      </SettingsGroup>

      {retired.length > 0 ? (
        <SettingsGroup title={s.retired}>
          {retired.map((shoe) => (
            <SettingRow
              key={shoe.id}
              icon="archive-outline"
              label={shoe.name}
              detail={detailOf(shoe, s)}
              value={s.distance(formatDistance(shoe.distanceM))}
              onPress={() => open(shoe.id)}
            />
          ))}
        </SettingsGroup>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: 40 },
});
