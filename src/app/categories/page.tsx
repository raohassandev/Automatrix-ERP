"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { hasPermission, type RoleName } from "@/lib/permissions";

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
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    name: "",
    type: "expense",
    description: "",
    maxAmount: "",
    enforceStrict: false,
  });

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canManage) {
      toast.error('You do not have permission to create categories');
      return;
    }
    if (!form.name.trim()) {
      toast.error('Category name is required');
      return;
    }

    try {
      const payload = {
        name: form.name,
        type: form.type,
        description: form.description,
        maxAmount: form.maxAmount ? parseFloat(form.maxAmount) : undefined,
        enforceStrict: form.enforceStrict,
      };
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        toast.success('Category created successfully');
        setForm({ name: "", type: "expense", description: "", maxAmount: "", enforceStrict: false });
        setShowForm(false);
        fetchCategories();
      } else {
        toast.error(data.error || 'Failed to create category');
      }
    } catch (error) {
      console.error("Failed to create category", error);
      toast.error('Failed to create category');
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
          <Button onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : 'Add Category'}
          </Button>
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

        {showForm && (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4 rounded-lg border p-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="block text-sm font-medium">Category Name</label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Enter category name"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Type</label>
                <select
                  className="rounded-md border px-3 py-2 w-full"
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                >
                  <option value="expense">Expense</option>
                  <option value="inventory">Inventory</option>
                  <option value="income">Income</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium">Description</label>
                <Input
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Optional description"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Max Amount (PKR)</label>
                <Input
                  type="number"
                  value={form.maxAmount}
                  onChange={(e) => setForm({ ...form, maxAmount: e.target.value })}
                  placeholder="Optional limit"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="enforceStrict"
                  type="checkbox"
                  className="h-4 w-4"
                  checked={form.enforceStrict}
                  onChange={(e) => setForm({ ...form, enforceStrict: e.target.checked })}
                />
                <label htmlFor="enforceStrict" className="text-sm font-medium">
                  Enforce strict limit
                </label>
              </div>
            </div>
            <Button type="submit" className="w-full">Create Category</Button>
          </form>
        )}
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
