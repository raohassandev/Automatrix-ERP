import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import type { Adapter, AdapterUser } from "next-auth/adapters";
import { assertE2eTestModeAllowed } from "@/lib/auth-e2e-guard";
import { assertCredentialsModeAllowed, isCredentialsModeAllowed } from "@/lib/auth-credentials-guard";
import bcrypt from "bcryptjs";

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
const e2eMode = process.env.E2E_TEST_MODE === "1";
const credentialsMode = isCredentialsModeAllowed(process.env as Record<string, string | undefined>);

// Fail-fast: prevent accidental enablement of E2E mode in staging/prod.
assertE2eTestModeAllowed(process.env as Record<string, string | undefined>);
assertCredentialsModeAllowed(process.env as Record<string, string | undefined>);

if ((!googleClientId || !googleClientSecret) && !e2eMode) {
  // Phase 1: Google OAuth is the only supported auth method in real environments.
  throw new Error(
    "Missing Google OAuth env vars: GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required."
  );
}

const authProviders = [];
if (googleClientId && googleClientSecret) {
  authProviders.push(
    Google({
      clientId: googleClientId,
      clientSecret: googleClientSecret,
      // We allow linking by email because:
      // - Google emails are verified
      // - we still enforce an allowlist (Employee table) server-side
      allowDangerousEmailAccountLinking: true,
    })
  );
}

if (credentialsMode) {
  authProviders.push(
    Credentials({
      id: "credentials",
      name: "Email Password",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const email =
          typeof credentials?.email === "string" ? credentials.email.trim().toLowerCase() : "";
        const password = typeof credentials?.password === "string" ? credentials.password : "";
        if (!email || !password) return null;

        const employee = await prisma.employee.findFirst({
          where: { email: { equals: email, mode: "insensitive" } },
          select: { status: true },
        });
        if (!employee || employee.status !== "ACTIVE") return null;

        const user = await prisma.user.findFirst({
          where: { email: { equals: email, mode: "insensitive" } },
          include: { role: { select: { name: true } } },
        });
        if (!user?.passwordHash) return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          roleId: user.roleId,
          role: user.role || undefined,
        };
      },
    })
  );
}

// E2E-only credentials provider so Playwright can authenticate without real Google OAuth.
// This must never be enabled in production.
if (e2eMode) {
  const roleByEmail: Record<string, string> = {
    "e2e-admin@automatrix.local": "CEO",
    "engineer1@automatrix.pk": "Engineering",
    "procurement1@automatrix.pk": "Procurement",
    "sales1@automatrix.pk": "Sales",
    "technician1@automatrix.pk": "Staff",
    "store1@automatrix.pk": "Store Keeper",
    "finance1@automatrix.pk": "Finance Manager",
  };

  authProviders.push(
    Credentials({
      id: "e2e",
      name: "E2E Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const email =
          typeof credentials?.email === "string" ? credentials.email.trim().toLowerCase() : "";
        const password = typeof credentials?.password === "string" ? credentials.password : "";
        const expected = process.env.E2E_TEST_PASSWORD || "";
        const bootstrap = process.env.E2E_BOOTSTRAP !== "0";
        const desiredRoleName = roleByEmail[email] || process.env.E2E_TEST_ROLE || "Admin";

        if (!expected || password !== expected || !email) return null;

        let employee = await prisma.employee.findFirst({
          where: { email: { equals: email, mode: "insensitive" } },
          select: { id: true, name: true, status: true },
        });

        if (!employee && bootstrap) {
          employee = await prisma.employee.upsert({
            where: { email },
            update: { status: "ACTIVE", role: desiredRoleName },
            create: {
              email,
              name: email.split("@")[0] || "E2E User",
              role: desiredRoleName,
              status: "ACTIVE",
            },
            select: { id: true, name: true, status: true },
          });
        }

        if (!employee || employee.status !== "ACTIVE") return null;

        const desiredRole = bootstrap
          ? await prisma.role.upsert({
              where: { name: desiredRoleName },
              update: {},
              create: { name: desiredRoleName },
              select: { id: true },
            })
          : await prisma.role.findUnique({
              where: { name: desiredRoleName },
              select: { id: true },
            });
        if (!desiredRole) return null;

        let user = await prisma.user.findFirst({
          where: { email: { equals: email, mode: "insensitive" } },
        });

        if (!user && bootstrap) {
          user = await prisma.user.upsert({
            where: { email },
            update: { roleId: desiredRole.id, passwordHash: null },
            create: {
              email,
              name: employee.name || null,
              roleId: desiredRole.id,
              passwordHash: null,
            },
          });
        } else if (!user) {
          return null;
        } else if (user.roleId !== desiredRole.id) {
          user = await prisma.user.update({
            where: { id: user.id },
            data: { roleId: desiredRole.id },
          });
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          roleId: user.roleId,
        };
      },
    })
  );
}

// Adapter wrapper to enforce allowlisted (admin-provisioned) sign-in.
// Phase 1 policy: a user can sign in only if there is an ACTIVE Employee record with the same email.
const baseAdapter = PrismaAdapter(prisma);
const adapter = {
  ...baseAdapter,
  getUserByEmail: async (email) => {
    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    if (!normalizedEmail) return null;
    return prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: "insensitive" } },
    });
  },
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
      // Credentials login is optional and explicitly env-gated (intended for staging/internal use).
      if (account?.provider !== "google") {
        if (account?.provider === "credentials") {
          return credentialsMode;
        }
        if (account?.provider === "e2e") {
          return e2eMode;
        }
        return false;
      }

      const email = typeof user?.email === "string" ? user.email.trim() : "";
      if (!email) return false;

      const employee = await prisma.employee.findFirst({
        where: { email: { equals: email, mode: "insensitive" } },
        select: { status: true },
      });

      const allowed = Boolean(employee && employee.status === "ACTIVE");
      try {
        await prisma.auditLog.create({
          data: {
            action: allowed ? "AUTH_SIGNIN_SUCCESS" : "AUTH_SIGNIN_DENIED",
            entity: "Auth",
            entityId: account?.provider || "google",
            reason: allowed ? null : "Email not allowlisted or employee inactive",
            userId: typeof user?.id === "string" ? user.id : null,
            newValue: JSON.stringify({ email: email.toLowerCase() }),
          },
        });
      } catch {
        // Sign-in flow should not fail due to audit write errors.
      }
      return allowed;
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
  events: {
    async signOut(message) {
      const userId =
        "token" in message && message.token && typeof message.token.id === "string"
          ? message.token.id
          : null;
      try {
        await prisma.auditLog.create({
          data: {
            action: "AUTH_SIGNOUT",
            entity: "Auth",
            entityId: "session",
            userId,
          },
        });
      } catch {
        // Best-effort audit only.
      }
    },
  },
});
