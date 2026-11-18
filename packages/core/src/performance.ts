import { defineStrings } from "./i18n.ts";

/**
 * The three lists behind the profile's "Performances" block, each on a page
 * of its own: what has been done at best, the fastest stretch over each
 * distance, and what those are worth on race day.
 */
export type PerformanceSection = "records" | "efforts" | "predictions";

export const PERFORMANCE_SECTIONS: readonly PerformanceSection[] = ["records", "efforts", "predictions"];

export const readSection = (value: unknown): PerformanceSection =>
  PERFORMANCE_SECTIONS.find((section) => section === value) ?? "records";

/** Titles, shared by the profile's rows and the pages they open. */
export const performanceTitles = defineStrings({
  fr: {
    records: "Records",
    efforts: "Meilleures performances",
    predictions: "Temps prédits",
  } as Record<PerformanceSection, string>,
  en: {
    records: "Personal records",
    efforts: "Best efforts",
    predictions: "Predicted times",
  },
});

/**
 * A distance's name as it reads mid-sentence: "Marathon" becomes "marathon",
 * while "5K" and "1 mile" are left as they are.
 */
export const inSentence = (name: string): string =>
  /^[A-Z][a-z]/.test(name) ? name.charAt(0).toLowerCase() + name.slice(1) : name;
