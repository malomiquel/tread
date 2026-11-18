/**
 * Where the app asks for the weather and for routes, and where people can
 * write to.
 *
 * The defaults are the free public services the app was built on. Neither is
 * meant for a product people pay for — Open-Meteo's free API is for
 * non-commercial use, and routing.openstreetmap.de is a community server —
 * so each can be pointed elsewhere at build time without touching the code:
 * an Open-Meteo subscription (its own host and key), a routing server of the
 * app's own. See `app.config.js` for the variables.
 *
 * Free of anything native, so the modules that build URLs stay testable in
 * plain Node; the app hands its build configuration in at startup.
 */

export interface Services {
  /** Open-Meteo's forecast endpoint. */
  weatherUrl: string;
  /** The key a commercial Open-Meteo plan comes with, or null on the free API. */
  weatherKey: string | null;
  /** An OSRM route endpoint with a walking profile, up to `/route/v1/<profile>`. */
  routingUrl: string;
  /** Where support mail goes, or null while there is none: the row is then hidden. */
  supportEmail: string | null;
}

export const DEFAULT_SERVICES: Services = {
  weatherUrl: "https://api.open-meteo.com/v1/forecast",
  weatherKey: null,
  routingUrl: "https://routing.openstreetmap.de/routed-foot/route/v1/foot",
  supportEmail: null,
};

let current: Services = DEFAULT_SERVICES;

export const services = (): Services => current;

/** A value from the build, or nothing when it is missing or blank. */
const given = (value: unknown): string | null =>
  typeof value === "string" && value.trim() !== "" ? value.trim() : null;

/**
 * Take the build's configuration, keeping the default for anything it does
 * not set. A trailing slash on a URL is dropped, since paths are appended.
 */
export function configureServices(from: Record<string, unknown> | null | undefined): void {
  const url = (value: unknown) => given(value)?.replace(/\/+$/, "") ?? null;
  current = {
    weatherUrl: url(from?.weatherUrl) ?? DEFAULT_SERVICES.weatherUrl,
    weatherKey: given(from?.weatherKey),
    routingUrl: url(from?.routingUrl) ?? DEFAULT_SERVICES.routingUrl,
    supportEmail: given(from?.supportEmail),
  };
}

/** A forecast URL for the given query, with the plan's key when there is one. */
export function weatherRequest(query: string): string {
  const { weatherUrl, weatherKey } = current;
  return `${weatherUrl}?${query}${weatherKey ? `&apikey=${encodeURIComponent(weatherKey)}` : ""}`;
}
