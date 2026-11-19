"use client";

import { useState } from "react";
import Link from "next/link";
import { useStrings } from "@tread/core/i18n";
import { Brand } from "@/components/Brand";
import { authClient } from "@/lib/auth-client";
import { authStrings, MIN_PASSWORD } from "./strings";

export function ResetForm({ token, invalid }: { token: string | null; invalid: boolean }) {
  const s = useStrings(authStrings);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [message, setMessage] = useState(invalid || !token ? s.resetBadLink : "");

  async function submit(form: FormData) {
    const newPassword = String(form.get("password") ?? "");
    if (newPassword.length < MIN_PASSWORD) {
      setMessage(s.tooShort);
      return;
    }
    if (!token) return;
    setBusy(true);
    const { error } = await authClient.resetPassword({ newPassword, token });
    setBusy(false);
    if (!error) setDone(true);
    else setMessage(error.status === 429 ? s.tooMany : s.resetBadLink);
  }

  return (
    <>
      <Brand />
      <h1>{s.resetTitle}</h1>
      <p className="lede">{done ? s.resetDone : s.resetLede}</p>
      {done ? (
        <Link href="/sign-in" className="button primary press">{s.signIn}</Link>
      ) : (
        <form onSubmit={(event) => { event.preventDefault(); void submit(new FormData(event.currentTarget)); }}>
          <div className="field">
            <label htmlFor="password">{s.newPassword}</label>
            <input id="password" name="password" type="password" autoComplete="new-password" minLength={MIN_PASSWORD} maxLength={128} required disabled={!token || invalid} />
            <span className="hint">{s.passwordHint}</span>
          </div>
          <p className="form-message error" aria-live="polite">{message}</p>
          <button className="button primary press" type="submit" disabled={busy || !token || invalid}>{s.reset}</button>
        </form>
      )}
      {done ? null : <div className="auth-foot"><Link href={invalid ? "/forgot-password" : "/sign-in"}>{invalid ? s.forgot : s.backToSignIn}</Link></div>}
    </>
  );
}
