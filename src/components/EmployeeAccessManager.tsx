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

type PasswordState = {
  employeeId: string;
  password: string;
};

export default function EmployeeAccessManager() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [passwordState, setPasswordState] = useState<PasswordState | null>(null);

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
      if (data.password) {
        setPasswordState({ employeeId: employee.id, password: data.password });
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
    if (!employee.userId) return;
    setPendingId(employee.id);
    setStatus(null);
    try {
      const res = await fetch("/api/users/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: employee.userId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus(data.error || "Failed to reset password.");
        return;
      }
      if (data.password) {
        setPasswordState({ employeeId: employee.id, password: data.password });
      }
      setStatus(`Password reset for ${employee.email}`);
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
          Create login access so employees can submit expenses. Assign the RBAC role that controls permissions.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
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
                        disabled={pendingId === employee.id}
                      >
                        {employee.userId ? "Update Role" : "Create Login"}
                      </Button>
                      {employee.userId ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => resetPassword(employee)}
                          disabled={pendingId === employee.id}
                        >
                          Reset Password
                        </Button>
                      ) : null}
                    </div>
                    {passwordState?.employeeId === employee.id ? (
                      <div className="mt-2 rounded-md border bg-muted/40 px-2 py-1 text-xs">
                        Temp password:{" "}
                        <code className="rounded bg-muted px-1 py-0.5">{passwordState.password}</code>
                      </div>
                    ) : null}
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
