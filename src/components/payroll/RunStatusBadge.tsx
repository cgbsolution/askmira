import { FileSpreadsheet, Lock } from "lucide-react";
import React from "react";

import { isRunLocked, RUN_STATUS } from "@/components/payroll/labels";
import { Badge } from "@/components/ui/badge";
import type { RunStatus } from "@/lib/types/payroll";

export function RunStatusBadge({ status }: { status: RunStatus }) {
  const meta = RUN_STATUS[status] ?? { label: status, variant: "muted" as const };
  return (
    <Badge variant={meta.variant}>
      {isRunLocked(status) && <Lock aria-label="Locked" />}
      {meta.label}
    </Badge>
  );
}

/**
 * Marks a run or payslip imported as paid on the previous payroll, so nobody
 * reads its figures as something AskMira computed.
 */
export function ImportedBadge({
  children = "Imported · factoHR",
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={className}
      title="Imported from the factoHR salary register as paid there; never recomputed"
    >
      <FileSpreadsheet aria-hidden />
      {children}
    </Badge>
  );
}
