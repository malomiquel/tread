"use client";

import type { IconType } from "react-icons";
import Link from "next/link";
import {
  IoCheckmarkDoneOutline, IoChevronBack, IoCloudyOutline, IoDiamondOutline, IoFlagOutline, IoGiftOutline,
  IoLeafOutline, IoMoonOutline, IoPulseOutline, IoRainyOutline, IoResizeOutline, IoSnowOutline,
  IoSpeedometerOutline, IoSunnyOutline, IoThermometerOutline, IoTimerOutline, IoTrendingUpOutline, IoTrophyOutline,
} from "react-icons/io5";
import {
  RARITIES, RARITY_FROM, STAT_KEYS, TRAIT_POINTS, cardWords, type Rarity, type StatKey, type Trait,
} from "@tread/core/card";
import { rarityPips } from "@tread/core/cardLook";
import { defineStrings, plural, useStrings } from "@tread/core/i18n";
import { metaWords } from "@tread/core/metaCard";
import { PageHeader } from "@/components/PageHeader";
import { RecordRow } from "@/components/RecordRow";
import { SectionHeader } from "@/components/SectionHeader";

/**
 * How a card is dealt, said in words: the phone's rules page
 * (`apps/mobile/src/app/card-rules.tsx`) on a large screen.
 *
 * The points and the thresholds are read from the rules themselves
 * (`@tread/core/card`), so this page cannot drift from what deals the cards;
 * only the sentences around them are written here.
 */
const strings = defineStrings({
  fr: {
    back: "Collection",
    title: "Les règles",
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
    back: "Collection",
    title: "The rules",
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

const TRAIT_ICONS: Record<Trait, IconType> = {
  best: IoTrophyOutline, longest: IoResizeOutline, ghost: IoTimerOutline, race: IoFlagOutline,
  session: IoCheckmarkDoneOutline, patience: IoLeafOutline, climb: IoTrendingUpOutline,
  early: IoSunnyOutline, late: IoMoonOutline, rain: IoRainyOutline, snow: IoSnowOutline,
  wind: IoCloudyOutline, cold: IoThermometerOutline, anniversary: IoGiftOutline,
};

const STAT_ICONS: Record<StatKey, IconType> = {
  endurance: IoResizeOutline, speed: IoSpeedometerOutline, climb: IoTrendingUpOutline, steady: IoPulseOutline,
};

/** Traits from the one worth most to the ones worth least. */
const TRAITS = (Object.keys(TRAIT_POINTS) as Trait[]).sort((a, b) => TRAIT_POINTS[b] - TRAIT_POINTS[a]);

/** The points the next rarity up starts at, or none past the last. */
function nextFrom(rarity: Rarity): number | null {
  const after = RARITIES[RARITIES.indexOf(rarity) + 1];
  return after ? RARITY_FROM[after] : null;
}

export function CardRulesScreen() {
  const s = useStrings(strings);
  const words = useStrings(cardWords);
  const meta = useStrings(metaWords);

  return (
    <div className="page narrow">
      <Link href="/collection" className="back"><IoChevronBack aria-hidden />{s.back}</Link>
      <PageHeader title={s.title} />
      <p className="page-lede">{s.lede}</p>

      <SectionHeader title={s.rarity} />
      <p className="body-text">{s.rarityBody}</p>
      <div className="panel">
        {RARITIES.map((rarity) => (
          <RecordRow
            key={rarity}
            icon={<IoDiamondOutline size={19} />}
            name={words.rarity[rarity]}
            detail={rarityPips(rarity)}
            value={s.from(RARITY_FROM[rarity], nextFrom(rarity))}
          />
        ))}
      </div>

      <SectionHeader title={s.traits} />
      <p className="body-text">{s.traitsBody}</p>
      <div className="panel">
        {TRAITS.map((trait) => {
          const Icon = TRAIT_ICONS[trait];
          return (
            <RecordRow key={trait} icon={<Icon size={19} />} name={words.trait[trait]} detail={s.trait[trait]} value={s.points(TRAIT_POINTS[trait])} />
          );
        })}
      </div>

      <SectionHeader title={s.stats} />
      <p className="body-text">{s.statsBody}</p>
      <div className="panel">
        {STAT_KEYS.map((key) => {
          const Icon = STAT_ICONS[key];
          return <RecordRow key={key} icon={<Icon size={19} />} name={words.stat[key]} detail={s.stat[key]} value="" />;
        })}
      </div>

      <SectionHeader title={s.great} />
      <p className="body-text">{s.greatBody}</p>
      {(["week", "block", "race"] as const).map((kind) => (
        <div key={kind} style={{ marginTop: 6 }}>
          <h3 className="kind-name">{meta.kind[kind]}</h3>
          <p className="body-text">{meta.explain[kind]}</p>
        </div>
      ))}
      <p className="body-text" style={{ marginTop: 14 }}>{s.sport}</p>
    </div>
  );
}
