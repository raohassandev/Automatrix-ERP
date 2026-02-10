import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import type { Adapter, AdapterUser } from "next-auth/adapters";

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

if (!googleClientId || !googleClientSecret) {
  // Phase 1: Google OAuth is the only supported auth method.
  throw new Error("Missing Google OAuth env vars: GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required.");
}

const authProviders = [
  Google({
    clientId: googleClientId,
    clientSecret: googleClientSecret,
    // We allow linking by email because:
    // - Google emails are verified
    // - we still enforce an allowlist (Employee table) server-side
    allowDangerousEmailAccountLinking: true,
  }),
];

// Adapter wrapper to enforce allowlisted (admin-provisioned) sign-in.
// Phase 1 policy: a user can sign in only if there is an ACTIVE Employee record with the same email.
const baseAdapter = PrismaAdapter(prisma);
const adapter = {
  ...baseAdapter,
  createUser: async (data: AdapterUser) => {
    const rawEmail = typeof data?.email === "string" ? data.email.trim() : "";
    if (!rawEmail) {
      throw new Error("User email is required.");
    }
    const email = rawEmail.toLowerCase();

    const employee = await prisma.employee.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { status: true },
    });

    if (!employee || employee.status !== "ACTIVE") {
      throw new Error("Access denied. This email is not allowlisted.");
    }

    const staffRole = await prisma.role.findUnique({
      where: { name: "Staff" },
      select: { id: true },
    });

    if (!baseAdapter.createUser) {
      throw new Error("Auth adapter misconfigured: createUser is not implemented.");
    }

    const toCreate = {
      ...data,
      email,
      // Custom field on our User model (not part of Auth.js types).
      roleId: staffRole?.id ?? undefined,
    } as AdapterUser;

    return await baseAdapter.createUser(toCreate);
  },
} satisfies Adapter;

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter,
  providers: authProviders,
  secret:
    process.env.AUTH_SECRET ??
    process.env.NEXTAUTH_SECRET ??
    (process.env.NODE_ENV === "development" ? "dev-secret-change-me" : undefined),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  experimental: {
    enableWebAuthn: false,
  },
  callbacks: {
    signIn: async ({ user, account }) => {
      // Phase 1: Google OAuth only.
      if (account?.provider !== "google") return false;

      const email = typeof user?.email === "string" ? user.email.trim() : "";
      if (!email) return false;

      const employee = await prisma.employee.findFirst({
        where: { email: { equals: email, mode: "insensitive" } },
        select: { status: true },
      });

      return Boolean(employee && employee.status === "ACTIVE");
    },
    jwt: async ({ token, user }) => {
      if (user) {
        token.id = user.id;
        token.roleId = user.roleId || null;
        
        // Check if role is already populated (from dev bypass or includes)
        if (user.role && typeof user.role === 'object' && 'name' in user.role) {
          token.role = user.role.name;
        } else {
          const roleId = user.roleId;
          const role = roleId
            ? await prisma.role.findUnique({
                where: { id: roleId },
                select: { name: true },
              })
            : null;
          token.role = role?.name || "Guest";
        }
      }
      return token;
    },
    session: async ({ session, token }) => {
      if (session.user) {
        session.user.id = token.id as string;
        (session.user as { roleId?: string | null }).roleId = token.roleId as string | null;
        (session.user as { role?: string }).role = token.role as string;
      }
      return session;
    },
    authorized: ({ auth, request }) => {
      const { pathname } = request.nextUrl;
      if (pathname.startsWith("/api/auth")) return true;
      if (pathname === "/api/health") return true;
      if (pathname.startsWith("/login")) return true;
      return !!auth?.user;
    },
  },
});
