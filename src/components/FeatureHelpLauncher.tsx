"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { BookOpen, CircleHelp, Link2, ListChecks, Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { resolveFeatureHelp } from "@/lib/feature-help";

type FeatureHelpLauncherProps = {
  compact?: boolean;
  className?: string;
};

const HIDDEN_PATH_PREFIXES = ["/login", "/forbidden", "/api"];

export function FeatureHelpLauncher({ compact = false, className }: FeatureHelpLauncherProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const hidden = useMemo(() => {
    const currentPath = String(pathname || "/");
    return HIDDEN_PATH_PREFIXES.some((prefix) => currentPath.startsWith(prefix));
  }, [pathname]);

  const help = useMemo(() => resolveFeatureHelp(String(pathname || "/")), [pathname]);

  if (hidden) return null;

  return (
    <>
      <Button
        type="button"
        variant={compact ? "outline" : "secondary"}
        size={compact ? "icon-sm" : "sm"}
        onClick={() => setOpen(true)}
        className={cn(
          compact ? "border-primary/35 bg-card text-primary hover:bg-primary/10" : "gap-2",
          className,
        )}
        title="How this feature works"
      >
        <CircleHelp className="h-4 w-4" />
        {!compact ? <span>How this works</span> : null}
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side={compact ? "bottom" : "right"}
          className="w-full overflow-y-auto border-l border-border sm:max-w-2xl"
        >
          <SheetHeader className="pr-8">
            <SheetTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              {help.title}
            </SheetTitle>
            <SheetDescription>{help.summary}</SheetDescription>
          </SheetHeader>

          <div className="mt-5 space-y-5 text-sm">
            <section className="rounded-lg border border-primary/25 bg-primary/5 p-4">
              <div className="mb-2 flex items-center gap-2 font-semibold">
                <ListChecks className="h-4 w-4 text-primary" />
                Procedure
              </div>
              <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
                {help.procedure.map((step, index) => (
                  <li key={`${help.id}-step-${index}`}>{step}</li>
                ))}
              </ol>
            </section>

            <section className="rounded-lg border border-sky-300/35 bg-sky-500/10 p-4 dark:border-sky-900/60 dark:bg-sky-950/25">
              <div className="mb-2 flex items-center gap-2 font-semibold">
                <Workflow className="h-4 w-4 text-sky-700 dark:text-sky-300" />
                Controls and Guardrails
              </div>
              <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                {help.controls.map((line, index) => (
                  <li key={`${help.id}-control-${index}`}>{line}</li>
                ))}
              </ul>
            </section>

            <section className="rounded-lg border border-amber-300/35 bg-amber-500/10 p-4 dark:border-amber-900/60 dark:bg-amber-950/25">
              <div className="mb-2 font-semibold text-amber-900 dark:text-amber-200">
                Cross-module Financial Effects
              </div>
              <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                {help.impacts.map((line, index) => (
                  <li key={`${help.id}-impact-${index}`}>{line}</li>
                ))}
              </ul>
            </section>

            <section className="rounded-lg border border-border bg-card p-4">
              <div className="mb-2 flex items-center gap-2 font-semibold">
                <Link2 className="h-4 w-4 text-primary" />
                Related Pages
              </div>
              <div className="flex flex-wrap gap-2">
                {help.links.map((link) => (
                  <Link
                    key={`${help.id}-${link.href}`}
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
                  >
                    {link.label}
                  </Link>
                ))}
                <Link
                  href={`/help#feature-${help.id}`}
                  onClick={() => setOpen(false)}
                  className="rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/15"
                >
                  Open Full Procedure
                </Link>
              </div>
            </section>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

