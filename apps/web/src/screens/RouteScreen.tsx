"use client";

import Link from "next/link";
import { IoChevronBack } from "react-icons/io5";
import { formatDistance, formatDuration, formatPace } from "@tread/core/format";
import { defineStrings, intlLocale, useStrings } from "@tread/core/i18n";
import { distanceUnit, paceUnit } from "@tread/core/units";

/** Three paces to say how long it takes, in seconds per kilometre. */
const PACES = [300, 360, 420];
import { SummaryBanner } from "@/components/SummaryBanner";
import { TrackMap } from "@/components/TrackMap";
import { routeLengthM } from "@/lib/route";
import type { RouteRow } from "@/lib/types";

const strings = defineStrings({
  fr: {
    back: "Parcours",
    length: "Distance",
    drawn: (date: string) => `Tracé le ${date}`,
    at: (pace: string) => `À ${pace}`,
    run: "Pour le courir, choisis-le dans l'app avant de partir : la voix te guide à chaque virage.",
  },
  en: {
    back: "Routes",
    length: "Distance",
    drawn: (date: string) => `Drawn on ${date}`,
    at: (pace: string) => `At ${pace}`,
    run: "To run it, pick it in the app before you set off: the voice guides you at every turn.",
  },
});

export function RouteScreen({ route }: { route: RouteRow }) {
  const s = useStrings(strings);
  const length = routeLengthM(route.line);
  const date = new Date(route.createdAt).toLocaleDateString(intlLocale(), { day: "numeric", month: "long", year: "numeric" });
  return (
    <div className="page">
      <Link href="/routes" className="back"><IoChevronBack aria-hidden />{s.back}</Link>
      <div className="page-head">
        <div>
          <h1>{route.name}</h1>
          <p className="subtitle">{[route.place, s.drawn(date)].filter(Boolean).join(" · ")}</p>
        </div>
      </div>
      <SummaryBanner
        label={s.length}
        value={formatDistance(length)}
        unit={distanceUnit()}
        detail={s.run}
        figures={PACES.map((seconds) => ({ label: s.at(`${formatPace(seconds)}${paceUnit()}`), value: formatDuration((length / 1000) * seconds) }))}
      />
      <div style={{ marginTop: 16 }}>
        <TrackMap line={route.line} />
      </div>
    </div>
  );
}
