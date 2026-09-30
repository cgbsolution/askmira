"use client";

import { Check, ClipboardList, Loader2, Undo2, X } from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { DataPanel } from "@/components/common/DataPanel";
import { FormField } from "@/components/common/FormField";
import { apiMessage } from "@/components/people/labels";
import { ChangeRequestDiff } from "@/components/people/profile/ChangeRequestDiff";
import { CHANGE_STATUS } from "@/components/people/profile/labels";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useApiQuery } from "@/hooks/useApiQuery";
import { post } from "@/lib/api";
import type { ChangeRequest } from "@/lib/types/people";
import { formatDate } from "@/lib/utils";

/** HR approves (the change is applied there and then) or rejects with a note. */
export function DecisionDialog({
  request,
  kind,
  onOpenChange,
  onDecided,
}: {
  request: ChangeRequest | null;
  kind: "approve" | "reject";
  onOpenChange: (open: boolean) => void;
  onDecided: (request: ChangeRequest) => void;
}) {
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setNote("");
    setError(null);
  }, [request, kind]);

  const submit = async () => {
    if (!request) return;
    if (kind === "reject" && note.trim().length < 3) {
      setError("Say why, so the employee knows what to fix.");
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const decided = await post<ChangeRequest>(`/employees/change-requests/${request.id}/${kind}`, {
        note: note.trim() || null,
      });
      toast.success(kind === "approve" ? "Approved and applied to the record" : "Rejected");
      onDecided(decided);
      onOpenChange(false);
    } catch (caught) {
      setError(apiMessage(caught, "The request could not be decided."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={request !== null} onOpenChange={(next) => !isSaving && onOpenChange(next)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {kind === "approve" ? "Approve" : "Reject"} {request?.employee_name}&apos;s change to their{" "}
            {request?.section_label}
          </DialogTitle>
          <DialogDescription>
            {kind === "approve"
              ? "Approving applies the change to the record immediately, with an audit entry."
              : "The employee sees your note and can raise a fresh request."}
          </DialogDescription>
        </DialogHeader>
        {request && (
          <div className="grid gap-4">
            <p className="text-sm">
              <span className="text-muted-foreground">Reason given: </span>
              {request.reason}
            </p>
            <ChangeRequestDiff request={request} />
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <FormField
              htmlFor="decision-note"
              label={kind === "approve" ? "Note" : "Why it is rejected"}
              optional={kind === "approve"}
            >
              <Textarea
                id="decision-note"
                value={note}
                maxLength={1000}
                onChange={(event) => setNote(event.target.value)}
              />
            </FormField>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" disabled={isSaving} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant={kind === "reject" ? "destructive" : "default"}
            disabled={isSaving}
            onClick={() => void submit()}
          >
            {isSaving ? <Loader2 className="animate-spin" /> : kind === "approve" ? <Check /> : <X />}
            {kind === "approve" ? "Approve and apply" : "Reject"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** One person's change requests, newest first. The requester can withdraw a pending one. */
export function ChangeRequestsPanel({
  employeeId,
  isSelf,
  version = 0,
  onChanged,
}: {
  employeeId: string;
  isSelf: boolean;
  version?: number;
  onChanged: () => void;
}) {
  const path = isSelf ? "/employees/me/change-requests" : `/employees/${employeeId}/change-requests`;
  const { data, error, isLoading, reload } = useApiQuery<ChangeRequest[]>(`${path}?v=${version}`);
  const [withdrawing, setWithdrawing] = useState<ChangeRequest | null>(null);
  const [deciding, setDeciding] = useState<{ request: ChangeRequest; kind: "approve" | "reject" } | null>(null);
  const rows = data ?? [];

  const withdraw = async () => {
    if (!withdrawing) return;
    try {
      await post(`/employees/change-requests/${withdrawing.id}/withdraw`);
      toast.success("Request withdrawn");
      reload();
      onChanged();
    } catch (caught) {
      toast.error(apiMessage(caught, "The request could not be withdrawn."));
      throw caught;
    }
  };

  return (
    <>
      <DataPanel
        title="Change requests"
        description={
          isSelf
            ? "Changes to sensitive details go to HR. Each one shows here until it is decided."
            : "Changes this person asked HR to make."
        }
        isLoading={isLoading}
        error={error?.detail}
        onRetry={reload}
        isEmpty={rows.length === 0}
        empty={{
          icon: ClipboardList,
          title: "No change requests",
          description: isSelf
            ? "Use “Request change” on a section such as PAN, bank account or address."
            : undefined,
        }}
      >
        <ul className="grid gap-3">
          {rows.map((request) => {
            const meta = CHANGE_STATUS[request.status];
            return (
              <li key={request.id} className="grid gap-3 rounded-lg border border-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-foreground first-letter:uppercase">{request.section_label}</p>
                    <p className="text-xs text-muted-foreground">
                      Asked {formatDate(request.requested_at)} · {request.reason}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={meta.variant}>{meta.label}</Badge>
                    {request.can_withdraw && (
                      <Button size="sm" variant="ghost" onClick={() => setWithdrawing(request)}>
                        <Undo2 /> Withdraw
                      </Button>
                    )}
                    {request.can_decide && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => setDeciding({ request, kind: "reject" })}>
                          <X /> Reject
                        </Button>
                        <Button size="sm" onClick={() => setDeciding({ request, kind: "approve" })}>
                          <Check /> Approve
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                <ChangeRequestDiff request={request} />
                {request.decided_at && request.status !== "withdrawn" && (
                  <p className="text-xs text-muted-foreground">
                    {meta.label} by {request.decided_by_name ?? "HR"} on {formatDate(request.decided_at)}
                    {request.decision_note ? ` — ${request.decision_note}` : ""}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </DataPanel>
      <ConfirmDialog
        open={withdrawing !== null}
        onOpenChange={(open) => !open && setWithdrawing(null)}
        title="Withdraw this request?"
        description="HR will no longer see it. You can raise a new one at any time."
        confirmLabel="Withdraw"
        onConfirm={withdraw}
      />
      <DecisionDialog
        request={deciding?.request ?? null}
        kind={deciding?.kind ?? "approve"}
        onOpenChange={(open) => !open && setDeciding(null)}
        onDecided={() => {
          reload();
          onChanged();
        }}
      />
    </>
  );
}
