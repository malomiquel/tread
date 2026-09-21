import { File } from "expo-file-system";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { Alert } from "react-native";
import { importRun } from "@/lib/db";
import { parseGpx } from "@/lib/gpx";

/**
 * The path inside an incoming URL, whatever scheme it arrived under.
 *
 * A file handed over by iOS reaches the app as file://, but the router
 * rewrites it into the app's own scheme before anything else sees it — the
 * same document turns up as tread:///private/var/… Stripping whichever scheme
 * is in front leaves the one thing that matters, which is where the file is.
 */
function pathOf(url: string): string {
  return decodeURI(url.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "/").replace(/^\/+/, "/"));
}

/**
 * Takes in a GPX file handed over by the system.
 *
 * Once the app declares it can open them, a trace shared from Files, Mail or
 * anywhere else arrives as a launch URL. iOS copies it into this app's own
 * inbox first — the app never asks for it, it is simply given — so reading it
 * needs no permission and the copy is ours to delete afterwards.
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
          Alert.alert(
            "Rien à importer",
            "Ce file ne contient aucun point exploitable, ou cette course est déjà dans l'app.",
          );
          return;
        }
        router.replace({ pathname: "/run/[id]", params: { id: String(id) } });
      } catch (cause) {
        router.replace("/");
        Alert.alert("Import impossible", cause instanceof Error ? cause.message : "Fichier illisible.");
      } finally {
        // The inbox copy has served its purpose; leaving it would quietly fill
        // the app's storage with every trace ever opened.
        try {
          file.delete();
        } catch {
          /* already gone, or never ours to delete */
        }
      }
    })();
  }, [url, router]);

  return null;
}
