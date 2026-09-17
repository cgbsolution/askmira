"use client";

import { FileSearch } from "lucide-react";
import React, { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { EncashmentStatus, ExitReason, ServiceRounding } from "@/lib/types/payroll-ops";

export const ENCASHMENT_STATUS_LABEL: Record<EncashmentStatus, string> = {
  requested: "Requested",
  approved: "Approved",
  rejected: "Rejected",
  paid: "Paid",
  cancelled: "Cancelled",
};

const ENCASHMENT_STATUS_VARIANT: Record<
  EncashmentStatus,
  "warning" | "success" | "destructive" | "default" | "muted"
> = {
  requested: "warning",
  approved: "success",
  rejected: "destructive",
  paid: "default",
  cancelled: "muted",
};

export function EncashmentStatusBadge({ status }: { status: EncashmentStatus }) {
  return (
    <Badge variant={ENCASHMENT_STATUS_VARIANT[status]}>{ENCASHMENT_STATUS_LABEL[status]}</Badge>
  );
}

export const EXIT_REASON_LABEL: Record<ExitReason, string> = {
  resignation: "Resignation",
  retirement: "Retirement",
  termination: "Termination",
  death: "Death",
  disablement: "Disablement",
  end_of_contract: "End of contract",
};

export const SERVICE_ROUNDING_LABEL: Record<ServiceRounding, string> = {
  nearest_year_six_month_rule: "Nearest year (six months or more rounds up)",
  always_round_down: "Always round down",
  always_round_up: "Always round up",
  exact_fraction: "Exact fraction of a year",
};

function renderValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value, null, 2);
}

/**
 * The server's working for a computed figure, shown as it sent it.
 *
 * Plain text only — React escapes every value, nothing is rendered as HTML.
 */
export function WorkingButton({
  title,
  working,
}: {
  title: string;
  working: Record<string, unknown>;
}) {
  const [open, setOpen] = useState(false);
  const entries = Object.entries(working ?? {});
  if (entries.length === 0) return null;
  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <FileSearch /> Working
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>How the server arrived at this figure.</DialogDescription>
          </DialogHeader>
          <dl className="grid gap-2.5">
            {entries.map(([key, value]) => (
              <div key={key} className="grid gap-0.5 border-b border-border pb-2 last:border-0">
                <dt className="text-xs text-muted-foreground">{key.replace(/_/g, " ")}</dt>
                <dd className="text-sm break-words whitespace-pre-wrap text-foreground tabular-nums">
                  {renderValue(value)}
                </dd>
              </div>
            ))}
          </dl>
        </DialogContent>
      </Dialog>
    </>
  );
}
