import { SignInForm } from "@/components/auth/SignInForm";
import { signedOutOnly } from "../guard";

export default async function SignInPage() {
  await signedOutOnly();
  return <SignInForm />;
}
