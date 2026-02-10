import { NextResponse } from "next/server";

// Phase 1 policy (LOCKED): Google OAuth only, no public signup.
// Users must be provisioned by an admin (Employee record + access/role assignment).
export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error: "Registration is disabled. Sign in with Google and contact an admin for access.",
    },
    { status: 410 }
  );
}

