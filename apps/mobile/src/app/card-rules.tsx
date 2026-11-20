import { ScrollView, StyleSheet, Text, View } from "react-native";
import { rarityPips } from "@/components/CardSurface";
import { Panel } from "@/components/Panel";
import { RecordRow, type RecordIcon } from "@/components/RecordRow";
import { SectionHeader } from "@/components/SectionHeader";
import {
  RARITIES, RARITY_FROM, STAT_KEYS, TRAIT_POINTS, cardWords, type Rarity, type StatKey, type Trait,
} from "@tread/core/card";
import { defineStrings, plural, useStrings } from "@tread/core/i18n";
import { metaWords } from "@tread/core/metaCard";
import { colors, font } from "@/lib/theme";

/**
 * How a card is dealt, said in words.
 *
 * The points and the thresholds are read from the rules themselves
 * (`@tread/core/card`), so this page cannot drift from what deals the cards;
 * only the sentences around them are written here.
 */
const strings = defineStrings({
  fr: {
    lede: "Chaque sortie laisse une carte. Rien n'est tiré au hasard : tout vient de ce que la sortie a été, comparé à celles d'avant.",
    rarity: "La rareté",
    rarityBody: "Les traits d'une sortie s'additionnent en points, et le total fait la rareté. Un record battu sur ta plus longue sortie compte deux points de moins : les deux arrivent presque toujours ensemble.",
    from: (points: number, next: number | null) =>
      next === null ? `${points} points et plus` : points === next - 1 ? plural(points, "point", "points") : `${points} à ${plural(next - 1, "point", "points")}`,
    traits: "Les traits",
    traitsBody: "Ce qu'une sortie a eu de particulier. Leurs points s'additionnent pour faire la rareté.",
    stats: "Les quatre stats",
    statsBody: "Chaque stat va de 1 à 99 et te compare à toi-même : 50, c'est une sortie dans ta moyenne ; 99, ta meilleure. Tant que tu as moins de dix sorties, la comparaison est complétée par dix sorties types de débutant, pour que tes premières cartes aient déjà des notes.",
    great: "Les grandes cartes",
    greatBody: "Certaines cartes ne viennent pas d'une sortie mais de plusieurs. Une semaine ou un bloc prend la rareté des traits de ses sorties réunis ; une course est toujours légendaire.",
    sport: "Une sortie à vélo a ses propres cartes et sa propre numérotation : elle n'est jamais comparée à une course à pied.",
    points: (points: number) => `+${points}`,
    trait: {
      best: "1 % plus vite qu'avant, dès 1 km",
      longest: "5 % plus loin que ta plus longue",
      ghost: "Meilleur temps sur un de tes parcours",
      race: "Étiquetée Compétition, ou le jour J d'un plan",
      session: "Tous les blocs d'une séance courus",
      patience: "Footing gardé lent et facile",
      climb: "100 m de D+ et 15 m par km",
      early: "Partie avant 7 h",
      late: "Partie après 21 h",
      rain: "Au moins 0,3 mm de pluie",
      snow: "Il neigeait",
      wind: "Vent de 25 km/h ou plus",
      cold: "Ressenti de 2° ou moins",
      anniversary: "Un an jour pour jour après ta première",
    } as Record<Trait, string>,
    stat: {
      endurance: "La distance",
      speed: "L'allure moyenne",
      climb: "Le dénivelé par kilomètre",
      steady: "Ton allure moyenne près de ton meilleur km",
    } as Record<StatKey, string>,
  },
  en: {
    lede: "Every outing leaves a card. Nothing is drawn at random: it all comes from what the outing was, set against the ones before it.",
    rarity: "Rarity",
    rarityBody: "An outing's traits add up to points, and the total sets the rarity. A record broken on your longest run counts two points less: the two nearly always come together.",
    from: (points: number, next: number | null) =>
      next === null ? `${points} points and more` : points === next - 1 ? plural(points, "point", "points") : `${points} to ${next - 1} points`,
    traits: "Traits",
    traitsBody: "What was special about an outing. Their points add up to the rarity.",
    stats: "The four stats",
    statsBody: "Each stat runs from 1 to 99 and sets you against yourself: 50 is an outing in your average, 99 your best. Until you have ten outings, the comparison is filled out with ten typical beginner's outings, so your first cards already have marks.",
    great: "The great cards",
    greatBody: "Some cards come from several outings rather than one. A week or a block takes the rarity of its outings' traits together; a race is always legendary.",
    sport: "A ride has its own cards and its own numbering: it is never set against a run.",
    points: (points: number) => `+${points}`,
    trait: {
      best: "1 % faster than before, from 1 km",
      longest: "5 % further than your longest",
      ghost: "Best time on one of your routes",
      race: "Tagged Race, or a plan's race day",
      session: "Every block of a session run",
      patience: "An easy run kept slow and easy",
      climb: "100 m of gain and 15 m per km",
      early: "Started before 7 am",
      late: "Started after 9 pm",
      rain: "At least 0.3 mm of rain",
      snow: "It was snowing",
      wind: "Wind of 25 km/h or more",
      cold: "Feels like 2° or less",
      anniversary: "A year to the day after your first",
    },
    stat: {
      endurance: "The distance",
      speed: "The average pace",
      climb: "The elevation gain per kilometre",
      steady: "Your average pace near your best km",
    },
  },
});

const TRAIT_ICONS: Record<Trait, RecordIcon> = {
  best: "trophy-outline", longest: "resize-outline", ghost: "timer-outline", race: "flag-outline",
  session: "checkmark-done-outline", patience: "leaf-outline", climb: "trending-up-outline",
  early: "sunny-outline", late: "moon-outline", rain: "rainy-outline", snow: "snow-outline",
  wind: "cloudy-outline", cold: "thermometer-outline", anniversary: "gift-outline",
};

const STAT_ICONS: Record<StatKey, RecordIcon> = {
  endurance: "resize-outline", speed: "speedometer-outline", climb: "trending-up-outline", steady: "pulse-outline",
};

/** Traits from the one worth most to the ones worth least. */
const TRAITS = (Object.keys(TRAIT_POINTS) as Trait[]).sort((a, b) => TRAIT_POINTS[b] - TRAIT_POINTS[a]);

/** The points the next rarity up starts at, or none past the last. */
function nextFrom(rarity: Rarity): number | null {
  const after = RARITIES[RARITIES.indexOf(rarity) + 1];
  return after ? RARITY_FROM[after] : null;
}

export default function CardRulesScreen() {
  const s = useStrings(strings);
  const words = useStrings(cardWords);
  const meta = useStrings(metaWords);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.lede}>{s.lede}</Text>

      <SectionHeader title={s.rarity} />
      <Text style={styles.body}>{s.rarityBody}</Text>
      <Panel>
        {RARITIES.map((rarity, index) => (
          <RecordRow
            key={rarity}
            first={index === 0}
            onPanel
            icon="diamond-outline"
            label={words.rarity[rarity]}
            detail={rarityPips(rarity)}
            value={s.from(RARITY_FROM[rarity], nextFrom(rarity))}
          />
        ))}
      </Panel>

      <SectionHeader title={s.traits} />
      <Text style={styles.body}>{s.traitsBody}</Text>
      <Panel>
        {TRAITS.map((trait, index) => (
          <RecordRow
            key={trait}
            first={index === 0}
            onPanel
            icon={TRAIT_ICONS[trait]}
            label={words.trait[trait]}
            detail={s.trait[trait]}
            value={s.points(TRAIT_POINTS[trait])}
          />
        ))}
      </Panel>

      <SectionHeader title={s.stats} />
      <Text style={styles.body}>{s.statsBody}</Text>
      <Panel>
        {STAT_KEYS.map((key, index) => (
          <RecordRow
            key={key}
            first={index === 0}
            onPanel
            icon={STAT_ICONS[key]}
            label={words.stat[key]}
            detail={s.stat[key]}
            value=""
          />
        ))}
      </Panel>

      <SectionHeader title={s.great} />
      <Text style={styles.body}>{s.greatBody}</Text>
      {(["week", "block", "race"] as const).map((kind) => (
        <View key={kind} style={styles.kind}>
          <Text style={styles.kindName}>{meta.kind[kind]}</Text>
          <Text style={styles.body}>{meta.explain[kind]}</Text>
        </View>
      ))}
      <Text style={[styles.body, styles.note]}>{s.sport}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingTop: 10, paddingBottom: 48 },
  lede: {
    color: colors.text, fontFamily: font.regular, fontSize: 16.5, lineHeight: 24,
    paddingHorizontal: 20, marginBottom: 4,
  },
  body: {
    color: colors.muted, fontFamily: font.regular, fontSize: 15, lineHeight: 22,
    paddingHorizontal: 20, marginBottom: 10,
  },
  kind: { gap: 2, marginTop: 4 },
  kindName: { color: colors.text, fontFamily: font.semibold, fontSize: 16.5, paddingHorizontal: 20 },
  note: { marginTop: 14 },
});
