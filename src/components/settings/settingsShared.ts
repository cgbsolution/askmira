import { ApiError } from "@/lib/api";
import type { UserRole } from "@/lib/types";

/** Role names as an administrator reads them, not as the enum spells them. */
export const ROLE_LABEL: Record<UserRole, string> = {
  super_admin: "Super admin",
  admin: "Admin",
  sub_admin: "Sub-admin",
  employee: "Employee",
};

/** What each role can reach, shown beside the choice rather than after it. */
export const ROLE_SCOPE: Record<UserRole, string> = {
  super_admin: "Every workspace on the platform. Cannot be granted from here.",
  admin: "Everything in this workspace: settings, modules, logins and roles, payroll approval.",
  sub_admin: "Day-to-day HR and payroll work. Cannot change settings, roles or approve money.",
  employee:
    "Their own record, payslips, time off and the culture feed — plus their team's " +
    "approvals once somebody reports to them.",
};

/** The roles a workspace administrator may choose from. */
export const ASSIGNABLE_ROLES: UserRole[] = ["admin", "sub_admin", "employee"];

export function errorDetail(caught: unknown, fallback: string): string {
  return caught instanceof ApiError ? caught.detail : fallback;
}

export function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
