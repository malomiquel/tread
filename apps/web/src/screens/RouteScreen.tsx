"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { IoChevronBack, IoCreateOutline, IoTrashOutline } from "react-icons/io5";
import { formatDistance, formatDuration, formatElevation, formatPace } from "@tread/core/format";
import { defineStrings, intlLocale, useStrings } from "@tread/core/i18n";
import { distanceUnit, elevationUnit, paceUnit } from "@tread/core/units";
import { LineChart } from "@/components/LineChart";
import { SectionHeader } from "@/components/SectionHeader";
import { useElevation } from "@/hooks/useElevation";

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
    edit: "Modifier",
    remove: "Supprimer",
    removeConfirm: "Supprimer ce parcours ? Il disparaîtra aussi de ton téléphone à la prochaine synchro.",
    removeFailed: "Le parcours n'a pas pu être supprimé. Réessaie.",
    gain: "D+",
    profile: "Profil d'altitude",
    low: "Min",
    high: "Max",
  },
  en: {
    back: "Routes",
    length: "Distance",
    drawn: (date: string) => `Drawn on ${date}`,
    at: (pace: string) => `At ${pace}`,
    run: "To run it, pick it in the app before you set off: the voice guides you at every turn.",
    edit: "Edit",
    remove: "Delete",
    removeConfirm: "Delete this route? It will also leave your phone at its next sync.",
    removeFailed: "The route couldn't be deleted. Try again.",
    gain: "Gain",
    profile: "Elevation profile",
    low: "Min",
    high: "Max",
  },
});

export function RouteScreen({ route }: { route: RouteRow }) {
  const s = useStrings(strings);
  const router = useRouter();
  const [removing, setRemoving] = useState(false);
  const elevation = useElevation(route.line, 0);
  const length = routeLengthM(route.line);

  async function remove() {
    if (!window.confirm(s.removeConfirm)) return;
    setRemoving(true);
    const response = await fetch(`/api/routes/${route.id}`, { method: "DELETE" }).catch(() => null);
    if (!response?.ok) {
      setRemoving(false);
      window.alert(s.removeFailed);
      return;
    }
    router.push("/routes");
    router.refresh();
  }
  const date = new Date(route.createdAt).toLocaleDateString(intlLocale(), { day: "numeric", month: "long", year: "numeric" });
  return (
    <div className="page">
      <Link href="/routes" className="back"><IoChevronBack aria-hidden />{s.back}</Link>
      <div className="page-head">
        <div>
          <h1>{route.name}</h1>
          <p className="subtitle">{[route.place, s.drawn(date)].filter(Boolean).join(" · ")}</p>
        </div>
        <div className="header-actions">
          <button type="button" className="header-button danger" onClick={() => void remove()} disabled={removing}>
            <IoTrashOutline size={18} aria-hidden />
            <span>{s.remove}</span>
          </button>
          <Link href={`/routes/${route.id}/edit`} className="header-button">
            <IoCreateOutline size={18} aria-hidden />
            <span>{s.edit}</span>
          </Link>
        </div>
      </div>
      <SummaryBanner
        label={s.length}
        value={formatDistance(length)}
        unit={distanceUnit()}
        detail={s.run}
        figures={[
          { label: s.gain, value: elevation ? formatElevation(elevation.gainM) : "–", unit: elevationUnit() },
          ...PACES.map((seconds) => ({ label: s.at(`${formatPace(seconds)}${paceUnit()}`), value: formatDuration((length / 1000) * seconds) })),
        ]}
      />
      <div style={{ marginTop: 16 }}>
        <TrackMap line={route.line} />
      </div>
      <SectionHeader title={s.profile} />
      <div className="panel padded">
        <div className="profile-room" style={{ marginTop: 0 }}>
          {elevation ? (
            <LineChart
              series={elevation.profile}
              format={(metres) => `${formatElevation(metres)} ${elevationUnit()}`}
              lowLabel={s.low}
              highLabel={s.high}
              label={s.profile}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
