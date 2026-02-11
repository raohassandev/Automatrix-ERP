import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getItemDetailForUser } from "@/lib/item-detail-policy";
import { ItemDetailClient } from "./ItemDetailClient";

export default async function ItemDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: { ledgerPage?: string };
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const { id } = await params;
  const ledgerPage = Math.max(parseInt(searchParams.ledgerPage || "1", 10), 1);
  const result = await getItemDetailForUser({ userId: session.user.id, itemDbId: id, ledgerPage });

  if (!result.ok) {
    if (result.status === 404) {
      return (
        <div className="rounded-xl border bg-card p-8 shadow-sm">
          <h1 className="text-2xl font-semibold">Item</h1>
          <p className="mt-2 text-muted-foreground">Item not found.</p>
        </div>
      );
    }
    return (
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Item</h1>
        <p className="mt-2 text-muted-foreground">You do not have access to this item.</p>
      </div>
    );
  }

  return <ItemDetailClient detail={result.data} />;
}

