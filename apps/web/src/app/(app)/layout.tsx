import { AppShell } from "@/components/AppShell";
import { Locale } from "@/components/Locale";
import { preferencesOf } from "@/lib/server/data";
import { phoneUnits, requestLanguage } from "@/lib/server/locale";
import { requireUser } from "@/lib/server/session";

/** Every page behind the account: signed in, in the runner's language and units. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const preferences = await preferencesOf(user.id);
  return (
    <Locale language={await requestLanguage()} units={phoneUnits(preferences.settings)}>
      <AppShell>{children}</AppShell>
    </Locale>
  );
}
