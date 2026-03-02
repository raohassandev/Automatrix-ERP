import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { parseBankStatementFile } from "@/lib/bank-statement-import";
import { logAudit } from "@/lib/audit";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const canManage =
    (await requirePermission(session.user.id, "accounting.manage")) ||
    (await requirePermission(session.user.id, "company_accounts.manage"));
  if (!canManage) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const formData = await req.formData();
  const companyAccountId = String(formData.get("companyAccountId") || "").trim();
  const file = formData.get("file");
  if (!companyAccountId || !file || !(file instanceof File)) {
    return NextResponse.json({ success: false, error: "Account and statement file are required." }, { status: 400 });
  }

  const fileName = file.name || "statement.csv";
  const ext = fileName.toLowerCase().split(".").pop() || "";
  if (!["csv", "xlsx", "xls"].includes(ext)) {
    return NextResponse.json({ success: false, error: "Only CSV/XLSX/XLS files are supported." }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  const lines = parseBankStatementFile(Buffer.from(bytes), fileName);
  if (lines.length === 0) {
    return NextResponse.json({ success: false, error: "No valid statement lines found in file." }, { status: 400 });
  }

  const importBatchNo = `STM-${Date.now()}`;
  await prisma.$transaction(async (tx) => {
    for (const line of lines) {
      await tx.bankStatementLine.create({
        data: {
          companyAccountId,
          statementDate: line.statementDate,
          description: line.description,
          reference: line.reference,
          debit: new Prisma.Decimal(line.debit),
          credit: new Prisma.Decimal(line.credit),
          amount: new Prisma.Decimal(line.amount),
          runningBalance: line.runningBalance === null ? null : new Prisma.Decimal(line.runningBalance),
          status: "UNMATCHED",
          importedById: session.user.id,
          importBatchNo,
        },
      });
    }
  });

  await logAudit({
    action: "IMPORT_BANK_STATEMENT",
    entity: "BankStatementLine",
    entityId: importBatchNo,
    newValue: JSON.stringify({ companyAccountId, rows: lines.length, fileName }),
    userId: session.user.id,
  });

  return NextResponse.json({
    success: true,
    data: {
      importBatchNo,
      importedRows: lines.length,
    },
  });
}
