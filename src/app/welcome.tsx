import Ionicons from "@expo/vector-icons/Ionicons";
import * as Location from "expo-location";
import { useEffect, useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/Button";
import { StepSlider } from "@/components/StepSlider";
import { healthAvailable, requestHealthAccess } from "@/lib/health";
import { defineStrings, useStrings } from "@/lib/i18n";
import {
  RUNNER_FREQUENCIES, RUNNER_GOALS, RUNNER_LEVELS, startingWeeklyGoalM, suggestedFrequency,
  type RunnerFrequency, type RunnerGoal, type RunnerLevel,
} from "@/lib/runner";
import { getSettings, markWelcomed, setRunner, setWeeklyGoal } from "@/lib/settings";
import { colors, font } from "@/lib/theme";

type Icon = React.ComponentProps<typeof Ionicons>["name"];

/** Where a permission stands, as far as this screen can tell. */
type Access = "unknown" | "granted" | "refused" | "asked";

const welcomeStrings = defineStrings({
  fr: {
    headline: "Cours, progresse, et garde tout pour toi.",
    recordTitle: "Enregistre tes courses",
    recordDetail: "Distance, allure, dénivelé et tracé, même écran verrouillé et téléphone en poche.",
    planTitle: "Suis un programme",
    planDetail:
      "Du 5 km au marathon : des séances construites semaine par semaine jusqu'au jour de ta course.",
    routesTitle: "Trace tes parcours",
    routesDetail: "Dessine une boucle qui suit les rues, puis cours dessus en la voyant sur la carte.",
    note: "Pas de compte, pas de publicité. Tes courses restent sur ton téléphone.",
    continue: "Continuer",
    back: "Retour",
    skip: "Passer",
    goalQuestion: "Pourquoi tu cours ?",
    goalLede: "C'est ce qui décide par où l'app commence.",
    goals: {
      regular: { title: "Courir régulièrement", detail: "Un objectif de distance chaque semaine" },
      race: { title: "Préparer une course", detail: "Un programme jusqu'au jour J" },
      comeback: { title: "Reprendre la course", detail: "Repartir en douceur après une pause" },
    } as Record<RunnerGoal, { title: string; detail: string }>,
    levelQuestion: "Où en es-tu ?",
    levelLede: "Pour partir de tes jambes d'aujourd'hui, pas de celles que tu voudrais avoir.",
    levels: {
      new: { title: "Je débute", detail: "Courir 20 minutes d'affilée est déjà un défi" },
      occasional: { title: "Je cours de temps en temps", detail: "Quelques sorties par mois, jusqu'à 40 minutes" },
      weekly: { title: "Je cours chaque semaine", detail: "Une heure ne me fait pas peur" },
    } as Record<RunnerLevel, { title: string; detail: string }>,
    frequencyQuestion: "Combien de sorties par semaine ?",
    frequencyLede: "Ce que tu peux tenir, pas ce que tu voudrais faire. Ça se change plus tard.",
    frequencyUnit: (n: number): string => (n > 1 ? "sorties par semaine" : "sortie par semaine"),
    frequencyHints: {
      1: "De quoi garder le fil, même les semaines chargées.",
      2: "Assez pour progresser, assez peu pour tenir.",
      3: "Un vrai entraînement, avec de la place pour récupérer.",
      4: "Pour viser haut, avec un corps déjà habitué.",
    } as Record<RunnerFrequency, string>,
    frequencyLabel: "Sorties par semaine",
    twoPermissions: "Deux autorisations",
    onePermission: "Une autorisation",
    permissionsLede:
      "Tu peux refuser : rien ne sera demandé en ton absence, et tu pourras changer d'avis dans les réglages du téléphone.",
    locationTitle: "Ta position",
    locationDetail:
      "Pour mesurer ta distance et dessiner ton tracé. Au départ d'une course, le téléphone proposera aussi de la garder écran éteint : accepte, sinon l'enregistrement s'arrête dès qu'il est dans ta poche.",
    openSettings: "Ouvrir les réglages",
    allow: "Autoriser",
    healthTitle: "Apple Santé",
    healthDetail:
      "Pour y copier tes courses, calculer tes calories avec ton poids, et afficher ta fréquence cardiaque si tu cours avec une montre.",
    connect: "Connecter",
    start: "Commencer",
    access: {
      granted: "Autorisée",
      refused: "Refusée",
      asked: "Demandée",
    } as Record<Exclude<Access, "unknown">, string>,
  },
  en: {
    headline: "Run, improve, and keep it all to yourself.",
    recordTitle: "Record your runs",
    recordDetail: "Distance, pace, elevation and track, even with the screen locked and your phone in your pocket.",
    planTitle: "Follow a training plan",
    planDetail: "From 5K to marathon: sessions built week by week, all the way to race day.",
    routesTitle: "Draw your routes",
    routesDetail: "Sketch a loop that follows the streets, then run it with the map in view.",
    note: "No account, no ads. Your runs stay on your phone.",
    continue: "Continue",
    back: "Back",
    skip: "Skip",
    goalQuestion: "Why do you run?",
    goalLede: "This decides where the app starts you.",
    goals: {
      regular: { title: "Run regularly", detail: "A distance goal every week" },
      race: { title: "Train for a race", detail: "A plan all the way to race day" },
      comeback: { title: "Get back into running", detail: "Ease back in after a break" },
    },
    levelQuestion: "Where are you now?",
    levelLede: "So we start from the legs you have today, not the ones you wish you had.",
    levels: {
      new: { title: "I'm just starting", detail: "Running 20 minutes straight is already a challenge" },
      occasional: { title: "I run now and then", detail: "A few runs a month, up to 40 minutes" },
      weekly: { title: "I run every week", detail: "An hour doesn't scare me" },
    },
    frequencyQuestion: "How many runs a week?",
    frequencyLede: "What you can keep up, not what you wish you did. You can change it later.",
    frequencyUnit: (n: number): string => (n > 1 ? "runs a week" : "run a week"),
    frequencyHints: {
      1: "Enough to keep the habit, even in busy weeks.",
      2: "Enough to improve, few enough to stick with.",
      3: "Real training, with room to recover.",
      4: "To aim high, with a body already used to it.",
    },
    frequencyLabel: "Runs a week",
    twoPermissions: "Two permissions",
    onePermission: "One permission",
    permissionsLede:
      "You can say no: nothing will be asked behind your back, and you can change your mind in your phone's settings.",
    locationTitle: "Your location",
    locationDetail:
      "To measure your distance and draw your track. When you start a run, your phone will also offer to keep it with the screen off: say yes, or recording stops as soon as the phone is in your pocket.",
    openSettings: "Open Settings",
    allow: "Allow",
    healthTitle: "Apple Health",
    healthDetail:
      "To save your runs there, work out your calories from your weight, and show your heart rate if you run with a watch.",
    connect: "Connect",
    start: "Get started",
    access: {
      granted: "Allowed",
      refused: "Denied",
      asked: "Requested",
    },
  },
});

/**
 * The first thing the app shows, once.
 *
 * One idea per page: what Tread does, then three questions about the runner —
 * each alone on its page, with the room to read its choices — then what the
 * app needs and why. Before this, the first thing anybody saw was the Health
 * sheet, raised by the app launching with no word of explanation.
 *
 * Nothing here is compulsory. The questions can be skipped, and every
 * permission can be refused and asked for again later where it is used.
 */
type Step = "intro" | "goal" | "level" | "frequency" | "permissions";

/** The steps a progress bar counts: everything after the introduction. */
const COUNTED: Step[] = ["goal", "level", "frequency", "permissions"];

export default function WelcomeScreen() {
  const [step, setStep] = useState<Step>("intro");
  const [goal, setGoal] = useState<RunnerGoal | null>(null);
  const [level, setLevel] = useState<RunnerLevel | null>(null);
  /** Null until the slider is touched, so it follows the level until then. */
  const [perWeek, setPerWeek] = useState<RunnerFrequency | null>(null);
  const frequency = perWeek ?? suggestedFrequency(level ?? "occasional");

  async function keep() {
    if (goal === null || level === null) return;
    const profile = { goal, level, perWeek: frequency };
    await setRunner(profile);
    // A race is prepared with a programme, which sets its own weeks. Anybody
    // else gets a weekly goal to aim at — unless they already set one.
    if (goal !== "race" && getSettings().weeklyGoalM === null) {
      await setWeeklyGoal(startingWeeklyGoalM(profile));
    }
    setStep("permissions");
  }

  const skip = () => setStep("permissions");

  return (
    <SafeAreaView style={styles.screen}>
      {step === "intro" ? <Introduction onNext={() => setStep("goal")} /> : null}

      {step === "goal" ? (
        <Question step={step} onBack={() => setStep("intro")} onSkip={skip}
          onNext={() => setStep("level")} ready={goal !== null}>
          <Choices kind="goals" options={RUNNER_GOALS} chosen={goal} onChoose={setGoal} />
        </Question>
      ) : null}

      {step === "level" ? (
        <Question step={step} onBack={() => setStep("goal")} onSkip={skip}
          onNext={() => setStep("frequency")} ready={level !== null}>
          <Choices kind="levels" options={RUNNER_LEVELS} chosen={level} onChoose={setLevel} />
        </Question>
      ) : null}

      {step === "frequency" ? (
        <Question step={step} onBack={() => setStep("level")} onSkip={skip}
          onNext={() => void keep()} ready={goal !== null && level !== null}>
          <Frequency value={frequency} onChange={setPerWeek} />
        </Question>
      ) : null}

      {step === "permissions" ? <Permissions /> : null}
    </SafeAreaView>
  );
}

/** How far through the welcome, as segments that fill. */
function Progress({ step }: { step: Step }) {
  const reached = COUNTED.indexOf(step);
  return (
    <View style={styles.progress}>
      {COUNTED.map((counted, at) => (
        <View key={counted} style={[styles.segment, at <= reached && styles.segmentOn]} />
      ))}
    </View>
  );
}

const QUESTION_TEXT = {
  goal: ["goalQuestion", "goalLede"],
  level: ["levelQuestion", "levelLede"],
  frequency: ["frequencyQuestion", "frequencyLede"],
} as const;

/** One question on its own page: the way back, the question, the answers, the way on. */
function Question({
  step, onBack, onSkip, onNext, ready, children,
}: {
  step: "goal" | "level" | "frequency";
  onBack: () => void;
  onSkip: () => void;
  onNext: () => void;
  ready: boolean;
  children: React.ReactNode;
}) {
  const s = useStrings(welcomeStrings);
  const [question, lede] = QUESTION_TEXT[step];
  return (
    <View style={styles.page}>
      <View style={styles.bar}>
        <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel={s.back} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Progress step={step} />
        <Pressable onPress={onSkip} accessibilityRole="button" hitSlop={12}>
          <Text style={styles.skipLabel}>{s.skip}</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.questionBody}>
        <Text style={styles.title}>{s[question]}</Text>
        <Text style={styles.lede}>{s[lede]}</Text>
        <View style={styles.answers}>{children}</View>
      </ScrollView>

      <View style={styles.footer}>
        <Button label={s.continue} onPress={onNext} disabled={!ready} />
      </View>
    </View>
  );
}

/** A list of answers, each a title with a line saying what it means. */
function Choices<K extends "goals" | "levels", T extends string>({
  kind, options, chosen, onChoose,
}: {
  kind: K;
  options: readonly T[];
  chosen: T | null;
  onChoose: (option: T) => void;
}) {
  const s = useStrings(welcomeStrings);
  const words = s[kind] as Record<string, { title: string; detail: string }>;
  return (
    <>
      {options.map((option) => (
        <Choice
          key={option}
          title={words[option].title}
          detail={words[option].detail}
          selected={chosen === option}
          onPress={() => onChoose(option)}
        />
      ))}
    </>
  );
}

/** The number, what it means, and the slider that sets it. */
function Frequency({ value, onChange }: { value: RunnerFrequency; onChange: (value: RunnerFrequency) => void }) {
  const s = useStrings(welcomeStrings);
  return (
    <View style={styles.frequency}>
      <View style={styles.frequencyReadout}>
        <Text style={styles.frequencyNumber}>{value}</Text>
        <Text style={styles.frequencyUnit}>{s.frequencyUnit(value)}</Text>
      </View>
      <Text style={styles.frequencyHint}>{s.frequencyHints[value]}</Text>
      <StepSlider
        values={RUNNER_FREQUENCIES}
        value={value}
        onChange={onChange}
        accessibilityLabel={s.frequencyLabel}
      />
    </View>
  );
}

function Introduction({ onNext }: { onNext: () => void }) {
  const s = useStrings(welcomeStrings);
  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.brand}>Tread</Text>
        <Text style={styles.title}>{s.headline}</Text>

        <View style={styles.features}>
          <Feature
            icon="play"
            title={s.recordTitle}
            detail={s.recordDetail}
          />
          <Feature
            icon="calendar"
            title={s.planTitle}
            detail={s.planDetail}
          />
          <Feature
            icon="map"
            title={s.routesTitle}
            detail={s.routesDetail}
          />
        </View>

        <Text style={styles.note}>{s.note}</Text>
      </ScrollView>

      <View style={styles.footer}>
        <Button label={s.continue} onPress={onNext} />
      </View>
    </View>
  );
}

function Feature({ icon, title, detail }: { icon: Icon; title: string; detail: string }) {
  return (
    <View style={styles.feature}>
      <View style={styles.featureIcon}>
        <Ionicons name={icon} size={20} color={colors.accent} />
      </View>
      <View style={styles.featureText}>
        <Text style={styles.featureTitle}>{title}</Text>
        <Text style={styles.featureDetail}>{detail}</Text>
      </View>
    </View>
  );
}

function Choice({
  title, detail, selected, onPress,
}: {
  title: string;
  detail: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={({ pressed }) => [styles.choice, selected && styles.chosen, pressed && styles.pressed]}
    >
      <View style={styles.choiceText}>
        <Text style={[styles.choiceTitle, selected && styles.chosenText]}>{title}</Text>
        <Text style={styles.choiceDetail}>{detail}</Text>
      </View>
      {selected ? <Ionicons name="checkmark-circle" size={22} color={colors.accent} /> : null}
    </Pressable>
  );
}

function Permissions() {
  const s = useStrings(welcomeStrings);
  const [location, setLocation] = useState<Access>("unknown");
  const [health, setHealth] = useState<Access>("unknown");
  const [canAskLocation, setCanAskLocation] = useState(true);
  const withHealth = healthAvailable();

  // A phone that already said yes, restored from a backup or reinstalled,
  // should not be asked a question it has answered.
  useEffect(() => {
    let active = true;
    void Location.getForegroundPermissionsAsync()
      .then((existing) => {
        if (!active) return;
        setCanAskLocation(existing.canAskAgain);
        if (existing.status === "granted") setLocation("granted");
        else if (existing.status === "denied") setLocation("refused");
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  async function askLocation() {
    if (!canAskLocation) {
      void Linking.openSettings();
      return;
    }
    try {
      const asked = await Location.requestForegroundPermissionsAsync();
      setCanAskLocation(asked.canAskAgain);
      setLocation(asked.status === "granted" ? "granted" : "refused");
    } catch {
      setLocation("refused");
    }
  }

  async function askHealth() {
    // Health never says whether reading was allowed, so the honest state
    // after asking is "asked", not "granted".
    await requestHealthAccess();
    setHealth("asked");
  }

  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.title}>{withHealth ? s.twoPermissions : s.onePermission}</Text>
        <Text style={styles.lede}>{s.permissionsLede}</Text>

        <Permission
          icon="navigate"
          title={s.locationTitle}
          detail={s.locationDetail}
          access={location}
          action={location === "refused" && !canAskLocation ? s.openSettings : s.allow}
          onPress={() => void askLocation()}
        />

        {withHealth ? (
          <Permission
            icon="heart"
            title={s.healthTitle}
            detail={s.healthDetail}
            access={health}
            action={s.connect}
            onPress={() => void askHealth()}
          />
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <Button label={s.start} onPress={() => void markWelcomed()} />
      </View>
    </View>
  );
}

function Permission({
  icon, title, detail, access, action, onPress,
}: {
  icon: Icon;
  title: string;
  detail: string;
  access: Access;
  action: string;
  onPress: () => void;
}) {
  const s = useStrings(welcomeStrings);
  const settled = access === "granted" || access === "asked";
  return (
    <View style={styles.permission}>
      <View style={styles.permissionHead}>
        <Ionicons name={icon} size={19} color={colors.accent} />
        <Text style={styles.permissionTitle}>{title}</Text>
        {access !== "unknown" ? (
          <Text style={[styles.status, access === "refused" && styles.statusRefused]}>
            {s.access[access]}
          </Text>
        ) : null}
      </View>
      <Text style={styles.permissionDetail}>{detail}</Text>
      {settled ? null : (
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          style={({ pressed }) => [styles.ask, pressed && styles.pressed]}
        >
          <Text style={styles.askLabel}>{action}</Text>
        </Pressable>
      )}
    </View>
  );
}

const GUTTER = 24;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  page: { flex: 1 },
  body: { paddingHorizontal: GUTTER, paddingTop: 36, paddingBottom: 24, gap: 14 },
  footer: { paddingHorizontal: GUTTER, paddingTop: 8, paddingBottom: 12 },
  bar: {
    flexDirection: "row", alignItems: "center", gap: 16,
    paddingHorizontal: GUTTER, paddingTop: 12, paddingBottom: 4,
  },
  progress: { flex: 1, flexDirection: "row", gap: 6 },
  segment: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.accentSoft },
  segmentOn: { backgroundColor: colors.accent },
  skipLabel: { color: colors.subtle, fontSize: 16, fontFamily: font.semibold },
  questionBody: { paddingHorizontal: GUTTER, paddingTop: 28, paddingBottom: 24, gap: 10 },
  answers: { gap: 10, marginTop: 18 },

  choice: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.hairline,
  },
  chosen: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  chosenText: { color: colors.accent },
  choiceText: { flex: 1, gap: 2 },
  choiceTitle: { color: colors.text, fontSize: 17, fontFamily: font.semibold },
  choiceDetail: { color: colors.muted, fontSize: 14, fontFamily: font.regular, lineHeight: 19 },
  frequency: { gap: 14, marginTop: 8 },
  frequencyReadout: { flexDirection: "row", alignItems: "baseline", gap: 10 },
  frequencyNumber: {
    color: colors.accent, fontSize: 72, fontFamily: font.bold,
    letterSpacing: -2, lineHeight: 76, fontVariant: ["tabular-nums"],
  },
  frequencyUnit: { color: colors.text, fontSize: 20, fontFamily: font.semibold },
  frequencyHint: {
    color: colors.muted, fontSize: 15.5, fontFamily: font.regular, lineHeight: 22,
    minHeight: 44, marginBottom: 10,
  },

  brand: {
    color: colors.accent, fontSize: 17, fontFamily: font.bold,
    letterSpacing: 2.4, textTransform: "uppercase",
  },
  title: {
    color: colors.text, fontSize: 36, fontFamily: font.bold,
    letterSpacing: -0.8, lineHeight: 40,
  },
  lede: { color: colors.muted, fontSize: 16, fontFamily: font.regular, lineHeight: 23 },
  note: {
    color: colors.subtle, fontSize: 14.5, fontFamily: font.regular, lineHeight: 21, marginTop: 8,
  },

  features: { gap: 20, marginTop: 18 },
  feature: { flexDirection: "row", gap: 14, alignItems: "flex-start" },
  featureIcon: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: "center", justifyContent: "center",
    backgroundColor: colors.accentSoft,
  },
  featureText: { flex: 1, gap: 2 },
  featureTitle: { color: colors.text, fontSize: 19, fontFamily: font.semibold, letterSpacing: -0.2 },
  featureDetail: { color: colors.muted, fontSize: 15, fontFamily: font.regular, lineHeight: 21 },

  permission: {
    gap: 8, marginTop: 10, paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline,
  },
  permissionHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  permissionTitle: { flex: 1, color: colors.text, fontSize: 19, fontFamily: font.semibold },
  status: { color: colors.accent, fontSize: 14.5, fontFamily: font.semibold },
  statusRefused: { color: colors.subtle },
  permissionDetail: { color: colors.muted, fontSize: 15, fontFamily: font.regular, lineHeight: 21 },
  ask: {
    alignSelf: "flex-start", marginTop: 4,
    paddingHorizontal: 16, paddingVertical: 9, borderRadius: 8,
    backgroundColor: colors.accentSoft,
  },
  askLabel: { color: colors.accent, fontSize: 15.5, fontFamily: font.semibold },
  pressed: { opacity: 0.6 },
});
