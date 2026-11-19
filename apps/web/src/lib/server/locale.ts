import "server-only";
import { cookies, headers } from "next/headers";
import type { Language } from "@tread/core/i18n";
import type { UnitSystem } from "@tread/core/units";
import { LANGUAGE_COOKIE, pickLanguage, pickUnits } from "@/lib/language";

export async function requestLanguage(): Promise<Language> {
  return pickLanguage((await cookies()).get(LANGUAGE_COOKIE)?.value, (await headers()).get("accept-language"));
}

/** The units the phone shows, from the settings it last sent. */
export function phoneUnits(settings: Record<string, string>): UnitSystem {
  return pickUnits(settings.units, settings.phoneUnits);
}
