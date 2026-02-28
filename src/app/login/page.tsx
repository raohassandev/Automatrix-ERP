import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { LoginClient } from "./LoginClient";

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

  return <LoginClient error={error} />;
}
