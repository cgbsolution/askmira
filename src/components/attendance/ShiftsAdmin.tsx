"use client";

import React from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { AssignmentsTab } from "./AssignmentsTab";
import { ImportPunchesTab } from "./ImportPunchesTab";
import { PeriodsTab } from "./PeriodsTab";
import { RostersTab } from "./RostersTab";
import { ShiftsTab } from "./ShiftsTab";
import { WorkLocationsTab } from "./WorkLocationsTab";

/**
 * HR's attendance set-up. Tier 1: shifts, rosters and locks decide payable days.
 */
export function ShiftsAdmin() {
  return (
    <Tabs defaultValue="shifts">
      <div className="no-scrollbar overflow-x-auto">
        <TabsList>
          <TabsTrigger value="shifts">Shifts</TabsTrigger>
          <TabsTrigger value="rosters">Rosters</TabsTrigger>
          <TabsTrigger value="assignments">Assignments</TabsTrigger>
          <TabsTrigger value="periods">Periods &amp; payroll lock</TabsTrigger>
          <TabsTrigger value="import">Import punches</TabsTrigger>
          <TabsTrigger value="locations">Work locations</TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="shifts" className="mt-4">
        <ShiftsTab />
      </TabsContent>
      <TabsContent value="rosters" className="mt-4">
        <RostersTab />
      </TabsContent>
      <TabsContent value="assignments" className="mt-4">
        <AssignmentsTab />
      </TabsContent>
      <TabsContent value="periods" className="mt-4">
        <PeriodsTab />
      </TabsContent>
      <TabsContent value="import" className="mt-4">
        <ImportPunchesTab />
      </TabsContent>
      <TabsContent value="locations" className="mt-4">
        <WorkLocationsTab />
      </TabsContent>
    </Tabs>
  );
}
