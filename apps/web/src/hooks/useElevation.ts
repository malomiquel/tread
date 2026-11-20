"use client";

import { useEffect, useState } from "react";
import type { RoutePoint } from "@tread/core/route";
import { elevationOf, type Elevation } from "@/lib/elevation";

/**
 * The climb and profile of a line, asked for once the line has stopped
 * changing for a moment: a route being drawn is not asked about at every
 * click. Null while it is asked, and when it could not be had.
 */
export function useElevation(line: readonly RoutePoint[], waitMs = 600): Elevation | null {
  const [found, setFound] = useState<{ line: readonly RoutePoint[]; elevation: Elevation | null } | null>(null);
  useEffect(() => {
    if (line.length < 2) return;
    let live = true;
    const timer = setTimeout(() => {
      void elevationOf(line).then((elevation) => {
        if (live) setFound({ line, elevation });
      });
    }, waitMs);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [line, waitMs]);
  return found && found.line === line ? found.elevation : null;
}
