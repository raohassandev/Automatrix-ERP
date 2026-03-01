"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatMoney } from "@/lib/format";
import type { ProjectDetailData, ProjectDetailTab } from "@/lib/project-detail-policy";
import { buildProjectWorkhubPolicy } from "@/lib/project-workhub-policy";
import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/FormDialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PurchaseOrderFormDialog } from "@/components/PurchaseOrderFormDialog";
import { GoodsReceiptFormDialog } from "@/components/GoodsReceiptFormDialog";
import { VendorBillFormDialog } from "@/components/VendorBillFormDialog";
import { withLoadingToast } from "@/lib/withLoadingToast";

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
    case "documents":
      return "Documents";
  }
}

export function ProjectDetailClient({ detail }: { detail: ProjectDetailData }) {
  const router = useRouter();
  const tabs = (Object.keys(detail.policy.tabs) as ProjectDetailTab[]).filter(
    (t) => detail.policy.tabs[t],
  );
  const [active, setActive] = React.useState<ProjectDetailTab>(tabs[0] || "activity");
  const workhub = buildProjectWorkhubPolicy(detail.policy.role);

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

  const anyActions = Object.values(workhub.actions).some(Boolean);

  return (
    <div className="grid gap-6">
      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="text-sm text-muted-foreground">{detail.header.projectId}</div>
            <h1 className="mt-1 truncate text-2xl font-semibold">{detail.header.name}</h1>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span>
                Client:{" "}
                <Link className="underline underline-offset-2" href={`/clients?search=${encodeURIComponent(detail.header.client.name)}`}>
                  {detail.header.client.name}
                </Link>
              </span>
              <span>Status: {detail.header.status}</span>
              <span>Start: {detail.header.startDate}</span>
              <span>End: {detail.header.endDate || "-"}</span>
              <span>
                Manager:{" "}
                {detail.header.manager ? (
                  <span className="text-foreground">{detail.header.manager.name}</span>
                ) : (
                  "-"
                )}
              </span>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            Role: <span className="font-medium text-foreground">{detail.policy.role}</span>
          </div>
          {anyActions ? (
            <div className="md:ml-4">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" data-testid="workhub-actions-button">
                    Actions
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {workhub.actions.create_po ? (
                    <DropdownMenuItem onSelect={() => setPoOpen(true)}>
                      Create Purchase Order for this Project
                    </DropdownMenuItem>
                  ) : null}
                  {workhub.actions.receive_grn ? (
                    <DropdownMenuItem onSelect={() => setGrnOpen(true)}>
                      Receive Goods (GRN) for this Project
                    </DropdownMenuItem>
                  ) : null}
                  {workhub.actions.create_vendor_bill ? (
                    <DropdownMenuItem onSelect={() => setBillOpen(true)}>
                      Create Vendor Bill for this Project
                    </DropdownMenuItem>
                  ) : null}
                  {workhub.actions.assign_people ? (
                    <DropdownMenuItem onSelect={() => setAssignOpen(true)}>
                      Assign People to Project
                    </DropdownMenuItem>
                  ) : null}
                  {workhub.actions.add_note ? (
                    <DropdownMenuItem onSelect={() => setNoteOpen(true)}>
                      Add Project Note
                    </DropdownMenuItem>
                  ) : null}
                  {workhub.actions.add_attachment ? (
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
          <div className="flex justify-end gap-2">
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
          <div className="flex justify-end gap-2">
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
          <div className="flex justify-end gap-2">
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
          <label className="text-sm text-muted-foreground">Section</label>
          <select
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
          <h2 className="text-lg font-semibold">Costs</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Phase 1 truth: posted AP bills + approved non-stock expenses (including incentives) against approved project income.
          </p>
          {!detail.costs ? (
            <div className="mt-4 text-sm text-muted-foreground">No access.</div>
          ) : (
            <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-lg border p-4">
                <div className="text-xs text-muted-foreground">AP billed (posted)</div>
                <div className="mt-2 text-lg font-semibold">{formatMoney(detail.costs.apBilledTotal)}</div>
              </div>
              <div className="rounded-lg border p-4">
                <div className="text-xs text-muted-foreground">AP paid (posted allocations)</div>
                <div className="mt-2 text-lg font-semibold">{formatMoney(detail.costs.apPaidTotal)}</div>
              </div>
              <div className="rounded-lg border p-4">
                <div className="text-xs text-muted-foreground">AP outstanding</div>
                <div className="mt-2 text-lg font-semibold">{formatMoney(detail.costs.apOutstanding)}</div>
              </div>
              <div className="rounded-lg border p-4">
                <div className="text-xs text-muted-foreground">Non-stock expenses (approved)</div>
                <div className="mt-2 text-lg font-semibold">{formatMoney(detail.costs.nonStockExpensesApproved)}</div>
              </div>
              <div className="rounded-lg border p-4">
                <div className="text-xs text-muted-foreground">Incentives (approved)</div>
                <div className="mt-2 text-lg font-semibold">{formatMoney(detail.costs.incentivesApproved)}</div>
              </div>
              <div className="rounded-lg border p-4">
                <div className="text-xs text-muted-foreground">Other non-stock expenses (approved)</div>
                <div className="mt-2 text-lg font-semibold">{formatMoney(detail.costs.otherNonStockExpensesApproved)}</div>
              </div>
              <div className="rounded-lg border p-4">
                <div className="text-xs text-muted-foreground">Pending expenses (submitted)</div>
                <div className="mt-2 text-lg font-semibold">{formatMoney(detail.costs.pendingExpenseSubmitted)}</div>
              </div>
              <div className="rounded-lg border p-4">
                <div className="text-xs text-muted-foreground">Project income (approved)</div>
                <div className="mt-2 text-lg font-semibold">{formatMoney(detail.costs.approvedIncomeReceived)}</div>
              </div>
              <div className="rounded-lg border p-4">
                <div className="text-xs text-muted-foreground">Pending income (submitted)</div>
                <div className="mt-2 text-lg font-semibold">{formatMoney(detail.costs.pendingIncomeSubmitted)}</div>
              </div>
              <div className="rounded-lg border p-4">
                <div className="text-xs text-muted-foreground">Total project costs (posted AP + approved expenses)</div>
                <div className="mt-2 text-lg font-semibold">{formatMoney(detail.costs.totalProjectCosts)}</div>
              </div>
              <div className="rounded-lg border p-4">
                <div className="text-xs text-muted-foreground">Project profit (approved income - total project costs)</div>
                <div className="mt-2 text-lg font-semibold">{formatMoney(detail.costs.projectProfit)}</div>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {active === "inventory" ? (
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Inventory</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Movements are sourced from InventoryLedger (Phase 1 stock truth).
          </p>
          {!detail.inventory ? (
            <div className="mt-4 text-sm text-muted-foreground">No access.</div>
          ) : (
            <>
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

              <div className="mt-4 overflow-x-auto">
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
            <div className="mt-4 overflow-x-auto">
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
            <div className="mt-4 overflow-x-auto">
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
          )}
        </div>
      ) : null}
    </div>
  );
}
