"use client";

import { useState, useTransition } from "react";
import { signIn } from "next-auth/react";

export function LoginClient({
  error,
  credentialsEnabled,
}: {
  error: string | null;
  credentialsEnabled: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const e2eEnabled = process.env.NEXT_PUBLIC_E2E_TEST_MODE === "1";
  const [e2eEmail, setE2eEmail] = useState("");
  const [e2ePassword, setE2ePassword] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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

  async function handleE2ELogin() {
    await signIn("e2e", {
      email: e2eEmail,
      password: e2ePassword,
      callbackUrl: "/dashboard",
    });
  }

  async function handleCredentialsLogin() {
    await signIn("credentials", {
      email,
      password,
      callbackUrl: "/dashboard",
    });
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

        {credentialsEnabled ? (
          <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
            <div className="font-medium text-foreground">Email login (staging/internal)</div>
            <div className="mt-2 grid gap-2">
              <input
                className="rounded-md border px-3 py-2"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <input
                className="rounded-md border px-3 py-2"
                placeholder="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-md border px-4 py-2"
                onClick={() => startTransition(handleCredentialsLogin)}
                disabled={pending || !email || !password}
              >
                {pending ? "Working..." : "Sign in with Email"}
              </button>
            </div>
          </div>
        ) : null}

        {e2eEnabled ? (
          <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
            <div className="font-medium text-foreground">E2E login (local only)</div>
            <div className="mt-2 grid gap-2">
              <input
                className="rounded-md border px-3 py-2"
                placeholder="Email"
                value={e2eEmail}
                onChange={(e) => setE2eEmail(e.target.value)}
              />
              <input
                className="rounded-md border px-3 py-2"
                placeholder="Password"
                type="password"
                value={e2ePassword}
                onChange={(e) => setE2ePassword(e.target.value)}
              />
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-md border px-4 py-2"
                onClick={() => startTransition(handleE2ELogin)}
                disabled={pending || !e2eEmail || !e2ePassword}
              >
                {pending ? "Working..." : "E2E Sign in"}
              </button>
            </div>
          </div>
        ) : null}

        {message ? <p className="text-sm text-red-600">{message}</p> : null}
      </div>
    </div>
  );
}
