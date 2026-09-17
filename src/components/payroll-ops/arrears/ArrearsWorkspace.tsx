"use client";

import { Building2, Info } from "lucide-react";
import React, { useCallback, useState } from "react";

import { EmptyState } from "@/components/common/EmptyState";
import { QueryBoundary } from "@/components/payroll-ops/shared";
import { ArrearBatchDialog } from "@/components/payroll-ops/arrears/ArrearBatchDialog";
import { ArrearBatchesTab } from "@/components/payroll-ops/arrears/ArrearBatchesTab";
import { NewRevisionTab } from "@/components/payroll-ops/arrears/NewRevisionTab";
import { RevisionHistoryTab } from "@/components/payroll-ops/arrears/RevisionHistoryTab";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApiQuery } from "@/hooks/useApiQuery";
import type { LegalEntity } from "@/lib/types/payroll-ops";

type Tab = "batches" | "new" | "history";

/** Arrears (prompt 12): retrospective revisions, arrear batches and Section 89(1) relief. */
export function ArrearsWorkspace() {
  const entities = useApiQuery<LegalEntity[]>("/org/legal-entities");
  const [tab, setTab] = useState<Tab>("batches");
  const [version, setVersion] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);

  const refresh = useCallback(() => setVersion((current) => current + 1), []);

  return (
    <div className="grid gap-6">
      <Alert>
        <Info />
        <AlertTitle>How arrears work</AlertTitle>
        <AlertDescription>
          <p>
            Closed payroll runs are never rewritten. When a salary change reaches back into periods
            already paid, the arrear is the difference between what was paid and what should have
            been. It is paid inside a future payroll run once approved, not from this screen.
          </p>
        </AlertDescription>
      </Alert>

      <QueryBoundary query={entities} skeletonRows={3}>
        {(rows) =>
          rows.length === 0 ? (
            <Card tier="tier1">
              <EmptyState
                icon={Building2}
                title="No legal entity is set up"
                description="Arrears are computed per legal entity. Add the entity under organisation settings first."
              />
            </Card>
          ) : (
            <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)}>
              <TabsList>
                <TabsTrigger value="batches">Arrear batches</TabsTrigger>
                <TabsTrigger value="new">New revision</TabsTrigger>
                <TabsTrigger value="history">Revision history</TabsTrigger>
              </TabsList>
              <TabsContent value="batches">
                <ArrearBatchesTab entities={rows} version={version} onOpen={setOpenId} />
              </TabsContent>
              <TabsContent value="new">
                <NewRevisionTab
                  entities={rows}
                  onCommitted={(batch) => {
                    refresh();
                    setTab("batches");
                    setOpenId(batch.id);
                  }}
                />
              </TabsContent>
              <TabsContent value="history">
                <RevisionHistoryTab onOpenBatch={setOpenId} />
              </TabsContent>
            </Tabs>
          )
        }
      </QueryBoundary>

      <ArrearBatchDialog batchId={openId} onClose={() => setOpenId(null)} onChanged={refresh} />
    </div>
  );
}
