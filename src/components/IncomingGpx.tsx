import { useRouter } from "expo-router";
import { File } from "expo-file-system";
import * as Linking from "expo-linking";
import { useEffect, useRef } from "react";
import { Alert } from "react-native";
import { importRun } from "@/lib/db";
import { parseGpx } from "@/lib/gpx";

/**
 * Takes in a GPX file handed over by the system.
 *
 * Once the app declares it can open them, a trace shared from Files, Mail or
 * another app arrives as a launch URL. iOS copies the file into this app's own
 * inbox first — the app never asks for it, it is simply given — so reading it
 * needs no permission and the copy is ours to delete afterwards.
 *
 * Renders nothing: it exists to watch, not to show.
 */
export function IncomingGpx() {
  const url = Linking.useURL();
  const router = useRouter();
  // A ref rather than state: remembering what has been dealt with must not
  // itself cause a render, and the same URL is handed over more than once.
  const traite = useRef<string | null>(null);

  useEffect(() => {
    if (!url || url === traite.current || !url.startsWith("file://")) return;
    traite.current = url;

    void (async () => {
      const fichier = new File(decodeURI(url));
      try {
        const { name, points } = parseGpx(await fichier.text());
        const id = await importRun(name, points);
        if (id === null) {
          Alert.alert(
            "Rien à importer",
            "Ce fichier ne contient aucun point exploitable, ou cette course est déjà dans l'app.",
          );
          return;
        }
        router.push({ pathname: "/run/[id]", params: { id: String(id) } });
      } catch (cause) {
        Alert.alert("Import impossible", cause instanceof Error ? cause.message : "Fichier illisible.");
      } finally {
        // The inbox copy has served its purpose; leaving it would quietly fill
        // the app's storage with every trace ever opened.
        try {
          fichier.delete();
        } catch {
          /* already gone, or never ours to delete */
        }
      }
    })();
  }, [url, router]);

  return null;
}
