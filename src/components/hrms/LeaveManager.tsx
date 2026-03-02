"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/StatusBadge";
import { toast } from "sonner";

type EmployeeOption = {
  id: string;
  name: string;
  email: string;
};

type LeaveRow = {
  id: string;
  employeeId: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string | null;
  status: string;
  decisionNote: string | null;
  employee: {
    id: string;
    name: string;
    email: string;
    department: string | null;
  };
};

export function LeaveManager({
  employees,
  rows,
  canManage,
  canApprove,
  ownEmployeeId,
}: {
  employees: EmployeeOption[];
  rows: LeaveRow[];
  canManage: boolean;
  canApprove: boolean;
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
    leaveType: "ANNUAL",
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date().toISOString().slice(0, 10),
    reason: "",
  });

  const submitNew = async () => {
    if (!form.employeeId || !form.startDate || !form.endDate) {
      toast.error("Employee and leave dates are required.");
      return;
    }
    const res = await fetch("/api/hrms/leave", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Failed to create leave request.");
      return;
    }
    toast.success("Leave request submitted.");
    router.refresh();
  };

  const act = async (id: string, action: "APPROVE" | "REJECT" | "CANCEL") => {
    const res = await fetch(`/api/hrms/leave/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Action failed.");
      return;
    }
    toast.success(`Leave ${action.toLowerCase()}d.`);
    router.refresh();
  };

  return (
    <div className="grid gap-6">
      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Leave Request</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Submit leave once. Managers approve directly from the same page.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-5">
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
                    {employee.name} ({employee.email})
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="space-y-2">
            <Label>Type</Label>
            <select
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={form.leaveType}
              onChange={(e) => setForm({ ...form, leaveType: e.target.value })}
            >
              <option value="ANNUAL">Annual</option>
              <option value="SICK">Sick</option>
              <option value="CASUAL">Casual</option>
              <option value="UNPAID">Unpaid</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label>Start Date</Label>
            <Input
              type="date"
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>End Date</Label>
            <Input
              type="date"
              value={form.endDate}
              onChange={(e) => setForm({ ...form, endDate: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Reason</Label>
            <Input
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              placeholder="Reason for leave"
            />
          </div>
        </div>
        <div className="mt-4">
          <Button disabled={pending} onClick={() => startTransition(submitNew)}>
            {pending ? "Submitting..." : "Submit Leave Request"}
          </Button>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Leave Pipeline</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2">Employee</th>
                <th className="py-2">Type</th>
                <th className="py-2">Dates</th>
                <th className="py-2">Days</th>
                <th className="py-2">Status</th>
                <th className="py-2">Reason</th>
                <th className="py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const own = ownEmployeeId === row.employeeId;
                return (
                  <tr key={row.id} className="border-b">
                    <td className="py-2">{row.employee.name}</td>
                    <td className="py-2">{row.leaveType}</td>
                    <td className="py-2">
                      {new Date(row.startDate).toLocaleDateString()} - {new Date(row.endDate).toLocaleDateString()}
                    </td>
                    <td className="py-2">{row.totalDays}</td>
                    <td className="py-2">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="py-2">{row.reason || "-"}</td>
                    <td className="py-2">
                      <div className="flex flex-wrap gap-2">
                        {canApprove && row.status === "PENDING" ? (
                          <>
                            <Button size="sm" variant="outline" onClick={() => startTransition(() => act(row.id, "APPROVE"))}>
                              Approve
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => startTransition(() => act(row.id, "REJECT"))}>
                              Reject
                            </Button>
                          </>
                        ) : null}
                        {(own || canManage) && (row.status === "PENDING" || row.status === "APPROVED") ? (
                          <Button size="sm" variant="outline" onClick={() => startTransition(() => act(row.id, "CANCEL"))}>
                            Cancel
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {rows.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">No leave requests found.</div>
        ) : null}
      </div>
    </div>
  );
}
