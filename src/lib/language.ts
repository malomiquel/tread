import { getLocales } from "expo-localization";
import { setLanguage, type Language } from "./i18n";

/**
 * What the runner asked for: the phone's language, or one of the two.
 *
 * "auto" is the default and the right answer for nearly everybody — the app
 * speaks whatever the phone speaks. The override exists for the bilingual
 * runner whose phone is in one language and whose running is in the other.
 */
export type LanguageChoice = "auto" | Language;

export const LANGUAGE_CHOICES: readonly LanguageChoice[] = ["auto", "fr", "en"];

/**
 * Each language named in itself, whatever the interface speaks: somebody
 * who landed in the wrong one has to recognise their own to get out of it.
 */
export const LANGUAGE_NAMES: Record<Language, string> = { fr: "Français", en: "English" };

export function readLanguageChoice(raw: string | undefined): LanguageChoice {
  return raw === "fr" || raw === "en" ? raw : "auto";
}

/**
 * French when the phone prefers French, English for everything else.
 *
 * English is the fallback because it is the language a phone set to Spanish
 * or German is likeliest to be read in; French is only right for those who
 * asked for it.
 */
export function deviceLanguage(): Language {
  try {
    return getLocales()[0]?.languageCode === "fr" ? "fr" : "en";
  } catch {
    return "fr";
  }
}

/** Speak the language chosen, or the phone's when nothing was. */
export function applyLanguage(choice: LanguageChoice): void {
  setLanguage(choice === "auto" ? deviceLanguage() : choice);
}
