"use client";

import { BadgeCheck, FileJson, ShieldAlert } from "lucide-react";
import React, { useMemo, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { DataPanel } from "@/components/common/DataPanel";
import { PageShell } from "@/components/common/PageShell";
import { RequireRole } from "@/components/common/RequireRole";
import { apiMessage, formatMoment, RULE_TYPE_LABEL } from "@/components/payroll/labels";
import { NewRuleSetDialog } from "@/components/payroll/NewRuleSetDialog";
import { StatutoryUpdates } from "@/components/payroll/StatutoryUpdates";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useApiQuery } from "@/hooks/useApiQuery";
import { post } from "@/lib/api";
import { ADMIN } from "@/lib/access";
import type { RuleSet } from "@/lib/types/payroll";
import { formatDay } from "@/lib/utils";

/**
 * Statutory rule sets and the Compliance SME's sign-off.
 *
 * Read-only rules: a correction is a new effective-dated version, never an
 * edit. Nothing here is seeded — every version on screen was entered by a
 * person, and payroll refuses any that has not been approved.
 */
export default function RuleSetsPage() {
  const { data, error, isLoading, reload } = useApiQuery<RuleSet[]>("/payroll/rule-sets");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [approving, setApproving] = useState<RuleSet | null>(null);

  const groups = useMemo(() => {
    const map = new Map<string, RuleSet[]>();
    for (const row of data ?? []) {
      const key = `${row.rule_type}|${row.jurisdiction}`;
      map.set(key, [...(map.get(key) ?? []), row]);
    }
    return [...map.entries()];
  }, [data]);

  const selected = (data ?? []).find((row) => row.id === selectedId) ?? null;

  const approve = async () => {
    if (!approving) return;
    try {
      await post<RuleSet>(`/payroll/rule-sets/${approving.id}/approve`, { attest: true });
      toast.success("Rule set approved.");
      reload();
    } catch (caught) {
      toast.error(apiMessage(caught, "Could not approve this rule set."));
      throw caught;
    }
  };

  return (
    <PageShell
      title="Rule sets"
      description="Versioned statutory rules, effective-dated by jurisdiction. Payroll computes only against approved versions."
      actions={
        <RequireRole roles={ADMIN}>
          <NewRuleSetDialog onCreated={reload} />
        </RequireRole>
      }
    >
      <Alert variant="warning">
        <ShieldAlert />
        <AlertTitle>Rates come from your Compliance SME, not from AskMira</AlertTitle>
        <AlertDescription>
          No statutory rate ships with the product. Each version is entered with its source and
          approved by someone other than the person who entered it.
        </AlertDescription>
      </Alert>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <DataPanel
          title="Versions"
          isLoading={isLoading && !data}
          error={error?.detail}
          onRetry={reload}
          isEmpty={groups.length === 0}
          empty={{
            icon: FileJson,
            title: "No rule sets entered",
            description:
              "Payroll cannot compute until PF and income tax rules — and each state's Professional Tax — are entered and approved.",
          }}
        >
          <div className="divide-y divide-border">
            {groups.map(([key, versions]) => (
              <div key={key} className="px-5 py-3">
                <p className="text-sm font-semibold text-foreground">
                  {RULE_TYPE_LABEL[versions[0].rule_type] ?? versions[0].rule_type} ·{" "}
                  {versions[0].jurisdiction}
                </p>
                <ul className="mt-2 space-y-1.5">
                  {versions.map((row) => (
                    <li key={row.id}>
                      <Button
                        variant={selectedId === row.id ? "secondary" : "ghost"}
                        className="h-auto w-full justify-between gap-3 px-3 py-2 text-left"
                        onClick={() => setSelectedId(row.id)}
                      >
                        <span className="min-w-0">
                          <span className="block text-sm">Version {row.version}</span>
                          <span className="block text-xs text-muted-foreground">
                            {formatDay(row.effective_from, true)} –{" "}
                            {row.effective_to ? formatDay(row.effective_to, true) : "open"}
                          </span>
                        </span>
                        <Badge variant={row.is_approved ? "success" : "warning"}>
                          {row.is_approved ? "Approved" : "Awaiting approval"}
                        </Badge>
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </DataPanel>

        <Card tier="tier1" className="h-fit">
          {selected ? (
            <>
              <CardHeader>
                <CardTitle>
                  {RULE_TYPE_LABEL[selected.rule_type] ?? selected.rule_type} ·{" "}
                  {selected.jurisdiction} · version {selected.version}
                </CardTitle>
                <CardDescription>
                  Effective {formatDay(selected.effective_from, true)}
                  {selected.effective_to ? ` to ${formatDay(selected.effective_to, true)}` : ""}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                  <dt className="text-muted-foreground">Source</dt>
                  <dd>{selected.source_reference ?? "—"}</dd>
                  <dt className="text-muted-foreground">Entered</dt>
                  <dd>
                    {formatMoment(selected.created_at)}
                    {selected.created_by_name ? ` by ${selected.created_by_name}` : ""}
                  </dd>
                  <dt className="text-muted-foreground">Approved</dt>
                  <dd>
                    {selected.is_approved
                      ? `${formatMoment(selected.approved_at)}${selected.approved_by_name ? ` by ${selected.approved_by_name}` : ""}`
                      : "Not yet"}
                  </dd>
                  {selected.notes && (
                    <>
                      <dt className="text-muted-foreground">Notes</dt>
                      <dd>{selected.notes}</dd>
                    </>
                  )}
                </dl>
                <ScrollArea className="h-80 rounded-md border border-border bg-muted/40">
                  <pre className="p-3 text-xs whitespace-pre-wrap text-foreground">
                    {JSON.stringify(selected.rules, null, 2)}
                  </pre>
                </ScrollArea>
                {!selected.is_approved && (
                  <RequireRole roles={ADMIN}>
                    {selected.caller_may_approve ? (
                      <Button onClick={() => setApproving(selected)}>
                        <BadgeCheck /> Approve this version
                      </Button>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        You entered this version, so someone else approves it.
                      </p>
                    )}
                  </RequireRole>
                )}
              </CardContent>
            </>
          ) : (
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Choose a version to see its rules.
            </CardContent>
          )}
        </Card>
      </div>

      <ConfirmDialog
        open={approving !== null}
        onOpenChange={(open) => !open && setApproving(null)}
        title="Approve this rule set?"
        confirmLabel="I attest, approve"
        description={
          approving ? (
            <>
              You are attesting that every value in the{" "}
              {RULE_TYPE_LABEL[approving.rule_type] ?? approving.rule_type} rules for{" "}
              {approving.jurisdiction}, version {approving.version}, matches{" "}
              <strong>{approving.source_reference ?? "its cited source"}</strong> and applies from{" "}
              {formatDay(approving.effective_from, true)}. Payroll runs dated on or after that day
              will compute with it, and any earlier open version will be closed the day before.
              Your name and the time are recorded.
            </>
          ) : undefined
        }
        onConfirm={approve}
      />

      <div className="mt-6">
        <StatutoryUpdates onDrafted={reload} />
      </div>
    </PageShell>
  );
}
