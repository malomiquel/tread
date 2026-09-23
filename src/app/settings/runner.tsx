import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SettingRow } from "@/components/SettingRow";
import { SettingsGroup } from "@/components/SettingsGroup";
import { StepSlider } from "@/components/StepSlider";
import { defineStrings, useStrings } from "@/lib/i18n";
import {
  RUNNER_FREQUENCIES, RUNNER_GOALS, RUNNER_LEVELS, runnerWords, suggestedFrequency,
  type RunnerProfile,
} from "@/lib/runner";
import { setRunner, useSettings } from "@/lib/settings";
import { colors, font } from "@/lib/theme";

const runnerStrings = defineStrings({
  fr: {
    goal: "Pourquoi tu cours",
    level: "Où tu en es",
    frequency: "Sorties par semaine",
    footer: "Sert à pré-remplir un programme et à proposer un objectif. Tes vraies courses comptent toujours davantage.",
  },
  en: {
    goal: "Why you run",
    level: "Where you are",
    frequency: "Runs a week",
    footer: "Used to pre-fill a training plan and suggest a goal. Your actual runs always count for more.",
  },
});

/** What somebody who skipped the questions is taken to be, until they say. */
const FALLBACK: RunnerProfile = { goal: "regular", level: "occasional", perWeek: suggestedFrequency("occasional") };

/**
 * The answers from the welcome, open to change.
 *
 * Asked once, on the first day, the answers go stale: somebody who began
 * as a beginner runs every week three months later. Each change is kept the
 * moment it is made, like every other setting; nothing already built — a
 * programme, a goal — is rewritten behind the runner's back.
 */
export default function RunnerSettings() {
  const s = useStrings(runnerStrings);
  const words = useStrings(runnerWords);
  const profile = useSettings().runner ?? FALLBACK;
  const change = (next: Partial<RunnerProfile>) => void setRunner({ ...profile, ...next });

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <SettingsGroup title={s.goal}>
        {RUNNER_GOALS.map((goal) => (
          <SettingRow
            key={goal}
            label={words.goals[goal].title}
            detail={words.goals[goal].detail}
            selected={profile.goal === goal}
            onPress={() => change({ goal })}
          />
        ))}
      </SettingsGroup>

      <SettingsGroup title={s.level}>
        {RUNNER_LEVELS.map((level) => (
          <SettingRow
            key={level}
            label={words.levels[level].title}
            detail={words.levels[level].detail}
            selected={profile.level === level}
            onPress={() => change({ level })}
          />
        ))}
      </SettingsGroup>

      <SettingsGroup title={s.frequency} footer={s.footer}>
        <View style={styles.frequency}>
          <Text style={styles.readout}>
            {profile.perWeek}
            <Text style={styles.unit}> {words.frequencyUnit(profile.perWeek)}</Text>
          </Text>
          <Text style={styles.hint}>{words.frequencyHints[profile.perWeek]}</Text>
          <StepSlider
            values={RUNNER_FREQUENCIES}
            value={profile.perWeek}
            onChange={(perWeek) => change({ perWeek })}
            accessibilityLabel={words.frequencyLabel}
          />
        </View>
      </SettingsGroup>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: 40 },
  frequency: { paddingVertical: 14, gap: 6 },
  readout: {
    color: colors.accent, fontSize: 30, fontFamily: font.semibold, fontVariant: ["tabular-nums"],
  },
  unit: { color: colors.text, fontSize: 17, fontFamily: font.medium },
  hint: { color: colors.muted, fontSize: 14.5, fontFamily: font.regular, lineHeight: 20, minHeight: 40 },
});
