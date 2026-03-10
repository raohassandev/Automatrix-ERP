export function employeeCodeFromId(id: string) {
  const clean = String(id || "").trim();
  if (!clean) return "EMP-UNKNOWN";
  return `EMP-${clean.slice(-6).toUpperCase()}`;
}

export function employeeDisplayLabel(employee: { id: string; name?: string | null }) {
  const code = employeeCodeFromId(employee.id);
  const name = (employee.name || "").trim() || "Unnamed employee";
  return `${code} - ${name}`;
}
