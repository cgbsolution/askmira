"use client";

import React from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Claim } from "@/lib/types/expenses";
import { formatDay } from "@/lib/utils";

import {
  CLAIM_KIND_LABEL,
  ClaimStatusBadge,
  VerdictBadge,
  formatMoney,
  humanizeKey,
} from "./shared";

/** The person's own claims. A row opens the full detail. */
export function ClaimsTable({
  claims,
  currency,
  onSelect,
}: {
  claims: Claim[];
  currency: string;
  onSelect: (claim: Claim) => void;
}) {
  return (
    <Card tier="tier1" className="py-2">
      <CardContent className="overflow-x-auto px-2">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Policy</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Flags</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {claims.map((claim) => {
              const foreign = claim.original_currency !== currency;
              return (
                <TableRow
                  key={claim.id}
                  tabIndex={0}
                  className="cursor-pointer"
                  onClick={() => onSelect(claim)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelect(claim);
                    }
                  }}
                >
                  <TableCell className="whitespace-nowrap tabular-nums">
                    {formatDay(claim.incurred_on, true)}
                  </TableCell>
                  <TableCell className="font-medium">{humanizeKey(claim.category_key)}</TableCell>
                  <TableCell>{CLAIM_KIND_LABEL[claim.kind]}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    <div>{formatMoney(claim.amount, currency)}</div>
                    {foreign && (
                      <div className="text-xs text-muted-foreground">
                        {formatMoney(claim.original_amount, claim.original_currency)}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <VerdictBadge kind={claim.policy_verdict} />
                  </TableCell>
                  <TableCell>
                    <ClaimStatusBadge status={claim.status} />
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {claim.flagged_for_approver && <Badge variant="warning">Flagged</Badge>}
                      {claim.exceeds_route_tolerance && <Badge variant="warning">Route variance</Badge>}
                      {!claim.flagged_for_approver && !claim.exceeds_route_tolerance && (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
