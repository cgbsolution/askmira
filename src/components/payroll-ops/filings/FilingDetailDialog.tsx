"use client";

import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

import {
  apiErrorMessage,
  DownloadButton,
  InlineProblem,
  QueryBoundary,
} from "@/components/payroll-ops/shared";
import { DetailField } from "@/components/payroll-ops/disbursements/common";
import { Money } from "@/components/common/Money";
import { FormField } from "@/components/common/FormField";
import { ExceptionsTable } from "@/components/payroll-ops/filings/ExceptionsTable";
import {
  displayPeriod,
  FilingStatusBadge,
  formatTimestamp,
  RETURN_LABEL,
} from "@/components/payroll-ops/filings/labels";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useApiQuery } from "@/hooks/useApiQuery";
import { post } from "@/lib/api";
import type { AcknowledgementInput, FilingRecord } from "@/lib/types/payroll-ops";
import { formatDay } from "@/lib/utils";
import { DatePicker } from "@/components/common/DatePicker";

type Mode = "none" | "acknowledge" | "reject";

/** One filing record: its figures, its validation findings, and what to record after upload. */
export function FilingDetailDialog({
  recordId,
  notice,
  onClose,
  onChanged,
}: {
  recordId: string | null;
  /** Shown above the record, e.g. the message of the generation that was just blocked. */
  notice?: string | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const query = useApiQuery<FilingRecord>(recordId ? `/filings/${recordId}` : null);

  return (
    <Dialog open={recordId !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>
            {query.data ? RETURN_LABEL[query.data.return_type] : "Filing record"}
            {query.data && ` · ${displayPeriod(query.data.period)}`}
            {query.data?.jurisdiction && ` · ${query.data.jurisdiction}`}
          </DialogTitle>
          <DialogDescription>
            Check the file against the portal&apos;s own validator before you upload it, then record
            the acknowledgement or the portal&apos;s rejection here.
          </DialogDescription>
        </DialogHeader>

        {notice && <InlineProblem>{notice}</InlineProblem>}

        <QueryBoundary query={query} skeletonRows={5}>
          {(record) => (
            <RecordBody
              key={record.id}
              record={record}
              onUpdated={(updated) => {
                query.setData(updated);
                onChanged();
              }}
            />
          )}
        </QueryBoundary>
      </DialogContent>
    </Dialog>
  );
}

function RecordBody({
  record,
  onUpdated,
}: {
  record: FilingRecord;
  onUpdated: (record: FilingRecord) => void;
}) {
  const [mode, setMode] = useState<Mode>("none");
  const blocking = record.validation_exceptions.filter((item) => item.severity === "blocking");

  return (
    <div className="grid gap-5">
      <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
        <DetailField label="Status">
          <FilingStatusBadge status={record.status} />
        </DetailField>
        <DetailField label="Records">
          <span className="tabular-nums">{record.record_count}</span>
        </DetailField>
        <DetailField label="Total amount">
          <Money value={record.total_amount} />
        </DetailField>
        <DetailField label="Generated">{formatTimestamp(record.generated_at)}</DetailField>
        <DetailField label="File">{record.file_name ?? "No file"}</DetailField>
        <DetailField label="Content hash">
          <span className="break-all text-xs">{record.content_hash ?? "—"}</span>
        </DetailField>
        {record.acknowledgement_number && (
          <DetailField label="Acknowledgement">{record.acknowledgement_number}</DetailField>
        )}
        {record.filed_at && <DetailField label="Filed on">{formatDay(record.filed_at, true)}</DetailField>}
        {record.rejection_reason && (
          <DetailField label="Portal rejection">
            <span className="whitespace-pre-wrap">{record.rejection_reason}</span>
          </DetailField>
        )}
      </dl>

      {record.status === "blocked" && (
        <InlineProblem>
          No file was built. {blocking.length} blocking{" "}
          {blocking.length === 1 ? "finding needs" : "findings need"} fixing at the source (the
          employee record or the payroll), then generate again.
        </InlineProblem>
      )}

      <div className="flex flex-wrap gap-2">
        {record.has_file && (
          <DownloadButton
            path={`/filings/${record.id}/download`}
            fallbackName={record.file_name ?? `${record.return_type}-${record.period}.txt`}
            label="Download file"
          />
        )}
        {record.status === "generated" && (
          <>
            <Button
              size="sm"
              variant={mode === "acknowledge" ? "default" : "outline"}
              onClick={() => setMode(mode === "acknowledge" ? "none" : "acknowledge")}
            >
              <CheckCircle2 /> Record acknowledgement
            </Button>
            <Button
              size="sm"
              variant={mode === "reject" ? "default" : "outline"}
              onClick={() => setMode(mode === "reject" ? "none" : "reject")}
            >
              <XCircle /> Record portal rejection
            </Button>
          </>
        )}
      </div>

      {mode === "acknowledge" && (
        <AcknowledgeForm recordId={record.id} onDone={(updated) => { setMode("none"); onUpdated(updated); }} />
      )}
      {mode === "reject" && (
        <RejectForm recordId={record.id} onDone={(updated) => { setMode("none"); onUpdated(updated); }} />
      )}

      <Separator />
      <div>
        <p className="mb-2 text-sm font-medium text-foreground">
          Validation findings{" "}
          <span className="text-muted-foreground tabular-nums">
            ({record.validation_exceptions.length})
          </span>
        </p>
        <div className="overflow-hidden rounded-md border border-border">
          <ExceptionsTable
            exceptions={record.validation_exceptions}
            emptyTitle="Every record passed validation"
          />
        </div>
      </div>
    </div>
  );
}

function AcknowledgeForm({
  recordId,
  onDone,
}: {
  recordId: string;
  onDone: (record: FilingRecord) => void;
}) {
  const [number, setNumber] = useState("");
  const [filedAt, setFiledAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => setError(null), [number, filedAt]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!number.trim()) {
      setError("Enter the acknowledgement number the portal issued.");
      return;
    }
    const body: AcknowledgementInput = {
      acknowledgement_number: number.trim(),
      filed_at: filedAt || null,
    };
    setIsBusy(true);
    try {
      const updated = await post<FilingRecord>(`/filings/${recordId}/acknowledgement`, body);
      toast.success("Acknowledgement recorded");
      onDone(updated);
    } catch (caught) {
      setError(apiErrorMessage(caught, "The acknowledgement could not be recorded."));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <form
      className="grid gap-3 rounded-md border border-border p-4"
      onSubmit={(event) => void submit(event)}
      noValidate
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField htmlFor="ack-number" label="Acknowledgement number">
          <Input
            id="ack-number"
            value={number}
            required
            maxLength={100}
            onChange={(event) => setNumber(event.target.value)}
          />
        </FormField>
        <FormField htmlFor="ack-filed-at" label="Filed on" optional>
          <DatePicker
            id="ack-filed-at"
            value={filedAt}
            onChange={setFiledAt}
          />
        </FormField>
      </div>
      {error && <InlineProblem>{error}</InlineProblem>}
      <div>
        <Button type="submit" size="sm" disabled={isBusy}>
          {isBusy && <Loader2 className="animate-spin" />}
          Save acknowledgement
        </Button>
      </div>
    </form>
  );
}

function RejectForm({
  recordId,
  onDone,
}: {
  recordId: string;
  onDone: (record: FilingRecord) => void;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!reason.trim()) {
      setError("Enter the reason the portal gave.");
      return;
    }
    setIsBusy(true);
    setError(null);
    try {
      const updated = await post<FilingRecord>(`/filings/${recordId}/rejection`, {
        reason: reason.trim(),
      });
      toast.success("Portal rejection recorded");
      onDone(updated);
    } catch (caught) {
      setError(apiErrorMessage(caught, "The rejection could not be recorded."));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <form
      className="grid gap-3 rounded-md border border-border p-4"
      onSubmit={(event) => void submit(event)}
      noValidate
    >
      <FormField htmlFor="reject-reason" label="Reason the portal gave">
        <Textarea
          id="reject-reason"
          value={reason}
          required
          rows={3}
          maxLength={2000}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Paste the error from the portal or the FVU"
        />
      </FormField>
      {error && <InlineProblem>{error}</InlineProblem>}
      <div>
        <Button type="submit" size="sm" disabled={isBusy}>
          {isBusy && <Loader2 className="animate-spin" />}
          Save rejection
        </Button>
      </div>
    </form>
  );
}
