import { redirect } from "next/navigation";
import { currentSession } from "@/lib/server/session";

/** The account pages are for the signed-out: anyone signed in goes to their history. */
export async function signedOutOnly(): Promise<void> {
  if (await currentSession()) redirect("/history");
}
