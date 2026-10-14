"use client";

import React, { useCallback, useState } from "react";

import { ClearanceTemplates } from "@/components/exits/ClearanceTemplates";
import { useExitRoles } from "@/components/exits/common";
import { ExitDetailSheet } from "@/components/exits/ExitDetailSheet";
import { ExitPolicyCard } from "@/components/exits/ExitPolicyCard";
import { ExitReasonsPanel } from "@/components/exits/ExitReasonsPanel";
import { ExitsTable } from "@/components/exits/ExitsTable";
import { NoticeRecoveryCalculator } from "@/components/exits/NoticeRecoveryCalculator";
import { StartExitDialog } from "@/components/exits/StartExitDialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/**
 * /people/exits (prompt 13 §1): the exits a person can see, the clearance
 * checklist of each, and — for HR — the calculator, checklist setup and policy.
 */
export function ExitsWorkspace() {
  const { isHr, isManager } = useExitRoles();
  const [version, setVersion] = useState(0);
  const [openExitId, setOpenExitId] = useState<string | null>(null);
  const refresh = useCallback(() => setVersion((current) => current + 1), []);

  return (
    <>
      <Tabs defaultValue="exits">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList className="no-scrollbar max-w-full overflow-x-auto">
            <TabsTrigger value="exits">Exits</TabsTrigger>
            {isHr && <TabsTrigger value="reasons">Why people leave</TabsTrigger>}
            {isHr && <TabsTrigger value="recovery">Notice recovery</TabsTrigger>}
            {isHr && <TabsTrigger value="checklist">Checklist setup</TabsTrigger>}
            {isHr && <TabsTrigger value="policy">Policy</TabsTrigger>}
          </TabsList>
          {isManager && (
            <StartExitDialog
              onCreated={(record) => {
                refresh();
                setOpenExitId(record.id);
              }}
            />
          )}
        </div>

        <TabsContent value="exits">
          <ExitsTable version={version} onOpen={setOpenExitId} />
        </TabsContent>
        {isHr && (
          <TabsContent value="reasons">
            <ExitReasonsPanel />
          </TabsContent>
        )}
        {isHr && (
          <TabsContent value="recovery">
            <NoticeRecoveryCalculator />
          </TabsContent>
        )}
        {isHr && (
          <TabsContent value="checklist">
            <ClearanceTemplates />
          </TabsContent>
        )}
        {isHr && (
          <TabsContent value="policy">
            <ExitPolicyCard />
          </TabsContent>
        )}
      </Tabs>

      <ExitDetailSheet
        exitId={openExitId}
        onClose={() => setOpenExitId(null)}
        onChanged={refresh}
      />
    </>
  );
}
