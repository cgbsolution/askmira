import { ApiError } from "@/lib/api";
import type { UserRole } from "@/lib/types";

/** Role names as an administrator reads them, not as the enum spells them. */
export const ROLE_LABEL: Record<UserRole, string> = {
  platform_admin: "Platform admin",
  tenant_admin: "Tenant admin",
  hr_admin: "HR admin",
  hr_ops: "HR ops",
  manager: "Manager",
  employee: "Employee",
};

/** What each role can reach, shown beside the choice rather than after it. */
export const ROLE_SCOPE: Record<UserRole, string> = {
  platform_admin: "Everything, across every workspace. Cannot be granted from here.",
  tenant_admin: "Everything in this workspace, including modules, roles and payroll approval.",
  hr_admin: "People, payroll, hiring and settings. Cannot grant tenant admin.",
  hr_ops: "Day-to-day HR and payroll operations. Cannot change roles or modules.",
  manager: "Their own team: approvals, attendance, appraisals and team reports.",
  employee: "Their own record, payslips, time off and the culture feed.",
};

/** The roles a workspace administrator may choose from. */
export const ASSIGNABLE_ROLES: UserRole[] = [
  "tenant_admin",
  "hr_admin",
  "hr_ops",
  "manager",
  "employee",
];

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
