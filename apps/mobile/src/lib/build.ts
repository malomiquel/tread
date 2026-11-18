import Constants from "expo-constants";

/** What this build is, as stamped at the moment it was made. */
export interface Build {
  /** Derived from the history: features move the minor, fixes the patch. */
  version: string;
  /** Count of commits. Monotonic, and what the stores order builds by. */
  buildNumber: string;
  /** Short commit, with a trailing + when the tree held uncommitted edits. */
  commit: string;
  builtAt: Date | null;
}

export function currentBuild(): Build {
  const extra = Constants.expoConfig?.extra?.build as
    | { commit?: string; buildNumber?: string; builtAt?: string }
    | undefined;
  const made = extra?.builtAt ? new Date(extra.builtAt) : null;
  return {
    version: Constants.expoConfig?.version ?? "—",
    buildNumber: extra?.buildNumber ?? "—",
    commit: extra?.commit ?? "—",
    builtAt: made && !Number.isNaN(made.getTime()) ? made : null,
  };
}

/**
 * One line: the version and build, the commit behind them, and when it was
 * made. Four facts because each answers a different question — which release
 * this is, whether it is newer than the last, exactly what source it holds,
 * and how old it is.
 */
export function buildLine(build = currentBuild()): string {
  const made = build.builtAt
    ? build.builtAt.toLocaleString("fr-FR", {
        day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
      })
    : null;
  return [`${build.version} (${build.buildNumber})`, build.commit, made]
    .filter(Boolean)
    .join(" · ");
}
