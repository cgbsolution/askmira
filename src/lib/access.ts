import {
  BarChart3,
  Bell,
  Briefcase,
  Building2,
  CalendarDays,
  CircleDollarSign,
  Clock,
  ExternalLink,
  FileText,
  GraduationCap,
  Heart,
  Inbox,
  Laptop,
  LayoutDashboard,
  LifeBuoy,
  MessageCircleQuestion,
  Receipt,
  Rocket,
  Settings,
  ShieldCheck,
  Sparkles,
  Target,
  UserCircle2,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import type { Audience, AuthUser, ProductKey, Tenant } from "@/lib/types";

/**
 * The web portal's information architecture and who may reach each part of it.
 *
 * One map drives both the navigation and the route guard, so a page cannot be
 * linked for a role and guarded differently. The role sets mirror the backend
 * routers' own (`HR_ROLES`, `ADMIN_ROLES`, …) — and the backend is still the
 * enforcement: this map decides what a person is shown, the API decides what
 * they get.
 *
 * `super_admin` passes every check, as it does in `require_roles`. `manager`
 * is anybody with a direct report, whatever their role — the backend's
 * `line_managers=True`.
 */

export const HR: Audience[] = ["admin", "sub_admin"];
export const ADMIN: Audience[] = ["admin"];
export const MANAGERS: Audience[] = [...HR, "manager"];
export const EVERYONE: Audience[] = [...HR, "employee"];
/** The platform owner only. Every other role is refused. */
export const PLATFORM: Audience[] = ["super_admin"];

export interface NavPage {
  name: string;
  path: string;
  roles: Audience[];
  /** Guarded but not listed in the section navigation (a create form, say). */
  hidden?: boolean;
  /**
   * Who may open the page, where that is wider than who sees it in the menu: an
   * approval rule can name anybody, so a decision queue opens for everyone and
   * shows each person only what waits on them.
   */
  reach?: Audience[];
  /** For a page outside any section, which has no section icon to borrow. */
  icon?: LucideIcon;
  /** Workspace module this one page needs, where its section needs none (or another). */
  module?: string;
  /**
   * About the person's own record — their payslips, their attendance. Left out
   * of the menu for a login with no employee record, which would only find an
   * empty page there. Still guarded by `roles` like any other page.
   */
  self?: boolean;
  /**
   * For a hidden page: the listed page the menu highlights while it is open
   * (Payroll setup while a salary structure is being edited, say).
   */
  parent?: string;
}

export interface NavSection {
  key: string;
  name: string;
  icon: LucideIcon;
  /** `main` is the list itself; `admin` sits under its own heading at the foot. */
  group: "main" | "admin";
  /** Workspace module that must be switched on. Undefined = always available. */
  module?: string;
  /**
   * The separate product that takes this section over when it is linked to the
   * workspace: its built-in pages are retired there, and `linkedPages` take
   * their place, alongside a launcher.
   */
  product?: ProductKey;
  pages: NavPage[];
  /**
   * The section's pages while its product is linked: the product's own records,
   * read live as the person (claims, jobs…), plus anything AskMira still owns.
   */
  linkedPages?: NavPage[];
}

export const GROUP_LABEL: Record<NavSection["group"], string> = {
  main: "Workspace",
  admin: "Admin",
};

/**
 * Payroll's set-up pages, changed a few times a year rather than every month:
 * listed on Payroll setup instead of in the menu, so the menu keeps to the
 * monthly cycle.
 */
export const PAYROLL_SETUP: { name: string; path: string; description: string }[] = [
  {
    name: "Salary structures",
    path: "/payroll/structures",
    description: "Components, CTC templates built from them, and how any CTC resolves.",
  },
  {
    name: "Statutory",
    path: "/payroll/statutory",
    description: "PF elections, ESI coverage, work locations, statutory bonus and registers.",
  },
  {
    name: "Rule sets",
    path: "/payroll/rule-sets",
    description: "Effective-dated statutory rules. Payroll computes only against approved versions.",
  },
  {
    name: "Accounting",
    path: "/payroll/accounting",
    description: "Payslip lines mapped to your ledgers, and each run exported as a journal.",
  },
  {
    name: "Gratuity & encashment",
    path: "/payroll/gratuity",
    description: "Gratuity accrual and payouts at exit, and leave encashment.",
  },
  {
    name: "Benefits",
    path: "/payroll/benefits",
    description: "Group plans, who is covered, changes to approve, and files for the insurer.",
  },
  {
    name: "Contractors",
    path: "/payroll/contractors",
    description: "Consultants paid against invoices, with TDS under 194C and 194J.",
  },
  {
    name: "Earned wage access",
    path: "/payroll/ewa",
    description: "Advances on pay already earned, recovered in the same month's payroll.",
  },
  {
    name: "Stock options",
    path: "/payroll/esop",
    description: "Grants, vesting schedules and the perquisite they create.",
  },
];

/**
 * The menu, by HR module — Onboarding, Employees, Attendance, Leave, Payroll —
 * the way HR thinks of the work, rather than by whose page it is. Each module
 * lists only the pages the person may open, so an employee's Attendance holds
 * their own days and HR's adds the review and the rosters.
 */
export const NAV: NavSection[] = [
  {
    key: "home",
    name: "Home",
    icon: LayoutDashboard,
    group: "main",
    pages: [{ name: "Home", path: "/", roles: EVERYONE }],
  },
  {
    // The workspace's own AI companion: it answers as the person asking.
    key: "companion",
    name: "Ask Mira",
    icon: Sparkles,
    group: "main",
    pages: [{ name: "Ask Mira", path: "/ask-mira", roles: EVERYONE }],
  },
  {
    key: "approvals",
    name: "Approvals",
    icon: Inbox,
    group: "main",
    pages: [
      { name: "Approvals", path: "/approvals", roles: EVERYONE },
      {
        name: "Lifecycle approval",
        path: "/approvals/lifecycle",
        roles: EVERYONE,
        hidden: true,
        parent: "/approvals",
      },
    ],
  },
  {
    key: "onboarding",
    name: "Onboarding",
    icon: Rocket,
    group: "main",
    // The one place people are added — one at a time or from Excel — and
    // followed through joining. Employees is for people already here.
    pages: [
      { name: "Add employees", path: "/onboarding/new", roles: HR },
      { name: "New joiners", path: "/onboarding/plans", roles: HR },
      { name: "Checklists", path: "/onboarding/templates", roles: HR },
      // HR see their own onboarding, while they have one, on Home.
      { name: "My onboarding", path: "/onboarding", roles: ["employee"], self: true },
      { name: "My tasks", path: "/onboarding/tasks", roles: EVERYONE },
      // Each joiner's record has Assets and Documents tabs; these pages do the
      // same for anyone, and stay reachable without a place in the menu.
      {
        name: "Asset assignment",
        path: "/onboarding/assets",
        roles: HR,
        hidden: true,
        parent: "/onboarding/plans",
      },
      {
        name: "Document entry",
        path: "/onboarding/documents",
        roles: HR,
        hidden: true,
        parent: "/onboarding/plans",
      },
    ],
  },
  {
    key: "people",
    name: "Employees",
    icon: Users,
    group: "main",
    module: "core_hr",
    pages: [
      { name: "Directory", path: "/people", roles: EVERYONE },
      { name: "Org chart", path: "/people/org-chart", roles: EVERYONE },
      { name: "Positions", path: "/people/positions", roles: HR },
      { name: "Lifecycle events", path: "/people/lifecycle", roles: HR },
      { name: "Profile changes", path: "/people/change-requests", roles: HR },
      { name: "Exits", path: "/people/exits", roles: MANAGERS },
      { name: "Clearance tasks", path: "/people/clearance", roles: EVERYONE },
    ],
  },
  {
    key: "attendance",
    name: "Attendance",
    icon: Clock,
    group: "main",
    module: "leave",
    pages: [
      { name: "My attendance", path: "/time/attendance", roles: EVERYONE, self: true },
      { name: "Attendance review", path: "/time/attendance-review", roles: MANAGERS, reach: EVERYONE },
      { name: "Overtime", path: "/time/overtime", roles: EVERYONE, self: true },
      { name: "Timesheet", path: "/time/timesheets", roles: EVERYONE, self: true },
      { name: "Timesheet approvals", path: "/time/timesheets/approvals", roles: MANAGERS, reach: EVERYONE },
      { name: "Shifts & rosters", path: "/time/shifts", roles: HR },
    ],
  },
  {
    key: "time",
    name: "Leave",
    icon: CalendarDays,
    group: "main",
    module: "leave",
    pages: [{ name: "Leave", path: "/time", roles: EVERYONE }],
  },
  {
    key: "payroll",
    name: "Payroll",
    icon: CircleDollarSign,
    group: "main",
    module: "payroll",
    pages: [
      { name: "Payroll runs", path: "/payroll", roles: HR },
      { name: "Salaries", path: "/payroll/salaries", roles: HR },
      { name: "Adjustments", path: "/payroll/adjustments", roles: HR },
      { name: "Arrears", path: "/payroll/arrears", roles: HR },
      { name: "Loans", path: "/payroll/loans", roles: HR },
      { name: "Tax proofs", path: "/payroll/tax-proofs", roles: HR },
      { name: "Return filings", path: "/payroll/filings", roles: HR },
      { name: "Bank files", path: "/payroll/disbursements", roles: HR },
      { name: "Full & final", path: "/payroll/settlements", roles: HR },
      { name: "Payroll setup", path: "/payroll/setup", roles: HR },
      // Set up once and changed rarely: reached from Payroll setup.
      ...PAYROLL_SETUP.map((page) => ({
        name: page.name,
        path: page.path,
        roles: HR,
        hidden: true,
        parent: "/payroll/setup",
      })),
    ],
  },
  {
    key: "pay",
    name: "My pay",
    icon: Wallet,
    group: "main",
    module: "payroll",
    pages: [
      { name: "Payslips", path: "/pay", roles: EVERYONE, self: true },
      { name: "Tax declarations", path: "/pay/tax", roles: EVERYONE, self: true },
      { name: "Loans & encashment", path: "/pay/loans", roles: EVERYONE, self: true },
      { name: "Benefits", path: "/pay/benefits", roles: EVERYONE, self: true },
      { name: "Stock options", path: "/pay/stock-options", roles: EVERYONE, self: true },
    ],
  },
  {
    key: "expenses",
    name: "Expenses",
    icon: Receipt,
    group: "main",
    product: "expense",
    pages: [
      { name: "My claims", path: "/expenses", roles: EVERYONE },
      { name: "Travel & advances", path: "/expenses/travel", roles: EVERYONE },
      { name: "Team approvals", path: "/expenses/team", roles: MANAGERS },
      { name: "Finance review", path: "/expenses/review", roles: HR },
      { name: "Policies & rates", path: "/expenses/policies", roles: HR },
      { name: "GST credits", path: "/expenses/gst", roles: HR },
      // Reimbursement components of the salary structure, paid through payroll.
      { name: "Salary reimbursements", path: "/expenses/reimbursements", roles: EVERYONE, module: "payroll" },
    ],
    linkedPages: [
      { name: "My claims", path: "/linked/expense/mine", roles: EVERYONE },
      // Whoever ExpenseGenie routes a claim to approves it, not only managers.
      { name: "Waiting for me", path: "/linked/expense/approvals", roles: EVERYONE },
      { name: "Company claims", path: "/linked/expense/company", roles: HR },
      { name: "Totals", path: "/linked/expense/totals", roles: EVERYONE },
      { name: "Salary reimbursements", path: "/expenses/reimbursements", roles: EVERYONE, module: "payroll" },
    ],
  },
  {
    key: "performance",
    name: "Performance",
    icon: Target,
    group: "main",
    pages: [
      { name: "My reviews", path: "/performance", roles: EVERYONE },
      { name: "Goals", path: "/performance/goals", roles: EVERYONE },
      { name: "1:1s", path: "/performance/one-on-ones", roles: EVERYONE },
      { name: "Feedback", path: "/performance/feedback", roles: EVERYONE },
      { name: "My team", path: "/performance/team", roles: MANAGERS },
      { name: "Calibration", path: "/performance/calibration", roles: MANAGERS },
      { name: "Increments & promotions", path: "/performance/increments", roles: MANAGERS },
      { name: "Improvement plans", path: "/performance/pips", roles: MANAGERS },
      { name: "Review cycles", path: "/performance/cycles", roles: HR },
      { name: "Competencies & scales", path: "/performance/competencies", roles: HR },
    ],
  },
  {
    key: "learning",
    name: "Learning",
    icon: GraduationCap,
    group: "main",
    pages: [
      { name: "My courses", path: "/learning", roles: EVERYONE, self: true },
      { name: "Courses", path: "/learning/admin", roles: HR },
    ],
  },
  {
    key: "culture",
    name: "Culture",
    icon: Heart,
    group: "main",
    // Culture and Rewards are separate modules sharing one menu entry, so each
    // page names its own.
    pages: [
      { name: "Feed", path: "/culture", roles: EVERYONE, module: "culture" },
      { name: "Announcements", path: "/culture/announcements", roles: EVERYONE, module: "culture" },
      { name: "Awards", path: "/culture/awards", roles: EVERYONE, module: "culture" },
      { name: "Surveys", path: "/culture/surveys", roles: EVERYONE, module: "culture" },
      { name: "Polls and events", path: "/culture/polls", roles: EVERYONE, module: "culture" },
      { name: "Clubs", path: "/culture/clubs", roles: EVERYONE, module: "culture" },
      { name: "My points", path: "/rewards", roles: EVERYONE, module: "rewards", self: true },
      { name: "Culture admin", path: "/culture/admin", roles: HR, module: "culture" },
      { name: "Rewards admin", path: "/rewards/admin", roles: HR, module: "rewards" },
    ],
  },
  {
    key: "docs",
    name: "Documents",
    icon: FileText,
    group: "main",
    pages: [
      { name: "My documents", path: "/docs", roles: EVERYONE, self: true },
      { name: "Letters", path: "/docs/letters", roles: HR },
      { name: "Templates", path: "/docs/templates", roles: HR },
    ],
  },
  {
    key: "reports",
    name: "Reports",
    icon: BarChart3,
    group: "main",
    pages: [
      { name: "Analytics", path: "/reports/dashboard", roles: MANAGERS },
      { name: "Reports", path: "/reports", roles: HR },
      { name: "BI connector", path: "/reports/bi", roles: ADMIN },
    ],
  },
  // ── On the right-hand rail (`QUICK_ACCESS`) ─────────────────────────────
  {
    key: "assistant",
    name: "Ask HR",
    icon: MessageCircleQuestion,
    group: "main",
    pages: [{ name: "Ask HR", path: "/assistant", roles: EVERYONE }],
  },
  {
    key: "assets",
    name: "Assets",
    icon: Laptop,
    group: "main",
    // CGB Helpdesk keeps the assets too: one product takes over Assets and Helpdesk.
    product: "helpdesk",
    pages: [
      { name: "My assets", path: "/assets", roles: EVERYONE, self: true },
      { name: "Asset register", path: "/assets/inventory", roles: HR },
      { name: "Asset requests", path: "/assets/requests", roles: MANAGERS },
      { name: "Categories", path: "/assets/categories", roles: HR },
    ],
    linkedPages: [
      { name: "My assets", path: "/linked/helpdesk/assets", roles: EVERYONE },
      // The helpdesk decides who sees its register: its engineers and admins, and HR.
      { name: "Asset register", path: "/linked/helpdesk/register", roles: HR, reach: EVERYONE },
    ],
  },
  {
    key: "helpdesk",
    name: "Helpdesk",
    icon: LifeBuoy,
    group: "main",
    product: "helpdesk",
    pages: [
      { name: "My tickets", path: "/helpdesk", roles: EVERYONE },
      { name: "Ticket queue", path: "/helpdesk/queue", roles: HR },
      // A category owner outside HR works their tickets here, linked from My tickets.
      { name: "My ticket queue", path: "/helpdesk/assigned", roles: EVERYONE, hidden: true },
      { name: "Categories", path: "/helpdesk/categories", roles: ADMIN },
    ],
    linkedPages: [
      // Also each ticket's own page, /linked/helpdesk/tickets/<id>.
      { name: "My tickets", path: "/linked/helpdesk/tickets", roles: EVERYONE },
      { name: "Overview", path: "/linked/helpdesk/overview", roles: EVERYONE },
      // IT staff in the helpdesk need not be HR here: the helpdesk decides who works its queues.
      { name: "Assigned to me", path: "/linked/helpdesk/assigned", roles: HR, reach: EVERYONE },
      { name: "Unassigned queue", path: "/linked/helpdesk/queue", roles: HR, reach: EVERYONE },
      { name: "All tickets", path: "/linked/helpdesk/all", roles: HR, reach: EVERYONE },
    ],
  },
  {
    key: "hiring",
    name: "Hiring",
    icon: Briefcase,
    group: "main",
    module: "hiring",
    product: "interview",
    pages: [
      { name: "Requisitions", path: "/hiring", roles: MANAGERS },
      { name: "Candidates", path: "/hiring/candidates", roles: MANAGERS },
      { name: "Interviews", path: "/hiring/interviews", roles: MANAGERS },
      { name: "Offers", path: "/hiring/offers", roles: HR },
      { name: "Talent pools", path: "/hiring/talent-pools", roles: HR },
      { name: "Refer a friend", path: "/hiring/referrals", roles: EVERYONE },
      { name: "Hiring analytics", path: "/hiring/analytics", roles: HR },
      { name: "Job boards", path: "/hiring/job-boards", roles: HR },
      { name: "Careers site", path: "/hiring/careers-site", roles: ADMIN },
    ],
    linkedPages: [
      { name: "Hiring overview", path: "/linked/interview/overview", roles: MANAGERS },
      { name: "Job openings", path: "/linked/interview/jobs", roles: MANAGERS },
      { name: "Candidates", path: "/linked/interview/candidates", roles: MANAGERS },
      { name: "Interviews", path: "/linked/interview/interviews", roles: MANAGERS },
    ],
  },
  // ── Admin ───────────────────────────────────────────────────────────────
  {
    key: "compliance",
    name: "Compliance",
    icon: ShieldCheck,
    group: "admin",
    pages: [
      { name: "Data protection", path: "/compliance", roles: ADMIN },
      { name: "Retention", path: "/compliance/retention", roles: ADMIN },
      { name: "Security", path: "/compliance/security", roles: ADMIN },
      { name: "AI governance", path: "/compliance/ai", roles: ADMIN },
    ],
  },
  {
    key: "settings",
    name: "Settings",
    icon: Settings,
    group: "admin",
    pages: [
      { name: "Company", path: "/settings", roles: ADMIN },
      { name: "Organisation", path: "/settings/organisation", roles: ADMIN },
      { name: "Users & roles", path: "/settings/users", roles: ADMIN },
      { name: "Modules", path: "/settings/modules", roles: ADMIN },
      { name: "Sign-in & SSO", path: "/settings/sso", roles: ADMIN },
      { name: "Connectors", path: "/settings/connectors", roles: ADMIN },
      // Where a product sends the admin back after Allow.
      { name: "Connecting", path: "/settings/connectors/callback", roles: ADMIN, hidden: true },
      { name: "Devices", path: "/settings/devices", roles: HR },
      { name: "Notifications", path: "/settings/notifications", roles: ADMIN },
    ],
  },
  {
    key: "platform",
    name: "Platform",
    icon: Building2,
    group: "admin",
    pages: [{ name: "Workspaces", path: "/platform", roles: PLATFORM }],
  },
];

/** Signed-in pages that belong to no section but still need a guard. */
const STANDALONE: NavPage[] = [
  { name: "My profile", path: "/profile", roles: EVERYONE, icon: UserCircle2 },
  // On the account menu, beside My profile.
  { name: "My privacy", path: "/compliance/privacy", roles: EVERYONE, icon: ShieldCheck },
  { name: "Notifications", path: "/notifications", roles: EVERYONE, icon: Bell },
  { name: "Client workspaces", path: "/operator", roles: HR, icon: Building2 },
  // Opens a linked product; the API decides who it admits.
  { name: "Opening", path: "/launch", roles: EVERYONE, icon: ExternalLink },
];

export function roleAllows(user: AuthUser | null, roles: Audience[]): boolean {
  if (!user) return false;
  if (user.role === "super_admin" || roles.includes(user.role)) return true;
  return Boolean(user.is_manager) && roles.includes("manager");
}

export function moduleEnabled(tenant: Tenant | null, module: string | undefined): boolean {
  return !module || Boolean(tenant?.enabled_modules?.[module]);
}

function matches(pathname: string, path: string): boolean {
  if (path === "/") return pathname === "/";
  return pathname === path || pathname.startsWith(`${path}/`);
}

/** The most specific declared page for a path, and its section. */
export function resolvePage(pathname: string): { page: NavPage; section?: NavSection } | null {
  let best: { page: NavPage; section?: NavSection } | null = null;
  const consider = (page: NavPage, section?: NavSection) => {
    if (matches(pathname, page.path) && (!best || page.path.length > best.page.path.length)) {
      best = { page, section };
    }
  };
  NAV.forEach((section) =>
    [...section.pages, ...(section.linkedPages ?? [])].forEach((page) => consider(page, section)),
  );
  STANDALONE.forEach((page) => consider(page));
  return best;
}

/** Our separate products: what each is called and who the portal offers it to. */
export const PRODUCTS: Record<ProductKey, { name: string; audience: Audience[] }> = {
  interview: { name: "Interviews", audience: MANAGERS },
  expense: { name: "Expenses", audience: EVERYONE },
  helpdesk: { name: "Helpdesk", audience: EVERYONE },
};

/** The linked product that has taken this section over, if any. */
export function linkedProduct(
  section: NavSection | undefined,
  tenant: Tenant | null,
): ProductKey | undefined {
  const product = section?.product;
  return product && tenant?.linked_products?.[product] ? product : undefined;
}

export type AccessDecision = "allowed" | "role" | "module" | "product";

/**
 * Whether the signed-in person may open a path.
 *
 * An undeclared path is refused rather than waved through: a page that exists
 * but is missing from this map should fail closed, and the missing entry is
 * then obvious in development.
 */
export function decideAccess(
  pathname: string,
  user: AuthUser | null,
  tenant: Tenant | null,
): AccessDecision {
  const resolved = resolvePage(pathname);
  if (!resolved) return "role";
  const { page, section } = resolved;
  const inLinked = Boolean(section?.linkedPages?.some((p) => p.path === page.path));
  const linkedOnly = inLinked && !section?.pages.some((p) => p.path === page.path);
  if (linkedProduct(section, tenant)) {
    // Linked: only the section's linked pages open; its built-in ones are retired.
    if (!inLinked) return "product";
  } else {
    if (linkedOnly) return "module";
    if (!moduleEnabled(tenant, section?.module)) return "module";
  }
  if (!moduleEnabled(tenant, page.module)) return "module";
  return roleAllows(user, page.reach ?? page.roles) ? "allowed" : "role";
}

/** The pages of a section this person may see, in navigation order. */
export function visiblePages(
  section: NavSection,
  user: AuthUser | null,
  tenant: Tenant | null,
): NavPage[] {
  const linked = linkedProduct(section, tenant);
  if (!linked && !moduleEnabled(tenant, section.module)) return [];
  const pages = linked ? (section.linkedPages ?? []) : section.pages;
  const hasRecord = Boolean(user?.employee_id);
  return pages.filter(
    (page) =>
      !page.hidden &&
      (hasRecord || !page.self) &&
      moduleEnabled(tenant, page.module) &&
      roleAllows(user, page.roles),
  );
}

/**
 * The sections kept on the right-hand rail instead of the navigation, top to
 * bottom: the companion, the hubs a linked product can take over, and the
 * self-service desks people reach for from any page.
 */
export const QUICK_ACCESS = ["companion", "assistant", "expenses", "helpdesk", "hiring", "assets"];

/** A section as a navigation rail shows it. */
export interface RailEntry {
  section: NavSection;
  pages: NavPage[];
  /** The linked product the row opens, where the person is offered it. */
  launch?: ProductKey;
}

/**
 * What a rail shows for a section: the pages this person may see and the linked
 * product it launches, or null when that leaves nothing to show.
 */
export function railEntry(
  section: NavSection,
  user: AuthUser | null,
  tenant: Tenant | null,
): RailEntry | null {
  const pages = visiblePages(section, user, tenant);
  const product = linkedProduct(section, tenant);
  const launch = product && roleAllows(user, PRODUCTS[product].audience) ? product : undefined;
  return pages.length > 0 || launch ? { section, pages, launch } : null;
}

export function sectionByKey(key: string): NavSection | undefined {
  return NAV.find((section) => section.key === key);
}
