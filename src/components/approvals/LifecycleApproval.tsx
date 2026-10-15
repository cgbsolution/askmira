"use client";

import { Check, Loader2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useState } from "react";
import { toast } from "sonner";

import { ApprovalChain } from "@/components/common/ApprovalChain";
import { ErrorState } from "@/components/common/ErrorState";
import { FormField } from "@/components/common/FormField";
import { Money } from "@/components/common/Money";
import { PageShell } from "@/components/common/PageShell";
import { EVENT_TYPE, FIELD_LABEL, apiMessage } from "@/components/people/labels";
import { EventStatusBadge } from "@/components/people/StatusBadges";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useApiQuery } from "@/hooks/useApiQuery";
import { post } from "@/lib/api";
import type { ApprovalStep } from "@/lib/types";
import type { LifecycleEvent } from "@/lib/types/people";
import { formatDate } from "@/lib/utils";

type DecidableEvent = LifecycleEvent & { approval_chain: ApprovalStep[]; caller_may_decide: boolean };

function shown(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

/**
 * One lifecycle event, for whoever its approval chain is waiting on — a
 * regional head or a finance controller an approval rule names, who has no
 * lifecycle screen of their own. What changes, what it sets off, who has
 * already decided, and the decision.
 */
export function LifecycleApproval({ eventId }: { eventId: string }) {
  const router = useRouter();
  const { data, error, isLoading, reload } = useApiQuery<DecidableEvent>(`/lifecycle/events/${eventId}`);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);

  const decide = async (approve: boolean) => {
    if (!approve && note.trim().length < 1) {
      toast.error("Say why it is not approved.");
      return;
    }
    setBusy(approve ? "approve" : "reject");
    try {
      await post(`/lifecycle/events/${eventId}/decide`, { approve, note: note.trim() });
      toast.success(approve ? "Approved." : "Not approved.");
      router.push("/approvals");
    } catch (caught) {
      toast.error(apiMessage(caught, "Could not record the decision."));
      reload();
    } finally {
      setBusy(null);
    }
  };

  const title = data ? `${EVENT_TYPE[data.event_type]} for ${data.employee_name}` : "Lifecycle approval";
  return (
    <PageShell title={title} description="A change to somebody's employment, waiting on your approval.">
      {isLoading && !data ? (
        <Skeleton className="h-64 w-full" />
      ) : error ? (
        <ErrorState message={error.detail} onRetry={reload} />
      ) : data ? (
        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <Card tier="tier1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                {EVENT_TYPE[data.event_type]} · {data.employee_code} <EventStatusBadge status={data.status} />
              </CardTitle>
              <CardDescription>
                Effective {formatDate(data.effective_from)}. {data.reason}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>What</TableHead>
                    <TableHead>Now</TableHead>
                    <TableHead>Becomes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(data.new_values).map(([field, value]) => (
                    <TableRow key={field}>
                      <TableCell>{FIELD_LABEL[field] ?? field.replace(/_/g, " ")}</TableCell>
                      <TableCell>{shown(data.previous_values[field])}</TableCell>
                      <TableCell className="font-medium">{shown(value)}</TableCell>
                    </TableRow>
                  ))}
                  {data.new_ctc_annual && (
                    <TableRow>
                      <TableCell>Annual CTC</TableCell>
                      <TableCell>—</TableCell>
                      <TableCell className="font-medium">
                        <Money value={data.new_ctc_annual} />
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              {data.consequences_shown.length > 0 && (
                <div className="grid gap-2">
                  <p className="text-sm font-medium text-foreground">What it sets off</p>
                  {data.consequences_shown.map((consequence, index) => (
                    <Alert key={index} variant={consequence.severity === "warning" ? "warning" : "default"}>
                      <AlertDescription>
                        {consequence.message}
                        {consequence.action_required ? ` ${consequence.action_required}` : ""}
                      </AlertDescription>
                    </Alert>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          <div className="grid content-start gap-6">
            <Card tier="tier1">
              <CardHeader>
                <CardTitle className="text-base">Approvers</CardTitle>
              </CardHeader>
              <CardContent>
                <ApprovalChain chain={data.approval_chain} />
              </CardContent>
            </Card>
            {data.caller_may_decide ? (
              <Card tier="tier1">
                <CardHeader>
                  <CardTitle className="text-base">Your decision</CardTitle>
                  <CardDescription>
                    Approving passes it to the next approver, or approves it if you are the last.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3">
                  <FormField htmlFor="lc-note" label="Note" hint="Needed if you do not approve.">
                    <Textarea id="lc-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
                  </FormField>
                  <div className="flex gap-2">
                    <Button disabled={busy !== null} onClick={() => void decide(true)}>
                      {busy === "approve" ? <Loader2 className="animate-spin" /> : <Check />} Approve
                    </Button>
                    <Button variant="destructive" disabled={busy !== null} onClick={() => void decide(false)}>
                      {busy === "reject" ? <Loader2 className="animate-spin" /> : <X />} Do not approve
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Alert>
                <AlertDescription>Nothing on this event is waiting on you now.</AlertDescription>
              </Alert>
            )}
          </div>
        </div>
      ) : null}
    </PageShell>
  );
}
