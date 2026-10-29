import { ApiError } from "@/lib/api";
import type { EmploymentStatus } from "@/lib/types";
import type {
  EmploymentType,
  Gender,
  LifecycleEventType,
  LifecycleStatus,
  PositionStatus,
} from "@/lib/types/people";

type BadgeVariant = "success" | "warning" | "muted" | "outline" | "destructive" | "secondary" | "accent";

export const EMPLOYMENT_STATUS: Record<EmploymentStatus, { label: string; variant: BadgeVariant }> = {
  active: { label: "Active", variant: "success" },
  on_notice: { label: "On notice", variant: "warning" },
  on_leave: { label: "On leave", variant: "outline" },
  exited: { label: "Exited", variant: "muted" },
  pre_joining: { label: "Pre-joining", variant: "outline" },
};

export const EMPLOYMENT_TYPE: Record<EmploymentType, string> = {
  full_time: "Full time",
  part_time: "Part time",
  contract: "Contract",
  intern: "Intern",
  consultant: "Consultant",
};

export const GENDER: Record<Gender, string> = {
  female: "Female",
  male: "Male",
  non_binary: "Non-binary",
  undisclosed: "Prefer not to say",
};

export const POSITION_STATUS: Record<PositionStatus, { label: string; variant: BadgeVariant }> = {
  approved: { label: "Approved", variant: "secondary" },
  filled: { label: "Filled", variant: "success" },
  vacant: { label: "Vacant", variant: "warning" },
  frozen: { label: "Frozen", variant: "outline" },
  abolished: { label: "Abolished", variant: "muted" },
};

export const EVENT_TYPE: Record<LifecycleEventType, string> = {
  confirmation: "Confirmation",
  probation_extension: "Probation extension",
  transfer: "Transfer",
  promotion: "Promotion",
  demotion: "Demotion",
  redesignation: "Redesignation",
  deputation: "Deputation",
  grade_change: "Grade change",
  department_change: "Department change",
  location_change: "Location change",
  manager_change: "Manager change",
  employment_type_change: "Employment type change",
};

/** The fields each event type may change — mirrors CHANGED_FIELDS in the backend engine. */
export const EVENT_FIELDS: Record<LifecycleEventType, string[]> = {
  confirmation: ["probation_end_date"],
  probation_extension: ["probation_end_date"],
  transfer: ["legal_entity_id", "location_id", "department_id", "manager_id", "designation"],
  promotion: ["grade", "designation", "manager_id"],
  demotion: ["grade", "designation"],
  redesignation: ["designation"],
  deputation: ["location_id", "department_id", "manager_id"],
  grade_change: ["grade"],
  department_change: ["department_id", "manager_id"],
  location_change: ["location_id"],
  manager_change: ["manager_id"],
  employment_type_change: ["employment_type", "notice_period_days"],
};

export const FIELD_LABEL: Record<string, string> = {
  status: "Status",
  probation_end_date: "Probation end date",
  legal_entity_id: "Company",
  location_id: "Location",
  department_id: "Department",
  manager_id: "Manager",
  designation: "Designation",
  grade: "Grade",
  employment_type: "Employment type",
  notice_period_days: "Notice period (days)",
};

export const EVENT_STATUS: Record<LifecycleStatus, { label: string; variant: BadgeVariant }> = {
  draft: { label: "Draft", variant: "outline" },
  pending_approval: { label: "Awaiting approval", variant: "warning" },
  approved: { label: "Approved", variant: "secondary" },
  effected: { label: "Effected", variant: "success" },
  cancelled: { label: "Cancelled", variant: "muted" },
  failed: { label: "Failed", variant: "destructive" },
};

export function personName(person: {
  display_name: string | null;
  first_name: string;
  last_name: string | null;
}): string {
  return person.display_name || [person.first_name, person.last_name].filter(Boolean).join(" ");
}

/** The API's own words for a failure, or a plain fallback. */
export function apiMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return error.detail;
  return fallback;
}

export function isForbidden(error: unknown): boolean {
  return error instanceof ApiError && error.status === 403;
}

/** Radix Select cannot hold an empty value; this stands for "none". */
export const NONE = "__none__";

export function fromSelect(value: string): string | null {
  return value === NONE ? null : value;
}

export function currentFinancialYear(today = new Date()): string {
  const start = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
  return `FY ${start}-${String(start + 1).slice(-2)}`;
}
