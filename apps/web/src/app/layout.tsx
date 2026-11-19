import type { Metadata, Viewport } from "next";
import { Barlow_Condensed } from "next/font/google";
import { defineStrings } from "@tread/core/i18n";
import { paletteCss } from "@tread/core/palette";
import { requestLanguage } from "@/lib/server/locale";
import "./globals.css";

const barlow = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  style: ["normal", "italic"],
  variable: "--font-barlow",
});

const strings = defineStrings({
  fr: { description: "Tes courses, ton programme et tes parcours, sur grand écran." },
  en: { description: "Your runs, your plan and your routes, on a large screen." },
});

export async function generateMetadata(): Promise<Metadata> {
  // Private pages behind an account: nothing here is for a search engine.
  return { title: "Tread", description: strings(await requestLanguage()).description, robots: { index: false, follow: false } };
}

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang={await requestLanguage()} className={barlow.variable}>
      <head>
        <style>{paletteCss()}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
