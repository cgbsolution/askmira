import React from "react";

import { HOURS_STATUS } from "@/components/payroll/consultant-hours/labels";
import { Badge } from "@/components/ui/badge";
import type { HoursStatus } from "@/lib/types/consultant-hours";

export function HoursStatusBadge({ status }: { status: HoursStatus }) {
  const meta = HOURS_STATUS[status] ?? { label: status, variant: "muted" as const };
  return <Badge variant={meta.variant}>{meta.label}</Badge>;
}
