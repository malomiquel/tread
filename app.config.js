const { execSync } = require("node:child_process");

/**
 * Stamps each build with where it came from.
 *
 * An app installed on a phone says nothing about which version of the source
 * produced it, so "am I still up to date?" has no answer from the device. The
 * commit it was built from does answer it: compare what the app shows with
 * `git log --oneline -1` and you know in a glance.
 *
 * Read at config time, which is to say once per build. Failures are silent
 * and fall back to a dash: a missing git is a reason to show less, never a
 * reason to fail a build.
 */
function git(commande) {
  try {
    return execSync(commande, { cwd: __dirname, stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return "";
  }
}

const commit = git("git rev-parse --short HEAD") || "—";
// A build made over uncommitted edits is not the commit it claims to be, and
// saying so is the difference between a stamp you can trust and one you cannot.
const clean = git("git status --porcelain") === "";

module.exports = ({ config }) => ({
  ...config,
  extra: {
    ...config.extra,
    build: {
      commit: clean ? commit : `${commit}+`,
      builtAt: new Date().toISOString(),
    },
  },
});
