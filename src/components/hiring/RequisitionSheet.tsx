"use client";

import { FileText, Loader2, Pencil, Send, Users } from "lucide-react";
import Link from "next/link";
import React, { useState } from "react";
import { toast } from "sonner";

import { ErrorState } from "@/components/common/ErrorState";
import { Money } from "@/components/common/Money";
import { RequireRole } from "@/components/common/RequireRole";
import { ApprovalDecisionButtons } from "@/components/hiring/ApprovalDecisionButtons";
import {
  formatDateTime,
  humanize,
  REQUISITION_STATUS,
  StatusBadge,
} from "@/components/hiring/labels";
import { RequisitionFlags } from "@/components/hiring/RequisitionFlags";
import { RequisitionFormDialog } from "@/components/hiring/RequisitionFormDialog";
import {
  RequisitionStatusDialog,
  STATUS_ACTION,
  STATUS_MOVES,
  type RequisitionStatusTarget,
} from "@/components/hiring/RequisitionStatusDialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useApiQuery } from "@/hooks/useApiQuery";
import { HR, MANAGERS } from "@/lib/access";
import { ApiError, post } from "@/lib/api";
import type { ApprovalStep, RequisitionDetail, SubmitResult } from "@/lib/types/hiring";
import { formatDate, humanizeRole } from "@/lib/utils";

const DECISION: Record<ApprovalStep["decision"], [string, "warning" | "success" | "destructive" | "muted"]> = {
  pending: ["Pending", "warning"],
  approved: ["Approved", "success"],
  rejected: ["Rejected", "destructive"],
  voided: ["Voided", "muted"],
};

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="truncate text-sm text-foreground">{children}</p>
    </div>
  );
}

function experience(min: number | null, max: number | null): string {
  if (min === null && max === null) return "—";
  if (min !== null && max !== null) return `${min}–${max} years`;
  return min !== null ? `${min}+ years` : `Up to ${max} years`;
}

/**
 * One requisition in a side sheet: budget flags first, then the facts, the
 * approval chain and whichever actions the API says the viewer may take.
 */
export function RequisitionSheet({
  requisitionId,
  onOpenChange,
  onChanged,
}: {
  requisitionId: string | null;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}) {
  const { data, error, isLoading, reload, setData } = useApiQuery<RequisitionDetail>(
    requisitionId ? `/hiring/requisitions/${requisitionId}` : null,
  );
  const detail = data && data.id === requisitionId ? data : null;
  const [editOpen, setEditOpen] = useState(false);
  const [statusTarget, setStatusTarget] = useState<RequisitionStatusTarget | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const refresh = (next?: RequisitionDetail) => {
    if (next) setData(next);
    else reload();
    onChanged();
  };

  const submit = async () => {
    if (!detail) return;
    setIsSubmitting(true);
    try {
      const result = await post<SubmitResult>(`/hiring/requisitions/${detail.id}/submit`);
      const chain = result.chain
        .map((step) => `${step.sequence}. ${humanizeRole(step.role)}${step.reason ? ` (${step.reason})` : ""}`)
        .join(" → ");
      const flags = result.flags.map((flag) => flag.message).join(" ");
      toast.success(`${detail.code} submitted for approval`, {
        description: [chain ? `Approval chain: ${chain}.` : "", flags].filter(Boolean).join(" "),
        duration: 10_000,
      });
      refresh();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.detail : "The requisition could not be submitted.");
    } finally {
      setIsSubmitting(false);
    }
  };

  let body: React.ReactNode;
  if (isLoading && !detail) {
    body = (
      <div className="space-y-3 p-4">
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  } else if (error) {
    body = <ErrorState message={error.detail} onRetry={reload} />;
  } else if (detail) {
    const moves = STATUS_MOVES[detail.status] ?? [];
    body = (
      <div className="space-y-5 px-4 pb-6">
        <RequisitionFlags flags={detail.budget_flags} />

        <div className="flex flex-wrap gap-2">
          {detail.can_edit && (
            <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil /> Edit
            </Button>
          )}
          {detail.can_submit && (
            <Button size="sm" disabled={isSubmitting} onClick={() => void submit()}>
              {isSubmitting ? <Loader2 className="animate-spin" /> : <Send />}
              Submit for approval
            </Button>
          )}
          <Button size="sm" variant="outline" asChild>
            <Link href={`/hiring/candidates?requisition_id=${detail.id}`}>
              <Users /> View candidates
              <span className="tabular-nums text-muted-foreground">({detail.candidate_count})</span>
            </Link>
          </Button>
        </div>

        {detail.can_decide ? (
          <div className="space-y-2 rounded-lg border border-border p-3">
            <p className="text-sm font-medium text-foreground">Your approval is needed</p>
            <RequireRole roles={MANAGERS}>
              <ApprovalDecisionButtons
                kind="requisition"
                id={detail.id}
                code={detail.code}
                onDecided={() => refresh()}
              />
            </RequireRole>
          </div>
        ) : (
          detail.decide_blocked_reason && (
            <Alert>
              <AlertDescription>{detail.decide_blocked_reason}</AlertDescription>
            </Alert>
          )
        )}

        <RequireRole roles={HR}>
          {moves.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {moves.map((target) => (
                <Button
                  key={target}
                  size="sm"
                  variant={target === "cancelled" || target === "closed" ? "outline" : "secondary"}
                  onClick={() => setStatusTarget(target)}
                >
                  {STATUS_ACTION[target].label}
                </Button>
              ))}
            </div>
          )}
        </RequireRole>

        <Separator />

        <div className="grid grid-cols-2 gap-3">
          <Fact label="Department">{detail.department_name ?? "—"}</Fact>
          <Fact label="Location">{detail.location_name ?? "—"}</Fact>
          <Fact label="Hiring manager">{detail.hiring_manager_name ?? "—"}</Fact>
          <Fact label="Recruiter">{detail.recruiter_name ?? "—"}</Fact>
          <Fact label="Openings">
            <span className="tabular-nums">
              {detail.openings} · {detail.open_vacancies} still open · {detail.filled_count} filled
            </span>
          </Fact>
          <Fact label="Approved headcount">
            <span className="tabular-nums">{detail.approved_headcount ?? "—"}</span>
          </Fact>
          <Fact label="Employment type">{humanize(detail.employment_type)}</Fact>
          <Fact label="Grade">{detail.grade ?? "—"}</Fact>
          <Fact label="Experience">
            {experience(detail.experience_min_years, detail.experience_max_years)}
          </Fact>
          <Fact label="Budget CTC band">
            {detail.budget_ctc_min || detail.budget_ctc_max ? (
              <>
                <Money value={detail.budget_ctc_min} /> – <Money value={detail.budget_ctc_max} />
              </>
            ) : (
              "Not set"
            )}
          </Fact>
          <Fact label="Target joining">{formatDate(detail.target_joining_date)}</Fact>
          <Fact label="Target close">{formatDate(detail.target_close_date)}</Fact>
          <Fact label="Raised">{formatDateTime(detail.created_at)}</Fact>
          <Fact label="Approved">{formatDateTime(detail.approved_at)}</Fact>
        </div>

        <section className="space-y-1.5">
          <h3 className="text-sm font-semibold text-foreground">Justification</h3>
          <p className="whitespace-pre-line text-sm text-muted-foreground">
            {detail.justification ?? "Not written yet. It is needed before submitting."}
          </p>
        </section>

        {detail.description && (
          <section className="space-y-1.5">
            <h3 className="text-sm font-semibold text-foreground">Job description</h3>
            <p className="whitespace-pre-line text-sm text-foreground">{detail.description}</p>
          </section>
        )}

        {detail.skills.length > 0 && (
          <section className="space-y-1.5">
            <h3 className="text-sm font-semibold text-foreground">Skills</h3>
            <div className="flex flex-wrap gap-1.5">
              {detail.skills.map((skill) => (
                <Badge key={skill} variant="secondary">
                  {skill}
                </Badge>
              ))}
            </div>
          </section>
        )}

        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground">Approval chain</h3>
          {detail.approvals.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No approval steps yet. The chain is worked out when the requisition is submitted.
            </p>
          ) : (
            <ol className="space-y-2">
              {detail.approvals.map((step, index) => (
                <li
                  key={`${step.sequence}-${index}`}
                  className="rounded-md border border-border px-3 py-2.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">
                      <span className="tabular-nums">{step.sequence}.</span>{" "}
                      {step.label ?? humanizeRole(step.role)}
                    </p>
                    <Badge variant={DECISION[step.decision]?.[1] ?? "outline"}>
                      {DECISION[step.decision]?.[0] ?? humanize(step.decision)}
                    </Badge>
                  </div>
                  {step.reason && <p className="mt-1 text-xs text-muted-foreground">{step.reason}</p>}
                  {step.decided_by && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {step.decided_by}
                      {step.decided_at ? ` · ${formatDateTime(step.decided_at)}` : ""}
                    </p>
                  )}
                  {step.note && (
                    <p className="mt-1 whitespace-pre-line text-sm text-foreground">“{step.note}”</p>
                  )}
                  {step.voided_by_changes && step.voided_by_changes.length > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Voided by changes to: {step.voided_by_changes.join(", ")}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    );
  }

  return (
    <>
      <Sheet open={requisitionId !== null} onOpenChange={onOpenChange}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <div className="flex flex-wrap items-center gap-2">
              {detail && (
                <>
                  <span className="font-mono text-xs text-muted-foreground">{detail.code}</span>
                  <StatusBadge map={REQUISITION_STATUS} value={detail.status} />
                </>
              )}
            </div>
            <SheetTitle className="flex items-center gap-2">
              <FileText className="size-4 text-muted-foreground" />
              {detail?.title ?? "Requisition"}
            </SheetTitle>
            <SheetDescription>
              {detail ? "Budget flags, approval chain and the actions open to you." : "Loading…"}
            </SheetDescription>
          </SheetHeader>
          {body}
        </SheetContent>
      </Sheet>

      {detail && (
        <>
          <RequisitionFormDialog
            open={editOpen}
            onOpenChange={setEditOpen}
            requisition={detail}
            onSaved={(saved) => refresh(saved)}
          />
          <RequisitionStatusDialog
            requisition={detail}
            target={statusTarget}
            onOpenChange={(open) => !open && setStatusTarget(null)}
            onChanged={(saved) => refresh(saved)}
          />
        </>
      )}
    </>
  );
}
