import { cookies } from "next/headers";
import { Locale } from "@/components/Locale";
import { SettingsScreen } from "@/screens/SettingsScreen";
import { LANGUAGE_COOKIE } from "@/lib/language";
import { viewer } from "@/lib/server/viewer";

export default async function SettingsPage() {
  const me = await viewer();
  const chosen = (await cookies()).get(LANGUAGE_COOKIE)?.value;
  return (
    <Locale language={me.language} units={me.units}>
      <SettingsScreen
        name={me.name}
        email={me.email}
        syncedAt={me.syncedAt}
        language={chosen === "fr" || chosen === "en" ? chosen : "auto"}
      />
    </Locale>
  );
}
