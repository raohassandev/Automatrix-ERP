"use client";

import { useState } from "react";
import { formatMoney } from "@/lib/format";
import { DeleteButton, QuickEditButton } from "@/components/TableActions";
import { MobileCard } from "@/components/MobileCard";
import { EmployeeWalletDialog } from "@/components/EmployeeWalletDialog";
import { Button } from "./ui/button";
import { Wallet } from "lucide-react";

interface Employee {
  id: string;
  name: string;
  email: string;
  role: string;
  walletBalance: number | string;
  walletHold?: number | string;
  status: string;
}

interface EmployeesTableProps {
  employees: Employee[];
}

export function EmployeesTable({ employees }: EmployeesTableProps) {
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
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="py-2">Name</th>
              <th className="py-2">Email</th>
              <th className="py-2">Role</th>
              <th className="py-2">Wallet</th>
              <th className="py-2">Status</th>
              <th className="py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((employee) => (
              <tr key={employee.id} className="border-b">
                <td className="py-2">{employee.name}</td>
                <td className="py-2">{employee.email}</td>
                <td className="py-2">{employee.role}</td>
                <td className="py-2">
                  <div className="text-sm">{formatMoney(Number(employee.walletBalance))}</div>
                  <div className="text-xs text-muted-foreground">
                    Available: {formatMoney(Number(employee.walletBalance) - Number(employee.walletHold || 0))}
                  </div>
                </td>
                <td className="py-2">{employee.status}</td>
                <td className="py-2">
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1"
                      onClick={() => openWalletDialog(employee)}
                    >
                      <Wallet className="h-4 w-4" />
                      Wallet
                    </Button>
                    <QuickEditButton
                      url={`/api/employees/${employee.id}`}
                      fields={{ role: "Role", status: "Status", phone: "Phone" }}
                    />
                    <DeleteButton url={`/api/employees/${employee.id}`} />
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
                <QuickEditButton
                  url={`/api/employees/${employee.id}`}
                  fields={{ role: "Role", status: "Status", phone: "Phone" }}
                />
                <DeleteButton url={`/api/employees/${employee.id}`} />
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
    </>
  );
}
