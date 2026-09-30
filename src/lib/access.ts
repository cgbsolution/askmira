import {
  BarChart3,
  Bell,
  Briefcase,
  CalendarClock,
  CircleDollarSign,
  FileText,
  Gift,
  Heart,
  Inbox,
  Laptop,
  LayoutDashboard,
  LifeBuoy,
  Receipt,
  Rocket,
  Settings,
  ShieldCheck,
  Target,
  UserCircle2,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import type { AuthUser, Tenant, UserRole } from "@/lib/types";

/**
 * The web portal's information architecture and who may reach each part of it.
 *
 * One map drives both the navigation and the route guard, so a page cannot be
 * linked for a role and guarded differently. The role sets mirror the backend
 * routers' own (`HR_ROLES`, `ADMIN_ROLES`, …) — and the backend is still the
 * enforcement: this map decides what a person is shown, the API decides what
 * they get.
 *
 * `platform_admin` passes every check, as it does in `require_roles`.
 */

export const HR: UserRole[] = ["tenant_admin", "hr_admin", "hr_ops"];
export const ADMIN: UserRole[] = ["tenant_admin", "hr_admin"];
export const MANAGERS: UserRole[] = [...HR, "manager"];
export const EVERYONE: UserRole[] = [...HR, "manager", "employee"];

export interface NavPage {
  name: string;
  path: string;
  roles: UserRole[];
  /** Guarded but not listed in the section navigation (a create form, say). */
  hidden?: boolean;
  /** For a page outside any section, which has no section icon to borrow. */
  icon?: LucideIcon;
}

export interface NavSection {
  key: string;
  name: string;
  icon: LucideIcon;
  group: "me" | "company" | "operations" | "admin";
  /** Workspace module that must be switched on. Undefined = always available. */
  module?: string;
  pages: NavPage[];
}

export const GROUP_LABEL: Record<NavSection["group"], string> = {
  me: "Me",
  company: "Company",
  operations: "Operations",
  admin: "Admin",
};

export const NAV: NavSection[] = [
  {
    key: "home",
    name: "Home",
    icon: LayoutDashboard,
    group: "me",
    pages: [{ name: "Home", path: "/", roles: EVERYONE }],
  },
  {
    key: "approvals",
    name: "Approvals",
    icon: Inbox,
    group: "me",
    pages: [{ name: "Approvals", path: "/approvals", roles: EVERYONE }],
  },
  {
    key: "onboarding",
    name: "Onboarding",
    icon: Rocket,
    group: "me",
    pages: [
      { name: "My onboarding", path: "/onboarding", roles: EVERYONE },
      { name: "My tasks", path: "/onboarding/tasks", roles: EVERYONE },
      { name: "New joiners", path: "/onboarding/plans", roles: HR },
      { name: "Checklists", path: "/onboarding/templates", roles: HR },
    ],
  },
  {
    key: "time",
    name: "Time",
    icon: CalendarClock,
    group: "me",
    module: "leave",
    pages: [
      { name: "Time off", path: "/time", roles: EVERYONE },
      { name: "Attendance", path: "/time/attendance", roles: EVERYONE },
      { name: "Attendance review", path: "/time/attendance-review", roles: MANAGERS },
      { name: "Shifts & rosters", path: "/time/shifts", roles: HR },
    ],
  },
  {
    key: "pay",
    name: "My pay",
    icon: Wallet,
    group: "me",
    module: "payroll",
    pages: [
      { name: "Payslips", path: "/pay", roles: EVERYONE },
      { name: "Tax declarations", path: "/pay/tax", roles: EVERYONE },
      { name: "Loans & reimbursements", path: "/pay/loans", roles: EVERYONE },
    ],
  },
  {
    key: "expenses",
    name: "Expenses",
    icon: Receipt,
    group: "me",
    pages: [
      { name: "My claims", path: "/expenses", roles: EVERYONE },
      { name: "Travel & advances", path: "/expenses/travel", roles: EVERYONE },
      { name: "Team approvals", path: "/expenses/team", roles: MANAGERS },
      { name: "Finance review", path: "/expenses/review", roles: HR },
      { name: "Policies & rates", path: "/expenses/policies", roles: HR },
      { name: "GST credits", path: "/expenses/gst", roles: HR },
    ],
  },
  {
    key: "docs",
    name: "Documents",
    icon: FileText,
    group: "me",
    pages: [
      { name: "My documents", path: "/docs", roles: EVERYONE },
      { name: "Letters", path: "/docs/letters", roles: HR },
      { name: "Templates", path: "/docs/templates", roles: HR },
    ],
  },
  {
    key: "assets",
    name: "Assets",
    icon: Laptop,
    group: "me",
    pages: [
      { name: "My assets", path: "/assets", roles: EVERYONE },
      { name: "Asset register", path: "/assets/inventory", roles: HR },
      { name: "Asset requests", path: "/assets/requests", roles: MANAGERS },
      { name: "Categories", path: "/assets/categories", roles: HR },
    ],
  },
  {
    key: "helpdesk",
    name: "Helpdesk",
    icon: LifeBuoy,
    group: "me",
    pages: [
      { name: "My tickets", path: "/helpdesk", roles: EVERYONE },
      { name: "Ticket queue", path: "/helpdesk/queue", roles: HR },
      // A category owner outside HR works their tickets here, linked from My tickets.
      { name: "My ticket queue", path: "/helpdesk/assigned", roles: EVERYONE, hidden: true },
      { name: "Categories", path: "/helpdesk/categories", roles: ADMIN },
    ],
  },
  {
    key: "people",
    name: "People",
    icon: Users,
    group: "company",
    module: "core_hr",
    pages: [
      { name: "Directory", path: "/people", roles: EVERYONE },
      { name: "Org chart", path: "/people/org-chart", roles: EVERYONE },
      { name: "Positions", path: "/people/positions", roles: HR },
      { name: "Lifecycle events", path: "/people/lifecycle", roles: HR },
      { name: "Exits", path: "/people/exits", roles: MANAGERS },
      { name: "Clearance tasks", path: "/people/clearance", roles: EVERYONE },
      { name: "Profile changes", path: "/people/change-requests", roles: HR },
      { name: "Add employee", path: "/people/new", roles: HR, hidden: true },
    ],
  },
  {
    key: "culture",
    name: "Culture",
    icon: Heart,
    group: "company",
    module: "culture",
    pages: [
      { name: "Feed", path: "/culture", roles: EVERYONE },
      { name: "Clubs", path: "/culture/clubs", roles: EVERYONE },
      { name: "Awards", path: "/culture/awards", roles: EVERYONE },
      { name: "Surveys", path: "/culture/surveys", roles: EVERYONE },
      { name: "Announcements", path: "/culture/announcements", roles: EVERYONE },
      { name: "Culture admin", path: "/culture/admin", roles: HR },
    ],
  },
  {
    key: "rewards",
    name: "Rewards",
    icon: Gift,
    group: "company",
    module: "rewards",
    pages: [
      { name: "My points", path: "/rewards", roles: EVERYONE },
      { name: "Rewards admin", path: "/rewards/admin", roles: HR },
    ],
  },
  {
    key: "performance",
    name: "Performance",
    icon: Target,
    group: "company",
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
    key: "hiring",
    name: "Hiring",
    icon: Briefcase,
    group: "company",
    module: "hiring",
    pages: [
      { name: "Requisitions", path: "/hiring", roles: MANAGERS },
      { name: "Candidates", path: "/hiring/candidates", roles: MANAGERS },
      { name: "Interviews", path: "/hiring/interviews", roles: MANAGERS },
      { name: "Offers", path: "/hiring/offers", roles: HR },
      { name: "Refer a friend", path: "/hiring/referrals", roles: EVERYONE },
      { name: "Hiring analytics", path: "/hiring/analytics", roles: HR },
      { name: "Job boards", path: "/hiring/job-boards", roles: HR },
      { name: "Careers site", path: "/hiring/careers-site", roles: ADMIN },
    ],
  },
  {
    key: "payroll",
    name: "Payroll",
    icon: CircleDollarSign,
    group: "operations",
    module: "payroll",
    pages: [
      { name: "Payroll runs", path: "/payroll", roles: HR },
      { name: "Salaries", path: "/payroll/salaries", roles: HR },
      { name: "Salary structures", path: "/payroll/structures", roles: HR },
      { name: "Statutory", path: "/payroll/statutory", roles: HR },
      { name: "Rule sets", path: "/payroll/rule-sets", roles: HR },
      { name: "Return filings", path: "/payroll/filings", roles: HR },
      { name: "Bank files", path: "/payroll/disbursements", roles: HR },
      { name: "Arrears", path: "/payroll/arrears", roles: HR },
      { name: "Loans", path: "/payroll/loans", roles: HR },
      { name: "Full & final", path: "/payroll/settlements", roles: HR },
      { name: "Gratuity & encashment", path: "/payroll/gratuity", roles: HR },
      { name: "Tax proofs", path: "/payroll/tax-proofs", roles: HR },
    ],
  },
  {
    key: "reports",
    name: "Reports",
    icon: BarChart3,
    group: "operations",
    pages: [
      { name: "Reports", path: "/reports", roles: HR },
      { name: "BI connector", path: "/reports/bi", roles: ADMIN },
    ],
  },
  {
    key: "compliance",
    name: "Compliance",
    icon: ShieldCheck,
    group: "operations",
    pages: [
      { name: "My privacy", path: "/compliance/privacy", roles: EVERYONE },
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
      { name: "Devices", path: "/settings/devices", roles: HR },
      { name: "Notifications", path: "/settings/notifications", roles: ADMIN },
    ],
  },
];

/** Signed-in pages that belong to no section but still need a guard. */
const STANDALONE: NavPage[] = [
  { name: "My profile", path: "/profile", roles: EVERYONE, icon: UserCircle2 },
  { name: "Notifications", path: "/notifications", roles: EVERYONE, icon: Bell },
];

export function roleAllows(user: AuthUser | null, roles: UserRole[]): boolean {
  if (!user) return false;
  return user.role === "platform_admin" || roles.includes(user.role);
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
  NAV.forEach((section) => section.pages.forEach((page) => consider(page, section)));
  STANDALONE.forEach((page) => consider(page));
  return best;
}

export type AccessDecision = "allowed" | "role" | "module";

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
  if (!moduleEnabled(tenant, resolved.section?.module)) return "module";
  return roleAllows(user, resolved.page.roles) ? "allowed" : "role";
}

/** The pages of a section this person may see, in navigation order. */
export function visiblePages(
  section: NavSection,
  user: AuthUser | null,
  tenant: Tenant | null,
): NavPage[] {
  if (!moduleEnabled(tenant, section.module)) return [];
  return section.pages.filter((page) => !page.hidden && roleAllows(user, page.roles));
}

export function sectionByKey(key: string): NavSection | undefined {
  return NAV.find((section) => section.key === key);
}
