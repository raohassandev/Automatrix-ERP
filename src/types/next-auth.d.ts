import "next-auth";
import "next-auth/adapters";

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

declare module "next-auth/adapters" {
  interface AdapterUser {
    roleId?: string | null;
  }
}

declare module "@auth/core/adapters" {
  interface AdapterUser {
    roleId?: string | null;
  }
}
