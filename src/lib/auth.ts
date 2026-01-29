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
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) {
        token.id = user.id;
        token.roleId = (user as { roleId?: string }).roleId || null;
        const roleId = (user as { roleId?: string }).roleId;
        const role = roleId
          ? await prisma.role.findUnique({
              where: { id: roleId },
              select: { name: true },
            })
          : null;
        token.role = role?.name || "Guest";
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
