import Ionicons from "@expo/vector-icons/Ionicons";
import * as Haptics from "expo-haptics";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Button } from "@/components/Button";
import {
  customSessionId, defaultName, EFFORTS, MAX_TIMES, measureLabel, nudge, starterGroups, switchMeasure, toSession,
  type DraftBlock, type DraftGroup,
} from "@/lib/customSession";
import { defineStrings, useStrings } from "@/lib/i18n";
import { customSession, removeCustomSession, storeCustomSession } from "@/lib/sessionLibrary";
import { colors, font } from "@/lib/theme";
import { chooseSession, getSnapshot } from "@/lib/tracker";
import { effortName, sessionMinutes } from "@/lib/workout";

const editorStrings = defineStrings({
  fr: {
    newTitle: "Nouvelle séance",
    editTitle: "Modifier la séance",
    name: "Nom",
    summary: (minutes: number, blocks: number) => `environ ${minutes} min · ${blocks} blocs`,
    step: (index: number) => `Étape ${index}`,
    repeat: "Répéter",
    fewer: "Une fois de moins",
    more: "Une fois de plus",
    removeStep: (index: number) => `Retirer l'étape ${index}`,
    distance: "Distance",
    time: "Durée",
    shorter: "Plus court",
    longer: "Plus long",
    removeBlock: "Retirer ce bloc",
    addBlock: "Ajouter un bloc",
    addStep: "Ajouter une étape",
    save: "Enregistrer",
    delete: "Supprimer la séance",
    deleteTitle: "Supprimer cette séance ?",
    deleteMessage: "Les courses déjà faites avec elle gardent leurs blocs.",
    cancel: "Annuler",
    saveFailed: "Enregistrement impossible",
    tryAgain: "La séance n'a pas pu être enregistrée. Réessaie.",
  },
  en: {
    newTitle: "New session",
    editTitle: "Edit session",
    name: "Name",
    summary: (minutes: number, blocks: number) => `about ${minutes} min · ${blocks} blocks`,
    step: (index: number) => `Step ${index}`,
    repeat: "Repeat",
    fewer: "One time fewer",
    more: "One time more",
    removeStep: (index: number) => `Remove step ${index}`,
    distance: "Distance",
    time: "Time",
    shorter: "Shorter",
    longer: "Longer",
    removeBlock: "Remove this block",
    addBlock: "Add a block",
    addStep: "Add a step",
    save: "Save",
    delete: "Delete session",
    deleteTitle: "Delete this session?",
    deleteMessage: "Runs already done with it keep their blocks.",
    cancel: "Cancel",
    saveFailed: "Couldn't save",
    tryAgain: "The session couldn't be saved. Try again.",
  },
});

const capitalised = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);

/** A round − or + beside a figure. */
function Stepper({ icon, label, onPress, disabled = false }: {
  icon: "remove" | "add";
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={() => {
        void Haptics.selectionAsync().catch(() => undefined);
        onPress();
      }}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={({ pressed }) => [styles.stepper, pressed && styles.pressed, disabled && styles.disabled]}
    >
      <Ionicons name={icon} size={18} color={colors.text} />
    </Pressable>
  );
}

/** One block: what kind of effort, measured how, and how much of it. */
function BlockEditor({ block, onChange, onRemove }: {
  block: DraftBlock;
  onChange: (block: DraftBlock) => void;
  onRemove: (() => void) | null;
}) {
  const s = useStrings(editorStrings);
  return (
    <View style={styles.block}>
      <View style={styles.chips}>
        {EFFORTS.map((effort) => {
          const on = block.effort === effort;
          return (
            <Pressable
              key={effort}
              onPress={() => onChange({ ...block, effort })}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              style={[styles.chip, on && styles.chipOn]}
            >
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{capitalised(effortName(effort))}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.measureRow}>
        <View style={styles.segments}>
          {(["metres", "seconds"] as const).map((measure) => {
            const on = block.measure === measure;
            return (
              <Pressable
                key={measure}
                onPress={() => (on ? undefined : onChange(switchMeasure(block)))}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                style={[styles.segment, on && styles.segmentOn]}
              >
                <Text style={[styles.segmentText, on && styles.segmentTextOn]}>
                  {measure === "metres" ? s.distance : s.time}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.value}>
          <Stepper
            icon="remove"
            label={s.shorter}
            onPress={() => onChange({ ...block, value: nudge(block.value, block.measure, -1) })}
          />
          <Text style={styles.valueText}>{measureLabel(block)}</Text>
          <Stepper
            icon="add"
            label={s.longer}
            onPress={() => onChange({ ...block, value: nudge(block.value, block.measure, 1) })}
          />
        </View>
        {onRemove ? (
          <Pressable onPress={onRemove} accessibilityRole="button" accessibilityLabel={s.removeBlock} hitSlop={8}>
            <Ionicons name="trash-outline" size={18} color={colors.subtle} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

/**
 * Writing a session of your own.
 *
 * Built as steps, each repeated some number of times, because that is how a
 * session is said out loud — ten minutes easy, then five times four hundred
 * with two hundred to recover, then five minutes easy. Every figure moves by
 * steps rather than being typed: a keyboard over half the screen to enter
 * "400" is a keyboard in the way of everything else.
 */
export default function SessionEditor() {
  const s = useStrings(editorStrings);
  const router = useRouter();
  const param = useLocalSearchParams<{ id: string }>().id;
  const existing = param === "new" ? null : customSession(Number(param));
  const [name, setName] = useState(existing?.name ?? "");
  const [groups, setGroups] = useState<DraftGroup[]>(() => existing?.groups ?? starterGroups());
  const [saving, setSaving] = useState(false);

  const draft = toSession({ id: existing?.id ?? 0, name, groups });

  const changeGroup = (index: number, group: DraftGroup) =>
    setGroups((current) => current.map((held, i) => (i === index ? group : held)));

  // The session under the run button follows the edit, so what was just
  // saved is what is run — never the copy from before.
  const follow = (id: number | null) => {
    const { status, session } = getSnapshot();
    if (status !== "idle" || session === null || existing === null) return;
    if (session.id !== customSessionId(existing.id)) return;
    const saved = id === null ? null : customSession(id);
    chooseSession(saved ? toSession(saved) : null);
  };

  const save = async () => {
    setSaving(true);
    try {
      const id = await storeCustomSession(existing?.id ?? null, name, groups);
      follow(id);
      router.back();
    } catch {
      setSaving(false);
      Alert.alert(s.saveFailed, s.tryAgain);
    }
  };

  const remove = () => {
    if (!existing) return;
    Alert.alert(s.deleteTitle, s.deleteMessage, [
      { text: s.cancel, style: "cancel" },
      {
        text: s.delete,
        style: "destructive",
        onPress: () => {
          void removeCustomSession(existing.id).then(() => {
            follow(null);
            router.back();
          });
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: existing ? s.editTitle : s.newTitle }} />

      <Text style={styles.label}>{s.name}</Text>
      <View style={styles.card}>
        <TextInput
          value={name}
          onChangeText={setName}
          // The name it would get anyway, so leaving it empty is a choice.
          placeholder={defaultName(groups)}
          placeholderTextColor={colors.subtle}
          style={styles.input}
          returnKeyType="done"
          maxLength={60}
          accessibilityLabel={s.name}
        />
      </View>
      <Text style={styles.summary}>{s.summary(sessionMinutes(draft), draft.steps.length)}</Text>

      {groups.map((group, index) => (
        <View key={index} style={styles.groupWrap}>
          <View style={styles.groupHead}>
            <Text style={styles.label}>{s.step(index + 1)}</Text>
            {groups.length > 1 ? (
              <Pressable
                onPress={() => setGroups((current) => current.filter((_, i) => i !== index))}
                accessibilityRole="button"
                accessibilityLabel={s.removeStep(index + 1)}
                hitSlop={8}
              >
                <Ionicons name="trash-outline" size={18} color={colors.subtle} />
              </Pressable>
            ) : null}
          </View>
          <View style={styles.card}>
            <View style={styles.repeat}>
              <Text style={styles.repeatLabel}>{s.repeat}</Text>
              <View style={styles.value}>
                <Stepper
                  icon="remove"
                  label={s.fewer}
                  onPress={() => changeGroup(index, { ...group, times: group.times - 1 })}
                  disabled={group.times <= 1}
                />
                <Text style={[styles.valueText, group.times > 1 && styles.times]}>× {group.times}</Text>
                <Stepper
                  icon="add"
                  label={s.more}
                  onPress={() => changeGroup(index, { ...group, times: group.times + 1 })}
                  disabled={group.times >= MAX_TIMES}
                />
              </View>
            </View>
            {group.blocks.map((block, blockIndex) => (
              <BlockEditor
                key={blockIndex}
                block={block}
                onChange={(next) => changeGroup(index, {
                  ...group,
                  blocks: group.blocks.map((held, i) => (i === blockIndex ? next : held)),
                })}
                onRemove={group.blocks.length > 1
                  ? () => changeGroup(index, { ...group, blocks: group.blocks.filter((_, i) => i !== blockIndex) })
                  : null}
              />
            ))}
            <Pressable
              onPress={() => changeGroup(index, {
                ...group,
                blocks: [...group.blocks, { effort: "recovery", measure: "seconds", value: 90 }],
              })}
              accessibilityRole="button"
              style={({ pressed }) => [styles.add, pressed && styles.pressed]}
            >
              <Ionicons name="add" size={18} color={colors.accent} />
              <Text style={styles.addText}>{s.addBlock}</Text>
            </Pressable>
          </View>
        </View>
      ))}

      <Pressable
        onPress={() => setGroups((current) => [
          ...current,
          { times: 1, blocks: [{ effort: "steady", measure: "seconds", value: 600 }] },
        ])}
        accessibilityRole="button"
        style={({ pressed }) => [styles.addStep, pressed && styles.pressed]}
      >
        <Ionicons name="add-circle-outline" size={20} color={colors.accent} />
        <Text style={styles.addText}>{s.addStep}</Text>
      </Pressable>

      <View style={styles.actions}>
        <Button label={s.save} onPress={() => void save()} disabled={saving} />
        {existing ? <Button label={s.delete} variant="danger" onPress={remove} /> : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 48 },
  label: {
    color: colors.subtle, fontSize: 12.5, fontFamily: font.medium,
    letterSpacing: 1, textTransform: "uppercase", marginHorizontal: 4, marginBottom: 7,
  },
  card: { borderRadius: 14, paddingHorizontal: 14, backgroundColor: colors.sunken },
  input: { color: colors.text, fontSize: 17, fontFamily: font.semibold, paddingVertical: 13 },
  summary: { color: colors.subtle, fontSize: 13.5, fontFamily: font.regular, marginHorizontal: 4, marginTop: 7 },

  groupWrap: { marginTop: 22 },
  groupHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingRight: 4 },
  repeat: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 8 },
  repeatLabel: { color: colors.text, fontSize: 16.5, fontFamily: font.medium },
  times: { color: colors.accent },

  block: {
    paddingVertical: 12, gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: colors.background },
  chipOn: { backgroundColor: colors.accent },
  chipText: { color: colors.muted, fontSize: 14, fontFamily: font.medium },
  chipTextOn: { color: colors.accentText },
  measureRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  segments: { flexDirection: "row", borderRadius: 8, overflow: "hidden", backgroundColor: colors.background },
  segment: { paddingHorizontal: 10, paddingVertical: 6 },
  segmentOn: { backgroundColor: colors.accentSoft },
  segmentText: { color: colors.muted, fontSize: 14, fontFamily: font.medium },
  segmentTextOn: { color: colors.accent },
  value: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 4 },
  valueText: {
    color: colors.text, fontSize: 17, fontFamily: font.semibold,
    minWidth: 70, textAlign: "center", fontVariant: ["tabular-nums"],
  },
  stepper: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: "center", justifyContent: "center", backgroundColor: colors.background,
  },
  disabled: { opacity: 0.35 },
  pressed: { opacity: 0.55 },

  add: {
    flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline,
  },
  addStep: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 18, marginHorizontal: 4 },
  addText: { color: colors.accent, fontSize: 16, fontFamily: font.semibold },
  actions: { gap: 10, marginTop: 28 },
});
