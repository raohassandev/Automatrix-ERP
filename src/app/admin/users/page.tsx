import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { UserManagementInterface } from "@/components/UserManagementInterface";

export default async function UserManagementPage() {
  const session = await auth();
  if (!session?.user?.id) {
    return redirect("/login");
  }

  // Only CEOs and Owners can manage users
  const canManageUsers = await requirePermission(session.user.id, "employees.view_all");
  if (!canManageUsers) {
    return (
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">User Management</h1>
        <p className="mt-2 text-muted-foreground">You do not have permission to manage users.</p>
      </div>
    );
  }

  let users = [];
  let roles = [];
  
  try {
    [users, roles] = await Promise.all([
      prisma.user.findMany({
        include: { role: true },
        orderBy: { createdAt: "desc" }
      }),
      prisma.role.findMany({ orderBy: { name: "asc" } })
    ]);
  } catch (error) {
    console.error("Error fetching users and roles:", error);
    return (
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">User Management</h1>
        <p className="mt-2 text-muted-foreground">Error loading user data. Please try again later.</p>
      </div>
    );
  }

  const getRoleBadgeVariant = (roleName: string) => {
    switch (roleName) {
      case 'CEO':
      case 'Owner':
        return 'default';
      case 'CFO':
      case 'Finance Manager':
        return 'secondary';
      case 'Manager':
        return 'outline';
      case 'Staff':
        return 'outline';
      case 'Guest':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">User Management</h1>
        <p className="mt-2 text-muted-foreground">
          Manage user roles and permissions across the system
        </p>
        
        {/* User Statistics */}
        <div className="grid gap-4 md:grid-cols-5 mt-6">
          {roles.map((role) => {
            const userCount = users.filter(u => u.role?.name === role.name).length;
            return (
              <div key={role.id} className="bg-muted/50 rounded-lg p-4">
                <div className="text-sm text-muted-foreground">{role.name}</div>
                <div className="text-xl font-semibold">{userCount} users</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* User Management Interface */}
      <UserManagementInterface 
        users={users.map(u => ({
          id: u.id,
          email: u.email,
          name: u.name || 'Unknown',
          roleName: u.role?.name || 'No Role',
          createdAt: u.createdAt.toISOString()
        }))}
        roles={roles.map(r => ({
          id: r.id,
          name: r.name
        }))}
      />

      {/* Users Table */}
      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">All Users</h2>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2">User</th>
                <th className="py-2">Email</th>
                <th className="py-2">Current Role</th>
                <th className="py-2">Joined</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b">
                  <td className="py-2 font-medium">{user.name || 'Unknown'}</td>
                  <td className="py-2">{user.email}</td>
                  <td className="py-2">
                    <Badge variant={getRoleBadgeVariant(user.role?.name || '')}>
                      {user.role?.name || 'No Role'}
                    </Badge>
                  </td>
                  <td className="py-2">{new Date(user.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {users.length === 0 && (
          <div className="py-12 text-center">
            <p className="text-muted-foreground">No users found.</p>
          </div>
        )}
      </div>
    </div>
  );
}
