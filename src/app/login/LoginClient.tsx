"use client";

import { useTransition } from "react";
import { signIn } from "next-auth/react";

export function LoginClient({ error }: { error: string | null }) {
  const [pending, startTransition] = useTransition();
  const message = (() => {
    if (!error) return null;
    switch (error) {
      case "AccessDenied":
        return "Access denied. Your email is not allowlisted. Contact admin.";
      case "OAuthAccountNotLinked":
        return "This email is already registered with a different sign-in method. Contact admin to link access.";
      case "Configuration":
        return "Auth is misconfigured. Contact admin.";
      default:
        return `Sign-in error: ${error}`;
    }
  })();

  async function handleGoogleLogin() {
    await signIn("google", { callbackUrl: "/dashboard" });
  }

  return (
    <div className="mx-auto max-w-md rounded-xl border bg-card p-8 shadow-sm">
      <h1 className="text-2xl font-semibold">Sign in</h1>
      <p className="mt-2 text-muted-foreground">Sign in with your company Google account.</p>

      <div className="mt-6 grid gap-3">
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-md bg-black px-4 py-2 text-white hover:bg-gray-800"
          onClick={() => startTransition(handleGoogleLogin)}
          disabled={pending}
        >
          {pending ? "Working..." : "Sign in with Google"}
        </button>

        {message ? <p className="text-sm text-red-600">{message}</p> : null}
      </div>
    </div>
  );
}
