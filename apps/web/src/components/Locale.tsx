"use client";

import type { ReactNode } from "react";
import { setLanguage, type Language } from "@tread/core/i18n";
import { setUnitSystem, type UnitSystem } from "@tread/core/units";

/**
 * Sets the language and the units every formatter in @tread/core reads.
 *
 * Those are module-wide, as on the phone. Set here, in render, before any
 * child renders: the tree below holds no Suspense boundary, so on the server
 * it renders in one go and another request cannot slip in between. Server
 * components never format; they hand plain data to what sits under this.
 */
export function Locale({ language, units, children }: { language: Language; units: UnitSystem; children: ReactNode }) {
  setLanguage(language);
  setUnitSystem(units);
  return children;
}
