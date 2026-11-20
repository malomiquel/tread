import { notFound } from "next/navigation";
import { Locale } from "@/components/Locale";
import { RouteEditorScreen } from "@/screens/RouteEditorScreen";
import { routeForEdit } from "@/lib/server/routes";
import { recentRuns } from "@/lib/server/data";
import { viewer } from "@/lib/server/viewer";

export default async function EditRoutePage({ params }: { params: Promise<{ id: string }> }) {
  const me = await viewer();
  const route = await routeForEdit(me.userId, (await params).id);
  if (!route) notFound();
  const recent = await recentRuns(me.userId);
  return (
    <Locale language={me.language} units={me.units}>
      <RouteEditorScreen initial={route} recent={recent} />
    </Locale>
  );
}
