"use client";

import React, { useState } from "react";

import {
  financialYearStart,
  ForbiddenState,
  shortFinancialYear,
} from "@/components/payroll-ops/shared";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/AuthContext";

import { ADMIN_ROLES, FinancialYearSelect, HR_ROLES } from "./common";
import { ProofQueueTable, type QueueFilter } from "./ProofQueueTable";
import { WindowsAdmin } from "./WindowsAdmin";

/** HR's tax-proof workspace: the verification queue and, for admins, the windows. */
export function TaxProofsWorkspace() {
  const { hasRole, isLoading } = useAuth();
  const [startYear, setStartYear] = useState(financialYearStart());
  const [status, setStatus] = useState<QueueFilter>("pending");
  const financialYear = shortFinancialYear(startYear);

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }
  if (!hasRole(...HR_ROLES)) {
    return (
      <Card tier="tier1" className="py-0">
        <ForbiddenState message="Verifying tax proofs is for the payroll and HR team." />
      </Card>
    );
  }
  const isAdmin = hasRole(...ADMIN_ROLES);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Label htmlFor="tax-proofs-financial-year" className="text-sm text-muted-foreground">
            Financial year
          </Label>
          <FinancialYearSelect id="tax-proofs-financial-year" value={startYear} onChange={setStartYear} />
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="tax-proofs-status" className="text-sm text-muted-foreground">
            Show
          </Label>
          <Select value={status} onValueChange={(value) => setStatus(value as QueueFilter)}>
            <SelectTrigger id="tax-proofs-status" size="sm" className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Awaiting verification</SelectItem>
              <SelectItem value="all">All proofs</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <ProofQueueTable key={`${financialYear}-${status}`} financialYear={financialYear} status={status} />

      {isAdmin && <WindowsAdmin key={financialYear} financialYear={financialYear} />}
    </div>
  );
}
