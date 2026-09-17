"use client";

import { UserX } from "lucide-react";
import React, { useCallback, useState } from "react";

import { EmptyState } from "@/components/common/EmptyState";
import { financialYearStart, shortFinancialYear } from "@/components/payroll-ops/shared";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/context/AuthContext";

import { FinancialYearSelect } from "./common";
import { DeclarationsPanel } from "./DeclarationsPanel";
import { Form12BBPanel } from "./Form12BBPanel";
import { HouseRentPanel } from "./HouseRentPanel";
import { PreviousEmployerPanel } from "./PreviousEmployerPanel";
import { ProjectionPanel } from "./ProjectionPanel";
import { RegimePanel } from "./RegimePanel";
import { WindowsStrip } from "./WindowsStrip";

/**
 * The employee's own tax screen (prompt 07). The server resolves "mine" from
 * the session, so no employee id is ever sent. Every save bumps `version`,
 * which refreshes the projection, the regime comparison and the Form 12BB
 * claims — a live preview of what the change does to TDS.
 */
export function TaxSelfService() {
  const { user, isLoading } = useAuth();
  const [startYear, setStartYear] = useState(financialYearStart());
  const [version, setVersion] = useState(0);
  const bump = useCallback(() => setVersion((current) => current + 1), []);
  const financialYear = shortFinancialYear(startYear);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-28 w-full" />
      </div>
    );
  }

  if (!user?.employee_id) {
    return (
      <Card tier="tier1" className="py-0">
        <EmptyState
          icon={UserX}
          title="Your login is not linked to an employee record"
          description="Tax declarations, proofs and TDS projections belong to an employee record. Ask your HR admin to link your login to your employee profile."
        />
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <Label htmlFor="tax-financial-year" className="text-sm text-muted-foreground">
          Financial year
        </Label>
        <FinancialYearSelect value={startYear} onChange={setStartYear} />
      </div>

      <WindowsStrip key={`windows-${financialYear}`} financialYear={financialYear} />

      <Tabs defaultValue="regime">
        <div className="max-w-full overflow-x-auto">
          <TabsList>
            <TabsTrigger value="regime">Regime</TabsTrigger>
            <TabsTrigger value="declarations">Declarations</TabsTrigger>
            <TabsTrigger value="rent">House rent</TabsTrigger>
            <TabsTrigger value="previous">Previous employer</TabsTrigger>
            <TabsTrigger value="projection">Projection</TabsTrigger>
            <TabsTrigger value="form12bb">Form 12BB</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="regime">
          <RegimePanel
            key={financialYear}
            financialYear={financialYear}
            version={version}
            onChanged={bump}
          />
        </TabsContent>
        <TabsContent value="declarations">
          <DeclarationsPanel key={financialYear} financialYear={financialYear} onChanged={bump} />
        </TabsContent>
        <TabsContent value="rent">
          <HouseRentPanel key={financialYear} financialYear={financialYear} onChanged={bump} />
        </TabsContent>
        <TabsContent value="previous">
          <PreviousEmployerPanel key={financialYear} financialYear={financialYear} onChanged={bump} />
        </TabsContent>
        <TabsContent value="projection">
          <ProjectionPanel key={financialYear} financialYear={financialYear} version={version} />
        </TabsContent>
        <TabsContent value="form12bb">
          <Form12BBPanel key={financialYear} financialYear={financialYear} version={version} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
