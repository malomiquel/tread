import { ResetForm } from "@/components/auth/ResetForm";

/** Better Auth sends people here with `?token=…`, or `?error=INVALID_TOKEN` when the link is spent. */
export default async function ResetPage({ searchParams }: { searchParams: Promise<{ token?: string; error?: string }> }) {
  const { token, error } = await searchParams;
  return <ResetForm token={token ?? null} invalid={Boolean(error)} />;
}
