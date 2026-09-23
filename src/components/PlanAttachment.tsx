import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { GlassPanel } from "@/components/GlassPanel";
import {
  activePlan, detachRunFromPlan, markPlanSessionDone, planDone, type StoredPlan,
} from "@/lib/db";
import { schedule, startOfDay, type Done, type ScheduledSession } from "@/lib/plan";
import { defineStrings, intlLocale, useStrings } from "@/lib/i18n";
import { colors, floatingShadow, font } from "@/lib/theme";
import { sessionMinutes, sessionName } from "@/lib/workout";

/**
 * Midnight of the day this module was loaded.
 *
 * The same reason the screens read it this way: a render may not ask the
 * clock, and asking in an effect costs a frame drawn without a date. It only
 * decides where pending sessions fall, which does not move under anybody
 * inside a single sitting.
 */
const BOOT_DAY = startOfDay(Date.now());

const attachmentStrings = defineStrings({
  fr: {
    title: "Programme",
    week: (n: number) => `Semaine ${n}`,
    weekLower: (n: number) => `semaine ${n}`,
    detachLabel: "Détacher cette course de la séance",
    detach: "Détacher",
    nonePending: "Aucune séance en attente.",
    attach: "Rattacher à une séance",
    attachTo: "Rattacher à",
    muchLonger: "bien plus longue que la séance",
    muchShorter: "bien plus courte que la séance",
  },
  en: {
    title: "Training plan",
    week: (n: number) => `Week ${n}`,
    weekLower: (n: number) => `week ${n}`,
    detachLabel: "Detach this run from the session",
    detach: "Detach",
    nonePending: "No sessions waiting.",
    attach: "Link to a session",
    attachTo: "Link to",
    muchLonger: "much longer than the session",
    muchShorter: "much shorter than the session",
  },
});

const dayName = (at: number): string =>
  new Date(at).toLocaleDateString(intlLocale(), { weekday: "short", day: "numeric" });

/**
 * How far a run is from what a session asked for.
 *
 * Nothing can tell whether a link is sincere — a five kilometre jog can be
 * filed under a session of repetitions and the programme will believe it,
 * easing off and reporting progress on the strength of a run that never
 * happened. What an estimate can do is say when the two are nowhere near each
 * other, and let the runner decide anyway: they are sometimes right about
 * their own training and the app never quite is.
 */
function mismatch(session: ScheduledSession, durationS: number): string | null {
  const expected = sessionMinutes(session.session) * 60;
  if (expected <= 0 || durationS <= 0) return null;
  const ratio = durationS / expected;
  if (ratio > 1.5) return attachmentStrings().muchLonger;
  if (ratio < 0.6) return attachmentStrings().muchShorter;
  return null;
}

interface Props {
  runId: number;
  durationS: number;
  /** Called once the link has changed, so the sheet around can reload. */
  onChange?: () => void;
}

/**
 * Tying a run to the session it was really for, after the fact.
 *
 * The link is normally made when a run is started from the programme, which
 * asks somebody to remember one thing before setting off. Forgetting it used
 * to cost the session outright: the run was filed on its own and the
 * programme went on waiting for something already done, with no way to say so.
 */
export function PlanAttachment({ runId, durationS, onChange }: Props) {
  const [plan, setPlan] = useState<StoredPlan | null>(null);
  const [done, setDone] = useState<Map<number, Done>>(new Map());
  const [picking, setPicking] = useState(false);
  const s = useStrings(attachmentStrings);

  const load = useCallback(() => {
    let live = true;
    activePlan()
      .then(async (found) => {
        if (!live) return;
        setPlan(found);
        setDone(found ? await planDone(found.id) : new Map());
      })
      .catch(() => undefined);
    return () => { live = false; };
  }, []);

  useFocusEffect(load);

  // No programme, nothing to say. The section does not appear at all rather
  // than appearing empty.
  if (!plan) return null;

  const scheduled = schedule(plan.sessions, done, BOOT_DAY, plan.raceAt, plan.days);
  const linked = scheduled.find((entry) => entry.runId === runId) ?? null;
  // The race is never offered: it is the one run nobody records by accident.
  const pending = scheduled.filter((entry) => !entry.settled && entry.kind !== "race");

  function attach(entry: ScheduledSession) {
    setPicking(false);
    void markPlanSessionDone(entry.order, runId)
      .then(() => { load(); onChange?.(); })
      .catch(() => undefined);
  }

  function detach() {
    void detachRunFromPlan(runId)
      .then(() => { load(); onChange?.(); })
      .catch(() => undefined);
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{s.title}</Text>

      {linked ? (
        <View style={styles.linked}>
          <View style={styles.linkedText}>
            <Text style={styles.name}>{sessionName(linked.session)}</Text>
            <Text style={styles.detail}>{s.week(linked.week)}</Text>
          </View>
          <Pressable
            onPress={detach}
            accessibilityRole="button"
            accessibilityLabel={s.detachLabel}
            hitSlop={10}
            style={({ pressed }) => [pressed && styles.pressed]}
          >
            <Text style={styles.detach}>{s.detach}</Text>
          </Pressable>
        </View>
      ) : pending.length === 0 ? (
        <Text style={styles.detail}>{s.nonePending}</Text>
      ) : (
        <Pressable
          onPress={() => setPicking(true)}
          accessibilityRole="button"
          style={({ pressed }) => [styles.attach, pressed && styles.pressed]}
        >
          <Ionicons name="link-outline" size={17} color={colors.accent} />
          <Text style={styles.attachLabel}>{s.attach}</Text>
        </Pressable>
      )}

      <Modal
        visible={picking}
        transparent
        animationType="fade"
        onRequestClose={() => setPicking(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setPicking(false)}>
          {/* Stops a tap inside the sheet from closing it. */}
          <Pressable onPress={() => undefined} style={styles.sheet}>
            <GlassPanel style={styles.panel}>
              <Text style={styles.kicker}>{s.attachTo}</Text>
              <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
                {pending.map((entry) => {
                  const off = mismatch(entry, durationS);
                  return (
                    <Pressable
                      key={entry.order}
                      onPress={() => attach(entry)}
                      accessibilityRole="button"
                      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                    >
                      <View style={styles.rowText}>
                        <Text style={styles.name}>{sessionName(entry.session)}</Text>
                        <Text style={[styles.detail, off !== null && styles.warn]}>
                          {dayName(entry.at)} · {s.weekLower(entry.week)}
                          {off !== null ? ` · ${off}` : ""}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={colors.subtle} />
                    </Pressable>
                  );
                })}
              </ScrollView>
            </GlassPanel>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const GUTTER = 20;

const styles = StyleSheet.create({
  section: {
    paddingHorizontal: GUTTER, paddingVertical: 15, gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline,
  },
  sectionTitle: {
    color: colors.subtle, fontSize: 11.5, fontFamily: font.semibold,
    letterSpacing: 1.3, textTransform: "uppercase",
  },

  linked: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  linkedText: { flex: 1, gap: 1 },
  detach: { color: colors.danger, fontSize: 13.5, fontFamily: font.semibold },

  attach: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 2 },
  attachLabel: { color: colors.accent, fontSize: 15, fontFamily: font.semibold },

  name: { color: colors.text, fontSize: 15.5, fontFamily: font.semibold },
  detail: { color: colors.subtle, fontSize: 13, fontFamily: font.regular },
  warn: { color: colors.warning },

  backdrop: {
    flex: 1, backgroundColor: colors.scrim,
    alignItems: "center", justifyContent: "center", padding: 22,
  },
  sheet: { width: "100%", maxWidth: 380, ...floatingShadow },
  panel: { borderRadius: 20, paddingHorizontal: 18, paddingVertical: 16, gap: 6 },
  kicker: {
    color: colors.subtle, fontSize: 11, fontFamily: font.semibold,
    letterSpacing: 1.4, textTransform: "uppercase",
  },
  list: { maxHeight: 360 },
  row: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    gap: 12, paddingVertical: 10,
  },
  rowText: { flex: 1, gap: 1 },
  pressed: { opacity: 0.6 },
});
