import { Locale } from "@/components/Locale";
import { PlanScreen } from "@/screens/PlanScreen";
import { planOf } from "@/lib/server/data";
import { viewer } from "@/lib/server/viewer";

export default async function PlanPage() {
  const me = await viewer();
  return (
    <Locale language={me.language} units={me.units}>
      <PlanScreen plan={await planOf(me.userId)} />
    </Locale>
  );
}
