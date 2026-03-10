"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatMoney } from "@/lib/format";
import type { ProjectDetailData, ProjectDetailTab } from "@/lib/project-detail-policy";
import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/FormDialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PurchaseOrderFormDialog } from "@/components/PurchaseOrderFormDialog";
import { GoodsReceiptFormDialog } from "@/components/GoodsReceiptFormDialog";
import { VendorBillFormDialog } from "@/components/VendorBillFormDialog";
import { IncentiveFormDialog } from "@/components/IncentiveFormDialog";
import { withLoadingToast } from "@/lib/withLoadingToast";
import { ProjectExecutiveSummary } from "@/components/projects/ProjectExecutiveSummary";
import { MobileCard } from "@/components/MobileCard";

function tabLabel(tab: ProjectDetailTab) {
  switch (tab) {
    case "activity":
      return "Activity";
    case "costs":
      return "Costs";
    case "inventory":
      return "Inventory";
    case "people":
      return "People";
    case "execution":
      return "Execution";
    case "documents":
      return "Documents";
  }
}

function statusPillClass(status: string) {
  const normalized = String(status || "").toUpperCase();
  if (normalized === "ACTIVE") return "border-emerald-200 bg-emerald-100 text-emerald-900";
  if (normalized === "ON_HOLD") return "border-amber-200 bg-amber-100 text-amber-900 dark:text-amber-100";
  if (normalized === "COMPLETED" || normalized === "CLOSED") {
    return "border-border bg-muted/50 text-foreground";
  }
  return "border-primary/30 bg-primary/10 text-primary";
}

export function ProjectDetailClient({ detail }: { detail: ProjectDetailData }) {
  const router = useRouter();
  const tabs = (Object.keys(detail.policy.tabs) as ProjectDetailTab[]).filter(
    (t) => detail.policy.tabs[t],
  );
  const [active, setActive] = React.useState<ProjectDetailTab>(tabs[0] || "activity");
  const workhubActions = detail.policy.workhubActions;

  const [poOpen, setPoOpen] = React.useState(false);
  const [grnOpen, setGrnOpen] = React.useState(false);
  const [billOpen, setBillOpen] = React.useState(false);
  const [assignOpen, setAssignOpen] = React.useState(false);
  const [noteOpen, setNoteOpen] = React.useState(false);
  const [attachmentOpen, setAttachmentOpen] = React.useState(false);

  const [users, setUsers] = React.useState<Array<{ id: string; email: string; name: string | null; role: string | null }>>([]);
  const [selectedUserIds, setSelectedUserIds] = React.useState<string[]>([]);
  const [note, setNote] = React.useState("");
  const [attachment, setAttachment] = React.useState({ fileName: "", url: "", mimeType: "", sizeBytes: "" });
  const [savingAssignments, setSavingAssignments] = React.useState(false);
  const [savingNote, setSavingNote] = React.useState(false);
  const [savingAttachment, setSavingAttachment] = React.useState(false);
  const [incentiveDialogOpen, setIncentiveDialogOpen] = React.useState(false);
  const [incentiveBusyId, setIncentiveBusyId] = React.useState<string | null>(null);
  const [incentives, setIncentives] = React.useState(detail.incentives?.rows || []);
  const [projectSwitching, setProjectSwitching] = React.useState(false);
  const [taskForm, setTaskForm] = React.useState({
    title: "",
    description: "",
    priority: "MEDIUM",
    dueDate: "",
    assignedToId: "",
  });
  const [savingTask, setSavingTask] = React.useState(false);
  const [updatingTaskId, setUpdatingTaskId] = React.useState<string | null>(null);
  const financeTransactions = React.useMemo(
    () =>
      detail.activity.filter((row) =>
        row.type === "INCOME" || row.type === "EXPENSE" || row.type === "BILL" || row.type === "PAYMENT",
      ),
    [detail.activity],
  );
  const inventoryTrace = React.useMemo(() => {
    const entries = detail.inventory?.entries || [];
    return entries.reduce(
      (acc, entry) => {
        const qty = Number(entry.quantity || 0);
        if (qty < 0) {
          acc.issuedQty += Math.abs(qty);
        } else if (qty > 0) {
          acc.returnedQty += qty;
        }
        acc.netQty += qty;
        return acc;
      },
      { issuedQty: 0, returnedQty: 0, netQty: 0 },
    );
  }, [detail.inventory?.entries]);
  const incentivePermissions = detail.policy.incentives;
  const canManageIncentives = incentivePermissions.canEdit || incentivePermissions.canApprove;
  const executionPermissions = detail.policy.execution;
  const canCreateTasks = executionPermissions.canCreate;
  const canManageTasks = executionPermissions.canManage;
  const canUpdateExecutionTasks = executionPermissions.canManage || executionPermissions.canUpdateAssigned;
  const canReviewTasks = executionPermissions.canReview;
  const recoveryRatePct =
    detail.costs && detail.costs.contractValue > 0
      ? (detail.costs.receivedAmount / detail.costs.contractValue) * 100
      : 0;
  const pendingRatePct =
    detail.costs && detail.costs.contractValue > 0
      ? (detail.costs.pendingRecovery / detail.costs.contractValue) * 100
      : 0;

  async function updateIncentiveStatus(incentiveId: string, status: "APPROVED" | "REJECTED") {
    try {
      setIncentiveBusyId(incentiveId);
      const res = await fetch(`/api/incentives/${incentiveId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || `Failed to ${status.toLowerCase()} incentive`);
      }
      toast.success(status === "APPROVED" ? "Incentive approved" : "Incentive rejected");
      router.refresh();
      setIncentives((prev) => prev.map((item) => (item.id === incentiveId ? { ...item, status } : item)));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update incentive");
    } finally {
      setIncentiveBusyId(null);
    }
  }

  React.useEffect(() => {
    if (!detail.policy.tabs[active]) {
      setActive(tabs[0] || "activity");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail.policy.role]);

  React.useEffect(() => {
    if (!assignOpen) return;
    let cancelled = false;
    const load = async () => {
      try {
        const [usersRes, assignRes] = await Promise.all([
          fetch("/api/users/list"),
          fetch(`/api/projects/${detail.header.id}/assignments`),
        ]);
        const usersJson = await usersRes.json();
        const assignJson = await assignRes.json();
        if (!usersRes.ok) throw new Error(usersJson.error || "Failed to load users");
        if (!assignRes.ok) throw new Error(assignJson.error || "Failed to load assignments");
        if (cancelled) return;
        setUsers(Array.isArray(usersJson.data) ? usersJson.data : []);
        const ids = Array.isArray(assignJson.data)
          ? assignJson.data.map((a: { userId: string }) => a.userId)
          : [];
        setSelectedUserIds(ids);
      } catch (e) {
        console.error(e);
        toast.error(e instanceof Error ? e.message : "Failed to load assignment data");
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [assignOpen, detail.header.id]);

  React.useEffect(() => {
    if (active !== "execution" || users.length > 0) return;
    let cancelled = false;
    fetch("/api/users/list")
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        if (Array.isArray(json?.data)) {
          setUsers(json.data);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [active, users.length]);

  async function saveAssignments() {
    const res = await fetch(`/api/projects/${detail.header.id}/assignments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignments: selectedUserIds.map((userId) => ({ userId })) }),
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error || "Failed to save assignments");
    }
  }

  async function addNote() {
    const res = await fetch(`/api/projects/${detail.header.id}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || "Failed to add note");
  }

  async function addAttachment() {
    const payload = {
      fileName: attachment.fileName,
      url: attachment.url,
      mimeType: attachment.mimeType || undefined,
      sizeBytes: attachment.sizeBytes ? Number(attachment.sizeBytes) : undefined,
    };
    const res = await fetch(`/api/projects/${detail.header.id}/attachments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || "Failed to add attachment");
  }

  async function createTask() {
    if (!canCreateTasks) {
      throw new Error("You do not have permission to create tasks.");
    }
    if (!taskForm.title.trim()) {
      throw new Error("Task title is required.");
    }
    const res = await fetch(`/api/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: detail.header.id,
        title: taskForm.title.trim(),
        description: taskForm.description.trim() || undefined,
        priority: taskForm.priority,
        dueDate: taskForm.dueDate || undefined,
        assignedToId: taskForm.assignedToId || undefined,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || "Failed to create task");
  }

  async function updateTask(taskId: string, payload: Record<string, unknown>) {
    if (!canUpdateExecutionTasks && !canReviewTasks) {
      throw new Error("You do not have permission to update tasks.");
    }
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || "Failed to update task");
  }

  const anyActions = Object.values(workhubActions).some(Boolean);

  return (
    <div className="grid gap-6">
      <div className="relative overflow-hidden rounded-xl border border-border bg-gradient-to-br from-background via-card to-muted/30 p-5 shadow-sm md:p-6">
        <div className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-primary/15" />
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0 relative z-10">
            <div className="text-sm font-medium text-sky-700 dark:text-sky-300">{detail.header.projectId}</div>
            <h1 className="mt-1 truncate text-2xl font-semibold">{detail.header.name}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${statusPillClass(detail.header.status)}`}
              >
                {detail.header.status.replaceAll("_", " ")}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span>
                Client:{" "}
                <Link className="font-medium text-sky-800 underline underline-offset-2 dark:text-sky-200" href={`/clients?search=${encodeURIComponent(detail.header.client.name)}`}>
                  {detail.header.client.name}
                </Link>
              </span>
              <span>Start: {detail.header.startDate}</span>
              <span>End: {detail.header.endDate || "-"}</span>
              <span>
                Manager:{" "}
                {detail.header.manager ? (
                  <span className="font-medium text-foreground">{detail.header.manager.name}</span>
                ) : (
                  "-"
                )}
              </span>
            </div>
          </div>
          <div className="relative z-10 text-xs text-muted-foreground">
            Role: <span className="font-medium text-foreground">{detail.policy.role}</span>
            {detail.projectSwitcher.options.length > 1 ? (
              <div className="mt-3 w-full md:w-80">
                <Label htmlFor="project-switcher" className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Switch Project
                </Label>
                <select
                  id="project-switcher"
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
                  value={detail.projectSwitcher.currentProjectDbId}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    if (!nextId || nextId === detail.projectSwitcher.currentProjectDbId) return;
                    setProjectSwitching(true);
                    router.push(`/projects/${nextId}`);
                  }}
                  disabled={projectSwitching}
                >
                  {detail.projectSwitcher.options.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.projectId} - {row.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>
          {anyActions ? (
            <div className="relative z-10 md:ml-4">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" data-testid="workhub-actions-button">
                    Actions
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {workhubActions.create_po ? (
                    <DropdownMenuItem onSelect={() => setPoOpen(true)}>
                      Create Purchase Order for this Project
                    </DropdownMenuItem>
                  ) : null}
                  {workhubActions.receive_grn ? (
                    <DropdownMenuItem onSelect={() => setGrnOpen(true)}>
                      Receive Goods (GRN) for this Project
                    </DropdownMenuItem>
                  ) : null}
                  {workhubActions.create_vendor_bill ? (
                    <DropdownMenuItem onSelect={() => setBillOpen(true)}>
                      Create Vendor Bill for this Project
                    </DropdownMenuItem>
                  ) : null}
                  {workhubActions.assign_people ? (
                    <DropdownMenuItem onSelect={() => setAssignOpen(true)}>
                      Assign People to Project
                    </DropdownMenuItem>
                  ) : null}
                  {workhubActions.add_note ? (
                    <DropdownMenuItem onSelect={() => setNoteOpen(true)}>
                      Add Project Note
                    </DropdownMenuItem>
                  ) : null}
                  {workhubActions.add_attachment ? (
                    <DropdownMenuItem onSelect={() => setAttachmentOpen(true)}>
                      Add Attachment (URL)
                    </DropdownMenuItem>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : null}
        </div>
      </div>

      {detail.costs ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-lg border border-primary/30 bg-primary/10 p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-primary">Contract Amount</div>
            <div className="mt-1 text-lg font-semibold text-foreground">{formatMoney(detail.costs.contractValue)}</div>
          </div>
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Received</div>
            <div className="mt-1 text-lg font-semibold text-emerald-900 dark:text-emerald-100">{formatMoney(detail.costs.receivedAmount)}</div>
            <div className="text-xs text-emerald-700 dark:text-emerald-300">{recoveryRatePct.toFixed(1)}% of contract</div>
          </div>
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">Pending Recovery</div>
            <div className="mt-1 text-lg font-semibold text-amber-900 dark:text-amber-100">{formatMoney(detail.costs.pendingRecovery)}</div>
            <div className="text-xs text-amber-800 dark:text-amber-200">{pendingRatePct.toFixed(1)}% of contract</div>
          </div>
          <div className="rounded-lg border border-sky-500/30 bg-sky-500/10 p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">Recovery Health</div>
            <div className="mt-1 text-lg font-semibold text-sky-900 dark:text-sky-100">
              {(100 - Math.min(100, pendingRatePct)).toFixed(1)}%
            </div>
            <div className="text-xs text-sky-700 dark:text-sky-300">Lower pending ratio means stronger cash recovery</div>
          </div>
        </div>
      ) : null}

      {detail.costs ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          <div className="rounded-xl border border-primary/25 bg-primary/10 p-4 shadow-sm">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-primary/90">Contract Amount</div>
            <div className="mt-2 text-2xl font-semibold text-foreground">{formatMoney(detail.costs.contractValue)}</div>
            <div className="mt-1 text-xs text-muted-foreground">Contracted project value</div>
          </div>

          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 shadow-sm">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Money In</div>
            <div className="mt-2 text-2xl font-semibold text-emerald-900 dark:text-emerald-100">
              {formatMoney(detail.costs.approvedIncomeReceived)}
            </div>
            <div className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">
              Pending: {formatMoney(detail.costs.pendingIncomeSubmitted)}
            </div>
          </div>

          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 shadow-sm">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-rose-700 dark:text-rose-300">Money Out</div>
            <div className="mt-2 text-2xl font-semibold text-rose-900 dark:text-rose-100">
              {formatMoney(detail.costs.costToDate)}
            </div>
            <div className="mt-1 text-xs text-rose-700 dark:text-rose-300">
              Pending: {formatMoney(detail.costs.pendingExpenseSubmitted)}
            </div>
          </div>

          <div
            className={`rounded-xl border p-4 shadow-sm ${
              detail.costs.projectProfit >= 0
                ? "border-emerald-500/30 bg-emerald-500/10"
                : "border-red-500/30 bg-red-500/10"
            }`}
          >
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Current Profit</div>
            <div className="mt-2 text-2xl font-semibold text-foreground">{formatMoney(detail.costs.projectProfit)}</div>
            <div className="mt-1 text-xs text-muted-foreground">Margin: {detail.costs.marginPercent.toFixed(1)}%</div>
          </div>

          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 shadow-sm">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">Cash to Recover</div>
            <div className="mt-2 text-2xl font-semibold text-amber-900 dark:text-amber-100">
              {formatMoney(detail.costs.pendingRecovery)}
            </div>
            <div className="mt-1 text-xs text-amber-800 dark:text-amber-200">
              Overdue: {formatMoney(detail.costs.risk.overdueRecoveryAmount)}
            </div>
          </div>

          <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-4 shadow-sm">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-indigo-800 dark:text-indigo-200">Vendor Outstanding</div>
            <div className="mt-2 text-2xl font-semibold text-indigo-900 dark:text-indigo-100">
              {formatMoney(detail.costs.apOutstanding)}
            </div>
            <div className="mt-1 text-xs text-indigo-700 dark:text-indigo-300">
              Billed {formatMoney(detail.costs.apBilledTotal)} / Paid {formatMoney(detail.costs.apPaidTotal)}
            </div>
          </div>
        </div>
      ) : null}

      {detail.costs ? (
        <ProjectExecutiveSummary costs={detail.costs} projectId={detail.header.projectId} />
      ) : null}

      {/* Work Hub dialogs (Phase 1 safe; no ad-hoc posting logic) */}
      <PurchaseOrderFormDialog
        open={poOpen}
        onOpenChange={setPoOpen}
        initialProjectRef={detail.header.projectId}
      />
      <GoodsReceiptFormDialog
        open={grnOpen}
        onOpenChange={setGrnOpen}
        initialProjectRef={detail.header.projectId}
      />
      <VendorBillFormDialog open={billOpen} onOpenChange={setBillOpen} initialProjectRef={detail.header.projectId} />

      <FormDialog open={assignOpen} onOpenChange={setAssignOpen} title="Assign People" description="Manage project members (audited).">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            (async () => {
              try {
                setSavingAssignments(true);
                await withLoadingToast(saveAssignments, { loading: "Saving...", success: "Saved" });
                setAssignOpen(false);
                router.refresh();
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Failed to save assignments");
              } finally {
                setSavingAssignments(false);
              }
            })();
          }}
          className="space-y-4"
        >
          <div className="max-h-[320px] overflow-auto rounded-md border p-3">
            {users.length === 0 ? (
              <div className="text-sm text-muted-foreground">No users found.</div>
            ) : (
              <div className="space-y-2">
                {users.map((u) => {
                  const checked = selectedUserIds.includes(u.id);
                  return (
                    <label key={u.id} className="flex items-center gap-3 text-sm">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          const next = e.target.checked;
                          setSelectedUserIds((prev) =>
                            next ? Array.from(new Set([...prev, u.id])) : prev.filter((id) => id !== u.id),
                          );
                        }}
                      />
                      <span className="min-w-0">
                        <span className="font-medium">{u.name || u.email}</span>{" "}
                        <span className="text-muted-foreground">({u.email})</span>
                        {u.role ? <span className="ml-2 text-xs text-muted-foreground">{u.role}</span> : null}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
          <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
            <Button type="button" variant="outline" onClick={() => setAssignOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={savingAssignments}>
              {savingAssignments ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>
      </FormDialog>

      <FormDialog open={noteOpen} onOpenChange={setNoteOpen} title="Add Project Note" description="Notes are stored as audited events (Phase 1).">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            (async () => {
              try {
                setSavingNote(true);
                await withLoadingToast(addNote, { loading: "Saving...", success: "Saved" });
                setNote("");
                setNoteOpen(false);
                router.refresh();
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Failed to add note");
              } finally {
                setSavingNote(false);
              }
            })();
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="projectNote">Note</Label>
            <textarea
              id="projectNote"
              className="min-h-[120px] w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Write a short project note..."
              required
            />
          </div>
          <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
            <Button type="button" variant="outline" onClick={() => setNoteOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={savingNote}>
              {savingNote ? "Saving..." : "Add"}
            </Button>
          </div>
        </form>
      </FormDialog>

      <FormDialog open={attachmentOpen} onOpenChange={setAttachmentOpen} title="Add Attachment (URL)" description="URL-only attachments (Phase 1).">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            (async () => {
              try {
                setSavingAttachment(true);
                await withLoadingToast(addAttachment, { loading: "Saving...", success: "Saved" });
                setAttachment({ fileName: "", url: "", mimeType: "", sizeBytes: "" });
                setAttachmentOpen(false);
                router.refresh();
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Failed to add attachment");
              } finally {
                setSavingAttachment(false);
              }
            })();
          }}
          className="space-y-4"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="attUrl">URL</Label>
              <Input id="attUrl" value={attachment.url} onChange={(e) => setAttachment((p) => ({ ...p, url: e.target.value }))} placeholder="https://..." required />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="attName">File name</Label>
              <Input id="attName" value={attachment.fileName} onChange={(e) => setAttachment((p) => ({ ...p, fileName: e.target.value }))} placeholder="invoice.pdf" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="attMime">MIME type (optional)</Label>
              <Input id="attMime" value={attachment.mimeType} onChange={(e) => setAttachment((p) => ({ ...p, mimeType: e.target.value }))} placeholder="application/pdf" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="attSize">Size bytes (optional)</Label>
              <Input id="attSize" value={attachment.sizeBytes} onChange={(e) => setAttachment((p) => ({ ...p, sizeBytes: e.target.value }))} placeholder="12345" />
            </div>
          </div>
          <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
            <Button type="button" variant="outline" onClick={() => setAttachmentOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={savingAttachment}>
              {savingAttachment ? "Saving..." : "Add"}
            </Button>
          </div>
        </form>
      </FormDialog>

      {/* Tabs: buttons on desktop, select on mobile */}
      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <div className="md:hidden">
          <label htmlFor="project-detail-tab-select" className="text-sm text-muted-foreground">
            Section
          </label>
          <select
            id="project-detail-tab-select"
            className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            value={active}
            onChange={(e) => setActive(e.target.value as ProjectDetailTab)}
          >
            {tabs.map((t) => (
              <option key={t} value={t}>
                {tabLabel(t)}
              </option>
            ))}
          </select>
        </div>
        <div className="hidden md:flex md:flex-wrap md:gap-2">
          {tabs.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setActive(t)}
              className={[
                "rounded-md border px-3 py-2 text-sm font-medium",
                active === t ? "border-foreground/20 bg-accent" : "border-border hover:bg-accent/60",
              ].join(" ")}
            >
              {tabLabel(t)}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {active === "activity" ? (
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Activity</h2>
          <p className="mt-1 text-sm text-muted-foreground">Chronological, source-linked events.</p>

          <div className="mt-6">
            <h3 className="text-sm font-semibold">Notes & Attachments</h3>
            <p className="mt-1 text-sm text-muted-foreground">Last 20 audited note/attachment events.</p>
            <div className="mt-3 space-y-3">
              {detail.notesHistory.length === 0 ? (
                <div className="text-sm text-muted-foreground">No notes or attachments yet.</div>
              ) : (
                detail.notesHistory.map((e, idx) => (
                  <div key={`${e.at}-${idx}`} className="flex items-start justify-between gap-4 border-b pb-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium">
                        {e.note ? "Note" : e.attachment ? "Attachment" : e.action}
                      </div>
                      {e.note ? <div className="mt-1 whitespace-pre-wrap text-sm">{e.note}</div> : null}
                      {e.attachment ? (
                        <div className="mt-1 text-sm">
                          <a className="underline underline-offset-2" href={e.attachment.url} target="_blank" rel="noreferrer">
                            {e.attachment.fileName}
                          </a>
                        </div>
                      ) : null}
                      <div className="mt-1 text-xs text-muted-foreground">{new Date(e.at).toLocaleString()}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {detail.activity.length === 0 ? (
              <div className="text-sm text-muted-foreground">No activity yet.</div>
            ) : (
              detail.activity.slice(0, 100).map((row, idx) => (
                <div key={`${row.at}-${idx}`} className="flex items-start justify-between gap-4 border-b pb-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium">
                      {row.href ? (
                        <Link className="underline underline-offset-2" href={row.href}>
                          {row.label}
                        </Link>
                      ) : (
                        row.label
                      )}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {new Date(row.at).toLocaleString()} {row.status ? `• ${row.status}` : ""}
                    </div>
                  </div>
                  <div className="text-right text-sm">
                    {typeof row.quantity === "number" ? (
                      <div className="font-medium">{row.quantity.toLocaleString()} qty</div>
                    ) : null}
                    {typeof row.amount === "number" ? (
                      <div className="font-medium">{formatMoney(row.amount)}</div>
                    ) : null}
                    {row.amount == null && (row.type === "BILL" || row.type === "PAYMENT" || row.type === "LEDGER" || row.type === "EXPENSE" || row.type === "INCOME") ? (
                      <div className="text-xs text-muted-foreground">Masked</div>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}

      {active === "costs" ? (
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Finance Summary</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Project totals are calculated from approved income, approved expenses, posted vendor bills, posted vendor payments, and non-draft invoices.
              </p>
            </div>
            <a
              href={`/api/reports/projects/${detail.header.id}/export`}
              className="rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-accent"
            >
              Export Project Finance CSV
            </a>
          </div>
          {!detail.costs ? (
            <div className="mt-4 text-sm text-muted-foreground">No access.</div>
          ) : (
            <>
              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-900 dark:bg-emerald-950/35">
                  <div className="text-xs font-medium text-emerald-700 dark:text-emerald-200">Money In (Approved)</div>
                  <div className="mt-2 text-lg font-semibold text-emerald-900 dark:text-emerald-100">{formatMoney(detail.costs.approvedIncomeReceived)}</div>
                </div>
                <div className="rounded-lg border border-rose-200 bg-rose-50/70 p-4 dark:border-rose-900 dark:bg-rose-950/30">
                  <div className="text-xs font-medium text-rose-800 dark:text-rose-200">Money Out (Total Cost)</div>
                  <div className="mt-2 text-lg font-semibold text-rose-900 dark:text-rose-100">{formatMoney(detail.costs.totalProjectCosts)}</div>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-900 dark:bg-amber-950/30">
                  <div className="text-xs font-medium text-amber-800 dark:text-amber-200">Cash to Recover</div>
                  <div className="mt-2 text-lg font-semibold text-amber-900 dark:text-amber-100">{formatMoney(detail.costs.pendingRecovery)}</div>
                </div>
                <div className="rounded-lg border border-indigo-200 bg-indigo-50/70 p-4 dark:border-indigo-900 dark:bg-indigo-950/30">
                  <div className="text-xs font-medium text-indigo-700 dark:text-indigo-200">Vendor Outstanding</div>
                  <div className="mt-2 text-lg font-semibold text-indigo-900 dark:text-indigo-100">{formatMoney(detail.costs.apOutstanding)}</div>
                </div>
                <div
                  className={`rounded-lg border p-4 ${
                    detail.costs.projectProfit >= 0
                      ? "border-emerald-200 bg-emerald-50/60"
                      : "border-red-200 bg-red-50/70"
                  }`}
                >
                  <div className="text-xs font-medium text-muted-foreground">Current Profit</div>
                  <div className="mt-2 text-lg font-semibold">{formatMoney(detail.costs.projectProfit)}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{detail.costs.marginPercent.toFixed(1)}% margin</div>
                </div>
              </div>

              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-900 dark:bg-amber-950/30">
                <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-100">Cash Risk Signals</h3>
                {detail.costs.risk.alerts.length === 0 ? (
                  <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-300">No critical cash risk alerts right now.</p>
                ) : (
                  <ul className="mt-2 space-y-1 text-sm text-amber-900 dark:text-amber-100">
                    {detail.costs.risk.alerts.map((alert, idx) => (
                      <li key={`${alert}-${idx}`}>• {alert}</li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="mt-4 grid gap-4 xl:grid-cols-3">
                <div className="rounded-lg border border-primary/30 bg-primary/10 p-4">
                  <h3 className="text-sm font-semibold text-sky-900 dark:text-sky-100">Revenue & Recovery</h3>
                  <div className="mt-3 space-y-2 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sky-800 dark:text-sky-200">Contract value</span>
                      <span className="font-semibold text-sky-900 dark:text-sky-100">{formatMoney(detail.costs.contractValue)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sky-800 dark:text-sky-200">Invoiced</span>
                      <span className="font-semibold text-sky-900 dark:text-sky-100">{formatMoney(detail.costs.invoicedAmount)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sky-800 dark:text-sky-200">Received (approved)</span>
                      <span className="font-semibold text-sky-900 dark:text-sky-100">{formatMoney(detail.costs.receivedAmount)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sky-800 dark:text-sky-200">Pending recovery</span>
                      <span className="font-semibold text-sky-900 dark:text-sky-100">{formatMoney(detail.costs.pendingRecovery)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sky-800 dark:text-sky-200">Invoice pending</span>
                      <span className="font-semibold text-sky-900 dark:text-sky-100">
                        {formatMoney(detail.costs.invoicedPendingRecovery)}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 text-xs">
                    <Link
                      className="font-medium text-sky-800 underline underline-offset-2"
                      href={`/income?search=${encodeURIComponent(detail.header.projectId)}`}
                    >
                      Open income entries
                    </Link>
                  </div>
                </div>

                <div className="rounded-lg border border-indigo-200 bg-indigo-50/50 p-4 dark:border-indigo-900 dark:bg-indigo-950/30">
                  <h3 className="text-sm font-semibold text-indigo-900 dark:text-indigo-100">Payables & Costs</h3>
                  <div className="mt-3 space-y-2 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-indigo-700 dark:text-indigo-300">AP billed (posted)</span>
                      <span className="font-semibold text-indigo-900 dark:text-indigo-100">{formatMoney(detail.costs.apBilledTotal)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-indigo-700 dark:text-indigo-300">AP paid (posted)</span>
                      <span className="font-semibold text-indigo-900 dark:text-indigo-100">{formatMoney(detail.costs.apPaidTotal)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-indigo-700 dark:text-indigo-300">AP outstanding</span>
                      <span className="font-semibold text-indigo-900 dark:text-indigo-100">{formatMoney(detail.costs.apOutstanding)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-indigo-700 dark:text-indigo-300">Non-stock approved</span>
                      <span className="font-semibold text-indigo-900 dark:text-indigo-100">{formatMoney(detail.costs.nonStockExpensesApproved)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-indigo-700 dark:text-indigo-300">Incentives</span>
                      <span className="font-semibold text-indigo-900 dark:text-indigo-100">{formatMoney(detail.costs.incentivesApproved)}</span>
                    </div>
                  </div>
                  <div className="mt-3 text-xs">
                    <Link
                      className="font-medium text-indigo-700 dark:text-indigo-300 underline underline-offset-2"
                      href={`/procurement/vendor-bills?search=${encodeURIComponent(detail.header.projectId)}`}
                    >
                      Open vendor bills
                    </Link>
                    <span className="mx-1 text-indigo-700">•</span>
                    <Link
                      className="font-medium text-indigo-700 dark:text-indigo-300 underline underline-offset-2"
                      href={`/procurement/vendor-payments?search=${encodeURIComponent(detail.header.projectId)}`}
                    >
                      Open vendor payments
                    </Link>
                  </div>
                </div>

                <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-900 dark:bg-emerald-950/30">
                  <h3 className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">Profitability View</h3>
                  <div className="mt-3 space-y-2 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-emerald-700 dark:text-emerald-300">Total project costs</span>
                      <span className="font-semibold text-emerald-900">{formatMoney(detail.costs.totalProjectCosts)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-emerald-700 dark:text-emerald-300">Current profit</span>
                      <span className="font-semibold text-emerald-900">{formatMoney(detail.costs.projectProfit)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-emerald-700 dark:text-emerald-300">Gross margin</span>
                      <span className="font-semibold text-emerald-900">{formatMoney(detail.costs.grossMargin)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-emerald-700 dark:text-emerald-300">Margin %</span>
                      <span className="font-semibold text-emerald-900">{detail.costs.marginPercent.toFixed(1)}%</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-emerald-700 dark:text-emerald-300">Pending expenses</span>
                      <span className="font-semibold text-emerald-900">{formatMoney(detail.costs.pendingExpenseSubmitted)}</span>
                    </div>
                  </div>
                  <div className="mt-3 text-xs">
                    <Link
                      className="font-medium text-emerald-700 dark:text-emerald-300 underline underline-offset-2"
                      href={`/expenses/by-project?project=${encodeURIComponent(detail.header.projectId)}`}
                    >
                      Open expenses
                    </Link>
                  </div>
                </div>
              </div>

              {detail.incentives && incentivePermissions.canView ? (
                <div className="mt-6 rounded-lg border border-border bg-background/60 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold">Project Incentives</h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Queue for incentive entries tied to this project. Approval posts cost automatically.
                      </p>
                    </div>
                    {incentivePermissions.canEdit ? (
                      <Button size="sm" onClick={() => setIncentiveDialogOpen(true)}>
                        Add Incentive
                      </Button>
                    ) : null}
                  </div>
                  <div className="mt-3 hidden overflow-x-auto md:block">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="py-2">Date</th>
                          <th className="py-2">Employee</th>
                          <th className="py-2">Formula</th>
                          <th className="py-2">Payout</th>
                          <th className="py-2">Amount</th>
                          <th className="py-2">Status</th>
                          <th className="py-2">Settlement</th>
                          {canManageIncentives ? <th className="py-2">Actions</th> : null}
                        </tr>
                      </thead>
                      <tbody>
                        {incentives.length === 0 ? (
                          <tr>
                            <td className="py-4 text-muted-foreground" colSpan={canManageIncentives ? 8 : 7}>
                              No incentives recorded for this project.
                            </td>
                          </tr>
                        ) : (
                          incentives.map((row) => (
                            <tr key={row.id} className="border-b">
                              <td className="py-2">{new Date(row.createdAt).toLocaleDateString()}</td>
                              <td className="py-2">
                                <div className="font-medium">{row.employeeName}</div>
                                <div className="text-xs text-muted-foreground">{row.employeeEmail}</div>
                              </td>
                              <td className="py-2">{row.formulaType || "FIXED"}</td>
                              <td className="py-2">{row.payoutMode}</td>
                              <td className="py-2">{formatMoney(row.amount)}</td>
                              <td className="py-2">{row.status}</td>
                              <td className="py-2">{row.settlementStatus}</td>
                              {canManageIncentives ? (
                                <td className="py-2">
                                  <div className="flex flex-wrap gap-2">
                                    {incentivePermissions.canApprove && row.status !== "APPROVED" ? (
                                      <Button
                                        size="sm"
                                        onClick={() => updateIncentiveStatus(row.id, "APPROVED")}
                                        disabled={incentiveBusyId === row.id}
                                      >
                                        {incentiveBusyId === row.id ? "Processing..." : "Approve"}
                                      </Button>
                                    ) : null}
                                    {incentivePermissions.canApprove && row.status === "PENDING" ? (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => updateIncentiveStatus(row.id, "REJECTED")}
                                        disabled={incentiveBusyId === row.id}
                                      >
                                        Reject
                                      </Button>
                                    ) : null}
                                  </div>
                                </td>
                              ) : null}
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-3 space-y-3 md:hidden">
                    {incentives.length === 0 ? (
                      <div className="text-sm text-muted-foreground">No incentives recorded for this project.</div>
                    ) : (
                      incentives.map((row) => (
                        <MobileCard
                          key={row.id}
                          title={row.employeeName}
                          subtitle={new Date(row.createdAt).toLocaleDateString()}
                          fields={[
                            { label: "Formula", value: row.formulaType || "FIXED" },
                            { label: "Payout", value: row.payoutMode },
                            { label: "Amount", value: formatMoney(row.amount) },
                            { label: "Status", value: row.status },
                            { label: "Settlement", value: row.settlementStatus },
                          ]}
                          actions={
                            incentivePermissions.canApprove ? (
                              <div className="flex w-full gap-2">
                                {row.status !== "APPROVED" ? (
                                  <Button
                                    size="sm"
                                    className="flex-1"
                                    onClick={() => updateIncentiveStatus(row.id, "APPROVED")}
                                    disabled={incentiveBusyId === row.id}
                                  >
                                    Approve
                                  </Button>
                                ) : null}
                                {row.status === "PENDING" ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="flex-1"
                                    onClick={() => updateIncentiveStatus(row.id, "REJECTED")}
                                    disabled={incentiveBusyId === row.id}
                                  >
                                    Reject
                                  </Button>
                                ) : null}
                              </div>
                            ) : null
                          }
                        />
                      ))
                    )}
                  </div>
                </div>
              ) : null}

              <div className="mt-6">
                <h3 className="text-sm font-semibold">Financial transactions</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Income, expense, bill, and payment trail for this project.
                </p>
                <div className="mt-3 hidden overflow-x-auto md:block">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="py-2">Date</th>
                        <th className="py-2">Type</th>
                        <th className="py-2">Reference</th>
                        <th className="py-2">Status</th>
                        <th className="py-2">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {financeTransactions.length === 0 ? (
                        <tr>
                          <td className="py-4 text-muted-foreground" colSpan={5}>
                            No financial transactions found.
                          </td>
                        </tr>
                      ) : (
                        financeTransactions.map((row, idx) => (
                          <tr key={`${row.at}-${row.type}-${idx}`} className="border-b">
                            <td className="py-2">{new Date(row.at).toLocaleString()}</td>
                            <td className="py-2">{row.type}</td>
                            <td className="py-2">
                              {row.href ? (
                                <Link className="underline underline-offset-2" href={row.href}>
                                  {row.label}
                                </Link>
                              ) : (
                                row.label
                              )}
                            </td>
                            <td className="py-2">{row.status || "-"}</td>
                            <td className="py-2">{typeof row.amount === "number" ? formatMoney(row.amount) : "-"}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="mt-3 space-y-3 md:hidden">
                  {financeTransactions.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No financial transactions found.</div>
                  ) : (
                    financeTransactions.map((row, idx) => (
                      <MobileCard
                        key={`${row.at}-${row.type}-${idx}`}
                        title={row.label}
                        subtitle={new Date(row.at).toLocaleString()}
                        fields={[
                          { label: "Type", value: row.type },
                          { label: "Status", value: row.status || "-" },
                          {
                            label: "Amount",
                            value: typeof row.amount === "number" ? formatMoney(row.amount) : "-",
                          },
                          { label: "Reference", value: row.href ? <Link href={row.href}>Open</Link> : "-" },
                        ]}
                      />
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      ) : null}

      {active === "inventory" ? (
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Inventory</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Stock movements and material usage allocated to this project.
          </p>
          {!detail.inventory ? (
            <div className="mt-4 text-sm text-muted-foreground">No access.</div>
          ) : (
            <>
              {detail.inventory.note ? (
                <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:text-amber-100">
                  {detail.inventory.note}
                </div>
              ) : null}
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <div className="rounded-lg border p-4">
                  <div className="text-xs text-muted-foreground">Issued to project</div>
                  <div className="mt-2 text-lg font-semibold">{inventoryTrace.issuedQty.toLocaleString()}</div>
                </div>
                <div className="rounded-lg border p-4">
                  <div className="text-xs text-muted-foreground">Returned from project</div>
                  <div className="mt-2 text-lg font-semibold">{inventoryTrace.returnedQty.toLocaleString()}</div>
                </div>
                <div className="rounded-lg border p-4">
                  <div className="text-xs text-muted-foreground">Net movement</div>
                  <div className="mt-2 text-lg font-semibold">{inventoryTrace.netQty.toLocaleString()}</div>
                </div>
              </div>

              {detail.inventory.totals ? (
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div className="rounded-lg border p-4">
                    <div className="text-xs text-muted-foreground">Total quantity (net)</div>
                    <div className="mt-2 text-lg font-semibold">
                      {detail.inventory.totals.quantity.toLocaleString()}
                    </div>
                  </div>
                  <div className="rounded-lg border p-4">
                    <div className="text-xs text-muted-foreground">Total value (net)</div>
                    <div className="mt-2 text-lg font-semibold">
                      {formatMoney(detail.inventory.totals.value)}
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="mt-4 hidden overflow-x-auto md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="py-2">Date</th>
                      <th className="py-2">Item</th>
                      <th className="py-2">Qty</th>
                      <th className="py-2">Unit</th>
                      <th className="py-2">Ref</th>
                      {detail.policy.canViewUnitCosts ? <th className="py-2">Unit Cost</th> : null}
                      {detail.policy.canViewUnitCosts ? <th className="py-2">Total</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {detail.inventory.entries.map((e) => (
                      <tr key={e.id} className="border-b">
                        <td className="py-2">{e.date}</td>
                        <td className="py-2">{e.itemName}</td>
                        <td className="py-2">{e.quantity.toLocaleString()}</td>
                        <td className="py-2">{e.unit}</td>
                        <td className="py-2">
                          {e.href ? (
                            <Link className="underline underline-offset-2" href={e.href}>
                              {e.reference || "View"}
                            </Link>
                          ) : (
                            e.reference || "-"
                          )}
                        </td>
                        {detail.policy.canViewUnitCosts ? <td className="py-2">{formatMoney(Number(e.unitCost || 0))}</td> : null}
                        {detail.policy.canViewUnitCosts ? <td className="py-2">{formatMoney(Number(e.total || 0))}</td> : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 space-y-3 md:hidden">
                {detail.inventory.entries.map((e) => (
                  <MobileCard
                    key={e.id}
                    title={e.itemName}
                    subtitle={`${e.date} • ${e.reference || "No ref"}`}
                    fields={[
                      { label: "Quantity", value: e.quantity.toLocaleString() },
                      { label: "Unit", value: e.unit },
                      {
                        label: "Reference",
                        value: e.href ? <Link href={e.href}>Open</Link> : e.reference || "-",
                      },
                      {
                        label: "Value",
                        value: detail.policy.canViewUnitCosts ? formatMoney(Number(e.total || 0)) : "Masked",
                      },
                    ]}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      ) : null}

      {active === "people" ? (
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold">People</h2>
          <p className="mt-1 text-sm text-muted-foreground">Project assignments (role-filtered).</p>
          {!detail.people ? (
            <div className="mt-4 text-sm text-muted-foreground">No access.</div>
          ) : (
            <>
              <div className="mt-4 hidden overflow-x-auto md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="py-2">Name</th>
                      <th className="py-2">Email</th>
                      <th className="py-2">Role</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.people.map((p) => (
                      <tr key={p.id} className="border-b">
                        <td className="py-2">{p.name}</td>
                        <td className="py-2">{p.email}</td>
                        <td className="py-2">{p.role}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 space-y-3 md:hidden">
                {detail.people.map((p) => (
                  <MobileCard
                    key={p.id}
                    title={p.name}
                    subtitle={p.email}
                    fields={[{ label: "Role", value: p.role }]}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      ) : null}

      {active === "execution" ? (
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Execution</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Track project tasks, ownership, due dates, and completion progress.
              </p>
            </div>
          </div>
          {!detail.execution ? (
            <div className="mt-4 text-sm text-muted-foreground">No access.</div>
          ) : (
            <>
              <div className="mt-4 grid gap-4 md:grid-cols-6">
                <div className="rounded-lg border border-primary/30 bg-primary/10 p-3">
                  <div className="text-xs text-sky-700">Total</div>
                  <div className="mt-1 text-lg font-semibold text-sky-900">{detail.execution.summary.total}</div>
                </div>
                <div className="rounded-lg border border-border bg-muted/40 p-3">
                  <div className="text-xs text-muted-foreground">To Do</div>
                  <div className="mt-1 text-lg font-semibold text-foreground">{detail.execution.summary.todo}</div>
                </div>
                <div className="rounded-lg border border-indigo-200 bg-indigo-50/60 p-3">
                  <div className="text-xs text-indigo-700">In Progress</div>
                  <div className="mt-1 text-lg font-semibold text-indigo-900 dark:text-indigo-100">{detail.execution.summary.inProgress}</div>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3">
                  <div className="text-xs text-amber-700">Blocked</div>
                  <div className="mt-1 text-lg font-semibold text-amber-900 dark:text-amber-100">{detail.execution.summary.blocked}</div>
                </div>
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3">
                  <div className="text-xs text-emerald-700">Done</div>
                  <div className="mt-1 text-lg font-semibold text-emerald-900">{detail.execution.summary.done}</div>
                </div>
                <div className="rounded-lg border border-rose-200 bg-rose-50/70 p-3">
                  <div className="text-xs text-rose-700">Overdue Open</div>
                  <div className="mt-1 text-lg font-semibold text-rose-900">{detail.execution.summary.overdueOpen}</div>
                </div>
              </div>

              {canCreateTasks ? (
                <form
                  className="mt-4 rounded-lg border p-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    (async () => {
                      try {
                        setSavingTask(true);
                        await withLoadingToast(createTask, { loading: "Creating task...", success: "Task created" });
                        setTaskForm({ title: "", description: "", priority: "MEDIUM", dueDate: "", assignedToId: "" });
                        router.refresh();
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : "Failed to create task");
                      } finally {
                        setSavingTask(false);
                      }
                    })();
                  }}
                >
                  <div className="mb-3 text-sm font-semibold">Create Task</div>
                  <div className="grid gap-3 md:grid-cols-6">
                    <input
                      className="rounded-md border border-border bg-background px-3 py-2 text-sm md:col-span-2"
                      placeholder="Task title"
                      value={taskForm.title}
                      onChange={(e) => setTaskForm((prev) => ({ ...prev, title: e.target.value }))}
                      required
                    />
                    <input
                      className="rounded-md border border-border bg-background px-3 py-2 text-sm md:col-span-2"
                      placeholder="Description (optional)"
                      value={taskForm.description}
                      onChange={(e) => setTaskForm((prev) => ({ ...prev, description: e.target.value }))}
                    />
                    <select
                      className="rounded-md border border-border bg-background px-3 py-2 text-sm"
                      value={taskForm.priority}
                      onChange={(e) => setTaskForm((prev) => ({ ...prev, priority: e.target.value }))}
                    >
                      <option value="LOW">LOW</option>
                      <option value="MEDIUM">MEDIUM</option>
                      <option value="HIGH">HIGH</option>
                      <option value="CRITICAL">CRITICAL</option>
                    </select>
                    <input
                      type="date"
                      className="rounded-md border border-border bg-background px-3 py-2 text-sm"
                      value={taskForm.dueDate}
                      onChange={(e) => setTaskForm((prev) => ({ ...prev, dueDate: e.target.value }))}
                    />
                    <select
                      className="rounded-md border border-border bg-background px-3 py-2 text-sm md:col-span-2"
                      value={taskForm.assignedToId}
                      onChange={(e) => setTaskForm((prev) => ({ ...prev, assignedToId: e.target.value }))}
                    >
                      <option value="">Unassigned</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {(u.name || u.email) + (u.role ? ` (${u.role})` : "")}
                        </option>
                      ))}
                    </select>
                    <div className="md:col-span-4" />
                    <Button type="submit" size="sm" disabled={savingTask} className="md:col-span-2">
                      {savingTask ? "Creating..." : "Add Task"}
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="mt-4 rounded-lg border border-border/70 bg-muted/20 p-3 text-xs text-muted-foreground">
                  Task creation is restricted for your role. You can still update tasks assigned to you.
                </div>
              )}

              <div className="mt-4 hidden overflow-x-auto md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="py-2">Task</th>
                      <th className="py-2">Assignee</th>
                      <th className="py-2">Priority</th>
                      <th className="py-2">Status</th>
                      <th className="py-2">Progress</th>
                      <th className="py-2">Due Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.execution.tasks.length === 0 ? (
                      <tr>
                        <td className="py-4 text-muted-foreground" colSpan={6}>
                          No execution tasks yet.
                        </td>
                      </tr>
                    ) : (
                      detail.execution.tasks.map((task) => (
                        <tr key={task.id} className="border-b">
                          <td className="py-2">
                            <div className="font-medium">{task.title}</div>
                            {task.description ? (
                              <div className="text-xs text-muted-foreground">{task.description}</div>
                            ) : null}
                          </td>
                          <td className="py-2">{task.assignedTo?.name || "-"}</td>
                          <td className="py-2">{task.priority}</td>
                          <td className="py-2">
                            <select
                              className="rounded-md border border-border bg-background px-2 py-1 text-xs"
                              value={task.status}
                              onChange={(e) => {
                                (async () => {
                                  try {
                                    setUpdatingTaskId(task.id);
                                    await updateTask(task.id, { status: e.target.value });
                                    router.refresh();
                                  } catch (err) {
                                    toast.error(err instanceof Error ? err.message : "Failed to update task");
                                  } finally {
                                    setUpdatingTaskId(null);
                                  }
                                })();
                              }}
                              disabled={!canUpdateExecutionTasks || updatingTaskId === task.id}
                            >
                              <option value="TODO">TODO</option>
                              <option value="IN_PROGRESS">IN_PROGRESS</option>
                              <option value="BLOCKED">BLOCKED</option>
                              <option value="DONE">DONE</option>
                              <option value="CANCELLED">CANCELLED</option>
                            </select>
                          </td>
                          <td className="py-2">
                            <input
                              type="number"
                              min={0}
                              max={100}
                              className="w-20 rounded-md border border-border bg-background px-2 py-1 text-xs"
                              defaultValue={task.progress}
                              onBlur={(e) => {
                                const next = Number(e.target.value || 0);
                                if (Number.isNaN(next)) return;
                                (async () => {
                                  try {
                                    setUpdatingTaskId(task.id);
                                    await updateTask(task.id, { progress: Math.max(0, Math.min(100, next)) });
                                    router.refresh();
                                  } catch (err) {
                                    toast.error(err instanceof Error ? err.message : "Failed to update progress");
                                  } finally {
                                    setUpdatingTaskId(null);
                                  }
                                })();
                              }}
                              disabled={!canUpdateExecutionTasks || updatingTaskId === task.id}
                            />
                          </td>
                          <td className="py-2">
                            <input
                              type="date"
                              className="rounded-md border border-border bg-background px-2 py-1 text-xs"
                              defaultValue={task.dueDate || ""}
                              onBlur={(e) => {
                                (async () => {
                                  try {
                                    setUpdatingTaskId(task.id);
                                    await updateTask(task.id, { dueDate: e.target.value || "" });
                                    router.refresh();
                                  } catch (err) {
                                    toast.error(err instanceof Error ? err.message : "Failed to update due date");
                                  } finally {
                                    setUpdatingTaskId(null);
                                  }
                                })();
                              }}
                              disabled={!canManageTasks || updatingTaskId === task.id}
                            />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 space-y-3 md:hidden">
                {detail.execution.tasks.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No execution tasks yet.</div>
                ) : (
                  detail.execution.tasks.map((task) => (
                    <MobileCard
                      key={task.id}
                      title={task.title}
                      subtitle={task.assignedTo?.name || "Unassigned"}
                      fields={[
                        { label: "Priority", value: task.priority },
                        { label: "Status", value: task.status },
                        { label: "Progress", value: `${task.progress}%` },
                        { label: "Due", value: task.dueDate || "-" },
                      ]}
                      actions={
                        <div className="grid w-full grid-cols-1 gap-2">
                          <select
                            className="w-full rounded-md border border-border bg-background px-2 py-2 text-xs"
                            value={task.status}
                            onChange={(e) => {
                              (async () => {
                                try {
                                  setUpdatingTaskId(task.id);
                                  await updateTask(task.id, { status: e.target.value });
                                  router.refresh();
                                } catch (err) {
                                  toast.error(err instanceof Error ? err.message : "Failed to update task");
                                } finally {
                                  setUpdatingTaskId(null);
                                }
                              })();
                            }}
                            disabled={!canUpdateExecutionTasks || updatingTaskId === task.id}
                          >
                            <option value="TODO">TODO</option>
                            <option value="IN_PROGRESS">IN_PROGRESS</option>
                            <option value="BLOCKED">BLOCKED</option>
                            <option value="DONE">DONE</option>
                            <option value="CANCELLED">CANCELLED</option>
                          </select>
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="number"
                              min={0}
                              max={100}
                              className="w-full rounded-md border border-border bg-background px-2 py-2 text-xs"
                              defaultValue={task.progress}
                              onBlur={(e) => {
                                const next = Number(e.target.value || 0);
                                if (Number.isNaN(next)) return;
                                (async () => {
                                  try {
                                    setUpdatingTaskId(task.id);
                                    await updateTask(task.id, { progress: Math.max(0, Math.min(100, next)) });
                                    router.refresh();
                                  } catch (err) {
                                    toast.error(err instanceof Error ? err.message : "Failed to update progress");
                                  } finally {
                                    setUpdatingTaskId(null);
                                  }
                                })();
                              }}
                              disabled={!canUpdateExecutionTasks || updatingTaskId === task.id}
                            />
                            <input
                              type="date"
                              className="w-full rounded-md border border-border bg-background px-2 py-2 text-xs"
                              defaultValue={task.dueDate || ""}
                              onBlur={(e) => {
                                (async () => {
                                  try {
                                    setUpdatingTaskId(task.id);
                                    await updateTask(task.id, { dueDate: e.target.value || "" });
                                    router.refresh();
                                  } catch (err) {
                                    toast.error(err instanceof Error ? err.message : "Failed to update due date");
                                  } finally {
                                    setUpdatingTaskId(null);
                                  }
                                })();
                              }}
                              disabled={!canManageTasks || updatingTaskId === task.id}
                            />
                          </div>
                        </div>
                      }
                    />
                  ))
                )}
              </div>
            </>
          )}
        </div>
      ) : null}

      {active === "documents" ? (
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Documents</h2>
          <p className="mt-1 text-sm text-muted-foreground">Phase 1 spine documents for this project.</p>
          {!detail.documents ? (
            <div className="mt-4 text-sm text-muted-foreground">No access.</div>
          ) : (
            <>
              <div className="mt-4 hidden overflow-x-auto md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="py-2">Type</th>
                      <th className="py-2">Number</th>
                      <th className="py-2">Status</th>
                      <th className="py-2">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.documents.map((d) => (
                      <tr key={`${d.type}-${d.number}`} className="border-b">
                        <td className="py-2">{d.type}</td>
                        <td className="py-2">
                          <Link className="underline underline-offset-2" href={d.href}>
                            {d.number}
                          </Link>
                        </td>
                        <td className="py-2">{d.status}</td>
                        <td className="py-2">{d.date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {detail.documents.length === 0 ? (
                  <div className="py-6 text-center text-sm text-muted-foreground">No documents found.</div>
                ) : null}
              </div>
              <div className="mt-4 space-y-3 md:hidden">
                {detail.documents.map((d) => (
                  <MobileCard
                    key={`${d.type}-${d.number}`}
                    title={d.number}
                    subtitle={d.type}
                    href={d.href}
                    fields={[
                      { label: "Status", value: d.status },
                      { label: "Date", value: d.date },
                    ]}
                  />
                ))}
                {detail.documents.length === 0 ? (
                  <div className="py-6 text-center text-sm text-muted-foreground">No documents found.</div>
                ) : null}
              </div>
            </>
          )}
        </div>
      ) : null}

      {detail.incentives && incentivePermissions.canEdit ? (
        <IncentiveFormDialog
          open={incentiveDialogOpen}
          onOpenChange={setIncentiveDialogOpen}
          employees={detail.incentives.employeeOptions}
          defaultProjectRef={detail.header.projectId}
          lockProjectRef
        />
      ) : null}
    </div>
  );
}
