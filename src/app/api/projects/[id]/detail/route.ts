import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getProjectDetailForUser } from "@/lib/project-detail-policy";

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const result = await getProjectDetailForUser({ userId: session.user.id, projectDbId: id });
  if (!result.ok) {
    return NextResponse.json({ success: false, error: result.error }, { status: result.status });
  }

  return NextResponse.json({ success: true, data: result.data });
}

