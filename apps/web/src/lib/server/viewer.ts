import "server-only";
import type { Language } from "@tread/core/i18n";
import type { UnitSystem } from "@tread/core/units";
import { preferencesOf } from "./data";
import { phoneUnits, requestLanguage } from "./locale";
import { requireUser } from "./session";

export interface Viewer {
  userId: string;
  name: string;
  email: string;
  language: Language;
  units: UnitSystem;
  settings: Record<string, string>;
  syncedAt: number | null;
}

/**
 * Who is looking, in which language and units.
 *
 * Each page wraps what it renders in `<Locale>` with these, rather than
 * relying on the layout's: a page's tree can arrive after the layout's has
 * rendered, and the formatters must be set for it, not for whoever came
 * before.
 */
export async function viewer(): Promise<Viewer> {
  const user = await requireUser();
  const preferences = await preferencesOf(user.id);
  return {
    userId: user.id,
    name: user.name,
    email: user.email,
    language: await requestLanguage(),
    units: phoneUnits(preferences.settings),
    settings: preferences.settings,
    syncedAt: preferences.syncedAt,
  };
}
