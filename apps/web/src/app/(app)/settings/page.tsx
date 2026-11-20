import { Locale } from "@/components/Locale";
import { SettingsScreen } from "@/screens/SettingsScreen";
import { viewer } from "@/lib/server/viewer";

export default async function SettingsPage() {
  const me = await viewer();
  return (
    <Locale language={me.language} units={me.units}>
      <SettingsScreen
        name={me.name}
        email={me.email}
        syncedAt={me.syncedAt}
      />
    </Locale>
  );
}
