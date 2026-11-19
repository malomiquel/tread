import { Locale } from "@/components/Locale";
import { HistoryScreen } from "@/screens/HistoryScreen";
import { outingRows } from "@/lib/server/data";
import { viewer } from "@/lib/server/viewer";

export default async function HistoryPage() {
  const me = await viewer();
  return (
    <Locale language={me.language} units={me.units}>
      <HistoryScreen outings={await outingRows(me.userId)} />
    </Locale>
  );
}
