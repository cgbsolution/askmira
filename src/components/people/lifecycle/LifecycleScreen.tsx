"use client";

import { PageShell } from "@/components/common/PageShell";
import { SectionNav } from "@/components/common/SectionNav";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { BatchesTab } from "./BatchesTab";
import { EventsTab } from "./EventsTab";
import { ProbationTab } from "./ProbationTab";

/**
 * People → Lifecycle events.
 *
 * Confirmations, transfers, promotions and the rest are events, not field
 * edits: each is previewed, approved, and applied on its effective date as one
 * cascade — record, pay and letter together, or none of them.
 */
export function LifecycleScreen() {
  return (
    <PageShell
      title="Lifecycle events"
      description="Confirmations, transfers, promotions and other changes — previewed, approved, and applied on their effective date."
    >
      <SectionNav section="people" />
      <Tabs defaultValue="events">
        <TabsList>
          <TabsTrigger value="events">Events</TabsTrigger>
          <TabsTrigger value="batches">Batches</TabsTrigger>
          <TabsTrigger value="probation">Probation</TabsTrigger>
        </TabsList>
        <TabsContent value="events" className="mt-4">
          <EventsTab />
        </TabsContent>
        <TabsContent value="batches" className="mt-4">
          <BatchesTab />
        </TabsContent>
        <TabsContent value="probation" className="mt-4">
          <ProbationTab />
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}
