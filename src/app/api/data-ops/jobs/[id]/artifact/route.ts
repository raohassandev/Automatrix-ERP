import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { DATA_OPS_ACTIONS, DATA_OPS_ENTITY } from "@/lib/data-ops";

function safeJson(input: string | null | undefined): Record<string, unknown> {
  if (!input) return {};
  try {
    const parsed = JSON.parse(input);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const canView = await requirePermission(session.user.id, "audit.view");
  if (!canView) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const completed = await prisma.auditLog.findFirst({
    where: {
      entity: DATA_OPS_ENTITY,
      entityId: id,
      action: DATA_OPS_ACTIONS.COMPLETED,
    },
    orderBy: { createdAt: "desc" },
  });
  if (!completed) {
    return NextResponse.json({ success: false, error: "Completed job artifact not found" }, { status: 404 });
  }

  const payload = safeJson(completed.newValue);
  const result = (payload.result || {}) as Record<string, unknown>;
  const artifact = (result.artifact || {}) as Record<string, unknown>;

  const fileName = String(artifact.fileName || "").trim();
  const contentType = String(artifact.contentType || "").trim();
  const contentBase64 = String(artifact.contentBase64 || "").trim();
  if (!fileName || !contentType || !contentBase64) {
    return NextResponse.json({ success: false, error: "No downloadable artifact in this job result" }, { status: 404 });
  }

  const bytes = Buffer.from(contentBase64, "base64");
  return new NextResponse(bytes, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${fileName.replace(/"/g, "")}"`,
      "Content-Length": String(bytes.byteLength),
      "Cache-Control": "no-store",
    },
  });
}

