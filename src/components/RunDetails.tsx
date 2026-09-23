import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ChoiceSheet } from "@/components/ChoiceSheet";
import { SettingRow } from "@/components/SettingRow";
import { SettingsGroup } from "@/components/SettingsGroup";
import {
  ACTIVITY_ICONS, ACTIVITY_TYPES, activityName, RUN_TAGS, tagName, toggleTag,
} from "@/lib/activity";
import { listShoes, setRunActivity, setRunShoe, setRunTags, type Run } from "@/lib/db";
import { formatDistance } from "@/lib/format";
import { defineStrings, useStrings } from "@/lib/i18n";
import { shoeOrder, wearOf, type Shoe } from "@/lib/shoes";
import { colors, font } from "@/lib/theme";
import { distanceUnit } from "@/lib/units";

const strings = defineStrings({
  fr: {
    title: "Détails",
    type: "Type",
    tags: "Étiquettes",
    shoes: "Chaussures",
    noShoe: "Aucune",
    noShoeDetail: "Cette course ne compte pour aucune paire",
    worn: (distance: string) => `à remplacer · ${distance} ${distanceUnit()}`,
    soon: (distance: string) => `bientôt à remplacer · ${distance} ${distanceUnit()}`,
    covered: (distance: string) => `${distance} ${distanceUnit()}`,
  },
  en: {
    title: "Details",
    type: "Type",
    tags: "Tags",
    shoes: "Shoes",
    noShoe: "None",
    noShoeDetail: "This run counts for no pair",
    worn: (distance: string) => `due for replacing · ${distance} ${distanceUnit()}`,
    soon: (distance: string) => `due soon · ${distance} ${distanceUnit()}`,
    covered: (distance: string) => `${distance} ${distanceUnit()}`,
  },
});

interface Props {
  run: Run;
  /** Tells the page what changed, so it redraws without reading the run again. */
  onChange: (patch: Partial<Run>) => void;
}

/**
 * What the runner can say about a run that the phone could not measure: what
 * kind of outing it was, what it was for, which pair it was run in.
 */
export function RunDetails({ run, onChange }: Props) {
  const s = useStrings(strings);
  const [shoes, setShoes] = useState<Shoe[]>([]);
  const [choosingShoe, setChoosingShoe] = useState(false);
  const [choosingType, setChoosingType] = useState(false);

  useEffect(() => {
    let active = true;
    void listShoes().then((found) => {
      if (active) setShoes(shoeOrder(found));
    }).catch(() => undefined);
    return () => { active = false; };
  }, [run.shoeId]);

  const shoe = shoes.find((held) => held.id === run.shoeId) ?? null;
  const shoeLine = (held: Shoe) => {
    const { wear } = wearOf(held);
    const distance = formatDistance(held.distanceM);
    return wear === "worn" ? s.worn(distance) : wear === "soon" ? s.soon(distance) : s.covered(distance);
  };
  // Retired pairs are not offered, except the one this run was already in.
  const offered = shoes.filter((held) => !held.retired || held.id === run.shoeId);

  return (
    <>
      <SettingsGroup title={s.title}>
        <SettingRow
          icon={ACTIVITY_ICONS[run.activity] as "walk-outline"}
          label={s.type}
          value={activityName(run.activity)}
          onPress={() => setChoosingType(true)}
        />
        {/* Nothing to say about shoes before any pair exists: the row would
            only offer "none". */}
        {shoes.length > 0 ? (
          <SettingRow
            icon="footsteps-outline"
            label={s.shoes}
            value={shoe?.name ?? s.noShoe}
            detail={shoe ? shoeLine(shoe) : undefined}
            onPress={() => setChoosingShoe(true)}
          />
        ) : null}
      </SettingsGroup>

      {/* Chips rather than a sheet: several can be on at once, and each is
          one tap either way. */}
      <View style={styles.tags} accessibilityLabel={s.tags}>
        {RUN_TAGS.map((tag) => {
          const on = run.tags.includes(tag);
          return (
            <Pressable
              key={tag}
              onPress={() => {
                const tags = toggleTag(run.tags, tag);
                onChange({ tags });
                void setRunTags(run.id, tags).catch(() => undefined);
              }}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              style={({ pressed }) => [styles.tag, on && styles.tagOn, pressed && styles.pressed]}
            >
              <Text style={[styles.tagText, on && styles.tagTextOn]}>{tagName(tag)}</Text>
            </Pressable>
          );
        })}
      </View>

      <ChoiceSheet
        visible={choosingType}
        title={s.type}
        selected={run.activity}
        choices={ACTIVITY_TYPES.map((type) => ({ value: type, label: activityName(type) }))}
        onChoose={(activity) => {
          onChange({ activity });
          void setRunActivity(run.id, activity).catch(() => undefined);
        }}
        onClose={() => setChoosingType(false)}
      />

      <ChoiceSheet
        visible={choosingShoe}
        title={s.shoes}
        selected={run.shoeId}
        choices={[
          ...offered.map((held) => ({ value: held.id as number | null, label: held.name, detail: shoeLine(held) })),
          { value: null, label: s.noShoe, detail: s.noShoeDetail },
        ]}
        onChoose={(shoeId) => {
          onChange({ shoeId });
          void setRunShoe(run.id, shoeId).catch(() => undefined);
        }}
        onClose={() => setChoosingShoe(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 20, paddingTop: 12 },
  tag: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.hairline,
  },
  tagOn: { backgroundColor: colors.accentSoft, borderColor: colors.accentSoft },
  tagText: { color: colors.muted, fontSize: 14.5, fontFamily: font.medium },
  tagTextOn: { color: colors.accent, fontFamily: font.semibold },
  pressed: { opacity: 0.55 },
});
