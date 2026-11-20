import { notFound } from "next/navigation";
import { Locale } from "@/components/Locale";
import { RouteScreen } from "@/screens/RouteScreen";
import { recentRuns, routeById } from "@/lib/server/data";
import { viewer } from "@/lib/server/viewer";

export default async function RoutePage({ params }: { params: Promise<{ id: string }> }) {
  const me = await viewer();
  const route = await routeById(me.userId, (await params).id);
  if (!route) notFound();
  const recent = await recentRuns(me.userId);
  return (
    <Locale language={me.language} units={me.units}>
      <RouteScreen route={route} recent={recent} />
    </Locale>
  );
}
