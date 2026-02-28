"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatMoney } from "@/lib/format";
import type { VendorDetailData, VendorDetailTab } from "@/lib/vendor-detail-policy";
import { buildVendorWorkhubPolicy } from "@/lib/vendor-workhub-policy";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/FormDialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { PurchaseOrderFormDialog } from "@/components/PurchaseOrderFormDialog";
import { VendorBillFormDialog } from "@/components/VendorBillFormDialog";
import { VendorPaymentFormDialog } from "@/components/VendorPaymentFormDialog";
import { withLoadingToast } from "@/lib/withLoadingToast";

function tabLabel(tab: VendorDetailTab) {
  switch (tab) {
    case "activity":
      return "Activity";
    case "bills":
      return "Bills";
    case "payments":
      return "Payments";
    case "aging":
      return "Aging";
    case "documents":
      return "Documents";
  }
}

export function VendorDetailClient({ detail }: { detail: VendorDetailData }) {
  const router = useRouter();
  const tabs = (Object.keys(detail.policy.tabs) as VendorDetailTab[]).filter((t) => detail.policy.tabs[t]);
  const [active, setActive] = React.useState<VendorDetailTab>(tabs[0] || "activity");
  const workhub = buildVendorWorkhubPolicy(detail.policy.role);

  const [poOpen, setPoOpen] = React.useState(false);
  const [billOpen, setBillOpen] = React.useState(false);
  const [paymentOpen, setPaymentOpen] = React.useState(false);
  const [noteOpen, setNoteOpen] = React.useState(false);
  const [attachmentOpen, setAttachmentOpen] = React.useState(false);

  const [note, setNote] = React.useState("");
  const [attachment, setAttachment] = React.useState({ fileName: "", url: "", mimeType: "", sizeBytes: "" });
  const [savingNote, setSavingNote] = React.useState(false);
  const [savingAttachment, setSavingAttachment] = React.useState(false);

  React.useEffect(() => {
    if (!detail.policy.tabs[active]) {
      setActive(tabs[0] || "activity");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail.policy.role]);

  async function addNote() {
    const res = await fetch(`/api/vendors/${detail.header.id}/notes`, {
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
    const res = await fetch(`/api/vendors/${detail.header.id}/attachments`, {
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
            <h1 className="truncate text-2xl font-semibold">{detail.header.name}</h1>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span>Status: {detail.header.status}</span>
              <span>Terms: {detail.header.paymentTermsLabel}</span>
              <span>Attachments: {detail.header.attachmentsCount}</span>
            </div>
            <div className="mt-3 grid gap-2 text-sm md:grid-cols-2">
              <div>
                <div className="text-xs text-muted-foreground">Contact</div>
                <div className="mt-1">{detail.header.contactName || "-"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Phone</div>
                <div className="mt-1">{detail.header.phone || "-"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Email</div>
                <div className="mt-1">{detail.header.email || "-"}</div>
              </div>
              <div className="md:col-span-2">
                <div className="text-xs text-muted-foreground">Address</div>
                <div className="mt-1">{detail.header.address || "-"}</div>
              </div>
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
                    <DropdownMenuItem onSelect={() => setPoOpen(true)}>Create PO for this Vendor</DropdownMenuItem>
                  ) : null}
                  {workhub.actions.create_vendor_bill ? (
                    <DropdownMenuItem onSelect={() => setBillOpen(true)}>Create Vendor Bill for this Vendor</DropdownMenuItem>
                  ) : null}
                  {workhub.actions.record_vendor_payment ? (
                    <DropdownMenuItem onSelect={() => setPaymentOpen(true)}>Record Vendor Payment</DropdownMenuItem>
                  ) : null}
                  {workhub.actions.add_note ? (
                    <DropdownMenuItem onSelect={() => setNoteOpen(true)}>Add Vendor Note</DropdownMenuItem>
                  ) : null}
                  {workhub.actions.add_attachment ? (
                    <DropdownMenuItem onSelect={() => setAttachmentOpen(true)}>Add Vendor Attachment (URL)</DropdownMenuItem>
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
        initialVendorId={detail.header.id}
        initialVendorName={detail.header.name}
      />
      <VendorBillFormDialog
        open={billOpen}
        onOpenChange={setBillOpen}
        initialVendorId={detail.header.id}
      />
      <VendorPaymentFormDialog
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        initialVendorId={detail.header.id}
      />

      <FormDialog open={noteOpen} onOpenChange={setNoteOpen} title="Add Vendor Note" description="Notes are stored as audited events (Phase 1).">
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
            <Label htmlFor="vendorNote">Note</Label>
            <textarea
              id="vendorNote"
              className="min-h-[120px] w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Write a short vendor note..."
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

      <FormDialog open={attachmentOpen} onOpenChange={setAttachmentOpen} title="Add Vendor Attachment (URL)" description="URL-only attachments (Phase 1).">
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
              <Label htmlFor="venAttUrl">URL</Label>
              <Input
                id="venAttUrl"
                value={attachment.url}
                onChange={(e) => setAttachment((p) => ({ ...p, url: e.target.value }))}
                placeholder="https://..."
                required
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="venAttName">File name</Label>
              <Input
                id="venAttName"
                value={attachment.fileName}
                onChange={(e) => setAttachment((p) => ({ ...p, fileName: e.target.value }))}
                placeholder="invoice.pdf"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="venAttMime">MIME type (optional)</Label>
              <Input
                id="venAttMime"
                value={attachment.mimeType}
                onChange={(e) => setAttachment((p) => ({ ...p, mimeType: e.target.value }))}
                placeholder="application/pdf"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="venAttSize">Size bytes (optional)</Label>
              <Input
                id="venAttSize"
                value={attachment.sizeBytes}
                onChange={(e) => setAttachment((p) => ({ ...p, sizeBytes: e.target.value }))}
                placeholder="12345"
              />
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
            onChange={(e) => setActive(e.target.value as VendorDetailTab)}
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
                    {typeof row.amount === "number" ? (
                      <div className="font-medium">{formatMoney(row.amount)}</div>
                    ) : row.type === "BILL" || row.type === "PAYMENT" ? (
                      <div className="text-xs text-muted-foreground">Masked</div>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}

      {active === "bills" ? (
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Bills</h2>
          <p className="mt-1 text-sm text-muted-foreground">Vendor bills (AP subledger).</p>
          {!detail.bills ? (
            <div className="mt-4 text-sm text-muted-foreground">No access.</div>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2">Bill</th>
                    <th className="py-2">Date</th>
                    <th className="py-2">Status</th>
                    <th className="py-2">Project</th>
                    {detail.policy.canViewAmounts ? <th className="py-2 text-right">Total</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {detail.bills.map((b) => (
                    <tr key={b.id} className="border-b">
                      <td className="py-2 font-medium">
                        <Link className="underline underline-offset-2" href={`/procurement/vendor-bills?search=${encodeURIComponent(b.billNumber)}`}>
                          {b.billNumber}
                        </Link>
                      </td>
                      <td className="py-2">{b.billDate}</td>
                      <td className="py-2">{b.status}</td>
                      <td className="py-2">{b.projectRef || "-"}</td>
                      {detail.policy.canViewAmounts ? (
                        <td className="py-2 text-right">{formatMoney(b.totalAmount || 0)}</td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}

      {active === "payments" ? (
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Payments</h2>
          <p className="mt-1 text-sm text-muted-foreground">Vendor payments + allocations.</p>
          {!detail.payments ? (
            <div className="mt-4 text-sm text-muted-foreground">No access.</div>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2">Payment</th>
                    <th className="py-2">Date</th>
                    <th className="py-2">Status</th>
                    <th className="py-2">Project</th>
                    {detail.policy.canViewAmounts ? <th className="py-2 text-right">Amount</th> : null}
                    {detail.policy.canViewAmounts ? <th className="py-2 text-right">Allocated</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {detail.payments.map((p) => (
                    <tr key={p.id} className="border-b">
                      <td className="py-2 font-medium">
                        <Link className="underline underline-offset-2" href={`/procurement/vendor-payments?search=${encodeURIComponent(p.paymentNumber)}`}>
                          {p.paymentNumber}
                        </Link>
                      </td>
                      <td className="py-2">{p.paymentDate}</td>
                      <td className="py-2">{p.status}</td>
                      <td className="py-2">{p.projectRef || "-"}</td>
                      {detail.policy.canViewAmounts ? (
                        <td className="py-2 text-right">{formatMoney(p.amount || 0)}</td>
                      ) : null}
                      {detail.policy.canViewAmounts ? (
                        <td className="py-2 text-right">{formatMoney(p.allocatedAmount || 0)}</td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}

      {active === "aging" ? (
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Aging</h2>
          <p className="mt-1 text-sm text-muted-foreground">Posted bills minus posted allocations (as-of date).</p>
          {!detail.aging ? (
            <div className="mt-4 text-sm text-muted-foreground">No access.</div>
          ) : (
            <>
              <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg border p-4">
                  <div className="text-xs text-muted-foreground">As of</div>
                  <div className="mt-2 text-lg font-semibold">{detail.aging.asOf}</div>
                </div>
                <div className="rounded-lg border p-4">
                  <div className="text-xs text-muted-foreground">Current</div>
                  <div className="mt-2 text-lg font-semibold">{formatMoney(detail.aging.current)}</div>
                </div>
                <div className="rounded-lg border p-4">
                  <div className="text-xs text-muted-foreground">Overdue</div>
                  <div className="mt-2 text-lg font-semibold">{formatMoney(detail.aging.overdue)}</div>
                </div>
              </div>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="py-2">Bucket</th>
                      <th className="py-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.aging.buckets.map((b) => (
                      <tr key={b.label} className="border-b">
                        <td className="py-2">{b.label}</td>
                        <td className="py-2 text-right">{formatMoney(b.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      ) : null}

      {active === "documents" ? (
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Documents</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Procurement spine documents for this vendor (filter on the target pages).
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2">Type</th>
                  <th className="py-2">Number</th>
                  <th className="py-2">Date</th>
                  <th className="py-2">Status</th>
                  <th className="py-2">Project</th>
                </tr>
              </thead>
              <tbody>
                {detail.documents.map((d) => (
                  <tr key={`${d.type}-${d.number}`} className="border-b">
                    <td className="py-2">{d.type}</td>
                    <td className="py-2 font-medium">
                      <Link className="underline underline-offset-2" href={d.href}>
                        {d.number}
                      </Link>
                    </td>
                    <td className="py-2">{d.date}</td>
                    <td className="py-2">{d.status}</td>
                    <td className="py-2">{d.projectRef || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {detail.documents.length === 0 ? (
            <div className="mt-4 text-sm text-muted-foreground">No documents found.</div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
