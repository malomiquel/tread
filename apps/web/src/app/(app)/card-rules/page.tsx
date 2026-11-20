import { Locale } from "@/components/Locale";
import { CardRulesScreen } from "@/screens/CardRulesScreen";
import { viewer } from "@/lib/server/viewer";

export default async function CardRulesPage() {
  const me = await viewer();
  return (
    <Locale language={me.language} units={me.units}>
      <CardRulesScreen />
    </Locale>
  );
}
