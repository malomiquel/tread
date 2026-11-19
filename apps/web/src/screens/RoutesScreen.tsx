"use client";

import { useState } from "react";
import Link from "next/link";
import { IoChevronForward, IoPhonePortraitOutline } from "react-icons/io5";
import { formatDistance } from "@tread/core/format";
import { defineStrings, intlLocale, plural, useStrings } from "@tread/core/i18n";
import { distanceUnit } from "@tread/core/units";
import { ChoiceMenu } from "@/components/ChoiceMenu";
import { EmptyState } from "@/components/EmptyState";
import { NoMatch } from "@/components/NoMatch";
import { PageHeader } from "@/components/PageHeader";
import { RunShape } from "@/components/RunShape";
import { routeLengthM, routeShape } from "@/lib/route";
import type { RouteRow } from "@/lib/types";

type Sort = "recent" | "longest" | "shortest" | "name";

const strings = defineStrings({
  fr: {
    title: "Parcours",
    count: (n: number, km: string) => `${plural(n, "parcours", "parcours")} · ${km} ${distanceUnit()}`,
    narrowed: (shown: number, all: number) => `${shown} sur ${all}`,
    search: "Chercher un parcours",
    sort: "Trier",
    sorts: { recent: "Les plus récents", longest: "Les plus longs", shortest: "Les plus courts", name: "Par nom" } as Record<Sort, string>,
    emptyTitle: "Trace ton premier parcours",
    emptyDetail: "Dans Tread, onglet Parcours : les rues sont suivies, la distance tombe juste.",
    note: "Les parcours se dessinent sur le téléphone et se retrouvent ici à la synchro.",
  },
  en: {
    title: "Routes",
    count: (n: number, km: string) => `${plural(n, "route", "routes")} · ${km} ${distanceUnit()}`,
    narrowed: (shown: number, all: number) => `${shown} of ${all}`,
    search: "Search routes",
    sort: "Sort",
    sorts: { recent: "Most recent", longest: "Longest", shortest: "Shortest", name: "By name" } as Record<Sort, string>,
    emptyTitle: "Draw your first route",
    emptyDetail: "In Tread, Routes tab: it follows the streets, so the distance comes out right.",
    note: "Routes are drawn on the phone and show here at the next sync.",
  },
});

export function RoutesScreen({ routes }: { routes: RouteRow[] }) {
  const s = useStrings(strings);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("recent");

  if (routes.length === 0) {
    return (
      <div className="page narrow">
        <PageHeader title={s.title} />
        <EmptyState
          actions={[{ title: s.emptyTitle, detail: s.emptyDetail, icon: <IoPhonePortraitOutline size={22} />, href: "/settings#phone", primary: true }]}
          note={s.note}
        />
      </div>
    );
  }

  const measured = routes.map((route) => ({ ...route, lengthM: routeLengthM(route.line) }));
  const needle = query.trim().toLocaleLowerCase();
  const shown = measured
    .filter((route) => !needle || route.name.toLocaleLowerCase().includes(needle) || (route.place ?? "").toLocaleLowerCase().includes(needle))
    .sort((a, b) =>
      sort === "longest" ? b.lengthM - a.lengthM
        : sort === "shortest" ? a.lengthM - b.lengthM
          : sort === "name" ? a.name.localeCompare(b.name, intlLocale())
            : b.createdAt - a.createdAt);
  const total = measured.reduce((sum, route) => sum + route.lengthM, 0);

  return (
    <div className="page narrow">
      <PageHeader
        title={s.title}
        subtitle={shown.length < measured.length ? s.narrowed(shown.length, measured.length) : s.count(measured.length, formatDistance(total))}
      />
      {measured.length > 1 ? (
        <>
          <input className="search" type="search" placeholder={s.search} aria-label={s.search} value={query} onChange={(event) => setQuery(event.target.value)} />
          <div className="chip-row" style={{ marginBottom: 14 }}>
            <ChoiceMenu
              title={s.sort}
              label={s.sorts[sort]}
              on
              chosen={sort}
              onChoose={setSort}
              choices={(Object.keys(s.sorts) as Sort[]).map((value) => ({ value, label: s.sorts[value] }))}
            />
          </div>
        </>
      ) : null}
      {shown.length === 0 ? (
        <NoMatch onShowAll={() => setQuery("")} />
      ) : (
        <div className="panel">
          <ul className="rows">
            {shown.map((route) => (
              <li key={route.id}>
                <Link href={`/routes/${route.id}`} className="row">
                  <span className="tile"><RunShape shape={routeShape(route.line)} /></span>
                  <span className="row-main">
                    <span className="row-name" style={{ display: "block" }}>{route.name}</span>
                    <span className="row-detail" style={{ display: "block" }}>
                      {route.place ?? new Date(route.createdAt).toLocaleDateString(intlLocale(), { day: "numeric", month: "long", year: "numeric" })}
                    </span>
                  </span>
                  <span className="row-figures"><strong>{formatDistance(route.lengthM)}</strong><span className="unit">{distanceUnit()}</span></span>
                  <IoChevronForward className="chevron" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
