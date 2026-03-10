import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { featureHelpCatalog } from "@/lib/feature-help";

export default async function HelpPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const canView = await requirePermission(session.user.id, "dashboard.view");
  if (!canView) {
    return (
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">ERP Guide</h1>
        <p className="mt-2 text-muted-foreground">You do not have access to the guide.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <div className="rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 via-card to-cyan-500/10 p-6 shadow-sm md:p-8">
        <h1 className="text-2xl font-semibold">ERP Guide</h1>
        <p className="mt-2 text-muted-foreground">
          Operator-first guide for Finance, Expense, Wallet, Payroll, Inventory, and Project flows.
        </p>
      </div>

      <section id="approval-basics" className="rounded-xl border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Approval Terms</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border border-amber-300/35 bg-amber-500/10 p-4">
            <div className="text-sm font-semibold text-amber-900 dark:text-amber-200">Approved</div>
            <p className="mt-1 text-sm text-muted-foreground">
              Business approval is complete, but money may still be unpaid.
            </p>
          </div>
          <div className="rounded-lg border border-emerald-300/35 bg-emerald-500/10 p-4">
            <div className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">Paid</div>
            <p className="mt-1 text-sm text-muted-foreground">
              Cash transfer/reimbursement is posted in ledger and reflected in wallet/accounts.
            </p>
          </div>
        </div>
      </section>

      <section id="expense-flow" className="rounded-xl border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Expense Flow</h2>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
          <li>Employee submits expense with correct payment source.</li>
          <li>Approver verifies amount/project/category and approves/rejects.</li>
          <li>If source is <span className="font-medium text-foreground">EMPLOYEE_POCKET</span>, it stays payable until reimbursement is posted.</li>
          <li>If source is <span className="font-medium text-foreground">EMPLOYEE_WALLET</span>, it is already company-funded and must not be paid again.</li>
        </ol>
      </section>

      <section id="payroll-flow" className="rounded-xl border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Payroll + Incentive Flow</h2>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
          <li>Set base salary on each employee profile first.</li>
          <li>Create project incentive and get it approved.</li>
          <li>Create payroll run for previous month, then use <span className="font-medium text-foreground">Auto-fill by Policy</span>.</li>
          <li>Review base, incentive, deductions, and reason lines employee-by-employee.</li>
          <li>Approve payroll run to freeze and authorize payouts.</li>
          <li>Use <span className="font-medium text-foreground">Settle Entries</span> to mark each employee paid.</li>
        </ol>
        <div className="mt-3 rounded-md border border-primary/25 bg-primary/5 p-3 text-xs text-muted-foreground">
          Payroll settlement includes only approved payroll-linked incentives created on or before the run period end, and settles per employee when that payroll entry is marked paid.
        </div>
      </section>

      <section id="inventory-flow" className="rounded-xl border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Inventory and Procurement Guardrails</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>Material stock must enter through PO → GRN → Vendor Bill chain.</li>
          <li>Direct stock expense posting is blocked by design.</li>
          <li>Duplicate/similar inventory names should be reviewed before creating new items.</li>
        </ul>
      </section>

      <section id="feature-procedures" className="rounded-xl border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Feature Procedure Library</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Full step-by-step procedure by feature. The same content is available from the contextual
          <span className="font-medium text-foreground"> How this works </span>
          action on each related page.
        </p>
        <div className="mt-4 space-y-4">
          {featureHelpCatalog.map((doc) => (
            <article key={doc.id} id={`feature-${doc.id}`} className="rounded-lg border border-border bg-card p-4">
              <h3 className="text-base font-semibold">{doc.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{doc.summary}</p>

              <div className="mt-3 grid gap-3 lg:grid-cols-3">
                <div className="rounded-md border border-primary/25 bg-primary/5 p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-primary">Procedure</div>
                  <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-muted-foreground">
                    {doc.procedure.map((line, idx) => (
                      <li key={`${doc.id}-p-${idx}`}>{line}</li>
                    ))}
                  </ol>
                </div>
                <div className="rounded-md border border-sky-300/35 bg-sky-500/10 p-3 dark:border-sky-900/60 dark:bg-sky-950/25">
                  <div className="text-xs font-semibold uppercase tracking-wide text-sky-900 dark:text-sky-200">
                    Controls
                  </div>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                    {doc.controls.map((line, idx) => (
                      <li key={`${doc.id}-c-${idx}`}>{line}</li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-md border border-amber-300/35 bg-amber-500/10 p-3 dark:border-amber-900/60 dark:bg-amber-950/25">
                  <div className="text-xs font-semibold uppercase tracking-wide text-amber-900 dark:text-amber-200">
                    Effects
                  </div>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                    {doc.impacts.map((line, idx) => (
                      <li key={`${doc.id}-i-${idx}`}>{line}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {doc.links.map((link) => (
                  <Link
                    key={`${doc.id}-${link.href}`}
                    href={link.href}
                    className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-accent"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="quick-links" className="rounded-xl border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Quick Links</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href="/payroll" className="rounded-md border border-border bg-card px-3 py-2 text-sm hover:bg-accent">
            Payroll
          </Link>
          <Link href="/incentives" className="rounded-md border border-border bg-card px-3 py-2 text-sm hover:bg-accent">
            Incentives
          </Link>
          <Link href="/expenses" className="rounded-md border border-border bg-card px-3 py-2 text-sm hover:bg-accent">
            Expenses
          </Link>
          <Link href="/wallets" className="rounded-md border border-border bg-card px-3 py-2 text-sm hover:bg-accent">
            Wallet Ledger
          </Link>
          <Link href="/projects" className="rounded-md border border-border bg-card px-3 py-2 text-sm hover:bg-accent">
            Projects
          </Link>
        </div>
      </section>
    </div>
  );
}
