"use client";

import { Ban, CircleCheck, HandCoins, KeyRound } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { ClearanceChecklist } from "@/components/exits/ClearanceChecklist";
import {
  dayOrDash,
  EXIT_TYPE_LABELS,
  ExitStatusBadge,
  Fact,
  personLabel,
  pluralCount,
  ReasonDialog,
  SettlementStatusBadge,
  timestampOrDash,
  useExitRoles,
} from "@/components/exits/common";
import { LettersPanel } from "@/components/exits/LettersPanel";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { DatePicker } from "@/components/common/DatePicker";
import { FormField } from "@/components/common/FormField";
import { QueryBoundary, toastApiError } from "@/components/payroll-ops/shared";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useApiQuery } from "@/hooks/useApiQuery";
import { post } from "@/lib/api";
import type { ExitRecord } from "@/lib/types/payroll-ops";

/**
 * One exit: its facts, the clearance checklist, letters and the HR / admin
 * actions. Nobody acts on their own exit; the server refuses it as well.
 */
export function ExitDetailSheet({
  exitId,
  onClose,
  onChanged,
}: {
  exitId: string | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const query = useApiQuery<ExitRecord>(exitId ? `/exits/${exitId}` : null);
  const record = query.data && query.data.id === exitId ? query.data : null;

  return (
    <Sheet open={exitId !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-2xl">
        <SheetHeader className="border-b border-border">
          <SheetTitle>
            {record ? personLabel(record.employee_name, record.employee_code) : "Exit"}
          </SheetTitle>
          <SheetDescription>
            {record
              ? `${EXIT_TYPE_LABELS[record.exit_type] ?? record.exit_type} · started ${timestampOrDash(record.created_at)}`
              : "Loading the exit record."}
          </SheetDescription>
        </SheetHeader>
        <QueryBoundary query={{ ...query, data: record }} skeletonRows={6}>
          {(data) => (
            <ExitDetail
              record={data}
              onUpdated={(updated) => {
                query.setData(updated);
                onChanged();
              }}
              onClearanceChanged={() => {
                query.reload();
                onChanged();
              }}
            />
          )}
        </QueryBoundary>
      </SheetContent>
    </Sheet>
  );
}

function ExitDetail({
  record,
  onUpdated,
  onClearanceChanged,
}: {
  record: ExitRecord;
  onUpdated: (record: ExitRecord) => void;
  onClearanceChanged: () => void;
}) {
  const { isHr, isAdmin, isManager, ownEmployeeId } = useExitRoles();
  const [dialog, setDialog] = useState<"cancel" | "waive" | "revoke" | "accept" | null>(null);
  const [agreedLastDay, setAgreedLastDay] = useState<string | null>(null);
  const [childVersion, setChildVersion] = useState(0);

  const isOwnExit = ownEmployeeId !== null && record.employee_id === ownEmployeeId;
  const isClosed = record.status === "cancelled" || record.status === "settled";

  const canCancel = isHr && !isOwnExit && !isClosed;
  const canWaive =
    isAdmin &&
    !isOwnExit &&
    record.status !== "cancelled" &&
    record.notice_shortfall_days > 0 &&
    !record.notice_waived;
  const canRevoke =
    isAdmin && !isOwnExit && record.status !== "cancelled" && !record.access_revoked_at;
  // The leaver's line manager or HR; the server checks the reporting line.
  const canAccept = (isHr || isManager) && !isOwnExit && record.awaiting_acceptance;

  const updated = (next: ExitRecord) => {
    onUpdated(next);
    setChildVersion((current) => current + 1);
  };

  return (
    <div className="space-y-4 p-4">
      {isOwnExit && (
        <Alert>
          <AlertDescription>
            This is your own exit. Actions on it are taken by someone else in HR.
          </AlertDescription>
        </Alert>
      )}

      {record.awaiting_acceptance && (
        <Alert variant="warning">
          <AlertTitle>Resignation waiting to be accepted</AlertTitle>
          <AlertDescription>
            Submitted by the employee on {dayOrDash(record.resignation_date)}. Until it is accepted
            they can withdraw it themselves.
            {record.employee_comments ? ` Their comments: “${record.employee_comments}”` : ""}
          </AlertDescription>
        </Alert>
      )}

      <Card tier="tier1">
        <CardContent>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <ExitStatusBadge status={record.status} />
            <span className="text-xs text-muted-foreground">Settlement:</span>
            <SettlementStatusBadge status={record.settlement_status} />
          </div>
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            <Fact label="Exit type">{EXIT_TYPE_LABELS[record.exit_type] ?? record.exit_type}</Fact>
            <Fact label="Resignation date">{dayOrDash(record.resignation_date)}</Fact>
            <Fact label="Requested last working day">
              {dayOrDash(record.requested_last_working_day)}
            </Fact>
            <Fact label="Approved last working day">
              {dayOrDash(record.approved_last_working_day)}
            </Fact>
            <Fact label="Notice period">{pluralCount(record.notice_period_days, "day")}</Fact>
            <Fact label="Notice shortfall">
              {record.notice_shortfall_days > 0
                ? pluralCount(record.notice_shortfall_days, "day")
                : "None"}
            </Fact>
            {record.notice_shortfall_days > 0 && (
              <Fact label="Notice recovery waived" className="sm:col-span-2">
                {record.notice_waived
                  ? `Yes${record.notice_waiver_reason ? ` — ${record.notice_waiver_reason}` : ""}`
                  : "No"}
              </Fact>
            )}
            <Fact label="Clearance">
              {pluralCount(record.clearance_total, "item")}
              {record.clearance_pending_mandatory > 0 &&
                `, ${record.clearance_pending_mandatory} mandatory pending`}
            </Fact>
            {record.initiated_by_employee && (
              <Fact label="Accepted">
                {record.accepted_at
                  ? `${timestampOrDash(record.accepted_at)}${record.accepted_by_name ? ` by ${record.accepted_by_name}` : ""}`
                  : record.withdrawn_at
                    ? `Withdrawn ${timestampOrDash(record.withdrawn_at)}`
                    : "Not yet"}
              </Fact>
            )}
            <Fact label="Login access">
              {record.access_revoked_at
                ? `Revoked ${timestampOrDash(record.access_revoked_at)}`
                : "Active"}
            </Fact>
            {record.reason && (
              <Fact label="Reason" className="sm:col-span-2">
                <span className="whitespace-pre-line">{record.reason}</span>
              </Fact>
            )}
          </dl>

          {(canCancel || canWaive || canRevoke || canAccept) && (
            <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4">
              {canAccept && (
                <Button
                  size="sm"
                  onClick={() => {
                    setAgreedLastDay(record.requested_last_working_day);
                    setDialog("accept");
                  }}
                >
                  <CircleCheck /> Accept resignation
                </Button>
              )}
              {canWaive && (
                <Button variant="outline" size="sm" onClick={() => setDialog("waive")}>
                  <HandCoins /> Waive notice recovery
                </Button>
              )}
              {canRevoke && (
                <Button variant="outline" size="sm" onClick={() => setDialog("revoke")}>
                  <KeyRound /> Revoke access
                </Button>
              )}
              {canCancel && (
                <Button variant="ghost" size="sm" onClick={() => setDialog("cancel")}>
                  <Ban /> Cancel exit
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <ClearanceChecklist
        exitId={record.id}
        isOwnExit={isOwnExit}
        version={childVersion}
        onChanged={onClearanceChanged}
      />

      {isHr && !isOwnExit && <LettersPanel exitId={record.id} version={childVersion} />}

      <ReasonDialog
        open={dialog === "accept"}
        onOpenChange={(open) => !open && setDialog(null)}
        title="Accept this resignation?"
        description="Agree the last working day. The notice shortfall is worked out from it, and the employee is told."
        label="Note to the employee"
        required={false}
        confirmLabel="Accept resignation"
        onSubmit={async (note) => {
          const next = await post<ExitRecord>(`/exits/${record.id}/accept`, {
            approved_last_working_day: agreedLastDay,
            note: note || null,
          });
          toast.success("Resignation accepted");
          updated(next);
        }}
      >
        <FormField
          htmlFor="accept-last-day"
          label="Agreed last working day"
          hint={`They proposed ${dayOrDash(record.requested_last_working_day)}; notice period ${pluralCount(record.notice_period_days, "day")}.`}
        >
          <DatePicker
            id="accept-last-day"
            value={agreedLastDay}
            min={record.resignation_date}
            onChange={setAgreedLastDay}
          />
        </FormField>
      </ReasonDialog>

      <ReasonDialog
        open={dialog === "cancel"}
        onOpenChange={(open) => !open && setDialog(null)}
        title="Cancel this exit?"
        description="Use this when the resignation is withdrawn or the exit was started in error. The record and its history are kept."
        label="Reason"
        confirmLabel="Cancel exit"
        destructive
        onSubmit={async (reason) => {
          const next = await post<ExitRecord>(`/exits/${record.id}/cancel`, { reason });
          toast.success("Exit cancelled");
          updated(next);
        }}
      />

      <ReasonDialog
        open={dialog === "waive"}
        onOpenChange={(open) => !open && setDialog(null)}
        title="Waive the notice recovery?"
        description={`${pluralCount(record.notice_shortfall_days, "day")} of notice were not served. Waiving means the company does not recover pay for them — that is money given away. The waiver and your reason are recorded in the audit trail.`}
        label="Reason for the waiver"
        confirmLabel="Waive recovery"
        onSubmit={async (reason) => {
          const next = await post<ExitRecord>(`/exits/${record.id}/waive-notice`, { reason });
          toast.success("Notice recovery waived");
          updated(next);
        }}
      />

      <ConfirmDialog
        open={dialog === "revoke"}
        onOpenChange={(open) => !open && setDialog(null)}
        title="Revoke login access?"
        description="Their login is deactivated. The employment record, payroll history, attendance and audit trail are all retained — nothing is deleted."
        confirmLabel="Revoke access"
        destructive
        onConfirm={async () => {
          try {
            const next = await post<ExitRecord>(`/exits/${record.id}/revoke-access`);
            toast.success("Login access revoked");
            updated(next);
          } catch (caught) {
            toastApiError(caught, "Access could not be revoked.");
            throw caught;
          }
        }}
      />
    </div>
  );
}
