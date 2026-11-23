"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { parseGpxLine } from "@tread/core/gpx";
import { autoRouteName, routeFromLine } from "@tread/core/route";
import { placeName } from "@/lib/place";

/**
 * GPX files made into routes, as the phone's "Import a GPX file" does: the
 * file's track kept as the line, a dozen handles placed along it so it can
 * be edited, the town looked up, and the route saved. Files are read in the
 * browser; only the route is sent.
 */
export function useGpxRoutes({ race = false }: { race?: boolean } = {}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ added: number; unreadable: number } | null>(null);

  async function importFiles(files: FileList | File[] | null) {
    const list = files ? Array.from(files) : [];
    if (list.length === 0) return;
    setBusy(true);
    setResult(null);
    let added = 0;
    let unreadable = 0;
    for (const file of list) {
      try {
        const { name, line } = parseGpxLine(await file.text());
        if (line.length < 2) {
          unreadable += 1;
          continue;
        }
        const route = routeFromLine(line);
        const fallback = file.name.replace(/\.gpx$/i, "").trim();
        const response = await fetch("/api/routes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name?.trim() || fallback || autoRouteName(Date.now()),
            waypoints: route.waypoints,
            legs: route.legs,
            place: await placeName(line[0]),
          }),
        });
        if (!response.ok) {
          unreadable += 1;
          continue;
        }
        added += 1;
        // A race's course: one file, and straight on to planning the race.
        if (race) {
          const { id } = (await response.json()) as { id: string };
          setBusy(false);
          router.push(`/routes/${id}/race`);
          return;
        }
      } catch {
        unreadable += 1;
      }
    }
    setBusy(false);
    setResult({ added, unreadable });
    if (added > 0) router.refresh();
  }

  return {
    busy,
    result,
    importFiles,
    /** Opens the browser's file picker. */
    pick: () => input.current?.click(),
    /** The hidden input the picker uses; render it once on the page. */
    inputProps: {
      ref: input,
      type: "file" as const,
      accept: ".gpx,application/gpx+xml",
      multiple: !race,
      hidden: true,
      onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
        void importFiles(event.target.files);
        event.target.value = "";
      },
    },
  };
}
