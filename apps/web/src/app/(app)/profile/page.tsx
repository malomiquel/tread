import { Locale } from "@/components/Locale";
import { ProfileScreen } from "@/screens/ProfileScreen";
import { outingFigures, shoeRows } from "@/lib/server/data";
import { viewer } from "@/lib/server/viewer";

export default async function ProfilePage() {
  const me = await viewer();
  const [outings, shoes] = await Promise.all([outingFigures(me.userId), shoeRows(me.userId)]);
  return (
    <Locale language={me.language} units={me.units}>
      <ProfileScreen name={me.name} outings={outings} shoes={shoes} settings={me.settings} />
    </Locale>
  );
}
