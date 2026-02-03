import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

const credentialsProvider = Credentials({
  name: "Credentials",
  credentials: {
    email: { label: "Email", type: "email" },
    password: { label: "Password", type: "password" },
  },
  authorize: async (credentials) => {
    const email = typeof credentials?.email === "string" ? credentials.email : "";
    const password = typeof credentials?.password === "string" ? credentials.password : "";
    if (!email || !password) return null;

    // Development bypass: hardcoded credentials
    // NOTE: If this user does not exist in the DB, pages that filter by `submittedById/addedById`
    // will show empty lists and dashboards will appear as 0. We auto-provision a real DB user
    // in development so created records correctly belong to this user.
    if (process.env.NODE_ENV === "development" && email === "admin@automatrix.local" && password === "admin123") {
      const devUserId = "dev-admin-id";

      // Ensure CEO role exists
      const ceoRole = await prisma.role.upsert({
        where: { name: "CEO" },
        update: {},
        create: { name: "CEO" },
      });

      // Ensure dev user exists
      await prisma.user.upsert({
        where: { id: devUserId },
        update: {
          email: "admin@automatrix.local",
          name: "Admin User",
          roleId: ceoRole.id,
        },
        create: {
          id: devUserId,
          email: "admin@automatrix.local",
          name: "Admin User",
          roleId: ceoRole.id,
          // passwordHash intentionally omitted for dev-bypass
        },
      });

      // Ensure employee exists for wallet/dashboard charts
      await prisma.employee.upsert({
        where: { email: "admin@automatrix.local" },
        update: { name: "Admin User", role: "CEO" },
        create: {
          email: "admin@automatrix.local",
          name: "Admin User",
          role: "CEO",
          walletBalance: 0,
        },
      });

      return {
        id: devUserId,
        email: "admin@automatrix.local",
        name: "Admin User",
        roleId: ceoRole.id,
        role: { name: "CEO" },
      };
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });
    if (!user?.passwordHash) return null;
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return null;
    return user;
  },
});

const authProviders = [];
if (googleClientId && googleClientSecret) {
  authProviders.push(
    Google({
      clientId: googleClientId,
      clientSecret: googleClientSecret,
    })
  );
}
authProviders.push(credentialsProvider);

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: authProviders,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  experimental: {
    enableWebAuthn: false,
  },
  skipCSRFCheck: process.env.NODE_ENV === "development",
  callbacks: {
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
      if (pathname.startsWith("/login")) return true;
      return !!auth?.user;
    },
  },
  events: {
    createUser: async ({ user }) => {
      const staffRole = await prisma.role.findUnique({
        where: { name: "Staff" },
      });
      if (staffRole && user.id) {
        await prisma.user.update({
          where: { id: user.id },
          data: { roleId: staffRole.id },
        });
      }

      const userEmail = user.email || "";
      const existingEmployee = await prisma.employee.findUnique({
        where: { email: userEmail },
      });
      if (!existingEmployee && userEmail) {
        await prisma.employee.create({
          data: {
            email: userEmail,
            name: user.name || userEmail.split("@")[0],
            role: "Staff",
          },
        });
      }
    },
  },
});
