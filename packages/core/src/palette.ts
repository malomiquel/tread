/**
 * Every colour Tread uses, as a light and a dark value.
 *
 * The single source for the phone (`theme.ts` turns each pair into a colour
 * the system resolves per appearance), the web app and the landing page
 * (both read them as CSS variables). Change a value here and every surface
 * follows.
 */
export const palette = {
  background: { light: "#ffffff", dark: "#0b0b0c" },
  sunken: { light: "#f4f4f4", dark: "#18181a" },
  hairline: { light: "#e6e6e6", dark: "#2b2b2e" },
  text: { light: "#101010", dark: "#f2f2f3" },
  muted: { light: "rgba(16, 16, 16, 0.62)", dark: "rgba(242, 242, 243, 0.62)" },
  subtle: { light: "rgba(16, 16, 16, 0.42)", dark: "rgba(242, 242, 243, 0.44)" },
  accent: { light: "#00348f", dark: "#6fa8ff" },
  accentText: { light: "#ffffff", dark: "#04101f" },
  accentSoft: { light: "rgba(0, 52, 143, 0.12)", dark: "rgba(111, 168, 255, 0.18)" },
  warning: { light: "#9a5b06", dark: "#d69a3e" },
  danger: { light: "#b3261e", dark: "#f08078" },
  dangerSoft: { light: "rgba(179, 38, 30, 0.10)", dark: "rgba(240, 128, 120, 0.16)" },
  track: { light: "#00348f", dark: "#6fa8ff" },
  scrim: { light: "rgba(16, 16, 16, 0.4)", dark: "rgba(0, 0, 0, 0.6)" },
  /**
   * The stage: the cobalt a page's lead figure stands on, the same in both
   * appearances, as on the landing page. Text on it is `onStage`, its light
   * the `stageGlow`, and figures sit on it in `glass`.
   */
  stage: { light: "#00348f", dark: "#00348f" },
  stageGlow: { light: "#6fa8ff", dark: "#6fa8ff" },
  onStage: { light: "#ffffff", dark: "#ffffff" },
  glass: { light: "rgba(4, 16, 31, 0.32)", dark: "rgba(4, 16, 31, 0.32)" },
  glassRule: { light: "rgba(255, 255, 255, 0.16)", dark: "rgba(255, 255, 255, 0.16)" },
} as const;

export type ColorToken = keyof typeof palette;

/** `accentSoft` becomes `--accent-soft`. */
const variable = (token: string): string => `--${token.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;

/**
 * The palette as a stylesheet for the web: light by default, dark under
 * `prefers-color-scheme`, every token a CSS variable.
 */
export function paletteCss(): string {
  const block = (appearance: "light" | "dark") =>
    Object.entries(palette)
      .map(([token, pair]) => `${variable(token)}: ${pair[appearance]};`)
      .join(" ");
  return `:root { color-scheme: light dark; ${block("light")} }\n@media (prefers-color-scheme: dark) { :root { ${block("dark")} } }`;
}
