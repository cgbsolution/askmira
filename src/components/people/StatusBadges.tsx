import React from "react";

import {
  EMPLOYMENT_STATUS,
  EVENT_STATUS,
  POSITION_STATUS,
} from "@/components/people/labels";
import { Badge } from "@/components/ui/badge";
import type { EmploymentStatus } from "@/lib/types";
import type { LifecycleStatus, PositionStatus } from "@/lib/types/people";

export function EmploymentStatusBadge({ status }: { status: EmploymentStatus }) {
  const meta = EMPLOYMENT_STATUS[status];
  return <Badge variant={meta.variant}>{meta.label}</Badge>;
}

export function PositionStatusBadge({ status }: { status: PositionStatus }) {
  const meta = POSITION_STATUS[status];
  return <Badge variant={meta.variant}>{meta.label}</Badge>;
}

export function EventStatusBadge({ status }: { status: LifecycleStatus }) {
  const meta = EVENT_STATUS[status];
  return <Badge variant={meta.variant}>{meta.label}</Badge>;
}

/** A labelled value in a read-only detail grid. */
export function DetailItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-0.5 truncate text-sm font-medium text-foreground">{children ?? "—"}</div>
    </div>
  );
}
