// @ts-check
import sitemap from "@astrojs/sitemap";
import { defineConfig } from "astro/config";

// The public address, for canonical links, hreflang and the sitemap.
const site = process.env.SITE_URL ?? "http://localhost:3021";

export default defineConfig({
  site,
  // Static HTML, no client JavaScript: the page is read, not used.
  output: "static",
  server: { port: 3021 },
  i18n: {
    defaultLocale: "fr",
    locales: ["fr", "en"],
    routing: { prefixDefaultLocale: false },
  },
  integrations: [
    sitemap({
      i18n: { defaultLocale: "fr", locales: { fr: "fr-FR", en: "en-GB" } },
    }),
  ],
});
