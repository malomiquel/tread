"use client";

import { defineStrings, useStrings } from "@tread/core/i18n";

const strings = defineStrings({
  fr: { none: "Rien ne correspond.", all: "Tout afficher" },
  en: { none: "Nothing matches.", all: "Show all" },
});

/** A list narrowed to nothing: one sentence, and "Show all". */
export function NoMatch({ onShowAll, sentence }: { onShowAll: () => void; sentence?: string }) {
  const s = useStrings(strings);
  return (
    <div className="no-match">
      <p style={{ margin: "0 0 8px" }}>{sentence ?? s.none}</p>
      <button type="button" className="link-button" onClick={onShowAll}>{s.all}</button>
    </div>
  );
}
