"use client";

import { Download, FileUp, Loader2, ShieldCheck, ShieldPlus, XCircle } from "lucide-react";
import React, { useRef, useState } from "react";
import { toast } from "sonner";

import { DataPanel } from "@/components/common/DataPanel";
import { FormField } from "@/components/common/FormField";
import { formatDateTime } from "@/components/hiring/labels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useApiQuery } from "@/hooks/useApiQuery";
import { ApiError, downloadFile, post } from "@/lib/api";

type CheckOutcome = "pending" | "clear" | "discrepancy" | "unable_to_verify";

interface BackgroundCheck {
  id: string;
  vendor: string;
  agency_name: string;
  status: "awaiting_consent" | "in_progress" | "clear" | "discrepancy" | "unable_to_verify" | "cancelled";
  checks: Array<{ type: string; label: string; status: CheckOutcome; note: string | null }>;
  consent_notice: string;
  consent_given_at: string | null;
  consent_typed_name: string | null;
  summary: string | null;
  has_report: boolean;
  report_filename: string | null;
  completed_at: string | null;
  cancelled_reason: string | null;
  created_at: string;
}

interface VendorCatalogue {
  vendors: Array<{ key: string; label: string }>;
  check_types: Array<{ key: string; label: string }>;
}

const STATUS: Record<BackgroundCheck["status"], { label: string; variant: "secondary" | "success" | "destructive" | "warning" | "muted" }> = {
  awaiting_consent: { label: "Waiting for the candidate's consent", variant: "secondary" },
  in_progress: { label: "In progress", variant: "secondary" },
  clear: { label: "Clear", variant: "success" },
  discrepancy: { label: "Discrepancy", variant: "destructive" },
  unable_to_verify: { label: "Could not verify", variant: "warning" },
  cancelled: { label: "Cancelled", variant: "muted" },
};

const OUTCOME_LABEL: Record<CheckOutcome, string> = {
  pending: "Pending",
  clear: "Clear",
  discrepancy: "Discrepancy",
  unable_to_verify: "Could not verify",
};

/** HR: background checks for one candidate — consent first, then outcomes and the report. */
export function BackgroundChecksPanel({ candidateId }: { candidateId: string }) {
  const { data, error, isLoading, reload } = useApiQuery<BackgroundCheck[]>(`/careers/candidates/${candidateId}/background-checks`);
  const [requesting, setRequesting] = useState(false);
  const open = (data ?? []).some((row) => row.status === "awaiting_consent" || row.status === "in_progress");

  return (
    <>
      <DataPanel
        title="Background checks"
        description="Requested here, agreed to by the candidate in their portal, and recorded here when the agency reports."
        actions={
          <Button size="sm" disabled={open} onClick={() => setRequesting(true)} title={open ? "Finish or cancel the open check first" : undefined}>
            <ShieldPlus /> Request a check
          </Button>
        }
        isLoading={isLoading}
        error={error?.detail ?? null}
        onRetry={reload}
        isEmpty={(data ?? []).length === 0}
        empty={{ icon: ShieldCheck, title: "No background checks", description: "The candidate is asked to agree before anything is checked." }}
      >
        <div className="grid gap-4 p-5">
          {(data ?? []).map((row) => (
            <CheckCard key={row.id} row={row} onChanged={reload} />
          ))}
        </div>
      </DataPanel>
      <RequestDialog open={requesting} candidateId={candidateId} onOpenChange={setRequesting} onRequested={reload} />
    </>
  );
}

function CheckCard({ row, onChanged }: { row: BackgroundCheck; onChanged: () => void }) {
  const [recording, setRecording] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      await post(`/careers/background-checks/${row.id}/report`, form);
      toast.success("Report attached.");
      onChanged();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.detail : "The report could not be attached.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card tier="tier1">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          {row.agency_name}
          <Badge variant={STATUS[row.status].variant}>{STATUS[row.status].label}</Badge>
        </CardTitle>
        <CardDescription>
          Requested {formatDateTime(row.created_at)}
          {row.consent_given_at && ` · agreed ${formatDateTime(row.consent_given_at)} as "${row.consent_typed_name}"`}
          {row.cancelled_reason && ` · ${row.cancelled_reason}`}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <ul className="grid gap-1.5">
          {row.checks.map((check) => (
            <li key={check.type} className="flex flex-wrap items-baseline gap-2 text-sm">
              <span className="font-medium text-foreground">{check.label}</span>
              <Badge variant={check.status === "clear" ? "success" : check.status === "discrepancy" ? "destructive" : check.status === "unable_to_verify" ? "warning" : "muted"}>
                {OUTCOME_LABEL[check.status]}
              </Badge>
              {check.note && <span className="text-xs text-muted-foreground">{check.note}</span>}
            </li>
          ))}
        </ul>
        {row.summary && <p className="text-sm text-muted-foreground">{row.summary}</p>}
        <div className="flex flex-wrap gap-2">
          {row.status === "in_progress" && (
            <Button size="sm" onClick={() => setRecording(true)}>
              Record outcomes
            </Button>
          )}
          {row.status !== "awaiting_consent" && row.status !== "cancelled" && (
            <>
              <Input
                ref={fileInput}
                type="file"
                accept="application/pdf,image/png,image/jpeg"
                className="hidden"
                aria-label="Agency report"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void upload(file);
                  event.target.value = "";
                }}
              />
              <Button size="sm" variant="outline" disabled={uploading} onClick={() => fileInput.current?.click()}>
                {uploading ? <Loader2 className="animate-spin" /> : <FileUp />} {row.has_report ? "Replace report" : "Attach report"}
              </Button>
            </>
          )}
          {row.has_report && (
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                void downloadFile(`/careers/background-checks/${row.id}/report`, row.report_filename ?? "report.pdf").catch((caught) =>
                  toast.error(caught instanceof ApiError ? caught.detail : "The report could not be downloaded."),
                )
              }
            >
              <Download /> Report
            </Button>
          )}
          {(row.status === "awaiting_consent" || row.status === "in_progress") && (
            <Button size="sm" variant="ghost" onClick={() => setCancelling(true)}>
              <XCircle /> Cancel
            </Button>
          )}
        </div>
      </CardContent>
      <OutcomesDialog open={recording} row={row} onOpenChange={setRecording} onSaved={onChanged} />
      <CancelDialog open={cancelling} row={row} onOpenChange={setCancelling} onCancelled={onChanged} />
    </Card>
  );
}

function RequestDialog({
  open,
  candidateId,
  onOpenChange,
  onRequested,
}: {
  open: boolean;
  candidateId: string;
  onOpenChange: (open: boolean) => void;
  onRequested: () => void;
}) {
  const catalogue = useApiQuery<VendorCatalogue>(open ? "/careers/background-check-vendors" : null);
  const [chosen, setChosen] = useState<string[]>(["employment", "education"]);
  const [agency, setAgency] = useState("");
  const [vendor, setVendor] = useState("manual");
  const [isSaving, setIsSaving] = useState(false);

  const save = async () => {
    setIsSaving(true);
    try {
      await post(`/careers/candidates/${candidateId}/background-checks`, {
        check_types: chosen,
        agency_name: agency.trim(),
        vendor,
      });
      toast.success("Requested. The candidate has been emailed to agree.");
      onOpenChange(false);
      onRequested();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.detail : "The check could not be requested.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !isSaving && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Request a background check</DialogTitle>
          <DialogDescription>
            The candidate is told what will be checked and by whom, and must agree before anything starts.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-medium">Checks</legend>
            {(catalogue.data?.check_types ?? []).map((check) => (
              <div key={check.key} className="flex items-center gap-2">
                <Checkbox
                  id={`bgv-type-${check.key}`}
                  checked={chosen.includes(check.key)}
                  onCheckedChange={(on) =>
                    setChosen((current) => (on ? [...current, check.key] : current.filter((key) => key !== check.key)))
                  }
                />
                <Label htmlFor={`bgv-type-${check.key}`} className="text-sm font-normal">
                  {check.label}
                </Label>
              </div>
            ))}
          </fieldset>
          <FormField htmlFor="bgv-agency" label="Agency" hint="Named to the candidate before they agree.">
            <Input id="bgv-agency" maxLength={255} value={agency} onChange={(event) => setAgency(event.target.value)} />
          </FormField>
          <FormField htmlFor="bgv-vendor" label="Sent through">
            <Select value={vendor} onValueChange={setVendor}>
              <SelectTrigger id="bgv-vendor" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(catalogue.data?.vendors ?? [{ key: "manual", label: "Manual" }]).map((option) => (
                  <SelectItem key={option.key} value={option.key}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={isSaving} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={isSaving || chosen.length === 0 || !agency.trim()} onClick={() => void save()}>
            {isSaving && <Loader2 className="animate-spin" />} Ask the candidate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function OutcomesDialog({
  open,
  row,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  row: BackgroundCheck;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [outcomes, setOutcomes] = useState<Record<string, { status: CheckOutcome; note: string }>>(() =>
    Object.fromEntries(row.checks.map((check) => [check.type, { status: check.status, note: check.note ?? "" }])),
  );
  const [summary, setSummary] = useState(row.summary ?? "");
  const [isSaving, setIsSaving] = useState(false);

  const save = async () => {
    setIsSaving(true);
    try {
      await post(`/careers/background-checks/${row.id}/results`, {
        results: Object.entries(outcomes).map(([type, value]) => ({ type, status: value.status, note: value.note.trim() || undefined })),
        summary: summary.trim() || undefined,
      });
      toast.success("Outcomes saved.");
      onOpenChange(false);
      onSaved();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.detail : "The outcomes could not be saved.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !isSaving && onOpenChange(next)}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>What {row.agency_name} found</DialogTitle>
          <DialogDescription>The check settles once nothing is pending. A discrepancy needs a note saying what differed.</DialogDescription>
        </DialogHeader>
        <div className="grid max-h-[60vh] gap-4 overflow-y-auto">
          {row.checks.map((check) => (
            <div key={check.type} className="grid gap-2 rounded-lg border p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium">{check.label}</span>
                <Select
                  value={outcomes[check.type]?.status ?? "pending"}
                  onValueChange={(next) =>
                    setOutcomes((current) => ({ ...current, [check.type]: { ...current[check.type], status: next as CheckOutcome } }))
                  }
                >
                  <SelectTrigger className="w-44" aria-label={`${check.label} outcome`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(OUTCOME_LABEL) as CheckOutcome[]).map((key) => (
                      <SelectItem key={key} value={key}>
                        {OUTCOME_LABEL[key]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Input
                aria-label={`${check.label} note`}
                placeholder="Note (required for a discrepancy)"
                maxLength={2000}
                value={outcomes[check.type]?.note ?? ""}
                onChange={(event) =>
                  setOutcomes((current) => ({ ...current, [check.type]: { ...current[check.type], note: event.target.value } }))
                }
              />
            </div>
          ))}
          <FormField htmlFor={`bgv-summary-${row.id}`} label="Summary" optional>
            <Textarea id={`bgv-summary-${row.id}`} rows={3} maxLength={4000} value={summary} onChange={(event) => setSummary(event.target.value)} />
          </FormField>
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={isSaving} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={isSaving} onClick={() => void save()}>
            {isSaving && <Loader2 className="animate-spin" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CancelDialog({
  open,
  row,
  onOpenChange,
  onCancelled,
}: {
  open: boolean;
  row: BackgroundCheck;
  onOpenChange: (open: boolean) => void;
  onCancelled: () => void;
}) {
  const [reason, setReason] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const save = async () => {
    setIsSaving(true);
    try {
      await post(`/careers/background-checks/${row.id}/cancel`, { reason: reason.trim() });
      toast.success("Check cancelled.");
      onOpenChange(false);
      onCancelled();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.detail : "The check could not be cancelled.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !isSaving && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cancel this check?</DialogTitle>
          <DialogDescription>Tell the agency separately if the case was already sent.</DialogDescription>
        </DialogHeader>
        <FormField htmlFor={`bgv-cancel-${row.id}`} label="Reason">
          <Textarea id={`bgv-cancel-${row.id}`} rows={3} maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} />
        </FormField>
        <DialogFooter>
          <Button variant="outline" disabled={isSaving} onClick={() => onOpenChange(false)}>
            Keep it
          </Button>
          <Button variant="destructive" disabled={isSaving || !reason.trim()} onClick={() => void save()}>
            {isSaving && <Loader2 className="animate-spin" />} Cancel check
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
