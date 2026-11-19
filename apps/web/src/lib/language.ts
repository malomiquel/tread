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
 * Kilometres or miles, as the phone shows them: its own setting when it was
 * set to one, else what its "Automatic" worked out to (sent with each sync),
 * else kilometres until the phone has said.
 */
export function pickUnits(phone: string | undefined, phoneResolved: string | undefined): UnitSystem {
  if (phone === "metric" || phone === "imperial") return phone;
  if (phoneResolved === "metric" || phoneResolved === "imperial") return phoneResolved;
  return "metric";
}
