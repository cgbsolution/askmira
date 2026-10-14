"use client";

import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  FileDown,
  Loader2,
  Pencil,
  Send,
  ShieldAlert,
  ThumbsDown,
  ThumbsUp,
  UserCheck,
  UserPlus,
  UserX,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import React, { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { ErrorState } from "@/components/common/ErrorState";
import { FormField } from "@/components/common/FormField";
import { Money } from "@/components/common/Money";
import { formatDateTime, humanize, OFFER_STATUS, StatusBadge } from "@/components/hiring/labels";
import { ActionDialog } from "@/components/hiring/OfferActionDialog";
import {
  OfferBreakupTable,
  OfferBudgetDeviation,
  OfferInternalParity,
} from "@/components/hiring/OfferApprovalSummary";
import { OfferTermsDialog } from "@/components/hiring/OfferTermsDialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import { useApiQuery } from "@/hooks/useApiQuery";
import { ADMIN } from "@/lib/access";
import { ApiError, downloadFile, post } from "@/lib/api";
import type { OfferApprovalView, OfferDetail } from "@/lib/types/hiring";
import type { LetterTemplate } from "@/lib/types/docs";
import { formatDay } from "@/lib/utils";

/** A calendar date from the API, without the UTC-midnight shift. */
const day = (value: string | null) => (value ? formatDay(value, true) : "—");

type OfferAction =
  | "terms"
  | "submit"
  | "approve"
  | "sendback"
  | "release"
  | "accept"
  | "decline"
  | "drop"
  | "convert"
  | "revoke"
  | null;

/** One labelled term in the offer's summary grid. */
function OfferTerm({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">{children}</dd>
    </div>
  );
}

/** A section heading inside the sheet. */
function OfferSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {children}
    </section>
  );
}

/**
 * One offer: the approval evidence first (budget deviation, then parity), then
 * the terms, components, breakup, approvals and history, and the actions the
 * API says are open right now.
 */
export function OfferSheet({
  offerId,
  onClose,
  onChanged,
}: {
  offerId: string | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { hasRole } = useAuth();
  const detailQuery = useApiQuery<OfferDetail>(offerId ? `/offers/${offerId}` : null);
  const detail = detailQuery.data && detailQuery.data.offer.id === offerId ? detailQuery.data : null;
  const needsApprovalView =
    detail !== null && (detail.offer.status === "pending_approval" || detail.offer.status === "approved");
  const approvalQuery = useApiQuery<OfferApprovalView>(
    needsApprovalView && detail ? `/offers/${detail.offer.id}/approval` : null,
  );
  const approval =
    needsApprovalView && approvalQuery.data && approvalQuery.data.offer.id === offerId
      ? approvalQuery.data
      : null;

  const [action, setAction] = useState<OfferAction>(null);
  const [escalation, setEscalation] = useState<string | null>(null);
  const [converted, setConverted] = useState<{ employee_id: string; employee_code: string } | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const reloadDetail = detailQuery.reload;
  const reloadApproval = approvalQuery.reload;
  const changed = () => {
    reloadDetail();
    if (needsApprovalView) reloadApproval();
    onChanged();
  };

  const closeSheet = () => {
    setAction(null);
    setEscalation(null);
    setConverted(null);
    onClose();
  };

  const download = async (letterId: string) => {
    setIsDownloading(true);
    try {
      await downloadFile(`/letters/${letterId}/pdf`, "offer-letter.pdf");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.detail : "The letter could not be downloaded.");
    } finally {
      setIsDownloading(false);
    }
  };

  let body: React.ReactNode = null;
  if (offerId && detailQuery.isLoading && !detail) {
    body = (
      <div className="space-y-3 px-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  } else if (offerId && detailQuery.error) {
    body = <ErrorState message={detailQuery.error.detail} onRetry={detailQuery.reload} />;
  } else if (detail) {
    const { offer, actions, my_authority: authority } = detail;
    const canRevoke = actions.can_revoke && hasRole(...ADMIN);
    const convertedId = converted?.employee_id ?? offer.converted_employee_id;

    body = (
      <div className="space-y-5 px-4 pb-6">
        {escalation && (
          <Alert variant="destructive">
            <ShieldAlert />
            <AlertTitle>Involve HR before this is communicated</AlertTitle>
            <AlertDescription>{escalation}</AlertDescription>
          </Alert>
        )}
        {convertedId && (
          <Alert variant="success">
            <CheckCircle2 />
            <AlertTitle>
              {converted ? `Employee ${converted.employee_code} created` : "Converted to an employee"}
            </AlertTitle>
            <AlertDescription>
              <Button asChild size="sm" variant="outline">
                <Link href={`/people/${convertedId}`}>Open employee record</Link>
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {needsApprovalView && (
          <div className="space-y-3">
            {approvalQuery.isLoading && !approval ? (
              <Skeleton className="h-24 w-full" />
            ) : approvalQuery.error ? (
              <ErrorState message={approvalQuery.error.detail} onRetry={approvalQuery.reload} className="py-6" />
            ) : approval ? (
              <>
                <OfferBudgetDeviation deviation={approval.budget_deviation} />
                <OfferInternalParity parity={approval.internal_parity} />
              </>
            ) : null}
          </div>
        )}

        <OfferSection title="Terms">
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <OfferTerm label="Annual CTC">
              <Money value={offer.ctc_annual} className="font-semibold" />
              {offer.currency !== "INR" && <span className="ml-1 text-xs">({offer.currency})</span>}
            </OfferTerm>
            <OfferTerm label="Designation">{offer.designation}</OfferTerm>
            <OfferTerm label="Grade">{offer.grade ?? "—"}</OfferTerm>
            <OfferTerm label="Joining date">{day(offer.joining_date)}</OfferTerm>
            <OfferTerm label="Probation">
              <span className="tabular-nums">{offer.probation_months} months</span>
            </OfferTerm>
            <OfferTerm label="Notice period">
              <span className="tabular-nums">{offer.notice_period_days} days</span>
            </OfferTerm>
            <OfferTerm label="Valid until">{day(offer.valid_until)}</OfferTerm>
            <OfferTerm label="Released">{formatDateTime(offer.released_at)}</OfferTerm>
            <OfferTerm label="Candidate responded">{formatDateTime(offer.responded_at)}</OfferTerm>
            <OfferTerm label="Requisition budget">
              {detail.requisition.budget_ctc_min || detail.requisition.budget_ctc_max ? (
                <>
                  <Money value={detail.requisition.budget_ctc_min} /> –{" "}
                  <Money value={detail.requisition.budget_ctc_max} />
                </>
              ) : (
                "Not set"
              )}
            </OfferTerm>
            <OfferTerm label="Open vacancies">
              <span className="tabular-nums">{detail.requisition.open_vacancies}</span>
            </OfferTerm>
            <OfferTerm label="Candidate notice period">
              {detail.candidate.notice_period_days !== null ? (
                <span className="tabular-nums">{detail.candidate.notice_period_days} days</span>
              ) : (
                "—"
              )}
            </OfferTerm>
          </dl>
          {offer.outcome_reason && (
            <p className="text-sm">
              <span className="font-medium">Reason recorded: </span>
              {offer.outcome_reason}
            </p>
          )}
          {offer.resigned_elsewhere && (
            <Badge variant="destructive">Candidate had resigned from their employer</Badge>
          )}
        </OfferSection>

        <OfferSection title="Actions">
          <div className="flex flex-wrap gap-2">
            {actions.can_edit_terms && (
              <Button size="sm" variant="outline" onClick={() => setAction("terms")}>
                <Pencil /> Edit terms
              </Button>
            )}
            {actions.can_submit && (
              <Button size="sm" onClick={() => setAction("submit")}>
                <Send /> Submit for approval
              </Button>
            )}
            {offer.status === "pending_approval" && authority.can_decide && (
              <>
                <Button size="sm" onClick={() => setAction("approve")}>
                  <ThumbsUp /> Approve
                </Button>
                <Button size="sm" variant="outline" onClick={() => setAction("sendback")}>
                  <ThumbsDown /> Send back
                </Button>
              </>
            )}
            {actions.can_release && (
              <Button size="sm" onClick={() => setAction("release")}>
                <Send /> Release
              </Button>
            )}
            {actions.can_record_response && (
              <>
                <Button size="sm" variant="outline" onClick={() => setAction("accept")}>
                  <UserCheck /> Record acceptance
                </Button>
                <Button size="sm" variant="outline" onClick={() => setAction("decline")}>
                  <XCircle /> Record decline
                </Button>
              </>
            )}
            {actions.can_record_drop && (
              <Button size="sm" variant="outline" onClick={() => setAction("drop")}>
                <UserX /> Record did-not-join
              </Button>
            )}
            {actions.can_convert && (
              <Button size="sm" variant="accent" onClick={() => setAction("convert")}>
                <UserPlus /> Convert to employee
              </Button>
            )}
            {canRevoke && (
              <Button size="sm" variant="destructive" onClick={() => setAction("revoke")}>
                <Ban /> Revoke
              </Button>
            )}
            {offer.letter_id && (
              <Button
                size="sm"
                variant="outline"
                disabled={isDownloading}
                onClick={() => void download(offer.letter_id as string)}
              >
                {isDownloading ? <Loader2 className="animate-spin" /> : <FileDown />}
                Offer letter
              </Button>
            )}
          </div>
          {offer.status === "pending_approval" && !authority.can_decide && authority.message && (
            <p className="text-sm text-muted-foreground">{authority.message}</p>
          )}
          {actions.can_record_response && (
            <p className="text-xs text-muted-foreground">
              Candidate-side e-signature is not built — record the acceptance you received.
            </p>
          )}
        </OfferSection>

        <OfferSection title="Components">
          {detail.components.length === 0 ? (
            <p className="text-sm text-muted-foreground">No one-off or variable components.</p>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {detail.components.map((component, index) => (
                <li key={`${component.kind}-${index}`} className="flex flex-wrap justify-between gap-2 px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-foreground">{component.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {component.kind === "esop" ? "ESOP" : humanize(component.kind)}
                      {component.payable_terms ? ` · ${component.payable_terms}` : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <Money value={component.amount} />
                    <p className="text-xs text-muted-foreground">
                      {component.counts_toward_ctc ? "Counts toward CTC" : "Outside CTC"}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </OfferSection>

        <OfferSection title="Salary breakup">
          <OfferBreakupTable lines={approval?.salary_breakup ?? detail.salary_breakup} />
        </OfferSection>

        <OfferSection title="Approvals">
          {detail.approvals.length === 0 ? (
            <p className="text-sm text-muted-foreground">Not submitted for approval yet.</p>
          ) : (
            <ol className="space-y-2">
              {detail.approvals.map((step) => (
                <li key={`${step.sequence}-${step.role}-${step.decided_at ?? ""}`} className="rounded-lg border border-border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">
                      Step {step.sequence}: {step.label ?? humanize(step.role)}
                    </p>
                    <Badge
                      variant={
                        step.decision === "approved"
                          ? "success"
                          : step.decision === "rejected"
                            ? "destructive"
                            : step.decision === "voided"
                              ? "muted"
                              : "warning"
                      }
                    >
                      {step.decision === "rejected" ? "Sent back" : humanize(step.decision)}
                    </Badge>
                  </div>
                  {step.reason && <p className="text-xs text-muted-foreground">{step.reason}</p>}
                  {step.decided_by && (
                    <p className="text-xs text-muted-foreground">
                      {step.decided_by} · {formatDateTime(step.decided_at)}
                    </p>
                  )}
                  {step.note && <p className="mt-1 text-sm">{step.note}</p>}
                  {step.voided_by_changes && step.voided_by_changes.length > 0 && (
                    <p className="mt-1 text-xs text-mustard-900 dark:text-mustard-100">
                      Voided by changes to: {step.voided_by_changes.join(", ")}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          )}
        </OfferSection>

        <OfferSection title="History">
          {detail.history.length === 0 ? (
            <p className="text-sm text-muted-foreground">No events recorded.</p>
          ) : (
            <ol className="space-y-2 border-l border-border pl-4">
              {detail.history.map((event, index) => (
                <li key={`${event.occurred_at}-${index}`} className="text-sm">
                  <p className="flex flex-wrap items-center gap-1.5">
                    {event.from_status && (
                      <>
                        <StatusBadge map={OFFER_STATUS} value={event.from_status} />
                        <span className="text-muted-foreground">→</span>
                      </>
                    )}
                    <StatusBadge map={OFFER_STATUS} value={event.to_status} />
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(event.occurred_at)}
                    {event.by ? ` · ${event.by}` : ""}
                  </p>
                  {event.reason && <p className="text-sm">{event.reason}</p>}
                </li>
              ))}
            </ol>
          )}
        </OfferSection>

        {action === "terms" && (
          <OfferTermsDialog
            key={`${offer.id}-${offer.ctc_annual}-${offer.designation}`}
            offer={offer}
            open
            onOpenChange={(next) => !next && setAction(null)}
            onSaved={changed}
          />
        )}
        <OfferActionDialogs
          key={offer.id}
          detail={detail}
          action={action}
          setAction={setAction}
          onDone={changed}
          onEscalation={setEscalation}
          onConverted={setConverted}
        />
      </div>
    );
  }

  return (
    <Sheet open={offerId !== null} onOpenChange={(next) => !next && closeSheet()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle className="flex flex-wrap items-center gap-2">
            {detail ? (
              <>
                <span className="font-mono">{detail.offer.code}</span>
                <StatusBadge map={OFFER_STATUS} value={detail.offer.status} />
              </>
            ) : (
              "Offer"
            )}
          </SheetTitle>
          <SheetDescription>
            {detail
              ? `${detail.candidate.name ?? "Candidate"}${detail.candidate.email ? ` · ${detail.candidate.email}` : ""} · ${detail.requisition.code} ${detail.requisition.title}`
              : "Loading the offer"}
          </SheetDescription>
        </SheetHeader>
        {body}
      </SheetContent>
    </Sheet>
  );
}

/** The dialogs behind each offer action. Each validates its required fields first. */
function OfferActionDialogs({
  detail,
  action,
  setAction,
  onDone,
  onEscalation,
  onConverted,
}: {
  detail: OfferDetail;
  action: OfferAction;
  setAction: (action: OfferAction) => void;
  onDone: () => void;
  onEscalation: (message: string | null) => void;
  onConverted: (result: { employee_id: string; employee_code: string }) => void;
}) {
  const id = detail.offer.id;
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [signature, setSignature] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [validUntil, setValidUntil] = useState(detail.offer.valid_until ?? "");
  const [employeeCode, setEmployeeCode] = useState("");
  const [workEmail, setWorkEmail] = useState(detail.candidate.email ?? "");
  const [resigned, setResigned] = useState(false);

  const templates = useApiQuery<LetterTemplate[]>(action === "release" ? "/letter-templates" : null);
  const allTemplates = templates.data ?? [];
  const offerTemplates = allTemplates.some((template) => template.category === "offer")
    ? allTemplates.filter((template) => template.category === "offer")
    : allTemplates;

  const close = (next: boolean) => {
    if (next) return;
    setAction(null);
    setNote("");
    setReason("");
    setSignature("");
    setTemplateId("");
    setResigned(false);
  };

  const reasonField = (fieldId: string, label = "Reason") => (
    <FormField htmlFor={fieldId} label={label}>
      <Textarea id={fieldId} rows={3} maxLength={2000} value={reason} onChange={(e) => setReason(e.target.value)} />
    </FormField>
  );
  const needReason = () => (reason.trim() ? null : "Enter the reason.");

  const decide = async (approve: boolean) => {
    await post(`/offers/${id}/decide`, { approve, note: note.trim() || null });
    toast.success(approve ? "Offer approved" : "Offer sent back");
    onDone();
  };

  return (
    <>
      <ConfirmDialog
        open={action === "submit"}
        onOpenChange={close}
        title="Submit for approval?"
        description="The offer goes to the approval chain. Changing material terms later voids approvals already given."
        confirmLabel="Submit"
        onConfirm={async () => {
          try {
            await post(`/offers/${id}/submit`);
            toast.success("Offer submitted for approval");
            onDone();
          } catch (error) {
            toast.error(error instanceof ApiError ? error.detail : "The offer could not be submitted.");
            throw error;
          }
        }}
      />

      <ActionDialog
        open={action === "approve"}
        onOpenChange={close}
        title="Approve offer"
        description={
          detail.my_authority.step !== null
            ? `You are signing step ${detail.my_authority.step}${detail.my_authority.step_role ? ` as ${humanize(detail.my_authority.step_role)}` : ""}.`
            : undefined
        }
        submitLabel="Approve"
        onSubmit={() => decide(true)}
      >
        <FormField htmlFor="offer-approve-note" label="Note" optional>
          <Textarea id="offer-approve-note" rows={3} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} />
        </FormField>
      </ActionDialog>

      <ActionDialog
        open={action === "sendback"}
        onOpenChange={close}
        title="Send offer back"
        submitLabel="Send back"
        destructive
        validate={() => (note.trim() ? null : "Say what needs to change.")}
        onSubmit={() => decide(false)}
      >
        <FormField htmlFor="offer-sendback-note" label="What needs to change">
          <Textarea id="offer-sendback-note" rows={3} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} />
        </FormField>
      </ActionDialog>

      <ActionDialog
        open={action === "release"}
        onOpenChange={close}
        title="Release offer"
        description="Generates the offer letter from the template and marks the offer as sent to the candidate."
        submitLabel="Release"
        validate={() => (templateId ? null : "Choose the letter template.")}
        onSubmit={async () => {
          await post(`/offers/${id}/release`, { template_id: templateId, valid_until: validUntil || null });
          toast.success("Offer released");
          onDone();
        }}
      >
        <FormField
          htmlFor="offer-release-template"
          label="Letter template"
          error={templates.error?.detail}
          hint={
            templates.data && offerTemplates.length === 0 ? "No letter templates exist. Add one under Documents." : undefined
          }
        >
          <Select value={templateId} onValueChange={setTemplateId} disabled={offerTemplates.length === 0}>
            <SelectTrigger id="offer-release-template" className="w-full">
              <SelectValue placeholder={templates.isLoading ? "Loading…" : "Choose a template"} />
            </SelectTrigger>
            <SelectContent>
              {offerTemplates.map((template) => (
                <SelectItem key={template.id} value={template.id}>
                  {template.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <FormField htmlFor="offer-release-valid" label="Valid until" optional>
          <Input id="offer-release-valid" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
        </FormField>
      </ActionDialog>

      <ActionDialog
        open={action === "accept"}
        onOpenChange={close}
        title="Record acceptance"
        description="Candidate-side e-signature is not built — record the acceptance you received."
        submitLabel="Record acceptance"
        onSubmit={async () => {
          await post(`/offers/${id}/accept`, { signature_reference: signature.trim() || null });
          toast.success("Acceptance recorded");
          onDone();
        }}
      >
        <FormField
          htmlFor="offer-accept-signature"
          label="Signature reference"
          optional
          hint="Where the signed acceptance is kept, e.g. an email subject or document number."
        >
          <Input id="offer-accept-signature" maxLength={255} value={signature} onChange={(e) => setSignature(e.target.value)} />
        </FormField>
      </ActionDialog>

      <ActionDialog
        open={action === "decline"}
        onOpenChange={close}
        title="Record decline"
        submitLabel="Record decline"
        destructive
        validate={needReason}
        onSubmit={async () => {
          await post(`/offers/${id}/decline`, { reason: reason.trim() });
          toast.success("Decline recorded");
          onDone();
        }}
      >
        {reasonField("offer-decline-reason", "Why the candidate declined")}
      </ActionDialog>

      <ActionDialog
        open={action === "drop"}
        onOpenChange={close}
        title="Record did-not-join"
        description="The candidate accepted but did not join. This is recorded separately from a decline."
        submitLabel="Record"
        destructive
        validate={needReason}
        onSubmit={async () => {
          await post(`/offers/${id}/drop`, { reason: reason.trim() });
          toast.success("Did-not-join recorded");
          onDone();
        }}
      >
        {reasonField("offer-drop-reason")}
      </ActionDialog>

      <ActionDialog
        open={action === "convert"}
        onOpenChange={close}
        title="Convert to employee"
        description="Creates the employee record from this accepted offer."
        submitLabel="Create employee"
        validate={() => {
          if (!employeeCode.trim()) return "Enter the employee code.";
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(workEmail.trim())) return "Enter a valid work email.";
          return null;
        }}
        onSubmit={async () => {
          const result = await post<{
            employee_id: string;
            employee_code: string;
            onboarding_checklist: string | null;
          }>(`/offers/${id}/convert`, {
            employee_code: employeeCode.trim(),
            work_email: workEmail.trim(),
          });
          toast.success(
            result.onboarding_checklist
              ? `Employee ${result.employee_code} created; onboarding started from ${result.onboarding_checklist}.`
              : `Employee ${result.employee_code} created. No default onboarding checklist is set, so start their onboarding from Onboarding.`,
          );
          onConverted(result);
          onDone();
        }}
      >
        <FormField htmlFor="offer-convert-code" label="Employee code">
          <Input id="offer-convert-code" maxLength={32} value={employeeCode} onChange={(e) => setEmployeeCode(e.target.value)} />
        </FormField>
        <FormField htmlFor="offer-convert-email" label="Work email">
          <Input
            id="offer-convert-email"
            type="email"
            value={workEmail}
            onChange={(e) => setWorkEmail(e.target.value)}
          />
        </FormField>
      </ActionDialog>

      <ActionDialog
        open={action === "revoke"}
        onOpenChange={close}
        title="Revoke offer"
        description="Withdraws an offer the candidate may already be relying on. This cannot be undone."
        submitLabel="Revoke offer"
        destructive
        validate={needReason}
        onSubmit={async () => {
          const result = await post<{ hr_escalation?: string }>(`/offers/${id}/revoke`, {
            reason: reason.trim(),
            candidate_resigned_elsewhere: resigned,
          });
          toast.success("Offer revoked");
          onEscalation(result?.hr_escalation ?? null);
          onDone();
        }}
      >
        {reasonField("offer-revoke-reason")}
        <div className="flex items-start gap-2">
          <Checkbox
            id="offer-revoke-resigned"
            checked={resigned}
            onCheckedChange={(checked) => setResigned(checked === true)}
          />
          <Label htmlFor="offer-revoke-resigned" className="font-normal">
            The candidate has already resigned elsewhere
          </Label>
        </div>
        {resigned && (
          <Alert variant="destructive">
            <AlertTriangle />
            <AlertDescription>
              Revoking now may leave the candidate without a job. Involve HR before this is communicated.
            </AlertDescription>
          </Alert>
        )}
      </ActionDialog>
    </>
  );
}
