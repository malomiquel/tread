import { ScrollView, StyleSheet, Text, View } from "react-native";
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
const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: "Les allures",
    body: [
      "Tout part du temps que tu vises, pas de celui que tu as déjà fait. Un programme entraîne le coureur que tu comptes être le jour de la course — c'est sa raison d'être. Le chrono est simplement prérempli depuis ta meilleure sortie pour que la projection démarre du réel.",
      "De ce temps, une formule déduit ton équivalent sur les autres distances : le temps grandit un peu plus vite que la distance. Doubler les kilomètres coûte plus que doubler les minutes.",
      "Ce « un peu plus vite » s'accentue avec la distance : faible sur 5 km, marqué sur marathon. Une valeur fixe décrivait des coureurs qui s'entraînent énormément, et donnait 3 h 04 au marathon pour quelqu'un qui court le 10 km en 40 minutes. La réponse honnête est plus proche de 3 h 29.",
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
    title: "Les dates",
    body: [
      "Aucune date n'est enregistrée. Le calendrier est recalculé chaque fois que tu ouvres l'onglet, à partir des jours que tu as choisis.",
      "Si tu sautes des séances, rien ne s'accumule en retard : ce qui reste se replace sur les jours disponibles. Et s'il ne reste plus assez de jours, ce sont les séances de fondation qui disparaissent, jamais l'affûtage. Manquer la fondation coûte un peu de plafond ; sauter l'affûtage coûte la course.",
    ],
  },
];

const LEVELS: { tag: string; tone: "solid" | "soft" | "mine"; body: string }[] = [
  {
    tag: "Publié",
    tone: "solid",
    body: "La formule de projection vient de Riegel (1981), et sa correction pour les coureurs amateurs de Vickers et Vertosick (2016). La forme de l'affûtage suit une méta-analyse de Bosquet (2007) : environ deux semaines à volume fortement réduit, intensité maintenue, pour à peu près trois pour cent de performance. La répartition d'intensité suit les travaux de Seiler.",
  },
  {
    tag: "Convention",
    tone: "soft",
    body: "La progression hebdomadaire, la semaine allégée tous les quatre, le refus de courir la distance de course. Ce sont des accords de métier, pas des résultats. La fameuse règle des dix pour cent par semaine n'a d'ailleurs jamais été démontrée : un essai randomisé sur des débutants (Buist, 2008) n'a trouvé aucune réduction des blessures.",
  },
  {
    tag: "Choisi",
    tone: "mine",
    body: "Tout le reste, et c'est la majorité des chiffres : les bascules entre phases, la courbe de charge, les plafonds, la composition exacte des séances. Ils sont cohérents entre eux et ressemblent à ce que produisent les plans du commerce. Aucune étude ne dit ces nombres-là.",
  },
];

export default function PlanMethodScreen() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.lede}>
        {"Un programme, c'est trois mois d'instructions. Voici comment celui-ci est construit, et ce qui, là-dedans, repose sur des travaux publiés plutôt que sur mon jugement."}
      </Text>

      {SECTIONS.map((section) => (
        <View key={section.title} style={styles.section}>
          <Text style={styles.title}>{section.title}</Text>
          {section.body.map((paragraph) => (
            <Text key={paragraph.slice(0, 24)} style={styles.paragraph}>{paragraph}</Text>
          ))}
        </View>
      ))}

      <View style={styles.section}>
        <Text style={styles.title}>{"D'où viennent les chiffres"}</Text>
        <Text style={styles.paragraph}>
          {"Ils ne se valent pas, et rien à l'écran ne permet de les distinguer. Trois niveaux :"}
        </Text>
        {LEVELS.map((level) => (
          <View key={level.tag} style={styles.level}>
            <Text style={[styles.tag, styles[level.tone]]}>{level.tag}</Text>
            <Text style={styles.paragraph}>{level.body}</Text>
          </View>
        ))}
      </View>

      <View style={styles.caution}>
        <Text style={styles.cautionTitle}>Ce que ce programme ignore</Text>
        <Text style={styles.cautionBody}>
          {"Tes blessures passées, ton âge, ton sommeil, ta charge de travail, le dénivelé de tes parcours, ta fréquence cardiaque. Un entraîneur regarde tout cela en premier."}
        </Text>
        <Text style={styles.cautionBody}>
          {"Ce plan est un point de départ défendable, pas une prescription. Si une séance te semble trop dure, elle l'est probablement : le programme ne le saura jamais, toi si."}
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
