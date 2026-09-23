import { useEffect, useState } from "react";
import { ChoiceSheet } from "@/components/ChoiceSheet";
import { SettingRow } from "@/components/SettingRow";
import { SettingsGroup } from "@/components/SettingsGroup";
import { listShoes, setRunShoe, type Run } from "@/lib/db";
import { formatDistance } from "@/lib/format";
import { defineStrings, useStrings } from "@/lib/i18n";
import { shoeOrder, wearOf, type Shoe } from "@/lib/shoes";
import { distanceUnit } from "@/lib/units";

const strings = defineStrings({
  fr: {
    title: "Détails",
    shoes: "Chaussures",
    noShoe: "Aucune",
    noShoeDetail: "Cette course ne compte pour aucune paire",
    worn: (distance: string) => `à remplacer · ${distance} ${distanceUnit()}`,
    soon: (distance: string) => `bientôt à remplacer · ${distance} ${distanceUnit()}`,
    covered: (distance: string) => `${distance} ${distanceUnit()}`,
  },
  en: {
    title: "Details",
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
 * What the runner can say about a run that the phone could not measure:
 * which pair it was run in.
 */
export function RunDetails({ run, onChange }: Props) {
  const s = useStrings(strings);
  const [shoes, setShoes] = useState<Shoe[]>([]);
  const [choosingShoe, setChoosingShoe] = useState(false);

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

  // Nothing to say about shoes before any pair exists: the row would only
  // offer "none".
  if (shoes.length === 0) return null;

  return (
    <>
      <SettingsGroup title={s.title}>
        <SettingRow
          icon="footsteps-outline"
          label={s.shoes}
          value={shoe?.name ?? s.noShoe}
          detail={shoe ? shoeLine(shoe) : undefined}
          onPress={() => setChoosingShoe(true)}
        />
      </SettingsGroup>

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
