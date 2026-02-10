import { NextResponse } from "next/server";

// Phase 1 policy (LOCKED): Google OAuth only (no credentials login).
// Password reset is not applicable in this phase.
export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error: "Password reset is disabled. This system uses Google OAuth only.",
    },
    { status: 410 }
  );
}

