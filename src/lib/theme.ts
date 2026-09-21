/**
 * Thème clair. Le fond n'est pas blanc pur mais un gris très léger : les
 * cartes blanches posées dessus se détachent alors d'elles-mêmes, sans avoir
 * besoin de bordures. Un seul accent, le vert, porte toute la donnée.
 */
export const couleurs = {
  fond: "#f4f5f7",
  surface: "#ffffff",
  bordure: "rgba(15, 23, 42, 0.07)",
  texte: "#0f172a",
  attenue: "rgba(15, 23, 42, 0.58)",
  discret: "rgba(15, 23, 42, 0.40)",
  accent: "#16a34a",
  accentTexte: "#ffffff",
  accentDoux: "rgba(22, 163, 74, 0.12)",
  pause: "#b45309",
  danger: "#dc2626",
  dangerDoux: "rgba(220, 38, 38, 0.08)",
  trace: "#16a34a",
} as const;

/**
 * Ombres plutôt que bordures : une ombre s'adapte au fond sur lequel elle
 * tombe, une bordure trace un trait dur qui durcit toute l'interface.
 * shadow* couvre iOS, elevation couvre Android.
 */
export const ombres = {
  carte: {
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  bouton: {
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 14,
    elevation: 5,
  },
};
