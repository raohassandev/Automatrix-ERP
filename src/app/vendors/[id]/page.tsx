import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getVendorDetailForUser } from "@/lib/vendor-detail-policy";
import { VendorDetailClient } from "./VendorDetailClient";

export default async function VendorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const { id } = await params;
  const result = await getVendorDetailForUser({ userId: session.user.id, vendorDbId: id });

  if (!result.ok) {
    if (result.status === 404) {
      return (
        <div className="rounded-xl border bg-card p-8 shadow-sm">
          <h1 className="text-2xl font-semibold">Vendor</h1>
          <p className="mt-2 text-muted-foreground">Vendor not found.</p>
        </div>
      );
    }
    return (
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Vendor</h1>
        <p className="mt-2 text-muted-foreground">You do not have access to this vendor.</p>
      </div>
    );
  }

  return <VendorDetailClient detail={result.data} />;
}

