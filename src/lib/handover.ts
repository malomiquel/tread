/**
 * Handing the whole app to the phone next to you, over the local network.
 *
 * The sending phone serves one file and shows a QR code; the receiving phone
 * scans it and downloads. Neither leaves the app, which is the only thing
 * this buys over the file in transfer.ts — and it is bought at a real price:
 * a native web server, a camera, and both phones on a Wi-Fi that lets its
 * clients talk to one another. Cafés and hotels often do not, so the file
 * stays as the way that always works, and the screens say so.
 *
 * The arithmetic and the url shape are here, testable on their own; only the
 * bottom of the file knows a server exists.
 */

/** The file the server serves, named after the token so the path is the secret. */
export const handoverFileName = (token: string): string => `${token}.zip`;

/**
 * How long the server stays up with nobody scanning.
 *
 * Two minutes: long enough to fetch the other phone from another room, short
 * enough that a forgotten screen does not leave a copy of somebody's whole
 * history reachable on a shared network all evening. The screen counts it
 * down out loud rather than dying quietly.
 */
export const HANDOVER_TIMEOUT_MS = 2 * 60 * 1000;

/**
 * A single-use token, which is what stands between this file and anything
 * else on the same network.
 *
 * Not a cryptographic secret, and it does not need to be one: it names a file
 * that exists for two minutes, on a local network, behind a server that stops
 * when the screen is left. Twenty-two characters of base 36 is a hundred and
 * thirteen bits — nothing is guessing that inside the window, and a network
 * where someone is already watching the traffic is a network where the fetch
 * itself was visible anyway.
 */
export function makeToken(random: () => number = Math.random): string {
  let token = "";
  while (token.length < 22) token += Math.floor(random() * 36 ** 8).toString(36).padStart(8, "0");
  return token.slice(0, 22);
}

/**
 * Addresses the receiving phone is willing to fetch from.
 *
 * Private ranges only. A QR code is a url somebody else wrote, and scanning
 * one off a poster must not make the app download whatever it points at: the
 * only thing it is allowed to reach is another device on this network.
 */
const PRIVATE_HOST =
  /^(?:10\.\d{1,3}|192\.168|169\.254|172\.(?:1[6-9]|2\d|3[01]))\.\d{1,3}\.\d{1,3}$/;

/** What the QR code carries: the whole url, and nothing else. */
export function handoverUrl(origin: string, token: string): string {
  return `${origin.replace(/\/$/, "")}/${handoverFileName(token)}`;
}

/**
 * A scanned code, or null for anything that is not one of ours.
 *
 * Shape and host are both checked, because this is the one place the app acts
 * on something a stranger could have printed.
 */
export function readHandoverUrl(scanned: string): string | null {
  try {
    const url = new URL(scanned.trim());
    if (url.protocol !== "http:") return null;
    if (!PRIVATE_HOST.test(url.hostname)) return null;
    if (!/^\/[a-z0-9]{22}\.zip$/.test(url.pathname)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** Seconds left, for a countdown that says what is about to happen. */
export function secondsLeft(startedAt: number, now: number): number {
  return Math.max(0, Math.ceil((startedAt + HANDOVER_TIMEOUT_MS - now) / 1000));
}

/**
 * The server sits behind a lazy require, for the same reason HealthKit and
 * the notifications do: its native half is missing from Expo Go and from any
 * build made before it was added, and a plain import would take the screen
 * down rather than the one feature it belongs to.
 */
type Server = typeof import("@dr.pogodin/react-native-static-server").default;

let loaded: { Server: Server } | null | undefined;

function staticServer(): { Server: Server } | null {
  if (loaded !== undefined) return loaded;
  try {
    // Everything React Native is required here rather than imported above,
    // which is what lets the url handling in this file be tested by plain
    // node.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { TurboModuleRegistry } = require("react-native") as typeof import("react-native");

    /*
     * The registry is asked before anything is loaded, and that order is the
     * whole point.
     *
     * Both halves of the server bind to their native counterpart with
     * `getEnforcing`, which throws at module scope where that counterpart is
     * missing — inside Expo Go, or in a build made before this was added. A
     * try/catch around the require is not enough on its own: a module that
     * throws while loading is reported by the bundler whether or not the
     * caller catches it, which is the red screen that appeared on the way
     * into the sending screen. Asking the registry cannot throw, and answers
     * with nothing instead.
     *
     * The same shape as the HealthKit guard, for the same reason.
     */
    for (const native of ["ReactNativeStaticServer", "ReactNativeFs"]) {
      if (!TurboModuleRegistry.get(native)) return (loaded = null);
    }

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const module = require("@dr.pogodin/react-native-static-server") as {
      default: Server;
    };
    loaded = { Server: module.default };
  } catch {
    loaded = null;
  }
  return loaded;
}

/** Whether this build can serve at all. False inside Expo Go. */
export const handoverAvailable = (): boolean => staticServer() !== null;

export interface Handover {
  /** What goes into the QR code. */
  url: string;
  /** Stops the server and deletes the file. Safe to call twice. */
  stop: () => Promise<void>;
}

/**
 * Serve one file, once, on the local network.
 *
 * The directory is emptied first and holds nothing but this transfer: a
 * static server hands out everything under the folder it is given, so the
 * folder is the boundary and it contains exactly one file whose name nobody
 * can guess.
 */
export async function startHandover(
  writeFile: (name: string) => Promise<void>,
  emptyDir: () => Promise<string>,
): Promise<Handover | null> {
  const module = staticServer();
  if (!module) return null;

  const token = makeToken();
  const fileDir = await emptyDir();
  await writeFile(handoverFileName(token));

  const server = new module.Server({
    fileDir,
    // Reachable from the other phone rather than from this app alone, which
    // is the whole point; the library picks the Wi-Fi address itself.
    nonLocal: true,
    // Any free port. A fixed one would collide with whatever else the phone
    // is running, and there is nothing to bookmark here.
    port: 0,
    // The app going to the background is somebody putting the phone down
    // mid-transfer; the server comes back with the screen.
    stopInBackground: true,
  });

  const origin = await server.start();
  let stopped = false;

  return {
    url: handoverUrl(origin, token),
    stop: async () => {
      if (stopped) return;
      stopped = true;
      try {
        await server.stop();
      } catch {
        /* nothing left to stop */
      }
      // The copy goes too. It is the whole history, and it has no business
      // outliving the two minutes it existed for.
      await emptyDir().catch(() => "");
    },
  };
}
