"use client";

import * as React from "react";
import { usePathname, useSearchParams } from "next/navigation";

function isInternalAnchor(el: Element | null) {
  if (!el) return null;
  const a = el.closest("a");
  if (!a) return null;
  const href = a.getAttribute("href") || "";
  if (!href) return null;
  if (a.getAttribute("target") === "_blank") return null;
  if (a.getAttribute("download") !== null) return null;
  // Ignore hash-only navigation
  if (href.startsWith("#")) return null;
  // Internal routes are typically absolute-from-root in this app.
  if (href.startsWith("/")) return a;
  // Same-origin absolute URL
  try {
    const u = new URL(href, window.location.href);
    if (u.origin === window.location.origin) return a;
  } catch {
    // ignore
  }
  return null;
}

export function RouteLoadingIndicator() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [active, setActive] = React.useState(false);

  // Stop the indicator when the route actually changed.
  React.useEffect(() => {
    if (!active) return;
    const t = window.setTimeout(() => setActive(false), 250);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams]);

  // Start the indicator on internal link clicks (covers sidebar + row links without changing every Link).
  React.useEffect(() => {
    const onClick = (e: MouseEvent) => {
      // Only left-click without modifiers
      if (e.defaultPrevented) return;
      if (e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = isInternalAnchor(e.target as Element | null);
      if (!anchor) return;
      setActive(true);
      // Auto-stop safety in case navigation is prevented.
      window.setTimeout(() => setActive(false), 8000);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  if (!active) return null;

  return (
    <div
      data-testid="route-loading-indicator"
      className="pointer-events-none fixed left-0 right-0 top-0 z-50 h-1 bg-transparent"
    >
      <div className="h-full w-full animate-pulse bg-primary/80" />
    </div>
  );
}

