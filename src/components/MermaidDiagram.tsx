"use client";

import { useEffect, useId, useState } from "react";
import mermaid from "mermaid";

export function MermaidDiagram({ code }: { code: string }) {
  const id = useId().replace(/:/g, "");
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const readDark = () => setIsDark(root.classList.contains("dark"));
    readDark();
    const observer = new MutationObserver(readDark);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    mermaid.initialize({ startOnLoad: false, theme: isDark ? "dark" : "default" });
    mermaid
      .render(`mermaid-${id}`, code)
      .then(({ svg }) => {
        if (!cancelled) setSvg(svg);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to render diagram.");
      });
    return () => {
      cancelled = true;
    };
  }, [code, id, isDark]);

  if (error) {
    return <pre className="text-sm text-destructive">{error}</pre>;
  }

  return <div className="mermaid [&_svg]:h-auto [&_svg]:max-w-none" dangerouslySetInnerHTML={{ __html: svg }} />;
}
