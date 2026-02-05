import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/format";

function toCsv(rows: Array<Array<string | number | null | undefined>>) {
  return rows
    .map((row) =>
      row
        .map((field) => {
          const value = field ?? "";
          return `"${String(value).replace(/"/g, '""')}"`;
        })
        .join(",")
    )
    .join("\n");
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    return new Response("Unauthorized", { status: 401 });
  }

  const employee = await prisma.employee.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  if (!employee) {
    return new Response("Employee not found", { status: 404 });
  }

  const rows = await prisma.walletLedger.findMany({
    where: { employeeId: employee.id },
    orderBy: { date: "desc" },
  });

  const csvRows: Array<Array<string | number | null | undefined>> = [
    ["Date", "Type", "Amount", "Balance", "Reference"],
    ...rows.map((row) => [
      row.date.toISOString().slice(0, 10),
      row.type,
      formatMoney(Number(row.amount)),
      formatMoney(Number(row.balance)),
      row.reference || "",
    ]),
  ];

  const csv = toCsv(csvRows);
  const filename = `my_wallet_${new Date().toISOString().slice(0, 10)}.csv`;
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=${filename}`,
    },
  });
}
