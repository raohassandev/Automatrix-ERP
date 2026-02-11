import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/rbac";
import { getCompanyAccountDetailForUser } from "@/lib/company-account-detail-policy";
import { CompanyAccountDetailClient } from "./CompanyAccountDetailClient";

export default async function CompanyAccountDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const canManage = await requirePermission(session.user.id, "company_accounts.manage");
  if (!canManage) {
    return (
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Company Account</h1>
        <p className="mt-2 text-muted-foreground">You do not have access to this page.</p>
      </div>
    );
  }

  const { id } = await params;
  const sp = await searchParams;
  const paymentsPageRaw = Array.isArray(sp.paymentsPage) ? sp.paymentsPage[0] : sp.paymentsPage;
  const paymentsPage = Math.max(parseInt(String(paymentsPageRaw || "1"), 10), 1);

  const result = await getCompanyAccountDetailForUser({
    userId: session.user.id,
    companyAccountId: id,
    paymentsPage,
  });
  if (!result.ok) {
    return (
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Company Account</h1>
        <p className="mt-2 text-muted-foreground">{result.error}</p>
      </div>
    );
  }

  return <CompanyAccountDetailClient detail={result.data} />;
}

