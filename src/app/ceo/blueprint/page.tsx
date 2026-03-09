import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import CeoBlueprintBoard from "@/components/CeoBlueprintBoard";
import { requirePermission } from "@/lib/rbac";
import fs from "node:fs/promises";
import path from "node:path";

function extractMermaidBlocks(content: string) {
  const blocks: string[] = [];
  const regex = /```mermaid\s*([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    blocks.push(match[1].trim());
  }
  return blocks;
}

export default async function CeoBlueprintPage() {
  const session = await auth();
  if (!session?.user?.id) {
    return redirect("/login");
  }

  const canView = await requirePermission(session.user.id, "dashboard.view_all_metrics");
  if (!canView) {
    return (
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">ERP Blueprint</h1>
        <p className="mt-2 text-muted-foreground">You do not have access to this page.</p>
      </div>
    );
  }

  const docPath = path.join(process.cwd(), "docs", "ERP_DIAGRAMS.md");
  const content = await fs.readFile(docPath, "utf8");
  const diagrams = extractMermaidBlocks(content);

  return (
    <div className="grid gap-6">
      <div className="rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 via-card to-sky-500/10 p-6 shadow-sm md:p-8">
        <h1 className="text-2xl font-semibold">ERP Blueprint</h1>
        <p className="mt-2 text-muted-foreground">
          Executive map of module boundaries, truth sources, and cross-module posting flow.
        </p>
      </div>

      <CeoBlueprintBoard diagrams={diagrams} />
    </div>
  );
}
