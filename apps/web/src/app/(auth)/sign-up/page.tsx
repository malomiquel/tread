import { SignUpForm } from "@/components/auth/SignUpForm";
import { signedOutOnly } from "../guard";

export default async function SignUpPage() {
  await signedOutOnly();
  return <SignUpForm />;
}
