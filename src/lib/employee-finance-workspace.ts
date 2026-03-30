type EmployeeOption = {
  id: string;
};

type ResolveArgs = {
  requestedEmployeeId?: string | null;
  currentEmployeeId?: string | null;
  canViewAll: boolean;
  canViewTeam: boolean;
  employeeOptions: EmployeeOption[];
};

export function resolveFinanceWorkspaceEmployeeId(args: ResolveArgs): string | null {
  const requestedEmployeeId = (args.requestedEmployeeId || "").trim();
  if (requestedEmployeeId && args.employeeOptions.some((row) => row.id === requestedEmployeeId)) {
    return requestedEmployeeId;
  }

  const currentEmployeeId = (args.currentEmployeeId || "").trim();
  if (currentEmployeeId && args.employeeOptions.some((row) => row.id === currentEmployeeId)) {
    return currentEmployeeId;
  }

  if (!args.canViewAll && !args.canViewTeam && args.employeeOptions.length === 1) {
    return args.employeeOptions[0].id;
  }

  if (args.employeeOptions.length === 1) {
    return args.employeeOptions[0].id;
  }

  return null;
}
