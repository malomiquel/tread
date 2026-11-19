import { Locale } from "@/components/Locale";
import { requestLanguage } from "@/lib/server/locale";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <Locale language={await requestLanguage()} units="metric">
      <main className="auth">
        <div className="auth-card">{children}</div>
      </main>
    </Locale>
  );
}
