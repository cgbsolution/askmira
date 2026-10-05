"use client";

import {
  BadgeCheck,
  Ban,
  BellRing,
  Download,
  Eye,
  FileSignature,
  MailCheck,
  MoreHorizontal,
  Plus,
  PlugZap,
  PenLine,
} from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { DataPanel } from "@/components/common/DataPanel";
import { FormField } from "@/components/common/FormField";
import { IssueLetterDialog } from "@/components/docs/IssueLetterDialog";
import { LETTER_CATEGORY, LETTER_STATUS, letterFileName } from "@/components/docs/letterLabels";
import { LetterViewerDialog } from "@/components/docs/LetterViewerDialog";
import type { PickedEmployee } from "@/components/people/EmployeePicker";
import { apiMessage, NONE } from "@/components/people/labels";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import { useApiQuery } from "@/hooks/useApiQuery";
import { downloadFile, get, post } from "@/lib/api";
import type {
  IssuedLetter,
  LetterStatus,
  LetterTemplate,
  LetterVerify,
  SignatureProviderStatus,
} from "@/lib/types/docs";
import { formatDate } from "@/lib/utils";

type Action = { kind: "sign" | "approve" | "revoke" | "acknowledge"; letter: IssuedLetter };

/** Where a letter's in-portal acknowledgement stands, in a few words. */
function AcknowledgementCell({ letter, own }: { letter: IssuedLetter; own: boolean }) {
  if (letter.acknowledged_at) {
    return (
      <div>
        <Badge variant="success">Acknowledged</Badge>
        <p className="mt-1 text-xs text-muted-foreground">
          {formatDate(letter.acknowledged_at)}
          {letter.acknowledged_name ? ` · “${letter.acknowledged_name}”` : ""}
        </p>
      </div>
    );
  }
  if (own && letter.can_acknowledge) {
    return <Badge variant="warning">Awaiting you</Badge>;
  }
  if (letter.acknowledgement_requested_at) {
    return (
      <div>
        <Badge variant="warning">Requested</Badge>
        <p className="mt-1 text-xs text-muted-foreground">{formatDate(letter.acknowledgement_requested_at)}</p>
      </div>
    );
  }
  return <span className="text-xs text-muted-foreground">—</span>;
}

const ACKNOWLEDGEABLE: LetterStatus[] = ["approved", "sent", "signed"];

/**
 * Issued letters: an employee's own archive, or — for HR — the tenant's.
 *
 * Letter HTML is only ever shown in a sandboxed frame; everything else here is
 * status, reference and actions.
 */
export function LettersPanel({
  employee,
  manage = false,
  title = "Letters",
}: {
  employee?: PickedEmployee | null;
  /** HR's full register with issue / sign / approve / revoke. */
  manage?: boolean;
  title?: string;
}) {
  const { user, hasRole } = useAuth();
  const isAdmin = hasRole("admin");
  const [status, setStatus] = useState(NONE);
  const [viewing, setViewing] = useState<IssuedLetter | null>(null);
  const [issuing, setIssuing] = useState(false);
  const [action, setAction] = useState<Action | null>(null);
  const [reason, setReason] = useState("");

  const params = new URLSearchParams();
  if (employee) params.set("employee_id", employee.id);
  if (status !== NONE) params.set("letter_status", status);
  const { data, error, isLoading, reload } = useApiQuery<IssuedLetter[]>(`/letters?${params}`);
  const templates = useApiQuery<LetterTemplate[]>(manage ? "/letter-templates" : null);
  const provider = useApiQuery<SignatureProviderStatus>(manage ? "/letters/signature-provider" : null);
  const rows = data ?? [];

  const download = async (letter: IssuedLetter, signed = false) => {
    try {
      await downloadFile(
        `/letters/${letter.id}/pdf${signed ? "?signed=true" : ""}`,
        letterFileName(letter.reference_number, signed),
      );
    } catch (caught) {
      toast.error(apiMessage(caught, "The PDF could not be downloaded."));
    }
  };

  const verify = async (letter: IssuedLetter) => {
    try {
      const result = await get<LetterVerify>(`/letters/${letter.id}/verify`);
      if (result.intact) toast.success(`${result.reference_number} matches its recorded hash`);
      else toast.error(`${result.reference_number} does NOT match its recorded hash`);
    } catch (caught) {
      toast.error(apiMessage(caught, "The letter could not be verified."));
    }
  };

  const runAction = async () => {
    if (!action) return;
    const { kind, letter } = action;
    try {
      if (kind === "sign") {
        await post(`/letters/${letter.id}/send-for-signature`, {});
        toast.success(`${letter.reference_number} sent for signature`);
      } else if (kind === "acknowledge") {
        await post(`/letters/${letter.id}/request-acknowledgement`);
        toast.success(`${letter.recipient_name} has been asked to acknowledge ${letter.reference_number}`);
      } else if (kind === "approve") {
        await post(`/letters/${letter.id}/approve`);
        toast.success(`${letter.reference_number} approved`);
      } else {
        if (!reason.trim()) {
          toast.error("Give a reason for revoking.");
          throw new Error("reason");
        }
        await post(`/letters/${letter.id}/revoke`, { reason: reason.trim() });
        toast.success(`${letter.reference_number} revoked`);
      }
      reload();
    } catch (caught) {
      if (!(caught instanceof Error && caught.message === "reason")) {
        toast.error(apiMessage(caught, "That action could not be completed."));
      }
      throw caught;
    }
  };

  const providerConnected = provider.data?.connected ?? false;

  return (
    <>
      {manage && provider.data && !provider.data.connected && (
        <Alert variant="warning">
          <PlugZap />
          <AlertTitle>E-signature provider not connected</AlertTitle>
          <AlertDescription>{provider.data.detail}</AlertDescription>
        </Alert>
      )}
      <DataPanel
        title={title}
        actions={
          manage ? (
            <Button size="sm" variant="accent" onClick={() => setIssuing(true)}>
              <Plus /> Issue letter
            </Button>
          ) : undefined
        }
        toolbar={
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger aria-label="Status" className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Any status</SelectItem>
              {(Object.keys(LETTER_STATUS) as LetterStatus[]).map((key) => (
                <SelectItem key={key} value={key}>
                  {LETTER_STATUS[key].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
        isLoading={isLoading}
        error={error?.detail}
        onRetry={reload}
        isEmpty={rows.length === 0}
        empty={{
          icon: FileSignature,
          title: "No letters",
          description: manage
            ? "Issue an appointment, confirmation or experience letter to see it here."
            : "Letters issued to you — appointment, confirmation, promotion — appear here.",
        }}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Reference</TableHead>
              {!employee && manage && <TableHead>Recipient</TableHead>}
              <TableHead>Letter</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Acknowledgement</TableHead>
              <TableHead>Issued</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((letter) => {
              const meta = LETTER_STATUS[letter.status];
              const own = letter.employee_id !== null && letter.employee_id === user?.employee_id;
              return (
                <TableRow key={letter.id}>
                  <TableCell className="font-medium tabular-nums">{letter.reference_number}</TableCell>
                  {!employee && manage && (
                    <TableCell className="text-muted-foreground">{letter.recipient_name}</TableCell>
                  )}
                  <TableCell>
                    <p>{letter.template_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {LETTER_CATEGORY[letter.category]} · template v{letter.template_version}
                    </p>
                  </TableCell>
                  <TableCell>
                    <Badge variant={meta.variant}>{meta.label}</Badge>
                    {letter.revoked_reason && (
                      <p className="mt-1 text-xs text-muted-foreground">{letter.revoked_reason}</p>
                    )}
                  </TableCell>
                  <TableCell>
                    <AcknowledgementCell letter={letter} own={own} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(letter.issued_at)}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${letter.reference_number}`}>
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {letter.candidate_id === null && (
                          <DropdownMenuItem onSelect={() => setViewing(letter)}>
                            <Eye /> View
                          </DropdownMenuItem>
                        )}
                        {own && letter.can_acknowledge && (
                          <DropdownMenuItem onSelect={() => setViewing(letter)}>
                            <PenLine /> Read & acknowledge
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onSelect={() => void download(letter)}>
                          <Download /> Download PDF
                        </DropdownMenuItem>
                        {letter.has_signed_pdf && (
                          <DropdownMenuItem onSelect={() => void download(letter, true)}>
                            <Download /> Download signed PDF
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onSelect={() => void verify(letter)}>
                          <BadgeCheck /> Verify integrity
                        </DropdownMenuItem>
                        {manage && !own && letter.employee_id && (
                          <>
                            <DropdownMenuSeparator />
                            {(letter.status === "approved" || letter.status === "sent") && (
                              <DropdownMenuItem onSelect={() => setAction({ kind: "sign", letter })}>
                                <MailCheck /> Send for signature
                              </DropdownMenuItem>
                            )}
                            {ACKNOWLEDGEABLE.includes(letter.status) && !letter.acknowledged_at && (
                              <DropdownMenuItem onSelect={() => setAction({ kind: "acknowledge", letter })}>
                                <BellRing />{" "}
                                {letter.acknowledgement_requested_at ? "Remind to acknowledge" : "Request acknowledgement"}
                              </DropdownMenuItem>
                            )}
                            {isAdmin && letter.status === "pending_approval" && (
                              <DropdownMenuItem onSelect={() => setAction({ kind: "approve", letter })}>
                                <BadgeCheck /> Approve
                              </DropdownMenuItem>
                            )}
                            {isAdmin && letter.status !== "revoked" && (
                              <DropdownMenuItem
                                variant="destructive"
                                onSelect={() => {
                                  setReason("");
                                  setAction({ kind: "revoke", letter });
                                }}
                              >
                                <Ban /> Revoke
                              </DropdownMenuItem>
                            )}
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </DataPanel>

      <LetterViewerDialog
        letter={viewing}
        onOpenChange={(open) => !open && setViewing(null)}
        onAcknowledged={() => {
          setViewing(null);
          reload();
        }}
      />
      {manage && (
        <IssueLetterDialog
          open={issuing}
          onOpenChange={setIssuing}
          templates={templates.data ?? []}
          onIssued={reload}
        />
      )}
      <ConfirmDialog
        open={action !== null}
        onOpenChange={(open) => !open && setAction(null)}
        title={
          action?.kind === "sign"
            ? "Send for e-signature?"
            : action?.kind === "acknowledge"
              ? "Ask for acknowledgement?"
              : action?.kind === "approve"
              ? "Approve this letter?"
              : "Revoke this letter?"
        }
        description={
          action?.kind === "acknowledge"
            ? `${action.letter.recipient_name} is notified to read ${action.letter.reference_number} in the portal and accept it with their typed name. This is separate from e-signature.`
            : action?.kind === "sign"
            ? providerConnected
              ? `${action.letter.reference_number} goes to ${action.letter.recipient_name} through ${provider.data?.provider}.`
              : "No e-signature provider is connected. This records the request against a development stand-in; nothing is sent to the employee."
            : action?.kind === "approve"
              ? `${action.letter.reference_number} becomes available to send. You cannot approve a letter you issued.`
              : action
                ? `${action.letter.reference_number} stays on record, marked revoked. Its content does not change.`
                : undefined
        }
        confirmLabel={
          action?.kind === "sign"
            ? "Send"
            : action?.kind === "acknowledge"
              ? "Notify"
              : action?.kind === "approve"
                ? "Approve"
                : "Revoke"
        }
        destructive={action?.kind === "revoke"}
        onConfirm={runAction}
      >
        {action?.kind === "revoke" && (
          <FormField htmlFor="revoke-reason" label="Reason">
            <Textarea
              id="revoke-reason"
              value={reason}
              maxLength={2000}
              onChange={(event) => setReason(event.target.value)}
            />
          </FormField>
        )}
      </ConfirmDialog>
    </>
  );
}
