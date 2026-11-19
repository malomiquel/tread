"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { IoCloudUploadOutline } from "react-icons/io5";
import { defineStrings, useStrings } from "@tread/core/i18n";

const strings = defineStrings({
  fr: {
    drop: "Dépose ta copie Tread ou tes fichiers GPX ici",
    or: "ou clique pour les choisir",
    reading: "Lecture…",
    done: (added: number, updated: number) =>
      [added > 0 ? `${added} sortie${added > 1 ? "s" : ""} ajoutée${added > 1 ? "s" : ""}` : null,
        updated > 0 ? `${updated} mise${updated > 1 ? "s" : ""} à jour` : null].filter(Boolean).join(" · ") || "Rien de nouveau.",
    unreadable: "Ce fichier n'est ni une copie Tread ni un GPX.",
    failed: "L'envoi n'a pas abouti. Rien n'a été perdu : réessaie.",
  },
  en: {
    drop: "Drop your Tread copy or your GPX files here",
    or: "or click to choose them",
    reading: "Reading…",
    done: (added: number, updated: number) =>
      [added > 0 ? `${added} outing${added === 1 ? "" : "s"} added` : null,
        updated > 0 ? `${updated} updated` : null].filter(Boolean).join(" · ") || "Nothing new.",
    unreadable: "This file is neither a Tread copy nor a GPX file.",
    failed: "The upload did not go through. Nothing was lost: try again.",
  },
});

/**
 * Bring a history in from a file: the safety copy or "Switch phones" file
 * the app writes (everything), the "All my runs" archive, or GPX files.
 */
export function Upload() {
  const s = useStrings(strings);
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [state, setState] = useState<{ busy: boolean; message: string; error: boolean }>({ busy: false, message: "", error: false });

  async function send(files: FileList | null) {
    if (!files || files.length === 0) return;
    setState({ busy: true, message: s.reading, error: false });
    let added = 0;
    let updated = 0;
    for (const file of Array.from(files)) {
      const body = new FormData();
      body.append("file", file);
      try {
        const response = await fetch("/api/sync", { method: "POST", body });
        if (response.status === 400) {
          setState({ busy: false, message: s.unreadable, error: true });
          return;
        }
        if (!response.ok) throw new Error(String(response.status));
        const result = (await response.json()) as { added: number; updated: number };
        added += result.added;
        updated += result.updated;
      } catch {
        setState({ busy: false, message: s.failed, error: true });
        return;
      }
    }
    setState({ busy: false, message: s.done(added, updated), error: false });
    router.refresh();
  }

  return (
    <div>
      <button
        type="button"
        className={`drop${over ? " over" : ""}`}
        style={{ width: "100%", background: over ? undefined : "transparent", font: "inherit" }}
        onClick={() => input.current?.click()}
        onDragOver={(event) => { event.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(event) => { event.preventDefault(); setOver(false); void send(event.dataTransfer.files); }}
        disabled={state.busy}
      >
        <IoCloudUploadOutline size={26} aria-hidden />
        <div style={{ fontWeight: 600, color: "var(--text)", marginTop: 6 }}>{s.drop}</div>
        <div>{s.or}</div>
      </button>
      <input ref={input} type="file" accept=".zip,.gpx" multiple hidden onChange={(event) => void send(event.target.files)} />
      <p className={`form-message${state.error ? " error" : ""}`} aria-live="polite">{state.message}</p>
    </div>
  );
}
