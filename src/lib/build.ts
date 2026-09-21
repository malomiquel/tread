import Constants from "expo-constants";

/** What this build is, as stamped at the moment it was made. */
export interface Build {
  version: string;
  /** Short commit, with a trailing + when the tree held uncommitted edits. */
  commit: string;
  builtAt: Date | null;
}

export function currentBuild(): Build {
  const extra = Constants.expoConfig?.extra?.build as
    | { commit?: string; builtAt?: string }
    | undefined;
  const made = extra?.builtAt ? new Date(extra.builtAt) : null;
  return {
    version: Constants.expoConfig?.version ?? "—",
    commit: extra?.commit ?? "—",
    builtAt: made && !Number.isNaN(made.getTime()) ? made : null,
  };
}

/** One line: the version, the commit it came from, and when it was made. */
export function buildLine(build = currentBuild()): string {
  const made = build.builtAt
    ? build.builtAt.toLocaleString("fr-FR", {
        day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
      })
    : null;
  return [`Version ${build.version}`, build.commit, made].filter(Boolean).join(" · ");
}
