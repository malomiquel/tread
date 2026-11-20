"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { IoCalendarOutline, IoMapOutline, IoPersonOutline, IoSettingsOutline, IoTimeOutline } from "react-icons/io5";
import { defineStrings, useStrings } from "@tread/core/i18n";
import { Brand } from "@/components/Brand";
import { LanguageSwitch } from "@/components/LanguageSwitch";

const strings = defineStrings({
  fr: { plan: "Plan", routes: "Parcours", history: "Historique", profile: "Profil", settings: "Réglages", main: "Navigation" },
  en: { plan: "Plan", routes: "Routes", history: "History", profile: "Profile", settings: "Settings", main: "Navigation" },
});

const TABS = [
  { href: "/plan", key: "plan", Icon: IoCalendarOutline },
  { href: "/routes", key: "routes", Icon: IoMapOutline },
  { href: "/history", key: "history", Icon: IoTimeOutline },
  { href: "/profile", key: "profile", Icon: IoPersonOutline },
] as const;

/**
 * The frame of every signed-in page: the name, the four tabs of the phone
 * (without the run disc: the browser does not record), the language and the
 * settings.
 * The tabs sit in the header on a large screen and float at the foot, as on
 * the phone, at a phone's width.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const s = useStrings(strings);
  const path = usePathname();
  const current = (href: string) => (path === href || path.startsWith(`${href}/`) ? "page" : undefined);
  // Pages pushed from a tab keep it lit: an outing from History, the collection from Profile.
  const parent = path.startsWith("/outings/")
    ? "/history"
    : path === "/collection" || path === "/card-rules" ? "/profile" : null;
  const links = TABS.map(({ href, key, Icon }) => (
    <Link key={href} href={href} aria-current={current(href) ?? (parent === href ? "page" : undefined)}>
      <Icon size={20} aria-hidden />
      <span>{s[key]}</span>
    </Link>
  ));
  return (
    <>
      <header className="shell-top">
        <div className="shell-top-inner">
          <Brand />
          <nav className="nav" aria-label={s.main}>{links}</nav>
          <div className="shell-account">
            <LanguageSwitch />
            <Link href="/settings" className="header-button" aria-current={current("/settings")}>
              <IoSettingsOutline size={18} aria-hidden />
              <span>{s.settings}</span>
            </Link>
          </div>
        </div>
      </header>
      <main>{children}</main>
      <nav className="tabbar" aria-label={s.main}>{links}</nav>
    </>
  );
}
