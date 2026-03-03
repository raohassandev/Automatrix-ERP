"use client";

import Link from "next/link";
import { AlertTriangle, Ban, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";

type StateType = "empty" | "forbidden" | "error";

const STATE_META: Record<StateType, { icon: typeof Inbox; title: string; tone: string }> = {
  empty: {
    icon: Inbox,
    title: "No data found",
    tone: "text-slate-500",
  },
  forbidden: {
    icon: Ban,
    title: "Access restricted",
    tone: "text-amber-600 dark:text-amber-400",
  },
  error: {
    icon: AlertTriangle,
    title: "Something went wrong",
    tone: "text-rose-600 dark:text-rose-400",
  },
};

export function PageState({
  type,
  message,
  primaryAction,
  secondaryAction,
}: {
  type: StateType;
  message: string;
  primaryAction?: { label: string; href: string };
  secondaryAction?: { label: string; href: string };
}) {
  const meta = STATE_META[type];
  const Icon = meta.icon;

  return (
    <div className="rounded-xl border bg-card p-8 text-center shadow-sm">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Icon className={`h-6 w-6 ${meta.tone}`} />
      </div>
      <h2 className="mt-4 text-xl font-semibold">{meta.title}</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">{message}</p>
      {primaryAction || secondaryAction ? (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {primaryAction ? (
            <Button asChild>
              <Link href={primaryAction.href}>{primaryAction.label}</Link>
            </Button>
          ) : null}
          {secondaryAction ? (
            <Button asChild variant="outline">
              <Link href={secondaryAction.href}>{secondaryAction.label}</Link>
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

