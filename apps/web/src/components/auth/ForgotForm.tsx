"use client";

import { useState } from "react";
import Link from "next/link";
import { useStrings } from "@tread/core/i18n";
import { Brand } from "@/components/Brand";
import { authClient } from "@/lib/auth-client";
import { authStrings } from "./strings";

export function ForgotForm() {
  const s = useStrings(authStrings);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean }>({ text: "", error: false });

  async function submit(form: FormData) {
    setBusy(true);
    const { error } = await authClient.requestPasswordReset({
      email: String(form.get("email") ?? "").trim(),
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    // The same sentence whether the address is known or not.
    if (!error) setMessage({ text: s.sent, error: false });
    else setMessage({ text: error.status === 429 ? s.tooMany : s.failed, error: true });
  }

  return (
    <>
      <Brand />
      <h1>{s.forgotTitle}</h1>
      <p className="lede">{s.forgotLede}</p>
      <form onSubmit={(event) => { event.preventDefault(); void submit(new FormData(event.currentTarget)); }}>
        <div className="field">
          <label htmlFor="email">{s.email}</label>
          <input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <p className={`form-message${message.error ? " error" : ""}`} aria-live="polite">{message.text}</p>
        <button className="button primary press" type="submit" disabled={busy}>{busy ? s.sending : s.send}</button>
      </form>
      <div className="auth-foot"><Link href="/sign-in">{s.backToSignIn}</Link></div>
    </>
  );
}
