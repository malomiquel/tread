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

/**
 * The version, read from the history rather than kept by hand.
 *
 * Now that every commit declares what it is, the number can be derived:
 * features move the minor, fixes move the patch, and nothing has to be
 * remembered at release time. A version maintained by hand is a version that
 * stops being true the first time someone forgets — and the whole point of
 * showing it in the app is to be able to trust it.
 *
 * The major stays where app.json puts it: only a person decides that a
 * release breaks with the one before.
 */
function version(fallback) {
  const [major] = fallback.split(".");
  const subjects = git("git log --format=%s").split("\n");
  const count = (type) =>
    subjects.filter((line) => new RegExp(`^${type}(\\(.+\\))?!?: `).test(line)).length;
  const minor = count("feat");
  const patch = count("fix");
  return minor || patch ? `${major}.${minor}.${patch}` : fallback;
}

// Monotonic, and unrelated to the version: iOS refuses a build number that
// goes backwards, and the count of commits only ever goes up.
const buildNumber = git("git rev-list --count HEAD") || "1";

module.exports = ({ config }) => ({
  ...config,
  version: version(config.version ?? "1.0.0"),
  ios: { ...config.ios, buildNumber },
  android: { ...config.android, versionCode: Number(buildNumber) },
  extra: {
    ...config.extra,
    /*
     * Where the app gets its weather and its routes, and where support mail
     * goes. Unset, the free public services are used and no support row is
     * shown; set these before selling the app (see src/lib/services.ts).
     *
     *   TREAD_WEATHER_URL    e.g. https://customer-api.open-meteo.com/v1/forecast
     *   TREAD_WEATHER_KEY    the Open-Meteo plan's API key
     *   TREAD_ROUTING_URL    e.g. https://routing.example.com/route/v1/foot
     *   TREAD_SUPPORT_EMAIL  e.g. support@example.com
     */
    services: {
      weatherUrl: process.env.TREAD_WEATHER_URL,
      weatherKey: process.env.TREAD_WEATHER_KEY,
      routingUrl: process.env.TREAD_ROUTING_URL,
      supportEmail: process.env.TREAD_SUPPORT_EMAIL,
    },
    build: {
      commit: clean ? commit : `${commit}+`,
      buildNumber,
      builtAt: new Date().toISOString(),
    },
  },
});
