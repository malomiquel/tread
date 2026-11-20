import { Locale } from "@/components/Locale";
import { CollectionScreen } from "@/screens/CollectionScreen";
import { cardOutings } from "@/lib/server/data";
import { viewer } from "@/lib/server/viewer";

export default async function CollectionPage() {
  const me = await viewer();
  return (
    <Locale language={me.language} units={me.units}>
      <CollectionScreen outings={await cardOutings(me.userId)} settings={me.settings} />
    </Locale>
  );
}
