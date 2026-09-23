import { getLocales } from "expo-localization";
import { defineStrings } from "./i18n";
import { setUnitSystem, type UnitSystem } from "./units";

/**
 * What the runner asked for: the phone's own system, or one of the two.
 *
 * "auto" follows the phone's region, which is right for nearly everybody —
 * the United States and the United Kingdom run in miles, everywhere else in
 * kilometres. The override is for the runner abroad, or the one whose phone
 * says one thing while their running club says the other.
 */
export type UnitChoice = "auto" | UnitSystem;

export const UNIT_CHOICES: readonly UnitChoice[] = ["auto", "metric", "imperial"];

export function readUnitChoice(raw: string | undefined): UnitChoice {
  return raw === "metric" || raw === "imperial" ? raw : "auto";
}

/** Miles where the phone's region measures in them, kilometres everywhere else. */
export function deviceUnitSystem(): UnitSystem {
  try {
    const system = getLocales()[0]?.measurementSystem;
    return system === "us" || system === "uk" ? "imperial" : "metric";
  } catch {
    return "metric";
  }
}

/** Show the units chosen, or the phone's when nothing was. */
export function applyUnits(choice: UnitChoice): void {
  setUnitSystem(choice === "auto" ? deviceUnitSystem() : choice);
}

/** How each choice is named, wherever it is shown. */
export const unitChoiceWords = defineStrings({
  fr: {
    names: { auto: "Automatique", metric: "Kilomètres", imperial: "Miles" } as Record<UnitChoice, string>,
    details: {
      auto: "Suit la région du téléphone",
      metric: "km, min/km, mètres, °C",
      imperial: "mi, min/mi, pieds, °F",
    } as Record<UnitChoice, string>,
    footer: "Tes courses sont toujours enregistrées de la même façon : changer d'unité ne modifie que l'affichage.",
  },
  en: {
    names: { auto: "Automatic", metric: "Kilometres", imperial: "Miles" },
    details: {
      auto: "Follows your phone's region",
      metric: "km, min/km, metres, °C",
      imperial: "mi, min/mi, feet, °F",
    },
    footer: "Your runs are always stored the same way: changing units only changes how they're shown.",
  },
});
