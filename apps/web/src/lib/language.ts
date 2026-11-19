import type { Language } from "@tread/core/i18n";
import type { UnitSystem } from "@tread/core/units";

/** The cookie the settings page writes when somebody picks a language. */
export const LANGUAGE_COOKIE = "tread-language";

/**
 * The interface's language: the one chosen in the settings, else French when
 * the browser leads with it, English otherwise.
 */
export function pickLanguage(chosen: string | null | undefined, accepted: string | null | undefined): Language {
  if (chosen === "fr" || chosen === "en") return chosen;
  const first = (accepted ?? "").split(",")[0]?.trim().toLowerCase() ?? "";
  return first.startsWith("fr") ? "fr" : "en";
}

/** The cookie the settings page writes when somebody picks units. */
export const UNITS_COOKIE = "tread-units";

/**
 * Kilometres or miles: what was picked on this page's settings, else what the
 * phone was set to, else kilometres. The phone's "Automatic" follows the
 * phone's region, which the server never sees; guessing it from the browser's
 * language put a French runner with an American browser in miles.
 */
export function pickUnits(chosen: string | undefined, phone: string | undefined): UnitSystem {
  if (chosen === "metric" || chosen === "imperial") return chosen;
  if (phone === "metric" || phone === "imperial") return phone;
  return "metric";
}
