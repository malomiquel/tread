import { Locale } from "@/components/Locale";
import { RouteEditorScreen } from "@/screens/RouteEditorScreen";
import { viewer } from "@/lib/server/viewer";

export default async function NewRoutePage() {
  const me = await viewer();
  return (
    <Locale language={me.language} units={me.units}>
      <RouteEditorScreen />
    </Locale>
  );
}
