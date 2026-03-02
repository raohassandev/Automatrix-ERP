import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getEffectivePermissionsForUser } from "@/lib/access-control";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await getEffectivePermissionsForUser(session.user.id);
  return NextResponse.json({
    role: result.roleName,
    permissions: Array.from(result.permissions).sort((a, b) => a.localeCompare(b)),
    deniedPermissions: Array.from(result.denied).sort((a, b) => a.localeCompare(b)),
  });
}
