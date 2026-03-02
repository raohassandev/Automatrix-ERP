import * as XLSX from "xlsx";

export type ParsedStatementLine = {
  statementDate: Date;
  description: string | null;
  reference: string | null;
  debit: number;
  credit: number;
  amount: number;
  runningBalance: number | null;
};

function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function parseNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return 0;
  const str = String(value).replace(/,/g, "").trim();
  const n = Number(str);
  return Number.isFinite(n) ? n : 0;
}

function parseDateValue(value: unknown) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "number") {
    const d = XLSX.SSF.parse_date_code(value);
    if (!d) return null;
    return new Date(Date.UTC(d.y, d.m - 1, d.d));
  }
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function mapRow(row: Record<string, unknown>) {
  const mapped: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    mapped[normalizeHeader(key)] = value;
  }
  const date =
    parseDateValue(mapped.statementdate) ||
    parseDateValue(mapped.date) ||
    parseDateValue(mapped.transactiondate) ||
    parseDateValue(mapped.valuedate);
  if (!date) return null;

  const debit = parseNumber(mapped.debit || mapped.withdrawal || mapped.dr || 0);
  const credit = parseNumber(mapped.credit || mapped.deposit || mapped.cr || 0);
  const signedAmountRaw = parseNumber(mapped.amount || 0);
  const amount = credit > 0 || debit > 0 ? credit - debit : signedAmountRaw;

  return {
    statementDate: date,
    description: mapped.description ? String(mapped.description).trim() : null,
    reference: mapped.reference ? String(mapped.reference).trim() : mapped.ref ? String(mapped.ref).trim() : null,
    debit,
    credit,
    amount,
    runningBalance: mapped.balance !== undefined ? parseNumber(mapped.balance) : null,
  } satisfies ParsedStatementLine;
}

function parseCsv(buffer: Buffer) {
  const text = buffer.toString("utf8");
  const wb = XLSX.read(text, { type: "string" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  return rows;
}

function parseXlsx(buffer: Buffer) {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  return rows;
}

export function parseBankStatementFile(buffer: Buffer, fileName: string) {
  const ext = fileName.toLowerCase().split(".").pop() || "";
  const rows = ext === "csv" ? parseCsv(buffer) : parseXlsx(buffer);
  const parsed = rows
    .map(mapRow)
    .filter((row): row is ParsedStatementLine => Boolean(row))
    .map((row) => ({
      ...row,
      amount: Number(row.amount.toFixed(2)),
      debit: Number(row.debit.toFixed(2)),
      credit: Number(row.credit.toFixed(2)),
      runningBalance: row.runningBalance === null ? null : Number(row.runningBalance.toFixed(2)),
    }));
  return parsed;
}
