"use client";

import { useRouter } from "next/navigation";
import { defineStrings, useLanguage, useStrings, type Language } from "@tread/core/i18n";
import { LANGUAGE_COOKIE } from "@/lib/language";

const strings = defineStrings({
  fr: { change: "Langue : français. Passer en anglais" },
  en: { change: "Language: English. Switch to French" },
});

/**
 * The language in the header, beside the settings: just its two letters,
 * FR or EN, with nothing around them. A tap turns to the other one. The
 * choice is kept in a cookie for a year and the page drawn again in it.
 */
export function LanguageSwitch() {
  const s = useStrings(strings);
  const current = useLanguage();
  const router = useRouter();
  const other: Language = current === "fr" ? "en" : "fr";

  function toggle() {
    document.cookie = `${LANGUAGE_COOKIE}=${other}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }

  return (
    <button type="button" className="language-switch" onClick={toggle} aria-label={s.change}>
      {current.toUpperCase()}
    </button>
  );
}
