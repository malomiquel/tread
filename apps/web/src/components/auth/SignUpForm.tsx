"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useStrings } from "@tread/core/i18n";
import { Brand } from "@/components/Brand";
import { authClient } from "@/lib/auth-client";
import { authStrings, MIN_PASSWORD } from "./strings";

export function SignUpForm() {
  const s = useStrings(authStrings);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();

  async function submit(form: FormData) {
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    if (password.length < MIN_PASSWORD) {
      setMessage(s.tooShort);
      return;
    }
    setBusy(true);
    setMessage("");
    const { error } = await authClient.signUp.email({
      name: String(form.get("name") ?? "").trim(),
      email,
      password,
      callbackURL: `${window.location.origin}/history`,
    });
    setBusy(false);
    if (!error) {
      // Signed in as it is created: straight to the history.
      router.replace("/history");
      router.refresh();
    } else if (error.status === 429) setMessage(s.tooMany);
    else if (error.status === 422 || error.status === 400) setMessage(s.taken);
    else setMessage(s.failed);
  }

  return (
    <>
      <Brand />
      <h1>{s.signUpTitle}</h1>
      <p className="lede">{s.signUpLede}</p>
      <form onSubmit={(event) => { event.preventDefault(); void submit(new FormData(event.currentTarget)); }}>
        <div className="field">
          <label htmlFor="name">{s.name}</label>
          <input id="name" name="name" autoComplete="given-name" required />
        </div>
        <div className="field">
          <label htmlFor="email">{s.email}</label>
          <input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className="field">
          <label htmlFor="password">{s.password}</label>
          <input id="password" name="password" type="password" autoComplete="new-password" minLength={MIN_PASSWORD} maxLength={128} required />
          <span className="hint">{s.passwordHint}</span>
        </div>
        <p className="form-message error" aria-live="polite">{message}</p>
        <button className="button primary press" type="submit" disabled={busy}>{busy ? s.signingUp : s.signUp}</button>
      </form>
      <div className="auth-foot">
        <span>{s.haveAccount} <Link href="/sign-in">{s.signIn}</Link></span>
      </div>
    </>
  );
}
