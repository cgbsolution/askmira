import React from "react";

import { PAYOUT_STATUS } from "@/components/payroll/consultant-payouts/labels";
import { Badge } from "@/components/ui/badge";
import type { PayoutRunStatus } from "@/lib/types/consultant-payouts";

export function PayoutStatusBadge({ status }: { status: PayoutRunStatus }) {
  const meta = PAYOUT_STATUS[status] ?? {
    label: status,
    variant: "muted" as const,
  };
  return <Badge variant={meta.variant}>{meta.label}</Badge>;
}
