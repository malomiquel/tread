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

/**
 * Kilometres or miles: what the phone was set to, else what the browser's
 * region measures in (the United States and the United Kingdom in miles).
 */
export function pickUnits(phone: string | undefined, accepted: string | null | undefined): UnitSystem {
  if (phone === "metric" || phone === "imperial") return phone;
  const region = (accepted ?? "").split(",")[0]?.trim().toLowerCase() ?? "";
  return region === "en-us" || region === "en-gb" ? "imperial" : "metric";
}
