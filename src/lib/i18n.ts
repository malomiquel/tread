import { useSyncExternalStore } from "react";

/**
 * The language the interface speaks, and the strings it speaks it with.
 *
 * No library: the app has two languages and a few hundred sentences, most of
 * them with a number inside. Each screen keeps its own strings beside the code
 * that shows them, as `{ fr, en }`, and the type makes the English side mirror
 * the French one key for key — a sentence added in one language and forgotten
 * in the other is a compile error rather than a blank on somebody's screen.
 *
 * Deliberately free of anything native. Which language the phone speaks is
 * decided at startup, in `language.ts`, and handed in here; everything that
 * only formats or translates can then be tested in plain Node, where the
 * interface speaks French as it always has.
 */

export type Language = "fr" | "en";

let current: Language = "fr";
const listeners = new Set<() => void>();

export const getLanguage = (): Language => current;

export function setLanguage(next: Language): void {
  if (next === current) return;
  current = next;
  for (const listener of listeners) listener();
}

export function subscribeLanguage(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The language, for a component that has to redraw when it changes. */
export function useLanguage(): Language {
  return useSyncExternalStore(subscribeLanguage, getLanguage, getLanguage);
}

/**
 * The locale handed to `Intl`, to dates and to the speech engine.
 *
 * British English rather than American for dates: day before month, and a
 * 24-hour clock, which is how the rest of Europe reads a training log.
 */
export const intlLocale = (): string => (current === "fr" ? "fr-FR" : "en-GB");

/** The voice kilometres are announced in. */
export const speechLocale = (): string => (current === "fr" ? "fr-FR" : "en-US");

/** A decimal written the way the interface's language writes it. */
export function decimal(text: string): string {
  return current === "fr" ? text.replace(".", ",") : text;
}

/**
 * A table of strings in both languages, read in whichever is current.
 *
 * The English side has to have exactly the French side's shape, functions
 * included, so both are filled in together or the build fails.
 */
export function defineStrings<T>(table: { fr: T; en: NoInfer<T> }): (language?: Language) => T {
  return (language = current) => table[language];
}

/**
 * The same table, for a component: it redraws when the language changes.
 *
 * The language is handed to the table rather than read inside it, so that it
 * is visibly what the result depends on. The React Compiler memoises what a
 * component computes by what it reads, and a table read with no argument
 * would look constant to it — and keep the old language after a switch.
 */
export function useStrings<T>(strings: (language?: Language) => T): T {
  return strings(useLanguage());
}

/** "1 course", "2 courses": the plural both languages form with an s. */
export const plural = (count: number, one: string, many: string): string =>
  `${count} ${count > 1 || (current === "en" && count === 0) ? many : one}`;
