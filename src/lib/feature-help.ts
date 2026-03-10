export type FeatureHelpLink = {
  label: string;
  href: string;
};

export type FeatureHelpDoc = {
  id: string;
  title: string;
  summary: string;
  procedure: string[];
  controls: string[];
  impacts: string[];
  links: FeatureHelpLink[];
};

export const featureHelpCatalog: FeatureHelpDoc[] = [
  {
    id: "dashboard",
    title: "Dashboard",
    summary: "Use this as the daily control center for cash, approvals, and operational priorities.",
    procedure: [
      "Review KPI tiles and exceptions first.",
      "Open linked pages from each card for drill-down.",
      "Resolve blocking approvals before creating new transactions.",
      "Return to dashboard to confirm the metrics moved as expected.",
    ],
    controls: [
      "KPI cards link to source registers and reports.",
      "Role-based visibility limits what each user can open.",
      "Theme and menu controls are available from top navigation.",
    ],
    impacts: [
      "Dashboard is read model only; no financial posting happens here.",
      "Numbers reflect approved/posted data from source modules.",
    ],
    links: [
      { label: "Dashboard", href: "/dashboard" },
      { label: "Approvals", href: "/approvals" },
      { label: "Reports Home", href: "/reports" },
    ],
  },
  {
    id: "my-portal",
    title: "My Portal",
    summary: "Employee self-service for wallet, salary, incentive, attendance, leave, and own expenses.",
    procedure: [
      "Check wallet available and reimbursement due at the top.",
      "Submit expense with correct payment source (wallet vs own pocket).",
      "Track expense status until approved/paid.",
      "Review salary and incentive history monthly.",
    ],
    controls: [
      "Export buttons provide personal payroll, incentive, and wallet CSV.",
      "Quick actions: Submit Expense, Wallet History, Mark Attendance, Apply Leave.",
      "Only own records are visible unless elevated permissions exist.",
    ],
    impacts: [
      "Own-pocket approved expense becomes reimbursement payable until paid.",
      "Payroll approval credits net pay to employee wallet ledger.",
    ],
    links: [
      { label: "My Portal", href: "/me" },
      { label: "My Expenses", href: "/expenses" },
      { label: "Wallet Ledger", href: "/wallets" },
    ],
  },
  {
    id: "projects",
    title: "Projects",
    summary: "Master list for project commercial and execution lifecycle.",
    procedure: [
      "Create or open project with correct client and contract value.",
      "Assign team members and verify project access scope.",
      "Use project detail page to monitor money in/out, pending recoveries, and activity.",
      "Close/archive only after financial and operational reconciliation.",
    ],
    controls: [
      "Project actions are role-guarded and audit logged.",
      "Project switch selector helps move between projects quickly.",
      "Linked-record guardrails prevent unsafe deletion of active financial chains.",
    ],
    impacts: [
      "Project IDs are used across income, expense, procurement, and reporting.",
      "Incorrect project mapping causes cross-module reporting distortion.",
    ],
    links: [
      { label: "Projects List", href: "/projects" },
      { label: "Project Reports", href: "/reports/projects" },
    ],
  },
  {
    id: "project-detail",
    title: "Project Detail",
    summary: "Executive view of budget, receivables, costs, profitability, and transaction timeline per project.",
    procedure: [
      "Check top KPIs: money in, money out, profit, cash to recover, unpaid vendor bills.",
      "Use executive summary cards and charts for risk detection.",
      "Verify activity timeline against expected transactions.",
      "Use action menu for controlled updates and linked records handling.",
    ],
    controls: [
      "Project dropdown switches context without leaving detail page.",
      "Tabs split activity, execution, and document context.",
      "Visibility of sensitive financial metrics depends on permissions.",
    ],
    impacts: [
      "All approved transactions with matching project reference affect project KPIs.",
      "Incentives and commissions tied to project feed payroll or AP settlement flows.",
    ],
    links: [
      { label: "Projects", href: "/projects" },
      { label: "Incentives", href: "/incentives" },
      { label: "Project Reports", href: "/reports/projects" },
    ],
  },
  {
    id: "tasks",
    title: "Tasks",
    summary: "Work planning and execution tracking for assigned and managed tasks.",
    procedure: [
      "Create task with clear owner, due date, and priority.",
      "Move status as work progresses (todo/in progress/blocked/done).",
      "Managers review quality and close items with comments.",
      "Use recurring template strategy for repeat operational work.",
    ],
    controls: [
      "Assigned users can update assigned tasks by permission.",
      "Managers can review/grade outcomes where review permission exists.",
      "Role scope controls full task visibility vs assigned-only access.",
    ],
    impacts: [
      "Task status is operational metadata; no accounting posting occurs.",
      "Task discipline improves project delivery and HR performance inputs.",
    ],
    links: [
      { label: "Tasks", href: "/tasks" },
      { label: "Projects", href: "/projects" },
      { label: "Employees", href: "/employees" },
    ],
  },
  {
    id: "expenses",
    title: "Expenses",
    summary: "Capture and control company expenses with approval and payment-state clarity.",
    procedure: [
      "Create expense with right project (if applicable), category, and payment source.",
      "Submit and route through approval workflow.",
      "After approval, mark paid only for payable items (for example own-pocket reimbursements).",
      "Review reflected impact in project costs, wallet ledger, and reports.",
    ],
    controls: [
      "Filters separate pending, approved, and paid queues.",
      "Bulk mark-paid is available for eligible approved rows.",
      "Reopen action exists for correction under permission control.",
    ],
    impacts: [
      "Employee pocket: approved = payable; paid = reimbursement settled.",
      "Employee wallet source: company-funded already, so no double payment should occur.",
      "Approved company expenses hit project/reporting numbers and posting flow.",
    ],
    links: [
      { label: "Expenses", href: "/expenses" },
      { label: "Approvals", href: "/approvals" },
      { label: "Employee Expense Report", href: "/reports/employee-expenses" },
    ],
  },
  {
    id: "income",
    title: "Income",
    summary: "Record project and non-project receipts with approval and company-account linkage.",
    procedure: [
      "Create income row with correct company account and source details.",
      "Attach project reference for project receipts.",
      "Approve the entry through workflow.",
      "Verify impact in project recoveries and cash reporting.",
    ],
    controls: [
      "Income detail screens support audit visibility and corrections.",
      "Approval and posting permissions are role-controlled.",
      "Company account mapping is required for accurate cash position.",
    ],
    impacts: [
      "Approved income updates project received/pending metrics.",
      "Company account movement and cash reports depend on this mapping.",
    ],
    links: [
      { label: "Income", href: "/income" },
      { label: "Company Accounts", href: "/company-accounts" },
      { label: "Cash Position Report", href: "/reports/accounting/cash-position" },
    ],
  },
  {
    id: "procurement",
    title: "Procurement",
    summary: "Control purchasing lifecycle: PO -> GRN -> Vendor Bill -> Vendor Payment.",
    procedure: [
      "Create PO with vendor, project reference, and line items.",
      "Receive stock via GRN against PO.",
      "Create vendor bill from approved receipt quantities.",
      "Post vendor payment from authorized company account.",
    ],
    controls: [
      "Status transitions enforce procurement discipline.",
      "Document-level project references keep commercial traceability.",
      "Approval queue shows pending procurement actions.",
    ],
    impacts: [
      "Procurement chain updates inventory, AP exposure, and project cost signals.",
      "Broken sequence (for example direct bill without receipt) causes reconciliation risk.",
    ],
    links: [
      { label: "Purchase Orders", href: "/procurement/purchase-orders" },
      { label: "Goods Receipts (GRN)", href: "/procurement/grn" },
      { label: "Vendor Bills", href: "/procurement/vendor-bills" },
      { label: "Vendor Payments", href: "/procurement/vendor-payments" },
    ],
  },
  {
    id: "inventory",
    title: "Inventory and Store",
    summary: "Maintain clean item master, stock levels, and allocations to projects.",
    procedure: [
      "Create or reuse item master entries (avoid duplicates).",
      "Use stock in/out and allocation actions with valid references.",
      "Track low-stock and valuation KPIs from inventory dashboard.",
      "Review stock ledger for quantity and cost traceability.",
    ],
    controls: [
      "Duplicate and similar-name checks reduce item master drift.",
      "Stock actions are permission-gated.",
      "Item detail page provides deeper movement history.",
    ],
    impacts: [
      "Inventory allocations affect project material cost visibility.",
      "Bad item naming creates reporting fragmentation and audit confusion.",
    ],
    links: [
      { label: "Inventory", href: "/inventory" },
      { label: "Stock Ledger", href: "/inventory/ledger" },
      { label: "Inventory Report", href: "/reports/inventory" },
    ],
  },
  {
    id: "approvals",
    title: "Approvals",
    summary: "Central queue for financial and operational approvals by role authority.",
    procedure: [
      "Open queue and filter pending records by type and employee/project context.",
      "Review details and approve, reject, or partially approve where allowed.",
      "Use reopen/correction controls for exceptional mistakes (permission-based).",
      "Verify downstream status changes in source modules.",
    ],
    controls: [
      "Queue visibility and action buttons are role-permission based.",
      "Recent approval history supports quick audit checks.",
      "Bulk selection helps handle repetitive approvals safely.",
    ],
    impacts: [
      "Approval changes are upstream control events; payments may still be pending.",
      "Approved vs paid states must be interpreted separately in finance workflows.",
    ],
    links: [
      { label: "Approvals Queue", href: "/approvals" },
      { label: "Expenses", href: "/expenses" },
      { label: "Vendor Bills", href: "/procurement/vendor-bills" },
    ],
  },
  {
    id: "payroll",
    title: "How Payroll Flow Works",
    summary: "Monthly payroll run for salary + variable pay + deductions with settlement posting.",
    procedure: [
      "Set base salary in each employee compensation profile.",
      "Create payroll run for previous month.",
      "Use Auto-fill by Policy, then fine-tune rows for special circumstances.",
      "Approve run to freeze/authorize payroll for that month.",
      "Use Settle Entries to mark employees paid one-by-one after actual transfer.",
      "Run moves to POSTED automatically when all entries are settled.",
    ],
    controls: [
      "Auto-fill policy pulls attendance, approved incentives/commissions, and advances.",
      "Duplicate/unknown employee rows are blocked.",
      "Approval and per-entry payment actions are permission-gated and audit logged.",
    ],
    impacts: [
      "Payroll approval freezes/authorizes the run, but payment is settled employee-by-employee.",
      "Mark Paid creates wallet posting and component breakdown lines per employee entry.",
      "Approved payroll-linked incentives are settled when that employee entry is marked paid.",
      "Salary advance deductions can transition advances to recovered status.",
    ],
    links: [
      { label: "Payroll", href: "/payroll" },
      { label: "Employees", href: "/employees" },
      { label: "Incentives", href: "/incentives" },
      { label: "Salary Advances", href: "/salary-advances" },
    ],
  },
  {
    id: "incentives",
    title: "Incentives and Commissions",
    summary: "Create and settle variable pay linked to project outcomes.",
    procedure: [
      "Create incentive/commission with project reference and payout mode.",
      "Approve entry through authorized role.",
      "For PAYROLL payout mode, keep as unsettled until payroll approval.",
      "For WALLET payout mode, settlement occurs on approval with wallet credit.",
    ],
    controls: [
      "Supports fixed amount and percentage-based formulas.",
      "Employee and project mapping is mandatory for traceability.",
      "Settled entries are protected from unsafe deletion.",
    ],
    impacts: [
      "Variable pay can affect project cost views and payroll liabilities.",
      "Settlement status is critical for avoiding double payment.",
    ],
    links: [
      { label: "Incentives", href: "/incentives" },
      { label: "Commissions", href: "/commissions" },
      { label: "Payroll", href: "/payroll" },
    ],
  },
  {
    id: "salary-advances",
    title: "Salary Advances",
    summary: "Issue and recover salary advances with approval and payroll recovery support.",
    procedure: [
      "Create advance for employee with reason and amount.",
      "Approve advance through authorized user.",
      "If paid, track outstanding and recovery path in payroll.",
      "Use recovered status when deduction settlement is complete.",
    ],
    controls: [
      "Paid/recovered advances are protected against unsafe edits.",
      "View-all vs own visibility follows role permissions.",
      "Advance data feeds payroll deduction logic.",
    ],
    impacts: [
      "Advance issue increases employee-funded company exposure.",
      "Advance recovery reduces net salary in payroll runs.",
    ],
    links: [
      { label: "Salary Advances", href: "/salary-advances" },
      { label: "Payroll", href: "/payroll" },
      { label: "Wallet Ledger", href: "/wallets" },
    ],
  },
  {
    id: "wallets",
    title: "Wallet Ledger",
    summary: "Single history for employee monetary movements (salary, incentive, advance, settlement).",
    procedure: [
      "Filter by employee, date, type, and source to isolate movement.",
      "Open references for source transaction validation.",
      "Use export for monthly reconciliation and audit review.",
      "Cross-check wallet balance with employee portal cards.",
    ],
    controls: [
      "Source types separate payroll, incentive, reimbursements, and adjustments.",
      "Posted-by metadata supports accountability.",
      "Own-only users can view only their own ledger.",
    ],
    impacts: [
      "Wallet ledger is critical for payable settlement evidence.",
      "Mismatch here indicates posting or source-flow issue.",
    ],
    links: [
      { label: "Wallet Ledger", href: "/wallets" },
      { label: "My Portal", href: "/me" },
      { label: "Payroll", href: "/payroll" },
    ],
  },
  {
    id: "employees",
    title: "Employees and Compensation",
    summary: "Employee master, role/access mapping, and base salary profile management.",
    procedure: [
      "Create and maintain employee core profile.",
      "Set base salary in compensation dialog with effective date.",
      "Assign role templates and apply user-specific overrides when needed.",
      "Use employee detail page to inspect salary/incentive/advance history.",
    ],
    controls: [
      "PII visibility is restricted by role.",
      "Compensation edit requires dedicated permission.",
      "Employee code and name provide consistent identification.",
    ],
    impacts: [
      "Base salary profile feeds payroll auto-fill.",
      "Wrong employee mapping creates payroll and reporting errors.",
    ],
    links: [
      { label: "Employees", href: "/employees" },
      { label: "Settings", href: "/settings" },
      { label: "Payroll", href: "/payroll" },
    ],
  },
  {
    id: "reports",
    title: "Reports",
    summary: "Read-only financial and operational analytics for decision making and controls.",
    procedure: [
      "Use Reports Home to choose required view.",
      "Apply date and entity filters before exporting.",
      "Drill down from summary reports to source transactions.",
      "Use exception reports to drive corrective action.",
    ],
    controls: [
      "Report access and export rights are permission-based.",
      "Accounting reports depend on source transaction hygiene.",
      "AP/AR/cash reports support cash-flow control decisions.",
    ],
    impacts: [
      "Reports do not post transactions; they expose data quality and control gaps.",
      "Any discrepancy should be corrected at source module level.",
    ],
    links: [
      { label: "Reports Home", href: "/reports" },
      { label: "AP Aging", href: "/reports/ap" },
      { label: "Cash Position", href: "/reports/accounting/cash-position" },
    ],
  },
  {
    id: "settings",
    title: "Settings and Access Control",
    summary: "Business roles, per-user overrides, and approval routes.",
    procedure: [
      "Select role template baseline first.",
      "Apply per-user allow/deny overrides only for exceptions.",
      "Set approval routes by amount/type authority.",
      "Review effective permissions before user go-live.",
    ],
    controls: [
      "Role templates are reusable permission bundles.",
      "User overrides supersede template for selected features.",
      "Effective permission APIs drive both UI gating and server checks.",
    ],
    impacts: [
      "Incorrect settings can expose sensitive finance controls or block operations.",
      "Approval route changes directly affect workflow timing and authority.",
    ],
    links: [
      { label: "Settings", href: "/settings" },
      { label: "Approvals", href: "/approvals" },
      { label: "ERP Guide", href: "/help" },
    ],
  },
  {
    id: "ceo-dashboard",
    title: "CEO Dashboard",
    summary: "Executive KPI board for top-level cash, procurement, inventory, and exception signals.",
    procedure: [
      "Review AP outstanding, billed purchases, and stock-in trend.",
      "Inspect low-stock and data-quality cards for risk.",
      "Open linked modules for intervention.",
      "Track exceptions and approvals backlog daily.",
    ],
    controls: [
      "This screen is intentionally read-focused.",
      "Links route to operational pages where actions are taken.",
      "Only executive roles should have access by default.",
    ],
    impacts: [
      "No direct posting from this screen.",
      "Helps prioritize actions that protect cash flow and continuity.",
    ],
    links: [
      { label: "CEO Dashboard", href: "/ceo/dashboard" },
      { label: "Approvals", href: "/approvals" },
      { label: "Inventory", href: "/inventory" },
    ],
  },
  {
    id: "ceo-blueprint",
    title: "ERP Blueprint",
    summary: "Cross-module map to understand lifecycle and dependency of ERP flows.",
    procedure: [
      "Use map to understand where each transaction starts and ends.",
      "Verify critical path for procurement, expense, and payroll.",
      "Identify out-of-scope or pending modules before process changes.",
      "Align team onboarding with documented flow paths.",
    ],
    controls: [
      "Blueprint is knowledge aid, not transaction entry form.",
      "Use zoom/pan controls to inspect dense parts of the map.",
      "Pair with ERP Guide for operational SOP.",
    ],
    impacts: [
      "Improves process discipline and reduces accidental workflow bypass.",
      "Helps managers explain end-to-end impact to non-technical users.",
    ],
    links: [
      { label: "ERP Blueprint", href: "/ceo/blueprint" },
      { label: "ERP Guide", href: "/help" },
    ],
  },
  {
    id: "help",
    title: "ERP Guide",
    summary: "Central SOP reference for all implemented features.",
    procedure: [
      "Open feature section matching your current task.",
      "Follow the listed procedure top to bottom.",
      "Use quick links to jump directly to the related module.",
      "Escalate process gaps before entering live financial data.",
    ],
    controls: [
      "Contextual help launcher links back here from every module.",
      "Each feature section includes controls and cross-module effects.",
      "Guide content should stay synchronized with production behavior.",
    ],
    impacts: [
      "Guide is documentation only; no posting actions occur here.",
      "Consistent usage reduces entry mistakes and reconciliation effort.",
    ],
    links: [
      { label: "ERP Guide", href: "/help" },
      { label: "Dashboard", href: "/dashboard" },
    ],
  },
];

const featureHelpById = new Map<string, FeatureHelpDoc>(
  featureHelpCatalog.map((doc) => [doc.id, doc]),
);

function normalizePathname(pathname: string) {
  const raw = String(pathname || "").trim();
  if (!raw) return "/";
  const withoutQuery = raw.split("?")[0].split("#")[0] || "/";
  if (withoutQuery === "/") return "/";
  return withoutQuery.endsWith("/") ? withoutQuery.slice(0, -1) : withoutQuery;
}

function getDoc(id: string) {
  return featureHelpById.get(id) || featureHelpCatalog[0];
}

export function resolveFeatureHelp(pathname: string): FeatureHelpDoc {
  const p = normalizePathname(pathname);

  if (p === "/" || p === "/dashboard") return getDoc("dashboard");
  if (p === "/help") return getDoc("help");
  if (p.startsWith("/ceo/dashboard")) return getDoc("ceo-dashboard");
  if (p.startsWith("/ceo/blueprint")) return getDoc("ceo-blueprint");
  if (p.startsWith("/settings")) return getDoc("settings");
  if (p.startsWith("/reports")) return getDoc("reports");
  if (p.startsWith("/approvals")) return getDoc("approvals");
  if (p.startsWith("/payroll")) return getDoc("payroll");
  if (p.startsWith("/incentives") || p.startsWith("/commissions")) return getDoc("incentives");
  if (p.startsWith("/salary-advances")) return getDoc("salary-advances");
  if (p.startsWith("/wallets")) return getDoc("wallets");
  if (p.startsWith("/employees")) return getDoc("employees");
  if (p === "/me") return getDoc("my-portal");
  if (p.startsWith("/tasks")) return getDoc("tasks");
  if (p === "/projects" || p.startsWith("/projects/financial")) return getDoc("projects");
  if (/^\/projects\/[^/]+$/.test(p)) return getDoc("project-detail");
  if (p.startsWith("/expenses")) return getDoc("expenses");
  if (p.startsWith("/income")) return getDoc("income");
  if (p.startsWith("/procurement")) return getDoc("procurement");
  if (p.startsWith("/inventory")) return getDoc("inventory");

  return getDoc("dashboard");
}
