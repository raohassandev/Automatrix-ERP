"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Role = { id: string; name: string };
type Employee = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  userId: string | null;
  userRole: string | null;
};

export default function EmployeeAccessManager() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [credentialsEnabled, setCredentialsEnabled] = useState(
    process.env.NEXT_PUBLIC_ENABLE_CREDENTIALS_LOGIN === "1",
  );

  const loadData = async () => {
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch("/api/employees/access");
      const data = await res.json();
      if (!res.ok) {
        setStatus(data.error || "Failed to load employee access.");
        return;
      }
      setEmployees(data.employees || []);
      setRoles(data.roles || []);
      const defaults: Record<string, string> = {};
      for (const employee of data.employees || []) {
        defaults[employee.id] = employee.userRole || employee.role || "Staff";
      }
      setSelectedRoles(defaults);
    } catch (error) {
      console.error(error);
      setStatus("Failed to load employee access.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const roleOptions = useMemo(() => roles.map((role) => role.name), [roles]);

  const provisionAccess = async (employee: Employee) => {
    setPendingId(employee.id);
    setStatus(null);
    try {
      const roleName = selectedRoles[employee.id] || "Staff";
      const res = await fetch("/api/employees/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: employee.id, roleName }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus(data.error || "Failed to provision access.");
        return;
      }
      setStatus(`Access updated for ${employee.email}`);
      await loadData();
    } catch (error) {
      console.error(error);
      setStatus("Failed to provision access.");
    } finally {
      setPendingId(null);
    }
  };

  const resetPassword = async (employee: Employee) => {
    setPendingId(employee.id);
    setStatus(null);
    try {
      const tempPassword = Math.random().toString(36).slice(-10) + "A1!";
      const res = await fetch("/api/users/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: employee.email, newPassword: tempPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus(data.error || "Failed to reset password.");
        return;
      }
      setStatus(`Temporary password for ${employee.email}: ${tempPassword}`);
      setCredentialsEnabled(true);
    } catch (error) {
      console.error(error);
      setStatus("Failed to reset password.");
    } finally {
      setPendingId(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Employee Access</CardTitle>
          <CardDescription>Loading employee access...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Employee Access</CardTitle>
        <CardDescription>
          Provision portal access for employees and set their RBAC role.
          This tool creates/updates the user record for the employee email.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {credentialsEnabled ? (
          <div className="rounded-md border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-sm">
            Credentials login is enabled in this environment. Use temporary passwords only for staging/internal QA.
          </div>
        ) : null}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2">Employee</th>
                <th className="py-2">Email</th>
                <th className="py-2">Status</th>
                <th className="py-2">Login</th>
                <th className="py-2">Role</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((employee) => (
                <tr key={employee.id} className="border-b">
                  <td className="py-2">{employee.name}</td>
                  <td className="py-2">{employee.email}</td>
                  <td className="py-2">{employee.status}</td>
                  <td className="py-2">
                    {employee.userId ? (
                      <Badge variant="default">Active</Badge>
                    ) : (
                      <Badge variant="outline">Not provisioned</Badge>
                    )}
                  </td>
                  <td className="py-2">
                    <select
                      className="rounded-md border px-2 py-1"
                      value={selectedRoles[employee.id] || "Staff"}
                      onChange={(event) =>
                        setSelectedRoles((prev) => ({
                          ...prev,
                          [employee.id]: event.target.value,
                        }))
                      }
                    >
                      {roleOptions.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => provisionAccess(employee)}
                        disabled={pendingId === employee.id || employee.status !== "ACTIVE"}
                      >
                        {employee.status !== "ACTIVE"
                          ? "Inactive"
                          : employee.userId
                            ? "Update Role"
                            : "Create Login"}
                      </Button>
                      {credentialsEnabled ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => resetPassword(employee)}
                          disabled={pendingId === employee.id || !employee.userId}
                        >
                          Reset Password
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {employees.length === 0 && (
          <p className="text-sm text-muted-foreground">No employees found.</p>
        )}

        {status && (
          <div className="rounded-md border px-3 py-2 text-sm text-muted-foreground">
            {status}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
