"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { hasPermission, type RoleName } from "@/lib/permissions";
import { CategoryFormDialog } from "@/components/CategoryFormDialog";

type Category = {
  id: string;
  name: string;
  type: string;
  description: string | null;
  maxAmount?: number | null;
  enforceStrict?: boolean;
};

export default function CategoriesPage() {
  const { data: session } = useSession();
  const roleName = ((session?.user as { role?: string })?.role || "Guest") as RoleName;
  const canManage = hasPermission(roleName, "categories.manage");
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  async function fetchCategories() {
    try {
      const res = await fetch('/api/categories');
      const data = await res.json();
      if (data.success) {
        setCategories(data.categories || []);
      }
    } catch (error) {
      console.error("Failed to fetch categories", error);
      toast.error('Failed to fetch categories');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchCategories();
  }, []);

  if (loading) {
    return (
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Category Management</h1>
        <p className="mt-2 text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!canManage) {
    return (
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Category Management</h1>
        <p className="mt-2 text-muted-foreground">You do not have access to categories.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Category Management</h1>
            <p className="mt-2 text-muted-foreground">
              Manage categories for expenses, inventory, and income
            </p>
          </div>
          {canManage ? (
            <Button onClick={() => setDialogOpen(true)}>Add Category</Button>
          ) : null}
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium">Search</label>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search categories..."
            className="mt-1"
          />
        </div>

        <CategoryFormDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onCreated={fetchCategories}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {['expense', 'inventory', 'income'].map((type) => (
          <div key={type} className="rounded-xl border bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold capitalize">{type} Categories</h2>
            <div className="mt-4 space-y-2">
              {categories
                .filter((cat) => cat.type === type)
                .filter((cat) => {
                  if (!search.trim()) return true;
                  const query = search.toLowerCase();
                  return (
                    cat.name.toLowerCase().includes(query) ||
                    (cat.description || "").toLowerCase().includes(query)
                  );
                })
                .map((category) => (
                  <div key={category.id} className="rounded-md border p-3">
                    <div className="font-medium">{category.name}</div>
                    {category.description && (
                      <div className="text-sm text-muted-foreground">
                        {category.description}
                      </div>
                    )}
                    {(category as { maxAmount?: number | null }).maxAmount ? (
                      <div className="text-xs text-muted-foreground mt-1">
                        Limit: PKR {(category as { maxAmount?: number | null }).maxAmount}
                        {(category as { enforceStrict?: boolean }).enforceStrict ? " (strict)" : ""}
                      </div>
                    ) : null}
                  </div>
                ))}
              {categories
                .filter((cat) => cat.type === type)
                .filter((cat) => {
                  if (!search.trim()) return true;
                  const query = search.toLowerCase();
                  return (
                    cat.name.toLowerCase().includes(query) ||
                    (cat.description || "").toLowerCase().includes(query)
                  );
                }).length === 0 && (
                <p className="text-sm text-muted-foreground">No {type} categories found</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
