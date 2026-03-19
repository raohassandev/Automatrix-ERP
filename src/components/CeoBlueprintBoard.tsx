"use client";

import { useMemo, useState } from "react";
import { MermaidDiagram } from "@/components/MermaidDiagram";
import { Button } from "@/components/ui/button";

type Props = {
  diagrams: string[];
};

const DIAGRAM_META = [
  {
    title: "Phase 1 Module Mindmap",
    subtitle: "Single-spine operating model and legacy boundaries.",
  },
  {
    title: "Document Spine Flow",
    subtitle: "Truth sources and posting flow across procurement, inventory, AP, and controls.",
  },
];

export default function CeoBlueprintBoard({ diagrams }: Props) {
  const [active, setActive] = useState(0);
  const [zoom, setZoom] = useState(0.9);

  const current = diagrams[active] || "";
  const title = DIAGRAM_META[active]?.title || `Diagram ${active + 1}`;
  const subtitle = DIAGRAM_META[active]?.subtitle || "ERP diagram";
  const zoomPercent = Math.round(zoom * 100);
  const canZoomOut = zoom > 0.6;
  const canZoomIn = zoom < 1.4;
  const stats = useMemo(
    () => ({
      diagrams: diagrams.length,
      scope: "Procurement + Inventory + AP + Controls",
      mode: "Phase 1 truth-source model",
    }),
    [diagrams.length],
  );

  if (!diagrams.length) {
    return (
      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <p className="text-muted-foreground">No diagrams found.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-lg border border-sky-500/30 bg-card/95 p-4 ring-1 ring-sky-500/10">
          <div className="text-xs text-sky-700 dark:text-sky-300">Diagram Pack</div>
          <div className="mt-1 text-sm font-semibold text-sky-900 dark:text-sky-100">{stats.diagrams} diagrams</div>
        </div>
        <div className="rounded-lg border border-violet-500/30 bg-card/95 p-4 ring-1 ring-violet-500/10">
          <div className="text-xs text-violet-700 dark:text-violet-300">Scope</div>
          <div className="mt-1 text-sm font-semibold text-violet-900 dark:text-violet-100">{stats.scope}</div>
        </div>
        <div className="rounded-lg border border-emerald-500/30 bg-card/95 p-4 ring-1 ring-emerald-500/10">
          <div className="text-xs text-emerald-700 dark:text-emerald-300">Model</div>
          <div className="mt-1 text-sm font-semibold text-emerald-900 dark:text-emerald-100">{stats.mode}</div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          {diagrams.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setActive(idx)}
              className={`rounded-md border px-3 py-2 text-sm ${
                idx === active
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-background text-foreground hover:bg-accent"
              }`}
            >
              {DIAGRAM_META[idx]?.title || `Diagram ${idx + 1}`}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => canZoomOut && setZoom((v) => Math.max(0.6, v - 0.1))} disabled={!canZoomOut}>
              Zoom -
            </Button>
            <span className="min-w-14 text-center text-xs text-muted-foreground">{zoomPercent}%</span>
            <Button variant="outline" size="sm" onClick={() => canZoomIn && setZoom((v) => Math.min(1.4, v + 0.1))} disabled={!canZoomIn}>
              Zoom +
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setZoom(0.9)}>
              Reset
            </Button>
          </div>
        </div>

        <div className="mt-4 overflow-auto rounded-lg border border-border/60 bg-background p-3">
          <div style={{ transform: `scale(${zoom})`, transformOrigin: "top left", width: `${100 / zoom}%` }}>
            <MermaidDiagram code={current} />
          </div>
        </div>
      </div>
    </div>
  );
}
