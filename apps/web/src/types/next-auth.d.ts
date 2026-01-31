import "next-auth";

declare module "next-auth" {
  interface User {
    id: string;
    roleId?: string | null;
    role?: { name: string } | null;
  }

  interface Session {
    user: User & {
      id: string;
      roleId?: string | null;
      role?: { name: string } | null;
    };
  }
}
