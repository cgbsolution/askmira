import React from "react";

import { Badge } from "@/components/ui/badge";
import type { EmployeeSummary } from "@/lib/types";
import type {
  BankFileFormat,
  DisbursementStatus,
  LineStatus,
  VerificationMethod,
} from "@/lib/types/payroll-ops";

export const BATCH_STATUS_LABEL: Record<DisbursementStatus, string> = {
  draft: "Draft",
  pending_approval: "Awaiting approval",
  approved: "Approved",
  released: "Released to bank",
  acknowledged: "Reconciled",
  failed: "Blocked / superseded",
};

const BATCH_STATUS_VARIANT: Record<
  DisbursementStatus,
  "muted" | "warning" | "default" | "secondary" | "success" | "destructive"
> = {
  draft: "muted",
  pending_approval: "warning",
  approved: "secondary",
  released: "default",
  acknowledged: "success",
  failed: "destructive",
};

export function BatchStatusBadge({ status }: { status: DisbursementStatus }) {
  return <Badge variant={BATCH_STATUS_VARIANT[status]}>{BATCH_STATUS_LABEL[status]}</Badge>;
}

export const LINE_STATUS_LABEL: Record<LineStatus, string> = {
  pending: "Pending",
  credited: "Credited",
  failed: "Failed",
  reissued: "Reissued",
};

export function LineStatusBadge({ status }: { status: LineStatus }) {
  const variant =
    status === "credited"
      ? "success"
      : status === "failed"
        ? "destructive"
        : status === "reissued"
          ? "secondary"
          : "muted";
  return <Badge variant={variant}>{LINE_STATUS_LABEL[status]}</Badge>;
}

export const FORMAT_LABEL: Record<BankFileFormat, string> = {
  hdfc: "HDFC Bank",
  icici: "ICICI Bank",
  sbi: "State Bank of India",
  axis: "Axis Bank",
  kotak: "Kotak Mahindra Bank",
  generic_neft: "Generic NEFT",
};

export const VERIFICATION_LABEL: Record<VerificationMethod, string> = {
  penny_drop: "Penny drop",
  manual: "Checked manually",
  none: "Not verified",
};

/** Indian Financial System Code: 4 letters, a zero, 6 letters or digits. */
export const IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/;

export function employeeDisplayName(employee: EmployeeSummary): string {
  return (
    employee.display_name ??
    [employee.first_name, employee.last_name].filter(Boolean).join(" ")
  );
}

export { formatTimestamp } from "@/components/payroll-ops/disbursements/common";
