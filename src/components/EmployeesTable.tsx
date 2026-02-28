"use client";

import { useState } from "react";
import { formatMoney } from "@/lib/format";
import { DeleteButton } from "@/components/TableActions";
import { MobileCard } from "@/components/MobileCard";
import { EmployeeWalletDialog } from "@/components/EmployeeWalletDialog";
import { Button } from "./ui/button";
import { Wallet } from "lucide-react";
import { EmployeeFormDialog } from "@/components/EmployeeFormDialog";

interface Employee {
  id: string;
  name: string;
  email: string;
  role: string;
  phone?: string | null;
  department?: string | null;
  designation?: string | null;
  cnic?: string | null;
  address?: string | null;
  education?: string | null;
  experience?: string | null;
  reportingOfficerId?: string | null;
  joinDate?: string | null;
  walletBalance: number | string;
  walletHold?: number | string;
  status: string;
}

interface EmployeesTableProps {
  employees: Employee[];
  canEditEmployees: boolean;
}

export function EmployeesTable({ employees, canEditEmployees }: EmployeesTableProps) {
  const [walletDialog, setWalletDialog] = useState<{
    open: boolean;
    employeeId: string;
    employeeName: string;
    currentBalance: number;
    availableBalance: number;
  }>({
    open: false,
    employeeId: "",
    employeeName: "",
    currentBalance: 0,
    availableBalance: 0,
  });
  const [editEmployee, setEditEmployee] = useState<Employee | null>(null);

  const openWalletDialog = (employee: Employee) => {
    const currentBalance = Number(employee.walletBalance);
    const availableBalance = currentBalance - Number(employee.walletHold || 0);
    setWalletDialog({
      open: true,
      employeeId: employee.id,
      employeeName: employee.name,
      currentBalance,
      availableBalance,
    });
  };

  return (
    <>
      {/* Desktop: Table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm table-auto">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="py-2 pr-3">Name</th>
              <th className="py-2 pr-3">Email</th>
              <th className="py-2 pr-3">Role</th>
              <th className="py-2 pr-3">Department</th>
              <th className="py-2 pr-3">Designation</th>
              <th className="py-2 pr-3">Wallet</th>
              <th className="py-2 pr-3 w-[90px] whitespace-nowrap">Status</th>
              <th className="py-2 w-[240px] whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((employee) => (
              <tr key={employee.id} className="border-b">
                <td className="py-2 pr-3">{employee.name}</td>
                <td className="py-2 pr-3">{employee.email}</td>
                <td className="py-2 pr-3">{employee.role}</td>
                <td className="py-2 pr-3">{employee.department || "-"}</td>
                <td className="py-2 pr-3">{employee.designation || "-"}</td>
                <td className="py-2 pr-3">
                  <div className="text-sm">{formatMoney(Number(employee.walletBalance))}</div>
                  <div className="text-xs text-muted-foreground">
                    Available: {formatMoney(Number(employee.walletBalance) - Number(employee.walletHold || 0))}
                  </div>
                </td>
                <td className="py-2 pr-3 w-[90px] whitespace-nowrap">{employee.status}</td>
                <td className="py-2 w-[240px]">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1"
                      onClick={() => openWalletDialog(employee)}
                    >
                      <Wallet className="h-4 w-4" />
                      Wallet
                    </Button>
                    {canEditEmployees ? (
                      <Button size="sm" variant="outline" onClick={() => setEditEmployee(employee)}>
                        Edit
                      </Button>
                    ) : null}
                    {canEditEmployees ? <DeleteButton url={`/api/employees/${employee.id}`} /> : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: Cards */}
      <div className="md:hidden space-y-4">
        {employees.map((employee) => (
          <MobileCard
            key={employee.id}
            title={employee.name}
            subtitle={employee.email}
              fields={[
                { label: "Role", value: employee.role },
                { label: "Department", value: employee.department || "-" },
                { label: "Designation", value: employee.designation || "-" },
                { label: "Wallet", value: formatMoney(Number(employee.walletBalance)) },
                {
                  label: "Available",
                  value: formatMoney(Number(employee.walletBalance) - Number(employee.walletHold || 0)),
                },
                { label: "Status", value: employee.status },
              ]}
            actions={
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1 flex-1"
                  onClick={() => openWalletDialog(employee)}
                >
                  <Wallet className="h-4 w-4" />
                  Wallet
                </Button>
                {canEditEmployees ? (
                  <Button size="sm" variant="outline" onClick={() => setEditEmployee(employee)}>
                    Edit
                  </Button>
                ) : null}
                {canEditEmployees ? <DeleteButton url={`/api/employees/${employee.id}`} /> : null}
              </>
            }
          />
        ))}
      </div>

      {/* Wallet Dialog */}
      <EmployeeWalletDialog
        open={walletDialog.open}
        onOpenChange={(open) => setWalletDialog({ ...walletDialog, open })}
        employeeId={walletDialog.employeeId}
        employeeName={walletDialog.employeeName}
        currentBalance={walletDialog.currentBalance}
        availableBalance={walletDialog.availableBalance}
      />
      <EmployeeFormDialog
        open={Boolean(editEmployee)}
        onOpenChange={(open) => {
          if (!open) setEditEmployee(null);
        }}
        initialData={
          editEmployee
            ? {
                id: editEmployee.id,
                name: editEmployee.name,
                email: editEmployee.email,
                phone: editEmployee.phone,
                role: editEmployee.role,
                status: editEmployee.status,
                department: editEmployee.department,
                designation: editEmployee.designation,
                cnic: editEmployee.cnic,
                address: editEmployee.address,
                education: editEmployee.education,
                experience: editEmployee.experience,
                reportingOfficerId: editEmployee.reportingOfficerId,
                joinDate: editEmployee.joinDate,
              }
            : undefined
        }
      />
    </>
  );
}
