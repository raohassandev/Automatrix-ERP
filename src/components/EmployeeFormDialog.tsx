"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FormDialog } from "./FormDialog";
import { Button } from "./ui/button";
import { DateField } from "./ui/date-field";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { toast } from "sonner";
import { ROLE_OPTIONS } from "@/lib/permissions";

interface EmployeeFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: {
    id: string;
    name: string;
    email: string;
    phone?: string | null;
    role: string;
    status?: string | null;
    cnic?: string | null;
    address?: string | null;
    education?: string | null;
    experience?: string | null;
    department?: string | null;
    designation?: string | null;
    reportingOfficerId?: string | null;
    joinDate?: string | null;
  };
}

const EMPTY_FORM = {
  name: "",
  email: "",
  phone: "",
  cnic: "",
  address: "",
  education: "",
  experience: "",
  department: "",
  designation: "",
  reportingOfficerId: "",
  joinDate: "",
  role: "Staff",
  initialWalletBalance: "",
  status: "ACTIVE",
};

export function EmployeeFormDialog({ open, onOpenChange, initialData }: EmployeeFormDialogProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [reportingOptions, setReportingOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [departments, setDepartments] = useState<Array<{ id: string; name: string }>>([]);
  const [designations, setDesignations] = useState<Array<{ id: string; name: string }>>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const isEdit = Boolean(initialData?.id);

  useEffect(() => {
    if (!open) return;
    const loadEmployees = async () => {
      try {
        const [employeeRes, departmentRes, designationRes] = await Promise.all([
          fetch("/api/employees"),
          fetch("/api/departments"),
          fetch("/api/designations"),
        ]);

        const employeeData = await employeeRes.json();
        if (employeeRes.ok) {
          const options = Array.isArray(employeeData.data)
            ? employeeData.data.map((employee: { id: string; name: string }) => ({
                id: employee.id,
                name: employee.name,
              }))
            : [];
          setReportingOptions(options);
        }

        const departmentData = await departmentRes.json();
        if (departmentRes.ok) {
          const list = Array.isArray(departmentData.data)
            ? departmentData.data.map((department: { id: string; name: string }) => ({
                id: department.id,
                name: department.name,
              }))
            : [];
          setDepartments(list);
        }

        const designationData = await designationRes.json();
        if (designationRes.ok) {
          const list = Array.isArray(designationData.data)
            ? designationData.data.map((designation: { id: string; name: string }) => ({
                id: designation.id,
                name: designation.name,
              }))
            : [];
          setDesignations(list);
        }
      } catch (error) {
        console.error("Failed to load reporting officers", error);
      }
    };
    loadEmployees();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (initialData) {
      setForm({
        ...EMPTY_FORM,
        name: initialData.name || "",
        email: initialData.email || "",
        phone: initialData.phone || "",
        cnic: initialData.cnic || "",
        address: initialData.address || "",
        education: initialData.education || "",
        experience: initialData.experience || "",
        department: initialData.department || "",
        designation: initialData.designation || "",
        reportingOfficerId: initialData.reportingOfficerId || "",
        joinDate: initialData.joinDate || "",
        role: initialData.role || "Staff",
        initialWalletBalance: "",
        status: initialData.status || "ACTIVE",
      });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [open, initialData]);

  async function submit() {
    try {
      if (!form.name.trim()) {
        toast.error("Employee name is required.");
        return;
      }
      if (!isEdit && !form.email.trim()) {
        toast.error("Email is required.");
        return;
      }
      if (form.initialWalletBalance && (!Number.isFinite(Number(form.initialWalletBalance)) || Number(form.initialWalletBalance) < 0)) {
        toast.error("Initial wallet balance must be a valid non-negative number.");
        return;
      }
      const res = await fetch(isEdit ? `/api/employees/${initialData?.id}` : "/api/employees", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(isEdit
            ? {
                name: form.name.trim(),
                phone: form.phone || null,
                role: form.role,
                status: form.status,
                cnic: form.cnic,
                address: form.address,
                education: form.education,
                experience: form.experience,
                department: form.department,
                designation: form.designation,
                reportingOfficerId: form.reportingOfficerId,
                joinDate: form.joinDate,
              }
            : {
                name: form.name.trim(),
                email: form.email.trim(),
                phone: form.phone || null,
                cnic: form.cnic || undefined,
                address: form.address || undefined,
                education: form.education || undefined,
                experience: form.experience || undefined,
                department: form.department || undefined,
                designation: form.designation || undefined,
                reportingOfficerId: form.reportingOfficerId || undefined,
                joinDate: form.joinDate || undefined,
                role: form.role,
                initialWalletBalance: form.initialWalletBalance
                  ? parseFloat(form.initialWalletBalance)
                  : 0,
              }),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to add employee");
      }

      toast.success(isEdit ? "Employee updated successfully!" : "Employee added successfully!");
      
      // Reset form
      setForm(EMPTY_FORM);
      
      // Close dialog
      onOpenChange(false);
      
      // Refresh data
      router.refresh();
    } catch (error) {
      console.error("Error adding employee:", error);
      toast.error(error instanceof Error ? error.message : "Failed to add employee");
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? "Edit Employee" : "Add Employee"}
      description={isEdit ? "Update employee record and role settings." : "Simple setup: identity, role, reporting, and optional wallet opening balance."}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(() => submit());
        }}
        className="space-y-4"
      >
        <div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
          Keep role and reporting officer accurate. These directly control approvals and access.
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name"
              placeholder="John Doe"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="john@example.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
              disabled={isEdit}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone (Optional)</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="+92 300 1234567"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <select
              id="role"
              className="rounded-md border px-3 py-2"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
            >
              {ROLE_OPTIONS.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="department">Department</Label>
            <Input
              id="department"
              list="department-options"
              placeholder="Engineering / Sales"
              value={form.department}
              onChange={(e) => setForm({ ...form, department: e.target.value })}
            />
            <datalist id="department-options">
              {departments.map((department) => (
                <option key={department.id} value={department.name} />
              ))}
            </datalist>
          </div>

          <div className="space-y-2">
            <Label htmlFor="designation">Designation</Label>
            <Input
              id="designation"
              list="designation-options"
              placeholder="Engineer / Technician"
              value={form.designation}
              onChange={(e) => setForm({ ...form, designation: e.target.value })}
            />
            <datalist id="designation-options">
              {designations.map((designation) => (
                <option key={designation.id} value={designation.name} />
              ))}
            </datalist>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reportingOfficerId">Reporting Officer</Label>
            <select
              id="reportingOfficerId"
              className="rounded-md border px-3 py-2"
              value={form.reportingOfficerId}
              onChange={(e) => setForm({ ...form, reportingOfficerId: e.target.value })}
            >
              <option value="">None</option>
              {reportingOptions
                .filter((employee) => employee.id !== initialData?.id)
                .map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.name}
                  </option>
                ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="joinDate">Join Date</Label>
            <DateField
              id="joinDate"
              value={form.joinDate}
              onChange={(value) => setForm({ ...form, joinDate: value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cnic">CNIC (Optional)</Label>
            <Input
              id="cnic"
              placeholder="35202-1234567-1"
              value={form.cnic}
              onChange={(e) => setForm({ ...form, cnic: e.target.value })}
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="address">Address (Optional)</Label>
            <Textarea
              id="address"
              placeholder="House #, Street, City"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="education">Education (Optional)</Label>
            <Textarea
              id="education"
              placeholder="Degree, certifications"
              value={form.education}
              onChange={(e) => setForm({ ...form, education: e.target.value })}
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="experience">Experience (Optional)</Label>
            <Textarea
              id="experience"
              placeholder="Relevant experience summary"
              value={form.experience}
              onChange={(e) => setForm({ ...form, experience: e.target.value })}
            />
          </div>

          {!isEdit ? (
            <div className="space-y-2">
              <Label htmlFor="initialWalletBalance">Initial Wallet Balance (Optional)</Label>
              <Input
                id="initialWalletBalance"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={form.initialWalletBalance}
                onChange={(e) => setForm({ ...form, initialWalletBalance: e.target.value })}
              />
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <select
                id="status"
                className="rounded-md border px-3 py-2"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving..." : isEdit ? "Save Changes" : "Add Employee"}
          </Button>
        </div>
      </form>
    </FormDialog>
  );
}
