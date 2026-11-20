import { Locale } from "@/components/Locale";
import { RouteEditorScreen } from "@/screens/RouteEditorScreen";
import { recentRuns } from "@/lib/server/data";
import { viewer } from "@/lib/server/viewer";

export default async function NewRoutePage() {
  const me = await viewer();
  const recent = await recentRuns(me.userId);
  return (
    <Locale language={me.language} units={me.units}>
      <RouteEditorScreen recent={recent} />
    </Locale>
  );
}
