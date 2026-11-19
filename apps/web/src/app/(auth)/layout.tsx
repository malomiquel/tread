import { Locale } from "@/components/Locale";
import { requestLanguage, requestUnits } from "@/lib/server/locale";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <Locale language={await requestLanguage()} units={await requestUnits(undefined)}>
      <main className="auth">
        <div className="auth-card">{children}</div>
      </main>
    </Locale>
  );
}
