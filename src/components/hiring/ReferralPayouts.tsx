import React from "react";

import { Money } from "@/components/common/Money";
import { Badge } from "@/components/ui/badge";
import type { ReferralPayout } from "@/lib/types/hiring";
import { formatDay } from "@/lib/utils";

const PAYOUT_STATUS: Record<ReferralPayout["status"], [string, "secondary" | "success" | "muted"]> = {
  scheduled: ["Scheduled", "secondary"],
  paid: ["Paid", "success"],
  forfeited: ["Forfeited", "muted"],
};

/**
 * A referral's bonus instalments: amount, when each falls due, whether it was
 * paid and under which payroll reference. `renderAction` adds a per-payout
 * control (HR's "Mark paid").
 */
export function ReferralPayouts({
  payouts,
  renderAction,
}: {
  payouts: ReferralPayout[];
  renderAction?: (payout: ReferralPayout) => React.ReactNode;
}) {
  if (payouts.length === 0) {
    return <span className="text-xs text-muted-foreground">No payouts scheduled</span>;
  }
  return (
    <ul className="space-y-1.5">
      {payouts.map((payout) => {
        const [label, variant] = PAYOUT_STATUS[payout.status] ?? [payout.status, "muted"];
        return (
          <li key={payout.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            <span className="font-medium text-foreground">{payout.milestone}</span>
            <Money value={payout.amount} />
            <Badge variant={variant}>{label}</Badge>
            <span className="text-muted-foreground">
              {payout.status === "paid" && payout.paid_at
                ? `paid ${formatDay(payout.paid_at, true)}`
                : `payable ${formatDay(payout.payable_on, true)}`}
            </span>
            {payout.payroll_reference && (
              <span className="text-muted-foreground">· Payroll ref {payout.payroll_reference}</span>
            )}
            {renderAction?.(payout)}
          </li>
        );
      })}
    </ul>
  );
}
