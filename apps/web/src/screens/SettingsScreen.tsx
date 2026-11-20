"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  IoCheckmark, IoGlobeOutline, IoLogOutOutline, IoMailOutline, IoPersonOutline, IoPhonePortraitOutline, IoSyncOutline,
} from "react-icons/io5";
import { defineStrings, intlLocale, useStrings, type Language } from "@tread/core/i18n";
import { PageHeader } from "@/components/PageHeader";
import { SectionHeader } from "@/components/SectionHeader";
import { Upload } from "@/components/Upload";
import { authClient } from "@/lib/auth-client";


const strings = defineStrings({
  fr: {
    title: "Réglages",
    account: "Compte",
    name: "Prénom",
    email: "Adresse",
    signOut: "Se déconnecter",
    phone: "Le téléphone",
    phoneSteps: "Dans Tread : Réglages, Compte, puis connecte-toi avec cette adresse. Tes sorties, ton programme, tes parcours et tes chaussures arrivent ici, et chaque nouvelle course suit.",
    lastSync: "Dernière synchro",
    never: "Jamais pour l'instant",
    import: "Importer",
    importFooter: "La copie de sécurité de l'app (tread-copie-…zip) apporte tout. Une archive GPX ou des fichiers GPX apportent les tracés seuls. Une sortie déjà là n'est jamais doublée.",
    danger: "Supprimer le compte",
    dangerFooter: "Le compte et tout ce qu'il contient sur le serveur disparaissent pour de bon. L'app garde ses données sur le téléphone.",
    password: "Ton mot de passe, pour confirmer",
    remove: "Supprimer le compte",
    removeConfirm: "Supprimer ton compte Tread et toutes les sorties enregistrées sur le serveur ? C'est définitif.",
    removeFailed: "Mot de passe incorrect, ou suppression impossible pour l'instant.",
  },
  en: {
    title: "Settings",
    account: "Account",
    name: "First name",
    email: "Address",
    signOut: "Sign out",
    phone: "The phone",
    phoneSteps: "In Tread: Settings, Account, then sign in with this address. Your outings, plan, routes and shoes arrive here, and every new run follows.",
    lastSync: "Last sync",
    never: "Never so far",
    import: "Import",
    importFooter: "The app's safety copy (tread-copie-…zip) brings everything. A GPX archive or GPX files bring the tracks alone. An outing already here is never doubled.",
    danger: "Delete the account",
    dangerFooter: "The account and everything in it on the server are gone for good. The app keeps its data on the phone.",
    password: "Your password, to confirm",
    remove: "Delete the account",
    removeConfirm: "Delete your Tread account and every outing stored on the server? This cannot be undone.",
    removeFailed: "Wrong password, or the account cannot be deleted right now.",
  },
});

export function SettingsScreen({ name, email, syncedAt }: {
  name: string;
  email: string;
  syncedAt: number | null;
}) {
  const s = useStrings(strings);
  const router = useRouter();
  const [removing, setRemoving] = useState(false);
  const [message, setMessage] = useState("");


  async function signOut() {
    await authClient.signOut();
    router.replace("/sign-in");
    router.refresh();
  }

  async function remove(form: FormData) {
    if (!window.confirm(s.removeConfirm)) return;
    setRemoving(true);
    const { error } = await authClient.deleteUser({ password: String(form.get("password") ?? "") });
    setRemoving(false);
    if (error) {
      setMessage(s.removeFailed);
      return;
    }
    router.replace("/sign-in");
    router.refresh();
  }

  return (
    <div className="page narrow">
      <PageHeader title={s.title} />

      <SectionHeader title={s.account} />
      <div className="settings-group">
        <div className="setting"><span className="icon"><IoPersonOutline size={19} /></span><span className="setting-label">{s.name}</span><span className="value">{name}</span></div>
        <div className="setting"><span className="icon"><IoMailOutline size={19} /></span><span className="setting-label">{s.email}</span><span className="value">{email}</span></div>
        <button type="button" className="setting" onClick={signOut} style={{ width: "100%", background: "none", border: 0, borderTop: 0, padding: 0, cursor: "pointer", textAlign: "left" }}>
          <span className="icon"><IoLogOutOutline size={19} /></span><span className="setting-label" style={{ color: "var(--accent)" }}>{s.signOut}</span>
        </button>
      </div>

      <div id="phone">
        <SectionHeader title={s.phone} />
        <div className="settings-group">
          <div className="setting" style={{ alignItems: "flex-start", padding: "14px 0" }}>
            <span className="icon"><IoPhonePortraitOutline size={19} /></span>
            <span style={{ color: "var(--muted)", fontSize: 15.5 }}>{s.phoneSteps}</span>
          </div>
          <div className="setting">
            <span className="icon"><IoSyncOutline size={19} /></span>
            <span className="setting-label">{s.lastSync}</span>
            <span className="value">{syncedAt
              ? new Date(syncedAt).toLocaleString(intlLocale(), { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })
              : s.never}</span>
          </div>
        </div>
      </div>

      <div id="import">
        <SectionHeader title={s.import} />
        <Upload />
        <p className="settings-footer" style={{ marginTop: 0 }}>{s.importFooter}</p>
      </div>

      <SectionHeader title={s.danger} />
      <form onSubmit={(event) => { event.preventDefault(); void remove(new FormData(event.currentTarget)); }} className="settings-group" style={{ padding: "16px 20px" }}>
        <div className="field" style={{ marginBottom: 12 }}>
          <label htmlFor="password">{s.password}</label>
          <input id="password" name="password" type="password" autoComplete="current-password" required style={{ background: "var(--background)" }} />
        </div>
        <p className="form-message error" aria-live="polite">{message}</p>
        <button type="submit" className="button danger press" disabled={removing}>{s.remove}</button>
      </form>
      <p className="settings-footer">{s.dangerFooter}</p>
    </div>
  );
}
