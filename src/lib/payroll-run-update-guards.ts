type PayrollRunPatchPayload = {
  periodStart?: string;
  periodEnd?: string;
  status?: string;
  notes?: string;
  entries?: unknown[];
};

export function hasPayrollRunNonStatusMutations(payload: PayrollRunPatchPayload): boolean {
  return (
    payload.periodStart !== undefined ||
    payload.periodEnd !== undefined ||
    payload.notes !== undefined ||
    payload.entries !== undefined
  );
}

