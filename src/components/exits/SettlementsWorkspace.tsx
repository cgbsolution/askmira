"use client";

import { ShieldAlert } from "lucide-react";
import React, { useCallback, useState } from "react";

import { AwaitingSettlementTable } from "@/components/exits/AwaitingSettlementTable";
import { personLabel } from "@/components/exits/common";
import { ComputeSettlementDialog } from "@/components/exits/ComputeSettlementDialog";
import { SettlementSheet } from "@/components/exits/SettlementSheet";
import { SettlementsTable } from "@/components/exits/SettlementsTable";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/**
 * /payroll/settlements (prompt 13 §2-5): exits waiting for a full & final
 * settlement, and the settlements computed so far with their statements.
 */
export function SettlementsWorkspace() {
  const [tab, setTab] = useState("awaiting");
  const [version, setVersion] = useState(0);
  const [computeFor, setComputeFor] = useState<{ exitId: string; label: string } | null>(null);
  const [openExitId, setOpenExitId] = useState<string | null>(null);
  const refresh = useCallback(() => setVersion((current) => current + 1), []);

  return (
    <>
      <Alert variant="warning">
        <ShieldAlert />
        <AlertTitle>Tax on settlements needs review</AlertTitle>
        <AlertDescription>
          <p>
            Tax on a settlement is recomputed from the actual figures entered here. It needs
            Compliance SME review before it is relied on.
          </p>
        </AlertDescription>
      </Alert>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="awaiting">Awaiting settlement</TabsTrigger>
          <TabsTrigger value="settlements">Settlements</TabsTrigger>
        </TabsList>
        <TabsContent value="awaiting">
          <AwaitingSettlementTable
            version={version}
            onCompute={(record) =>
              setComputeFor({
                exitId: record.id,
                label: personLabel(record.employee_name, record.employee_code),
              })
            }
          />
        </TabsContent>
        <TabsContent value="settlements">
          <SettlementsTable version={version} onOpen={setOpenExitId} />
        </TabsContent>
      </Tabs>

      <ComputeSettlementDialog
        exitId={computeFor?.exitId ?? null}
        employeeLabel={computeFor?.label ?? ""}
        onClose={() => setComputeFor(null)}
        onComputed={(settlement) => {
          setComputeFor(null);
          refresh();
          setTab("settlements");
          setOpenExitId(settlement.exit_record_id);
        }}
      />

      <SettlementSheet
        exitId={openExitId}
        onClose={() => setOpenExitId(null)}
        onChanged={refresh}
        onRecompute={(exitId, label) => {
          setOpenExitId(null);
          setComputeFor({ exitId, label });
        }}
      />
    </>
  );
}
