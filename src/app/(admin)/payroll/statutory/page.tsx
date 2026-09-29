"use client";

import React from "react";

import { PageShell } from "@/components/common/PageShell";
import { BonusPanel } from "@/components/payroll/statutory/BonusPanel";
import { EsiCoveragePanel } from "@/components/payroll/statutory/EsiCoveragePanel";
import { PfElectionsPanel } from "@/components/payroll/statutory/PfElectionsPanel";
import { RegistersPanel } from "@/components/payroll/statutory/RegistersPanel";
import { WorkLocationsPanel } from "@/components/payroll/statutory/WorkLocationsPanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/** PF, ESI, state postings, statutory bonus and the prescribed registers. */
export default function StatutoryPage() {
  return (
    <PageShell title="Statutory" description="PF elections, ESI coverage, work locations, statutory bonus and registers.">
      <Tabs defaultValue="pf">
        <TabsList className="flex-wrap">
          <TabsTrigger value="pf">PF elections</TabsTrigger>
          <TabsTrigger value="esi">ESI coverage</TabsTrigger>
          <TabsTrigger value="locations">Work locations</TabsTrigger>
          <TabsTrigger value="bonus">Bonus</TabsTrigger>
          <TabsTrigger value="registers">Registers</TabsTrigger>
        </TabsList>
        <TabsContent value="pf" className="mt-4">
          <PfElectionsPanel />
        </TabsContent>
        <TabsContent value="esi" className="mt-4">
          <EsiCoveragePanel />
        </TabsContent>
        <TabsContent value="locations" className="mt-4">
          <WorkLocationsPanel />
        </TabsContent>
        <TabsContent value="bonus" className="mt-4">
          <BonusPanel />
        </TabsContent>
        <TabsContent value="registers" className="mt-4">
          <RegistersPanel />
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}
