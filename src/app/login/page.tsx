import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { LoginClient } from "./LoginClient";

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: { error?: string };
}) {
  const session = await auth();
  if (session?.user?.id) {
    return redirect("/dashboard");
  }

  const error = typeof searchParams?.error === "string" ? searchParams.error : null;

  return <LoginClient error={error} />;
}

