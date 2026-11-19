import { redirect } from "next/navigation";
import { currentSession } from "@/lib/server/session";

/** The history when signed in, the sign-in page otherwise. */
export default async function Home() {
  redirect((await currentSession()) ? "/history" : "/sign-in");
}
