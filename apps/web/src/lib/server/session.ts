import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth, type Session } from "./auth";

/** The signed-in person, read once per request. */
export const currentSession = cache(async (): Promise<Session | null> =>
  auth.api.getSession({ headers: await headers() }));

/** The signed-in person, or a trip to the sign-in page. */
export async function requireUser(): Promise<Session["user"]> {
  const session = await currentSession();
  if (!session) redirect("/sign-in");
  return session.user;
}
