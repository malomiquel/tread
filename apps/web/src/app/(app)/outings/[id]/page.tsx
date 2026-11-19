import { notFound } from "next/navigation";
import { Locale } from "@/components/Locale";
import { OutingScreen } from "@/screens/OutingScreen";
import { outingDetail } from "@/lib/server/data";
import { viewer } from "@/lib/server/viewer";

export default async function OutingPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await viewer();
  const outing = await outingDetail(me.userId, (await params).id);
  if (!outing) notFound();
  return (
    <Locale language={me.language} units={me.units}>
      <OutingScreen outing={outing} />
    </Locale>
  );
}
