"use client";

import { Building2 } from "lucide-react";
import React, { useCallback, useState } from "react";

import { EmptyState } from "@/components/common/EmptyState";
import { NotLiveNotice, QueryBoundary } from "@/components/payroll-ops/shared";
import { FilingDetailDialog } from "@/components/payroll-ops/filings/FilingDetailDialog";
import { FilingsList } from "@/components/payroll-ops/filings/FilingsList";
import { GenerateReturnCard } from "@/components/payroll-ops/filings/GenerateReturnCard";
import { RETURN_LABEL } from "@/components/payroll-ops/filings/labels";
import { TdsChallansTab } from "@/components/payroll-ops/filings/TdsChallansTab";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApiQuery } from "@/hooks/useApiQuery";
import { get } from "@/lib/api";
import type { FilingRecord, LegalEntity, ReturnType } from "@/lib/types/payroll-ops";

/** Return filings (prompt 10): generate, validate, download, and record what the portal said. */
export function FilingsWorkspace() {
  const entities = useApiQuery<LegalEntity[]>("/org/legal-entities");
  const [version, setVersion] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(() => setVersion((current) => current + 1), []);

  /**
   * A 422 from generation carries a structured detail that lib/api.ts cannot
   * show. The blocked record is saved server-side, so reload the list and open
   * the newest blocked record of that return for that entity.
   */
  const handleBlocked = useCallback(
    async (returnType: ReturnType, legalEntityId: string, message: string) => {
      refresh();
      try {
        const rows = await get<FilingRecord[]>(
          `/filings?return_type=${returnType}&status=blocked`,
        );
        const newest = rows.find((row) => row.legal_entity_id === legalEntityId) ?? rows[0];
        if (newest) {
          setNotice(`${RETURN_LABEL[returnType]}: ${message}`);
          setOpenId(newest.id);
        }
      } catch {
        // The list below shows its own load error; the form already shows the refusal.
      }
    },
    [refresh],
  );

  return (
    <div className="grid gap-6">
      <NotLiveNotice title="Not yet accepted by a live government portal">
        <p>
          These files are generated to the published formats, but none has yet been uploaded to
          and accepted by a live government portal (EPFO, ESIC, state Professional Tax, or
          TRACES/FVU). Check each file before filing, and record the acknowledgement here after
          upload.
        </p>
      </NotLiveNotice>

      <QueryBoundary query={entities} skeletonRows={3}>
        {(rows) =>
          rows.length === 0 ? (
            <Card tier="tier1">
              <EmptyState
                icon={Building2}
                title="No legal entity is set up"
                description="Returns are filed per legal entity, against its PAN and TAN. Add the entity under organisation settings first."
              />
            </Card>
          ) : (
            <Tabs defaultValue="returns">
              <TabsList>
                <TabsTrigger value="returns">Returns</TabsTrigger>
                <TabsTrigger value="challans">TDS challans</TabsTrigger>
              </TabsList>
              <TabsContent value="returns" className="grid gap-4">
                <GenerateReturnCard
                  entities={rows}
                  onGenerated={refresh}
                  onBlocked={(type, entityId, message) =>
                    void handleBlocked(type, entityId, message)
                  }
                />
                <FilingsList
                  entities={rows}
                  version={version}
                  onOpen={(id) => {
                    setNotice(null);
                    setOpenId(id);
                  }}
                />
              </TabsContent>
              <TabsContent value="challans">
                <TdsChallansTab entities={rows} />
              </TabsContent>
            </Tabs>
          )
        }
      </QueryBoundary>

      <FilingDetailDialog
        recordId={openId}
        notice={notice}
        onClose={() => {
          setOpenId(null);
          setNotice(null);
        }}
        onChanged={refresh}
      />
    </div>
  );
}
