import { ScrollView, StyleSheet, Text, View } from "react-native";
import { defineStrings, useStrings } from "@/lib/i18n";
import { colors, font } from "@/lib/theme";

/**
 * How a programme is built, said out loud.
 *
 * The provenance of every constant is written into `plan.ts`, where it can be
 * checked against the code it describes — but that is a developer's view of
 * it, and it left the app more certain of itself than it has any right to be.
 * A runner is handed three months of instructions; they are owed the
 * reasoning, and they are owed the parts that are merely my judgement.
 *
 * Deliberately plain text. Nothing here is computed, so nothing here can fall
 * out of step with a particular plan and quietly start lying about it.
 */
type Tone = "solid" | "soft" | "mine";

const methodStrings = defineStrings<{
  lede: string;
  sections: { title: string; body: string[] }[];
  sourcesTitle: string;
  sourcesIntro: string;
  levels: { tag: string; tone: Tone; body: string }[];
  cautionTitle: string;
  cautionIgnored: string;
  cautionAdvice: string;
}>({
  fr: {
    lede: "Un programme, c'est trois mois d'instructions. Voici comment celui-ci est construit, et ce qui, là-dedans, repose sur des travaux publiés, et ce qui relève de choix faits pour Tread.",
    sections: [
      {
        title: "Les allures",
        body: [
          "Tout part du temps que tu vises, pas de celui que tu as déjà fait. Un programme entraîne le coureur que tu comptes être le jour de la course — c'est sa raison d'être. Le chrono est simplement prérempli depuis ta meilleure sortie pour que la projection démarre du réel.",
          "De ce temps, une formule déduit ton équivalent sur les autres distances : le temps grandit un peu plus vite que la distance. Doubler les kilomètres coûte plus que doubler les minutes.",
          "Ce « un peu plus vite » s'accentue avec la distance : faible sur 5 km, marqué sur marathon. Une valeur fixe décrivait des coureurs qui s'entraînent énormément, et donnait 3 h 04 au marathon pour quelqu'un qui court le 10 km en 40 minutes. La réponse honnête est plus proche de 3 h 29.",
          "Ton volume hebdomadaire entre aussi dans le calcul. Deux coureurs au même chrono sur 10 km n'ont pas le même marathon : celui qui court beaucoup perd nettement moins sur la distance. L'app mesure ce volume sur tes huit dernières semaines, semaines sans course comprises — et si elle n'a rien à mesurer, elle prend l'hypothèse la plus prudente plutôt que la moyenne.",
          "Ça ne joue que sur les longues distances. Personne ne voit son 5 km décidé par son kilométrage hebdomadaire.",
          "Les allures d'entraînement se calent ensuite sur l'allure marathon : environ une minute dix plus lent pour un footing, quarante-cinq secondes pour une sortie longue.",
        ],
      },
      {
        title: "La forme des semaines",
        body: [
          "Le programme traverse quatre phases : fondation, développement, travail spécifique, puis affûtage. L'affûtage est compté à rebours depuis la course, jamais depuis le début — si le temps manque, c'est la fondation qui est raccourcie, parce que c'est la seule des quatre qui puisse l'être.",
          "La charge monte régulièrement, sauf une semaine sur quatre qui retombe volontairement. On progresse en récupérant du travail, pas en le faisant : un plan qui ne fait que monter produit un coureur fatigué le jour J, pas un coureur affûté.",
          "Les deux dernières semaines s'effondrent : moitié moins de volume, puis presque rien. Ce n'est pas une semaine perdue, c'est la semaine qui fait la course.",
        ],
      },
      {
        title: "Ce que contient une semaine",
        body: [
          "À quatre séances : fractionné, footing, seuil, sortie longue.",
          "À trois : une seule séance de qualité, fractionné et seuil alternant d'une semaine sur l'autre, plus le footing et la sortie longue.",
          "À deux : le footing disparaît. Une course dont le seul rôle est d'ajouter du volume est la première à ne plus mériter sa place.",
          "À une : la sortie longue, coupée par une séance de qualité toutes les trois semaines. Sans elle on perd toute vitesse ; avec trop, on ne construit jamais l'endurance que la course demande.",
        ],
      },
      {
        title: "La sortie longue",
        body: [
          "C'est la séance qui prépare la distance, et la seule qui progresse vraiment. Elle part de ta plus longue sortie actuelle — pas d'une valeur déduite de ton objectif — et grandit d'environ huit pour cent par semaine.",
          "Les tendons et les ligaments s'adaptent bien plus lentement que le cœur et les poumons. Le fait que tu puisses courir la demi-heure de plus est précisément la raison de ne pas la courir.",
          "Elle reste toujours sous la durée de ta course : environ 85 % pour un semi, 75 % pour un marathon. On ne court jamais la course avant la course — couvrir la distance à l'entraînement n'apporte rien qu'une sortie plus courte n'ait déjà apporté, et coûte des semaines de récupération prises au milieu du programme.",
          "Cette limite ne vaut pas pour le 5 et le 10 km, où sortir plus longtemps que la durée de course n'a rien à voir avec l'effort de course.",
        ],
      },
      {
        title: "Ce que tu peux lui dire",
        body: [
          "Après chaque course, une question : c'était comment, de très facile à très dur. C'est la seule information de l'app que le téléphone ne peut pas mesurer.",
          "Si deux séances d'affilée te paraissent dures, le programme retire 15 % de ce qu'il demande — 30 % si les deux étaient très dures. Ce sont les répétitions qui sautent en premier, jamais l'échauffement : arriver froid sur une séance allégée serait le pire des deux mondes.",
          "Une seule séance dure ne déclenche rien. C'est l'entraînement qui fonctionne normalement, et s'alléger après chaque sortie difficile ne construirait jamais rien.",
          "Rien n'est réécrit dans le programme : l'allègement s'applique à l'affichage, et disparaît dès qu'une séance te semble plus facile.",
        ],
      },
      {
        title: "Les dates",
        body: [
          "Aucune date n'est enregistrée. Le calendrier est recalculé chaque fois que tu ouvres l'onglet, à partir des jours que tu as choisis.",
          "Si tu sautes des séances, rien ne s'accumule en retard : ce qui reste se replace sur les jours disponibles. Et s'il ne reste plus assez de jours, ce sont les séances de fondation qui disparaissent, jamais l'affûtage. Manquer la fondation coûte un peu de plafond ; sauter l'affûtage coûte la course.",
        ],
      },
    ],
    sourcesTitle: "D'où viennent les chiffres",
    sourcesIntro: "Ils ne se valent pas, et rien à l'écran ne permet de les distinguer. Trois niveaux :",
    levels: [
      {
        tag: "Publié",
        tone: "solid",
        body: "La formule de projection vient de Riegel (1981), et sa correction pour les coureurs amateurs de Vickers et Vertosick (2016). La forme de l'affûtage suit une méta-analyse de Bosquet (2007) : environ deux semaines à volume fortement réduit, intensité maintenue, pour à peu près trois pour cent de performance. La répartition d'intensité suit les travaux de Seiler. L'effet du volume hebdomadaire sur la projection vient du même travail de 2016 — c'est la forme mesurée d'une idée que Greg McMillan a popularisée bien avant, celle des profils de coureurs.",
      },
      {
        tag: "Convention",
        tone: "soft",
        body: "La progression hebdomadaire, la semaine allégée tous les quatre, le refus de courir la distance de course. Ce sont des accords de métier, pas des résultats. La fameuse règle des dix pour cent par semaine n'a d'ailleurs jamais été démontrée : un essai randomisé sur des débutants (Buist, 2008) n'a trouvé aucune réduction des blessures.",
      },
      {
        tag: "Choisi",
        tone: "mine",
        body: "Tout le reste, et c'est la majorité des chiffres : les bascules entre phases, la courbe de charge, les plafonds, la composition exacte des séances, et l'ampleur exacte de la correction par le volume — les études en donnent le sens, pas le coefficient. Ils sont cohérents entre eux et ressemblent à ce que produisent les plans du commerce. Aucune étude ne dit ces nombres-là.",
      },
    ],
    cautionTitle: "Ce que ce programme ignore",
    cautionIgnored: "Tes blessures passées, ton âge, ton sommeil, ta charge de travail, le dénivelé de tes parcours, ta fréquence cardiaque. Un entraîneur regarde tout cela en premier.",
    cautionAdvice: "Ce plan est un point de départ défendable, pas une prescription. Si une séance te semble trop dure, elle l'est probablement : dis-le à la fin de la course, et après deux séances dures d'affilée le programme s'allège de lui-même.",
  },
  en: {
    lede: "A training plan is three months of instructions. Here's how this one is built, which parts rest on published research, and which are choices made for Tread.",
    sections: [
      {
        title: "Paces",
        body: [
          "Everything starts from the time you're aiming for, not the one you've already run. A training plan trains the runner you mean to be on race day — that's its whole point. The time is simply prefilled from your best run so the projection starts from something real.",
          "From that time, a formula works out your equivalent over other distances: time grows a little faster than distance. Doubling the kilometres costs more than doubling the minutes.",
          "That “a little faster” grows with the distance: slight over 5 km, marked over a marathon. A fixed value described runners who train enormously, and gave a 3:04 marathon to someone who runs 10 km in 40 minutes. The honest answer is closer to 3:29.",
          "Your weekly volume goes into the calculation too. Two runners with the same 10 km time don't have the same marathon: the one who runs a lot loses much less over the distance. The app measures that volume over your last eight weeks, weeks without a run included — and if it has nothing to measure, it takes the most cautious assumption rather than the average.",
          "It only matters over long distances. Nobody's 5 km is decided by their weekly mileage.",
          "Training paces are then set from marathon pace: about a minute ten slower for an easy run, forty-five seconds for a long run.",
        ],
      },
      {
        title: "The shape of the weeks",
        body: [
          "The plan goes through four phases: base, build, race-specific work, then taper. The taper is counted back from the race, never forward from the start — if time is short, it's the base that gets cut, because it's the only one of the four that can be.",
          "The load rises steadily, except one week in four that drops on purpose. You improve by recovering from the work, not by doing it: a plan that only climbs produces a tired runner on race day, not a sharp one.",
          "The last two weeks fall away: half the volume, then almost nothing. It isn't a lost week, it's the week that makes the race.",
        ],
      },
      {
        title: "What a week holds",
        body: [
          "With four sessions: intervals, easy run, tempo, long run.",
          "With three: a single quality session, intervals and tempo alternating from one week to the next, plus the easy run and the long run.",
          "With two: the easy run goes. A run whose only job is to add volume is the first to lose its place.",
          "With one: the long run, broken up by a quality session every three weeks. Without it you lose all your speed; with too much, you never build the endurance the race asks for.",
        ],
      },
      {
        title: "The long run",
        body: [
          "It's the session that prepares you for the distance, and the only one that really progresses. It starts from your current longest run — not from a value worked out from your goal — and grows by about eight percent a week.",
          "Tendons and ligaments adapt far more slowly than the heart and lungs. The fact that you could run the extra half hour is exactly the reason not to.",
          "It always stays under your race time: about 85% for a half marathon, 75% for a marathon. You never run the race before the race — covering the distance in training brings nothing a shorter run hasn't already brought, and costs weeks of recovery taken in the middle of the plan.",
          "That limit doesn't apply to the 5 and 10 km, where running longer than your race time has nothing to do with race effort.",
        ],
      },
      {
        title: "What you can tell it",
        body: [
          "After every run, one question: how did it feel, from very easy to very hard. It's the only thing in the app your phone can't measure.",
          "If two sessions in a row feel hard, the plan takes 15% off what it asks — 30% if both were very hard. The repetitions go first, never the warm-up: arriving cold at a lighter session would be the worst of both worlds.",
          "A single hard session triggers nothing. That's training working as it should, and easing off after every tough run would never build anything.",
          "Nothing in the plan is rewritten: the easing applies to what's shown, and disappears as soon as a session feels easier.",
        ],
      },
      {
        title: "Dates",
        body: [
          "No date is stored. The calendar is worked out again every time you open the tab, from the days you've chosen.",
          "If you skip sessions, nothing piles up behind you: what's left moves onto the days available. And if there aren't enough days left, it's the base sessions that go, never the taper. Missing the base costs a little ceiling; skipping the taper costs the race.",
        ],
      },
    ],
    sourcesTitle: "Where the numbers come from",
    sourcesIntro: "They aren't all equal, and nothing on screen tells them apart. Three levels:",
    levels: [
      {
        tag: "Published",
        tone: "solid",
        body: "The projection formula comes from Riegel (1981), and its correction for amateur runners from Vickers and Vertosick (2016). The shape of the taper follows a meta-analysis by Bosquet (2007): about two weeks at sharply reduced volume, intensity kept, for roughly three percent of performance. The intensity split follows Seiler's work. The effect of weekly volume on the projection comes from the same 2016 study — it's the measured form of an idea Greg McMillan popularised long before, runner profiles.",
      },
      {
        tag: "Convention",
        tone: "soft",
        body: "The weekly progression, the lighter week every four, the refusal to run the race distance. These are agreements of the trade, not findings. The famous ten-percent-a-week rule has in fact never been shown to work: a randomised trial on beginners (Buist, 2008) found no reduction in injuries.",
      },
      {
        tag: "Chosen",
        tone: "mine",
        body: "Everything else, and that's most of the numbers: the switches between phases, the load curve, the caps, the exact make-up of the sessions, and the exact size of the volume correction — the studies give its direction, not its coefficient. They're consistent with each other and look like what commercial plans produce. No study gives these particular numbers.",
      },
    ],
    cautionTitle: "What this plan ignores",
    cautionIgnored: "Your past injuries, your age, your sleep, your workload, the elevation gain on your routes, your heart rate. A coach looks at all of that first.",
    cautionAdvice: "This plan is a sound starting point, not a prescription. If a session feels too hard, it probably is: say so at the end of the run, and after two hard sessions in a row the plan eases off by itself.",
  },
});

export default function PlanMethodScreen() {
  const s = useStrings(methodStrings);
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.lede}>
        {s.lede}
      </Text>

      {s.sections.map((section) => (
        <View key={section.title} style={styles.section}>
          <Text style={styles.title}>{section.title}</Text>
          {section.body.map((paragraph) => (
            <Text key={paragraph.slice(0, 24)} style={styles.paragraph}>{paragraph}</Text>
          ))}
        </View>
      ))}

      <View style={styles.section}>
        <Text style={styles.title}>{s.sourcesTitle}</Text>
        <Text style={styles.paragraph}>
          {s.sourcesIntro}
        </Text>
        {s.levels.map((level) => (
          <View key={level.tag} style={styles.level}>
            <Text style={[styles.tag, styles[level.tone]]}>{level.tag}</Text>
            <Text style={styles.paragraph}>{level.body}</Text>
          </View>
        ))}
      </View>

      <View style={styles.caution}>
        <Text style={styles.cautionTitle}>{s.cautionTitle}</Text>
        <Text style={styles.cautionBody}>
          {s.cautionIgnored}
        </Text>
        <Text style={styles.cautionBody}>
          {s.cautionAdvice}
        </Text>
      </View>
    </ScrollView>
  );
}

const GUTTER = 20;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: GUTTER, paddingTop: 14, paddingBottom: 44 },
  lede: {
    color: colors.text, fontFamily: font.regular, fontSize: 16.5,
    lineHeight: 24, marginBottom: 6,
  },

  section: {
    marginTop: 26, paddingTop: 18, gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline,
  },
  title: {
    color: colors.subtle, fontSize: 13, fontFamily: font.semibold,
    letterSpacing: 1.4, textTransform: "uppercase",
  },
  paragraph: {
    color: colors.muted, fontFamily: font.regular, fontSize: 15.5, lineHeight: 23,
  },

  level: { gap: 4, marginTop: 6 },
  tag: {
    alignSelf: "flex-start", overflow: "hidden",
    fontSize: 12, fontFamily: font.semibold, letterSpacing: 0.6,
    paddingHorizontal: 9, paddingVertical: 3, borderRadius: 5,
  },
  // Three weights of certainty, told apart at a glance rather than by reading.
  solid: { color: colors.accentText, backgroundColor: colors.accent },
  soft: { color: colors.warning, backgroundColor: colors.sunken },
  mine: { color: colors.subtle, backgroundColor: colors.sunken },

  caution: {
    marginTop: 28, padding: 16, borderRadius: 12, gap: 8,
    backgroundColor: colors.sunken,
  },
  cautionTitle: { color: colors.text, fontSize: 16.5, fontFamily: font.semibold },
  cautionBody: { color: colors.muted, fontFamily: font.regular, fontSize: 15, lineHeight: 22 },
});
