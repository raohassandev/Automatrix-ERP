"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DateField } from "@/components/ui/date-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/StatusBadge";
import { toast } from "sonner";
import { employeeDisplayLabel } from "@/lib/employee-display";

type EmployeeOption = {
  id: string;
  name: string;
  email: string;
};

type AttendanceRow = {
  id: string;
  employeeId: string;
  date: string;
  status: string;
  notes: string | null;
  employee: {
    id: string;
    name: string;
    email: string;
    department: string | null;
  };
};

export function AttendanceManager({
  employees,
  rows,
  canManage,
  ownEmployeeId,
}: {
  employees: EmployeeOption[];
  rows: AttendanceRow[];
  canManage: boolean;
  ownEmployeeId: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const defaultEmployee = useMemo(() => {
    if (canManage) return employees[0]?.id || "";
    return ownEmployeeId || "";
  }, [canManage, ownEmployeeId, employees]);
  const [form, setForm] = useState({
    employeeId: defaultEmployee,
    date: new Date().toISOString().slice(0, 10),
    status: "PRESENT",
    notes: "",
  });

  const submitNew = async () => {
    if (!form.date) {
      toast.error("Date is required.");
      return;
    }
    if (!form.employeeId) {
      toast.error("Employee is required.");
      return;
    }
    const res = await fetch("/api/hrms/attendance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Failed to save attendance.");
      return;
    }
    toast.success("Attendance saved.");
    router.refresh();
  };

  const updateStatus = async (id: string, status: string) => {
    const res = await fetch(`/api/hrms/attendance/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Failed to update attendance.");
      return;
    }
    toast.success("Attendance updated.");
    router.refresh();
  };

  return (
    <div className="grid gap-6">
      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Mark Attendance</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Quick entry for present, absent, leave, or field/WFH status.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-4">
          {canManage ? (
            <div className="space-y-2">
              <Label>Employee</Label>
              <select
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={form.employeeId}
                onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
              >
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employeeDisplayLabel(employee)}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="space-y-2">
            <Label>Date</Label>
            <DateField
              value={form.date}
              onChange={(value) => setForm({ ...form, date: value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <select
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              <option value="PRESENT">Present</option>
              <option value="ABSENT">Absent</option>
              <option value="LATE">Late</option>
              <option value="HALF_DAY">Half Day</option>
              <option value="WFH">Work From Home</option>
              <option value="LEAVE">Leave</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label>Notes (Optional)</Label>
            <Input
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Reason/details"
            />
          </div>
        </div>
        <div className="mt-4">
          <Button disabled={pending} onClick={() => startTransition(submitNew)}>
            {pending ? "Saving..." : "Save Attendance"}
          </Button>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Recent Attendance</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2">Date</th>
                <th className="py-2">Employee</th>
                <th className="py-2">Department</th>
                <th className="py-2">Status</th>
                <th className="py-2">Notes</th>
                <th className="py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b">
                  <td className="py-2">{new Date(row.date).toLocaleDateString()}</td>
                  <td className="py-2">{row.employee.name}</td>
                  <td className="py-2">{row.employee.department || "-"}</td>
                  <td className="py-2">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="py-2">{row.notes || "-"}</td>
                  <td className="py-2">
                    <select
                      className="rounded-md border border-border bg-background px-2 py-1 text-xs"
                      defaultValue={row.status}
                      onChange={(e) => startTransition(() => updateStatus(row.id, e.target.value))}
                    >
                      <option value="PRESENT">Present</option>
                      <option value="ABSENT">Absent</option>
                      <option value="LATE">Late</option>
                      <option value="HALF_DAY">Half Day</option>
                      <option value="WFH">WFH</option>
                      <option value="LEAVE">Leave</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">No attendance records found.</div>
        ) : null}
      </div>
    </div>
  );
}
