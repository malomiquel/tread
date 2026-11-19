import "server-only";
import { cookies, headers } from "next/headers";
import type { Language } from "@tread/core/i18n";
import type { UnitSystem } from "@tread/core/units";
import { LANGUAGE_COOKIE, pickLanguage, pickUnits } from "@/lib/language";

export async function requestLanguage(): Promise<Language> {
  return pickLanguage((await cookies()).get(LANGUAGE_COOKIE)?.value, (await headers()).get("accept-language"));
}

export async function requestUnits(phoneUnits: string | undefined): Promise<UnitSystem> {
  return pickUnits(phoneUnits, (await headers()).get("accept-language"));
}
