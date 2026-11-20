"use client";

import { useRouter } from "next/navigation";
import { defineStrings, useLanguage, useStrings, type Language } from "@tread/core/i18n";
import { LANGUAGE_COOKIE } from "@/lib/language";

const strings = defineStrings({
  fr: { label: "Langue", names: { fr: "Français", en: "English" } as Record<Language, string> },
  en: { label: "Language", names: { fr: "Français", en: "English" } },
});

const LANGUAGES: readonly Language[] = ["fr", "en"];

/**
 * FR / EN in the header, beside the settings: the language is changed where
 * it is read, in one tap, rather than looked for in a page of settings.
 * The choice is kept in a cookie for a year and the page drawn again in it.
 */
export function LanguageSwitch() {
  const s = useStrings(strings);
  const current = useLanguage();
  const router = useRouter();

  function choose(language: Language) {
    if (language === current) return;
    document.cookie = `${LANGUAGE_COOKIE}=${language}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }

  return (
    <div className="segmented language-switch" role="radiogroup" aria-label={s.label}>
      {LANGUAGES.map((language) => (
        <button
          key={language}
          type="button"
          role="radio"
          aria-checked={language === current}
          aria-pressed={language === current}
          aria-label={s.names[language]}
          lang={language}
          onClick={() => choose(language)}
        >
          {language.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
