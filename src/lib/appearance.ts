import { Appearance } from "react-native";
import { defineStrings } from "./i18n";

/**
 * What the runner asked for: the phone's appearance, or one of the two.
 *
 * "auto" is the default and follows the phone, light by day and dark by
 * night if that is how it is set. The override is for the runner who keeps
 * the phone dark but wants the app light, or the other way round.
 */
export type AppearanceChoice = "auto" | "light" | "dark";

export const APPEARANCE_CHOICES: readonly AppearanceChoice[] = ["auto", "light", "dark"];

export function readAppearanceChoice(raw: string | undefined): AppearanceChoice {
  return raw === "light" || raw === "dark" ? raw : "auto";
}

/**
 * Draw in the appearance chosen, or the phone's when nothing was.
 *
 * On iOS this overrides the window's own style, so every dynamic colour, the
 * navigation bars and the maps follow at once. Android reads its colours once
 * at launch (see theme.ts), before the settings are loaded, so there the
 * choice only reaches the screens that ask useColorScheme().
 */
export function applyAppearance(choice: AppearanceChoice): void {
  Appearance.setColorScheme(choice === "auto" ? "unspecified" : choice);
}

/** How each choice is named, wherever it is shown. */
export const appearanceWords = defineStrings({
  fr: {
    names: { auto: "Automatique", light: "Clair", dark: "Sombre" } as Record<AppearanceChoice, string>,
    details: {
      auto: "Suit l'apparence du téléphone",
      light: "Fond blanc, de jour comme de nuit",
      dark: "Fond noir, de jour comme de nuit",
    } as Record<AppearanceChoice, string>,
  },
  en: {
    names: { auto: "Automatic", light: "Light", dark: "Dark" },
    details: {
      auto: "Follows your phone's appearance",
      light: "White background, day and night",
      dark: "Black background, day and night",
    },
  },
});
