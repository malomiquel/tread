import Ionicons from "@expo/vector-icons/Ionicons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { Button } from "@/components/Button";
import { SettingRow } from "@/components/SettingRow";
import { SettingsGroup } from "@/components/SettingsGroup";
import { deleteShoe, listShoes, saveShoe } from "@/lib/db";
import { formatDistance } from "@/lib/format";
import { defineStrings, useStrings } from "@/lib/i18n";
import {
  DEFAULT_LIMIT_M, MAX_LIMIT_M, MIN_LIMIT_M, nudgeDistance, wearOf, type Shoe,
} from "@/lib/shoes";
import { colors, font } from "@/lib/theme";
import { distanceUnit, toDistanceUnits, unitLengthM } from "@/lib/units";

/** A distance in the runner's unit, to the nearest ten: "500", "310". */
const roundedUnits = (metres: number) => Math.round(toDistanceUnits(metres) / 10) * 10;

const strings = defineStrings({
  fr: {
    newTitle: "Nouvelle paire",
    editTitle: "Paire",
    name: "Nom",
    namePlaceholder: "Marque et modèle",
    distance: "Distance",
    covered: (done: string, limit: string) => `${done} sur ${limit} ${distanceUnit()}`,
    percent: (value: number) => `${value} % de sa durée`,
    start: "Déjà parcourus",
    startDetail: "Avant de l'ajouter ici",
    limit: "À remplacer vers",
    limitDetail: (low: number, high: number) => `Entre ${low} et ${high} ${distanceUnit()} pour la plupart des paires`,
    value: (value: string) => `${value} ${distanceUnit()}`,
    less: "Moins",
    more: "Plus",
    isDefault: "Paire par défaut",
    isDefaultFooter: "Les nouvelles courses sont comptées pour la paire par défaut.",
    retire: "Retirer cette paire",
    unretire: "Remettre en service",
    save: "Enregistrer",
    delete: "Supprimer la paire",
    deleteTitle: "Supprimer cette paire ?",
    deleteMessage: "Ses courses restent, sans paire.",
    cancel: "Annuler",
    saveFailed: "Enregistrement impossible",
    tryAgain: "La paire n'a pas pu être enregistrée. Réessaie.",
  },
  en: {
    newTitle: "New pair",
    editTitle: "Pair",
    name: "Name",
    namePlaceholder: "Brand and model",
    distance: "Distance",
    covered: (done: string, limit: string) => `${done} of ${limit} ${distanceUnit()}`,
    percent: (value: number) => `${value}% of its life`,
    start: "Already covered",
    startDetail: "Before it was added here",
    limit: "Replace at",
    limitDetail: (low: number, high: number) => `Between ${low} and ${high} ${distanceUnit()} for most pairs`,
    value: (value: string) => `${value} ${distanceUnit()}`,
    less: "Less",
    more: "More",
    isDefault: "Default pair",
    isDefaultFooter: "New runs count for the default pair.",
    retire: "Retire this pair",
    unretire: "Put back in use",
    save: "Save",
    delete: "Delete pair",
    deleteTitle: "Delete this pair?",
    deleteMessage: "Its runs stay, with no pair.",
    cancel: "Cancel",
    saveFailed: "Couldn't save",
    tryAgain: "The pair couldn't be saved. Try again.",
  },
});

/** − figure +, for a distance moved fifty units at a time. */
function DistanceStepper({ metres, min, max, onChange }: {
  metres: number;
  min: number;
  max: number;
  onChange: (metres: number) => void;
}) {
  const s = useStrings(strings);
  const step = (direction: 1 | -1) => onChange(nudgeDistance(metres, unitLengthM(), direction, min, max));
  return (
    <View style={styles.stepper}>
      <Pressable
        onPress={() => step(-1)}
        disabled={metres <= min}
        accessibilityRole="button"
        accessibilityLabel={s.less}
        hitSlop={6}
        style={({ pressed }) => [styles.stepButton, pressed && styles.pressed, metres <= min && styles.disabled]}
      >
        <Ionicons name="remove" size={18} color={colors.text} />
      </Pressable>
      <Text style={styles.stepValue}>{s.value(formatDistance(metres))}</Text>
      <Pressable
        onPress={() => step(1)}
        disabled={metres >= max}
        accessibilityRole="button"
        accessibilityLabel={s.more}
        hitSlop={6}
        style={({ pressed }) => [styles.stepButton, pressed && styles.pressed, metres >= max && styles.disabled]}
      >
        <Ionicons name="add" size={18} color={colors.text} />
      </Pressable>
    </View>
  );
}

/**
 * One pair: its name, where its count starts, when it is due, and whether new
 * runs go to it.
 */
export default function ShoeScreen() {
  const s = useStrings(strings);
  const router = useRouter();
  const param = useLocalSearchParams<{ id: string }>().id;
  const id = param === "new" ? null : Number(param);
  const [shoe, setShoe] = useState<Shoe | null>(null);
  const [loaded, setLoaded] = useState(id === null);
  const [name, setName] = useState("");
  const [startM, setStartM] = useState(0);
  const [limitM, setLimitM] = useState(DEFAULT_LIMIT_M);
  const [isDefault, setIsDefault] = useState(true);
  const [retired, setRetired] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    void listShoes().then((shoes) => {
      if (!active) return;
      if (id === null) {
        // The first pair is the one being run in; a second is usually a
        // spare, and taking the default from the first would be a surprise.
        setIsDefault(!shoes.some((held) => held.isDefault));
        return;
      }
      const found = shoes.find((held) => held.id === id) ?? null;
      setShoe(found);
      if (found) {
        setName(found.name);
        setStartM(found.startM);
        setLimitM(found.limitM);
        setIsDefault(found.isDefault);
        setRetired(found.retired);
      }
      setLoaded(true);
    }).catch(() => setLoaded(true));
    return () => { active = false; };
  }, [id]);

  const save = async (fields = { retired }) => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await saveShoe(id, { name, startM, limitM, retired: fields.retired, isDefault });
      router.back();
    } catch {
      setSaving(false);
      Alert.alert(s.saveFailed, s.tryAgain);
    }
  };

  const remove = () => {
    if (id === null) return;
    Alert.alert(s.deleteTitle, s.deleteMessage, [
      { text: s.cancel, style: "cancel" },
      { text: s.delete, style: "destructive", onPress: () => void deleteShoe(id).then(() => router.back()) },
    ]);
  };

  if (!loaded) return <View style={styles.screen} />;
  const covered = (shoe?.distanceM ?? 0) - (shoe?.startM ?? 0) + startM;
  const { share } = wearOf({ distanceM: covered, limitM });

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: id === null ? s.newTitle : s.editTitle }} />

      <SettingsGroup title={s.name}>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder={s.namePlaceholder}
          placeholderTextColor={colors.subtle}
          style={styles.input}
          maxLength={50}
          autoFocus={id === null}
          accessibilityLabel={s.name}
        />
      </SettingsGroup>

      {id !== null ? (
        <SettingsGroup title={s.distance}>
          <View style={styles.wear}>
            <Text style={styles.wearFigure}>{s.covered(formatDistance(covered), formatDistance(limitM))}</Text>
            <View style={styles.bar}>
              <View
                style={[
                  styles.fill,
                  { width: `${Math.min(1, share) * 100}%` },
                  share >= 1 && styles.fillWorn,
                ]}
              />
            </View>
            <Text style={styles.wearDetail}>{s.percent(Math.round(share * 100))}</Text>
          </View>
        </SettingsGroup>
      ) : null}

      <SettingsGroup>
        <SettingRow
          icon="play-skip-back-outline"
          label={s.start}
          detail={s.startDetail}
          right={<DistanceStepper metres={startM} min={0} max={MAX_LIMIT_M} onChange={setStartM} />}
        />
        <SettingRow
          icon="flag-outline"
          label={s.limit}
          detail={s.limitDetail(roundedUnits(500_000), roundedUnits(800_000))}
          right={<DistanceStepper metres={limitM} min={MIN_LIMIT_M} max={MAX_LIMIT_M} onChange={setLimitM} />}
        />
      </SettingsGroup>

      {!retired ? (
        <SettingsGroup footer={s.isDefaultFooter}>
          <SettingRow
            icon="star-outline"
            label={s.isDefault}
            right={
              <Switch
                value={isDefault}
                onValueChange={setIsDefault}
                trackColor={{ true: colors.accent, false: colors.hairline }}
                accessibilityLabel={s.isDefault}
              />
            }
          />
        </SettingsGroup>
      ) : null}

      <View style={styles.actions}>
        <Button label={s.save} onPress={() => void save()} disabled={saving || !name.trim()} />
        {id !== null ? (
          <Button
            label={retired ? s.unretire : s.retire}
            variant="secondary"
            onPress={() => void save({ retired: !retired })}
            disabled={saving || !name.trim()}
          />
        ) : null}
        {id !== null ? <Button label={s.delete} variant="danger" onPress={remove} /> : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: 48 },
  input: { color: colors.text, fontSize: 17, fontFamily: font.semibold, paddingVertical: 13 },
  wear: { paddingVertical: 14, gap: 8 },
  wearFigure: { color: colors.text, fontSize: 19, fontFamily: font.semibold, fontVariant: ["tabular-nums"] },
  bar: { height: 6, borderRadius: 3, overflow: "hidden", backgroundColor: colors.hairline },
  fill: { height: 6, borderRadius: 3, backgroundColor: colors.accent },
  fillWorn: { backgroundColor: colors.warning },
  wearDetail: { color: colors.subtle, fontSize: 13.5, fontFamily: font.regular },
  stepper: { flexDirection: "row", alignItems: "center", gap: 2 },
  stepButton: {
    width: 30, height: 30, borderRadius: 15,
    alignItems: "center", justifyContent: "center", backgroundColor: colors.background,
  },
  stepValue: {
    color: colors.text, fontSize: 15.5, fontFamily: font.semibold,
    minWidth: 66, textAlign: "center", fontVariant: ["tabular-nums"],
  },
  disabled: { opacity: 0.35 },
  pressed: { opacity: 0.55 },
  actions: { gap: 10, marginTop: 28, paddingHorizontal: 16 },
});
