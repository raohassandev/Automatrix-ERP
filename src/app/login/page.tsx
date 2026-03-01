import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { LoginClient } from "./LoginClient";
import { isCredentialsModeAllowed } from "@/lib/auth-credentials-guard";

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (session?.user?.id) {
    return redirect("/dashboard");
  }

  const params = (await searchParams) ?? {};
  const error = typeof params.error === "string" ? params.error : null;
  const credentialsEnabled = isCredentialsModeAllowed(process.env as Record<string, string | undefined>);

  return <LoginClient error={error} credentialsEnabled={credentialsEnabled} />;
}
