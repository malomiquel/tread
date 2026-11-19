import { Locale } from "@/components/Locale";
import { RoutesScreen } from "@/screens/RoutesScreen";
import { routeRows } from "@/lib/server/data";
import { viewer } from "@/lib/server/viewer";

export default async function RoutesPage() {
  const me = await viewer();
  return (
    <Locale language={me.language} units={me.units}>
      <RoutesScreen routes={await routeRows(me.userId)} />
    </Locale>
  );
}
