/**
 * Light theme. The canvas is not pure white but a very light grey, so the
 * white cards laid on top separate themselves without needing borders. A
 * single accent carries all of the data.
 */
export const colors = {
  background: "#f4f5f7",
  surface: "#ffffff",
  border: "rgba(15, 23, 42, 0.07)",
  text: "#0f172a",
  muted: "rgba(15, 23, 42, 0.58)",
  subtle: "rgba(15, 23, 42, 0.40)",
  accent: "#16a34a",
  accentText: "#ffffff",
  accentSoft: "rgba(22, 163, 74, 0.12)",
  warning: "#b45309",
  danger: "#dc2626",
  dangerSoft: "rgba(220, 38, 38, 0.08)",
  track: "#16a34a",
} as const;

/**
 * Shadows rather than borders: a shadow adapts to whatever it falls on, a
 * border draws a hard line that stiffens the whole interface.
 * shadow* covers iOS, elevation covers Android.
 */
export const shadows = {
  card: {
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  button: {
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 14,
    elevation: 5,
  },
};
