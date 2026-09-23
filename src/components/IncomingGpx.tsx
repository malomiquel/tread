import { File } from "expo-file-system";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { Alert } from "react-native";
import { importRun } from "@/lib/db";
import { parseGpx } from "@/lib/gpx";
import { defineStrings } from "@/lib/i18n";

const incomingStrings = defineStrings({
  fr: {
    nothingTitle: "Rien à importer",
    nothingMessage: "Ce fichier ne contient aucun point exploitable, ou cette course est déjà dans l'app.",
    failedTitle: "Import impossible",
    unreadable: "Fichier illisible.",
  },
  en: {
    nothingTitle: "Nothing to import",
    nothingMessage: "This file has no usable points, or this run is already in the app.",
    failedTitle: "Import failed",
    unreadable: "Unreadable file.",
  },
});

/**
 * The path inside an incoming URL, whatever scheme it arrived under.
 *
 * A file handed over by iOS reaches the app as file://, but the router
 * rewrites it into the app's own scheme before anything else sees it — the
 * same document turns up as tread:///private/var/… Stripping whichever scheme
 * is in front leaves the one thing that matters, which is where the file is.
 *
 * It also arrives over-encoded. A directory named "File Provider Storage"
 * comes through as File%2520Provider%2520Storage: %2520 is %20 encoded a
 * second time. Decoding once leaves the percent signs behind, so it is
 * decoded until it stops changing, which is the only way back to the name the
 * file actually has.
 */
function pathOf(url: string): string {
  let path = url.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "/").replace(/^\/+/, "/");
  for (let pass = 0; pass < 4; pass += 1) {
    try {
      const once = decodeURIComponent(path);
      if (once === path) break;
      path = once;
    } catch {
      // A stray percent that is not an escape: what we have is already the
      // real path.
      break;
    }
  }
  return path;
}

/**
 * True for a file iOS copied into this app's inbox, false for one it merely
 * lent us.
 *
 * The distinction decides whether the file may be deleted afterwards, and
 * getting it wrong would destroy someone's own document. A copy lives in a
 * directory iOS names after the bundle with -Inbox appended, and nothing else
 * does; a file opened in place is the original, sitting wherever its owner
 * keeps it.
 */
function isOurCopy(path: string): boolean {
  return /-Inbox\//.test(path);
}

/**
 * Takes in a GPX file handed over by the system.
 *
 * Once the app declares it can open them, a trace shared from Files, Mail or
 * anywhere else arrives as a launch URL. It comes one of two ways: copied
 * into the app's own inbox, or opened in place, which hands over the original
 * behind a security-scoped URL. Reading covers both — the file layer claims
 * and releases that access around the read — but deleting does not, and must
 * not.
 *
 * The screen is replaced rather than pushed: the router has already tried to
 * read the file's path as a route and landed on its not-found page, and that
 * page has no business staying underneath the run it produced.
 *
 * Renders nothing: it exists to watch, not to show.
 */
export function IncomingGpx() {
  const url = Linking.useURL();
  const router = useRouter();
  // A ref rather than state: remembering what has been dealt with must not
  // itself cause a render, and the same URL is handed over more than once.
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (!url || url === handled.current) return;
    const path = pathOf(url);
    if (!path.toLowerCase().endsWith(".gpx")) return;
    handled.current = url;

    void (async () => {
      const file = new File(`file://${encodeURI(path)}`);
      try {
        const { name, points } = parseGpx(await file.text());
        const id = await importRun(name, points);
        if (id === null) {
          router.replace("/");
          Alert.alert(incomingStrings().nothingTitle, incomingStrings().nothingMessage);
          return;
        }
        // Two moves rather than one. The router has already put its
        // not-found page on screen, having read the file's path as an
        // address; replacing it with the history clears that, and pushing the
        // run on top leaves something to go back to. Landing straight on the
        // run would show it with no way out, which is how a file opened from
        // elsewhere used to trap you.
        router.replace("/");
        setTimeout(
          () => router.push({ pathname: "/run/[id]", params: { id: String(id) } }),
          0,
        );
      } catch (cause) {
        router.replace("/");
        Alert.alert(
          incomingStrings().failedTitle,
          cause instanceof Error ? cause.message : incomingStrings().unreadable,
        );
      } finally {
        // Only ever our own copy. Leaving those behind would quietly fill the
        // app's storage with every trace ever opened — but deleting a file
        // opened in place would take the original with it, which is somebody's
        // document and none of our business.
        if (isOurCopy(path)) {
          try {
            file.delete();
          } catch {
            /* already gone */
          }
        }
      }
    })();
  }, [url, router]);

  return null;
}
