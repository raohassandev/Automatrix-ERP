"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { formatMoney } from "@/lib/format";
import type { CompanyAccountDetailData, CompanyAccountDetailTab } from "@/lib/company-account-detail-policy";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/FormDialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { VendorPaymentFormDialog } from "@/components/VendorPaymentFormDialog";
import { withLoadingToast } from "@/lib/withLoadingToast";

function tabLabel(tab: CompanyAccountDetailTab) {
  switch (tab) {
    case "activity":
      return "Activity";
    case "payments":
      return "Payments";
    case "summary":
      return "Summary";
    case "documents":
      return "Documents";
  }
}

export function CompanyAccountDetailClient({ detail }: { detail: CompanyAccountDetailData }) {
  const router = useRouter();
  const tabs = (Object.keys(detail.policy.tabs) as CompanyAccountDetailTab[]).filter((t) => detail.policy.tabs[t]);
  const [active, setActive] = React.useState<CompanyAccountDetailTab>(tabs[0] || "activity");
  const workhub = detail.policy.workhub;

  const [paymentOpen, setPaymentOpen] = React.useState(false);
  const [noteOpen, setNoteOpen] = React.useState(false);
  const [attachmentOpen, setAttachmentOpen] = React.useState(false);

  const [note, setNote] = React.useState("");
  const [attachment, setAttachment] = React.useState({ fileName: "", url: "", mimeType: "", sizeBytes: "" });
  const [savingNote, setSavingNote] = React.useState(false);
  const [savingAttachment, setSavingAttachment] = React.useState(false);

  async function addNote() {
    const res = await fetch(`/api/company-accounts/${detail.header.id}/notes`, {
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
    const res = await fetch(`/api/company-accounts/${detail.header.id}/attachments`, {
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
              <span>Type: {detail.header.type}</span>
              <span>Status: {detail.header.status}</span>
              <span>Currency: {detail.header.currency}</span>
              <span>Attachments: {detail.header.attachmentsCount}</span>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border p-4">
                <div className="text-xs text-muted-foreground">Opening balance</div>
                <div className="mt-2 text-lg font-semibold">{formatMoney(detail.header.openingBalance)}</div>
              </div>
              <div className="rounded-lg border p-4">
                <div className="text-xs text-muted-foreground">Current balance (Phase 1)</div>
                <div className="mt-2 text-lg font-semibold">{formatMoney(detail.header.currentBalance)}</div>
                <div className="mt-1 text-xs text-muted-foreground">Opening + approved income inflow - posted vendor payments - approved account expenses.</div>
              </div>
              <div className="rounded-lg border p-4">
                <div className="text-xs text-muted-foreground">Role</div>
                <div className="mt-2 text-lg font-semibold">{detail.policy.role}</div>
              </div>
            </div>
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
                  {workhub.actions.record_vendor_payment ? (
                    <DropdownMenuItem onSelect={() => setPaymentOpen(true)}>Record Vendor Payment</DropdownMenuItem>
                  ) : null}
                  {workhub.actions.add_note ? (
                    <DropdownMenuItem onSelect={() => setNoteOpen(true)}>Add Account Note</DropdownMenuItem>
                  ) : null}
                  {workhub.actions.add_attachment ? (
                    <DropdownMenuItem onSelect={() => setAttachmentOpen(true)}>Add Account Attachment (URL)</DropdownMenuItem>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : null}
        </div>
      </div>

      <VendorPaymentFormDialog
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        initialCompanyAccountId={detail.header.id}
      />

      <FormDialog open={noteOpen} onOpenChange={setNoteOpen} title="Add Account Note" description="Notes are stored as audited events (Phase 1).">
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
            <Label htmlFor="accNote">Note</Label>
            <textarea
              id="accNote"
              className="min-h-[120px] w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Write a short account note..."
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

      <FormDialog open={attachmentOpen} onOpenChange={setAttachmentOpen} title="Add Account Attachment (URL)" description="URL-only attachments (Phase 1).">
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
              <Label htmlFor="accAttUrl">URL</Label>
              <Input
                id="accAttUrl"
                value={attachment.url}
                onChange={(e) => setAttachment((p) => ({ ...p, url: e.target.value }))}
                placeholder="https://..."
                required
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="accAttName">File name</Label>
              <Input
                id="accAttName"
                value={attachment.fileName}
                onChange={(e) => setAttachment((p) => ({ ...p, fileName: e.target.value }))}
                placeholder="statement.pdf"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="accAttMime">MIME type (optional)</Label>
              <Input
                id="accAttMime"
                value={attachment.mimeType}
                onChange={(e) => setAttachment((p) => ({ ...p, mimeType: e.target.value }))}
                placeholder="application/pdf"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="accAttSize">Size bytes (optional)</Label>
              <Input
                id="accAttSize"
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
            onChange={(e) => setActive(e.target.value as CompanyAccountDetailTab)}
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
          <p className="mt-1 text-sm text-muted-foreground">Chronological inflows/outflows + audited notes/attachments.</p>

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
                      <div className="text-sm font-medium">{e.note ? "Note" : e.attachment ? "Attachment" : e.action}</div>
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
                    {typeof row.amount === "number" ? <div className="font-medium">{formatMoney(row.amount)}</div> : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}

      {active === "payments" ? (
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="flex flex-col gap-2 md:flex-row md:items-baseline md:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Payments</h2>
              <p className="mt-1 text-sm text-muted-foreground">Vendor payments paid from this account (paged).</p>
            </div>
            <div className="text-sm text-muted-foreground">
              Page {detail.payments.page} / {detail.payments.totalPages}
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2">Payment</th>
                  <th className="py-2">Date</th>
                  <th className="py-2">Status</th>
                  <th className="py-2">Vendor</th>
                  <th className="py-2">Project</th>
                  <th className="py-2 text-right">Amount</th>
                  <th className="py-2 text-right">Allocated</th>
                </tr>
              </thead>
              <tbody>
                {detail.payments.entries.map((p) => (
                  <tr key={p.id} className="border-b">
                    <td className="py-2 font-medium">
                      <Link className="underline underline-offset-2" href={p.href}>
                        {p.paymentNumber}
                      </Link>
                    </td>
                    <td className="py-2">{p.paymentDate}</td>
                    <td className="py-2">{p.status}</td>
                    <td className="py-2">{p.vendor.name}</td>
                    <td className="py-2">{p.projectRef || "-"}</td>
                    <td className="py-2 text-right">{formatMoney(p.amount)}</td>
                    <td className="py-2 text-right">{formatMoney(p.allocatedAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <Button asChild variant="outline" size="sm" disabled={detail.payments.page <= 1}>
              <Link href={`/company-accounts/${detail.header.id}?paymentsPage=${Math.max(1, detail.payments.page - 1)}`}>
                Prev
              </Link>
            </Button>
            <div className="text-xs text-muted-foreground">{detail.payments.totalCount} total</div>
            <Button asChild variant="outline" size="sm" disabled={detail.payments.page >= detail.payments.totalPages}>
              <Link
                href={`/company-accounts/${detail.header.id}?paymentsPage=${Math.min(detail.payments.totalPages, detail.payments.page + 1)}`}
              >
                Next
              </Link>
            </Button>
          </div>
        </div>
      ) : null}

      {active === "summary" ? (
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Summary</h2>
          <p className="mt-1 text-sm text-muted-foreground">Month-wise approved inflows and posted outflows.</p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2">Month</th>
                  <th className="py-2 text-right">Approved inflow</th>
                  <th className="py-2 text-right">Approved expense outflow</th>
                  <th className="py-2 text-right">Posted outflow</th>
                  <th className="py-2 text-right">Net change</th>
                  <th className="py-2 text-right">Count</th>
                </tr>
              </thead>
              <tbody>
                {detail.summary.length === 0 ? (
                  <tr>
                    <td className="py-3 text-sm text-muted-foreground" colSpan={6}>
                      No inflow/outflow activity in the last 12 months.
                    </td>
                  </tr>
                ) : (
                  detail.summary.map((r) => (
                    <tr key={r.month} className="border-b">
                      <td className="py-2">{r.month}</td>
                      <td className="py-2 text-right">{formatMoney(r.approvedInflow)}</td>
                      <td className="py-2 text-right">{formatMoney(r.approvedExpenseOutflow)}</td>
                      <td className="py-2 text-right">{formatMoney(r.postedOutflow)}</td>
                      <td className="py-2 text-right">{formatMoney(r.netChange)}</td>
                      <td className="py-2 text-right">{r.postedCount}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {active === "documents" ? (
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Documents</h2>
          <p className="mt-1 text-sm text-muted-foreground">Linked income entries, payments and allocated bills.</p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2">Type</th>
                  <th className="py-2">Number</th>
                  <th className="py-2">Date</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {detail.documents.map((d, idx) => (
                  <tr key={`${d.type}-${d.number}-${idx}`} className="border-b">
                    <td className="py-2">{d.type}</td>
                    <td className="py-2 font-medium">
                      <Link className="underline underline-offset-2" href={d.href}>
                        {d.number}
                      </Link>
                    </td>
                    <td className="py-2">{d.date}</td>
                    <td className="py-2">{d.status}</td>
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
