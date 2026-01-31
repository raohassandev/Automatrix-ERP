"use client";

import { useState, useTransition } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { isGoogleAuthConfigured } from "@/lib/env";

export default function LoginPage() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    name: "",
    email: "israrulhaq5@gmail.com",
    password: "Password",
  });
  const [message, setMessage] = useState<string | null>(null);

  async function handleEmailLogin() {
    setMessage(null);
    if (!form.email || !form.password) {
      setMessage("Email and password are required");
      return;
    }
    const res = await signIn("credentials", {
      email: form.email,
      password: form.password,
      redirect: false,
    });

    if (res?.error) {
      setMessage(res.error);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  async function handleGoogleLogin() {
    setMessage(null);
    if (!isGoogleAuthConfigured) {
      setMessage('Google authentication is not configured.');
      return;
    }
    await signIn("google", { callbackUrl: "/dashboard" });
  }

  async function handleRegister() {
    setMessage(null);
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name || undefined,
        email: form.email,
        password: form.password,
      }),
    });

    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      setMessage(payload?.error || "Unable to create account.");
      return;
    }

    const signInRes = await signIn("credentials", {
      email: form.email,
      password: form.password,
      redirect: false,
    });

    if (signInRes?.error) {
      setMessage(signInRes.error);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-md rounded-xl border bg-card p-8 shadow-sm">
      <h1 className="text-2xl font-semibold">Sign in</h1>
      <p className="mt-2 text-muted-foreground">Use Google or your email/password.</p>

      <div className="mt-6 grid gap-3">
        {isGoogleAuthConfigured ? (
          <button 
            type="button"
            className="inline-flex items-center justify-center rounded-md bg-black px-4 py-2 text-white hover:bg-gray-800"
            onClick={() => startTransition(handleGoogleLogin)}
            disabled={pending}
          >
            {pending ? "Working..." : "Sign in with Google"}
          </button>
        ) : (
          <p className="text-sm text-muted-foreground">Google auth is disabled in this environment.</p>
        )}

        <div className="border-t pt-4">
          <div className="grid gap-2">
            <input
              className="rounded-md border px-3 py-2"
              placeholder="Name (for new account)"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <input
              className="rounded-md border px-3 py-2"
              placeholder="Email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <input
              className="rounded-md border px-3 py-2"
              placeholder="Password (min 8 chars)"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>

          {message ? <p className="mt-3 text-sm text-red-600">{message}</p> : null}

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-md bg-black px-4 py-2 text-white hover:bg-gray-800"
              disabled={pending}
              onClick={() => startTransition(handleEmailLogin)}
            >
              {pending ? "Working..." : "Sign in"}
            </button>
            <button
              type="button"
              className="rounded-md border px-4 py-2 hover:bg-accent"
              disabled={pending}
              onClick={() => startTransition(handleRegister)}
            >
              {pending ? "Working..." : "Create account"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
