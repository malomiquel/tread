import "server-only";
import { defineStrings, type Language } from "@tread/core/i18n";

/**
 * The two e-mails an account needs: confirm the address, reset the password.
 *
 * Sent through Resend's HTTP API, so no SDK and no SMTP. Without a key the
 * link is printed in the server's log instead (development) or not sent at
 * all (production, with a warning). Sign-up sends nothing for now.
 */
const mail = defineStrings({
  fr: {
    verifySubject: "Confirme ton adresse",
    verifyBody: (url: string) =>
      `Bienvenue sur Tread.\n\nConfirme ton adresse pour retrouver tes sorties sur le web :\n${url}\n\nSi tu n'as pas créé de compte, ignore ce message.`,
    resetSubject: "Choisis un nouveau mot de passe",
    resetBody: (url: string) =>
      `Quelqu'un a demandé à changer le mot de passe de ton compte Tread.\n\nPour en choisir un nouveau (le lien vaut une heure) :\n${url}\n\nSi ce n'est pas toi, ignore ce message : rien ne change.`,
  },
  en: {
    verifySubject: "Confirm your address",
    verifyBody: (url: string) =>
      `Welcome to Tread.\n\nConfirm your address to see your outings on the web:\n${url}\n\nIf you did not create an account, ignore this message.`,
    resetSubject: "Choose a new password",
    resetBody: (url: string) =>
      `Someone asked to change the password of your Tread account.\n\nTo choose a new one (the link lasts an hour):\n${url}\n\nIf it was not you, ignore this message: nothing changes.`,
  },
});

/** French when the request leads with it, English otherwise. */
export function requestLanguage(request: Request | undefined): Language {
  const cookie = request?.headers.get("cookie") ?? "";
  const chosen = /(?:^|;\s*)tread-language=(fr|en)/.exec(cookie)?.[1];
  if (chosen === "fr" || chosen === "en") return chosen;
  const first = (request?.headers.get("accept-language") ?? "").split(",")[0]?.trim().toLowerCase() ?? "";
  return first.startsWith("fr") ? "fr" : "en";
}

async function send(to: string, subject: string, text: string): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    if (process.env.NODE_ENV === "production") console.warn(`[mail] RESEND_API_KEY is not set: "${subject}" was not sent`);
    else console.info(`[mail] to ${to}: ${subject}\n${text}`);
    return;
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM ?? "Tread <onboarding@resend.dev>", to, subject, text }),
  });
  if (!response.ok) throw new Error(`Resend answered ${response.status}`);
}

export async function sendVerification(to: string, url: string, language: Language): Promise<void> {
  const words = mail(language);
  await send(to, words.verifySubject, words.verifyBody(url));
}

export async function sendPasswordReset(to: string, url: string, language: Language): Promise<void> {
  const words = mail(language);
  await send(to, words.resetSubject, words.resetBody(url));
}
