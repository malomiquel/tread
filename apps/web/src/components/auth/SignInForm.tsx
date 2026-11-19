"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useStrings } from "@tread/core/i18n";
import { Brand } from "@/components/Brand";
import { authClient } from "@/lib/auth-client";
import { authStrings } from "./strings";

export function SignInForm() {
  const s = useStrings(authStrings);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(form: FormData) {
    setBusy(true);
    setMessage("");
    const { error } = await authClient.signIn.email({
      email: String(form.get("email") ?? "").trim(),
      password: String(form.get("password") ?? ""),
      callbackURL: `${window.location.origin}/history`,
    });
    setBusy(false);
    if (!error) {
      router.replace("/history");
      router.refresh();
      return;
    }
    // One sentence for a wrong address and a wrong password alike, so the
    // page never says which accounts exist.
    if (error.status === 403) setMessage(s.unverified);
    else if (error.status === 429) setMessage(s.tooMany);
    else if (error.status === 401 || error.status === 400) setMessage(s.wrong);
    else setMessage(s.failed);
  }

  return (
    <>
      <Brand />
      <h1>{s.signInTitle}</h1>
      <p className="lede">{s.signInLede}</p>
      <form onSubmit={(event) => { event.preventDefault(); void submit(new FormData(event.currentTarget)); }}>
        <div className="field">
          <label htmlFor="email">{s.email}</label>
          <input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className="field">
          <label htmlFor="password">{s.password}</label>
          <input id="password" name="password" type="password" autoComplete="current-password" required />
        </div>
        <p className="form-message error" aria-live="polite">{message}</p>
        <button className="button primary press" type="submit" disabled={busy}>{busy ? s.signingIn : s.signIn}</button>
      </form>
      <div className="auth-foot">
        <span>{s.noAccount} <Link href="/sign-up">{s.createOne}</Link></span>
        <Link href="/forgot-password">{s.forgot}</Link>
      </div>
    </>
  );
}
