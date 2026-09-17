"use client";

import React, { useCallback, useMemo, useState } from "react";

import { NotLiveNotice } from "@/components/payroll-ops/shared";
import { BankProfilesTab } from "@/components/payroll-ops/disbursements/BankProfilesTab";
import { BatchDetailDialog } from "@/components/payroll-ops/disbursements/BatchDetailDialog";
import { BatchesTab } from "@/components/payroll-ops/disbursements/BatchesTab";
import { EmployeeAccountsTab } from "@/components/payroll-ops/disbursements/EmployeeAccountsTab";
import { PrepareBatchDialog } from "@/components/payroll-ops/disbursements/PrepareBatchDialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApiQuery } from "@/hooks/useApiQuery";
import { get } from "@/lib/api";
import type { Page } from "@/lib/types";
import type {
  BankProfile,
  BatchPrepareInput,
  DisbursementBatch,
  LegalEntity,
  PayrollRunSummary,
} from "@/lib/types/payroll-ops";

type Tab = "batches" | "profiles" | "accounts";

/** Bank disbursement (prompt 11): salary files with maker-checker, release and reconciliation. */
export function DisbursementsWorkspace() {
  const runsQuery = useApiQuery<Page<PayrollRunSummary>>("/payroll/runs?page_size=50");
  const profiles = useApiQuery<BankProfile[]>("/disbursement/bank-profiles");
  const entities = useApiQuery<LegalEntity[]>("/org/legal-entities");

  const [tab, setTab] = useState<Tab>("batches");
  const [version, setVersion] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [prepareOpen, setPrepareOpen] = useState(false);
  const [prepareInitial, setPrepareInitial] = useState<Partial<BatchPrepareInput> | null>(null);
  const [accountSearch, setAccountSearch] = useState("");

  const refresh = useCallback(() => setVersion((current) => current + 1), []);

  const disbursableRuns = useMemo(
    () =>
      (runsQuery.data?.items ?? []).filter(
        (run) => run.status === "approved" || run.status === "paid",
      ),
    [runsQuery.data],
  );
  const runsError = runsQuery.error ? runsQuery.error.detail : null;

  /**
   * A 422 on prepare carries a structured detail lib/api.ts cannot show. The
   * blocked batch is saved as "failed" with its exceptions: reload, find the
   * newest one for this run, and open its worklist.
   */
  const handleBlocked = useCallback(
    async (input: BatchPrepareInput, message: string) => {
      refresh();
      try {
        const rows = await get<DisbursementBatch[]>(
          `/disbursement/batches?payroll_run_id=${encodeURIComponent(input.payroll_run_id)}`,
        );
        const newest = rows
          .filter((row) => row.status === "failed" && row.validation_exceptions.length > 0)
          .sort((a, b) => (b.prepared_at ?? "").localeCompare(a.prepared_at ?? ""))[0];
        if (newest) {
          setNotice(message);
          setOpenId(newest.id);
        }
      } catch {
        // The batch list shows its own load error.
      }
    },
    [refresh],
  );

  return (
    <div className="grid gap-6">
      <NotLiveNotice title="Bank file formats not yet accepted by a real bank">
        <p>
          These salary files follow each bank&apos;s published layout, but none has yet been
          accepted by a real bank. Test with your bank before sending the first live salary file.
        </p>
      </NotLiveNotice>
      <p className="-mt-2 text-sm text-muted-foreground">
        Maker-checker: the person who prepares a batch cannot approve it, and regenerating a file
        voids its approval.
      </p>

      <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)}>
        <TabsList>
          <TabsTrigger value="batches">Salary files</TabsTrigger>
          <TabsTrigger value="profiles">Bank profiles</TabsTrigger>
          <TabsTrigger value="accounts">Employee accounts</TabsTrigger>
        </TabsList>
        <TabsContent value="batches">
          <BatchesTab
            runs={runsQuery.data?.items ?? []}
            runsError={runsError}
            version={version}
            onPrepare={() => {
              setPrepareInitial(null);
              setPrepareOpen(true);
            }}
            onOpen={(id) => {
              setNotice(null);
              setOpenId(id);
            }}
          />
        </TabsContent>
        <TabsContent value="profiles">
          <BankProfilesTab query={profiles} entities={entities.data ?? []} />
        </TabsContent>
        <TabsContent value="accounts">
          <EmployeeAccountsTab initialSearch={accountSearch} />
        </TabsContent>
      </Tabs>

      <PrepareBatchDialog
        open={prepareOpen}
        onOpenChange={setPrepareOpen}
        runs={disbursableRuns}
        runsError={runsError}
        profiles={profiles.data ?? []}
        initial={prepareInitial}
        onPrepared={(batch) => {
          refresh();
          setNotice(null);
          setOpenId(batch.id);
        }}
        onBlocked={(input, message) => void handleBlocked(input, message)}
      />

      <BatchDetailDialog
        batchId={openId}
        notice={notice}
        onClose={() => {
          setOpenId(null);
          setNotice(null);
        }}
        onChanged={refresh}
        onOpenBatch={(id) => {
          setNotice(null);
          setOpenId(id);
        }}
        onFixAccount={(subject) => {
          setAccountSearch(subject);
          setTab("accounts");
        }}
        onPrepareAgain={(input) => {
          setOpenId(null);
          setNotice(null);
          setPrepareInitial(input);
          setPrepareOpen(true);
        }}
      />
    </div>
  );
}
