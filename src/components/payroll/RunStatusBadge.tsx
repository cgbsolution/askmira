import { Lock } from "lucide-react";
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
