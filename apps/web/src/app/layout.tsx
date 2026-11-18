import type { Metadata } from "next";
import { Barlow_Condensed } from "next/font/google";
import { headers } from "next/headers";
import { defineStrings } from "@tread/core/i18n";
import { paletteCss } from "@tread/core/palette";
import { pickLanguage } from "@/lib/language";
import "./globals.css";

const barlow = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-barlow",
});

const strings = defineStrings({
  fr: { description: "Tes courses et tes sorties à vélo, lues dans le navigateur." },
  en: { description: "Your runs and rides, read in the browser." },
});

export async function generateMetadata(): Promise<Metadata> {
  const language = pickLanguage((await headers()).get("accept-language"));
  // The app reads private files: nothing here is for a search engine.
  return { title: "Tread", description: strings(language).description, robots: { index: false, follow: false } };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const language = pickLanguage((await headers()).get("accept-language"));
  return (
    <html lang={language} className={barlow.variable}>
      <head>
        <style>{paletteCss()}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
