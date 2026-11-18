import type { Language } from "@tread/core/i18n";

/** The interface's language from what the browser asks for: French when it leads with it, English otherwise. */
export function pickLanguage(accepted: string | null | undefined): Language {
  const first = (accepted ?? "").split(",")[0]?.trim().toLowerCase() ?? "";
  return first.startsWith("fr") ? "fr" : "en";
}
