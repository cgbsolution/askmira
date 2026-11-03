"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { AlertTriangle, CheckCircle2, Download, Loader2 } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";

import { DataTable } from "@/components/common/data-table/DataTable";
import { apiMessage } from "@/components/payroll/labels";
import { toastApiError } from "@/components/payroll-ops/shared";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Progress } from "@/components/ui/progress";
import { downloadFile, get } from "@/lib/api";
import type { PayslipBatch, PayslipBatchResult } from "@/lib/types/payslip-batches";

const POLL_MS = 1500;
/** A year of payslips for a large team is tens of megabytes. */
const FILE_TIMEOUT_MS = 5 * 60_000;

const OUTCOME: Record<
  PayslipBatchResult["status"],
  { label: string; variant: "success" | "muted" | "destructive" }
> = {
  added: { label: "Added", variant: "success" },
  sent: { label: "Sent", variant: "success" },
  skipped: { label: "Skipped", variant: "muted" },
  failed: { label: "Failed", variant: "destructive" },
};

const RESULT_COLUMNS: ColumnDef<PayslipBatchResult>[] = [
  {
    id: "person",
    header: "Employee",
    accessorFn: (row) => `${row.name ?? ""} ${row.employee_code ?? ""}`,
    cell: ({ row }) => (
      <>
        <p className="font-medium text-foreground">{row.original.name ?? "—"}</p>
        <p className="text-xs text-muted-foreground">{row.original.employee_code}</p>
      </>
    ),
  },
  {
    accessorKey: "status",
    header: "Outcome",
    meta: { text: (row) => OUTCOME[row.status].label },
    cell: ({ row }) => (
      <Badge variant={OUTCOME[row.original.status].variant}>{OUTCOME[row.original.status].label}</Badge>
    ),
  },
  {
    id: "detail",
    header: "Details",
    accessorFn: (row) => row.detail ?? row.email ?? "",
    meta: { cellClassName: "max-w-sm whitespace-normal text-sm text-muted-foreground" },
    cell: ({ row }) => (
      <>
        {row.original.email && <span className="block">{row.original.email}</span>}
        {row.original.payslips > 0 && (
          <span className="block">
            {row.original.payslips} payslip{row.original.payslips === 1 ? "" : "s"}
          </span>
        )}
        {row.original.detail && <span className="block">{row.original.detail}</span>}
      </>
    ),
  },
];

export function fileSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function downloadBatch(batch: PayslipBatch): Promise<void> {
  await downloadFile(`/payroll/payslip-batches/${batch.id}/file`, batch.file_name ?? "payslips.zip", {
    timeout: FILE_TIMEOUT_MS,
  });
}

/**
 * Follows one download or email request until it is done, then hands over the
 * file (once, by itself) or shows who was emailed and who was not. Closing it
 * does not stop the work: it carries on and stays under Recent requests.
 */
export function PayslipBatchDialog({
  batchId,
  autoDownload,
  onClose,
  onChange,
}: {
  batchId: string;
  /** Start the download by itself when the file is ready (a fresh request). */
  autoDownload: boolean;
  onClose: () => void;
  /** The batch moved on: the screen refreshes its list of requests. */
  onChange?: () => void;
}) {
  const [batch, setBatch] = useState<PayslipBatch | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const downloaded = useRef(false);
  const lastStatus = useRef<string | null>(null);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = async () => {
      try {
        const next = await get<PayslipBatch>(`/payroll/payslip-batches/${batchId}`);
        if (stopped) return;
        setBatch(next);
        setError(null);
        if (next.status !== lastStatus.current) {
          lastStatus.current = next.status;
          onChange?.();
        }
        if (next.status === "queued" || next.status === "running") {
          timer = setTimeout(load, POLL_MS);
        }
      } catch (caught) {
        if (stopped) return;
        setError(apiMessage(caught, "Could not check on the payslips."));
        timer = setTimeout(load, POLL_MS * 3);
      }
    };
    void load();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
    // onChange is a fresh function each render; following the batch must not restart.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchId]);

  const save = async (current: PayslipBatch) => {
    setIsDownloading(true);
    try {
      await downloadBatch(current);
    } catch (caught) {
      toastApiError(caught, "The payslips could not be downloaded.");
    } finally {
      setIsDownloading(false);
    }
  };

  useEffect(() => {
    if (!autoDownload || downloaded.current || !batch) return;
    if (batch.action === "download" && batch.status === "completed" && batch.file_available) {
      downloaded.current = true;
      void save(batch);
    }
  }, [autoDownload, batch]);

  const isEmail = batch?.action === "email";
  const working = !batch || batch.status === "queued" || batch.status === "running";
  const percent = batch && batch.total_people ? Math.round((batch.processed / batch.total_people) * 100) : 0;
  const notDone = (batch?.results ?? []).filter((row) => row.status === "skipped" || row.status === "failed");

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEmail ? "Emailing payslips" : "Preparing payslips"}</DialogTitle>
          <DialogDescription>
            {batch
              ? `${batch.period_label} · ${batch.total_people} ${batch.total_people === 1 ? "person" : "people"} · ${batch.total_payslips} payslip${batch.total_payslips === 1 ? "" : "s"}`
              : "Starting…"}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="warning">
            <AlertTriangle />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {working && (
          <div className="grid gap-2" aria-live="polite">
            <Progress value={percent} aria-label="Progress" />
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              {!batch || batch.status === "queued"
                ? "Waiting to start…"
                : `${isEmail ? "Sending" : "Preparing"}: ${batch.processed} of ${batch.total_people} ${batch.total_people === 1 ? "person" : "people"} done`}
            </p>
            <p className="text-xs text-muted-foreground">
              You can close this; it carries on and stays under Recent requests.
            </p>
          </div>
        )}

        {batch?.status === "failed" && (
          <Alert variant="destructive">
            <AlertTriangle />
            <AlertTitle>This request stopped</AlertTitle>
            <AlertDescription>{batch.error ?? "It could not be finished. Please try again."}</AlertDescription>
          </Alert>
        )}

        {batch?.status === "completed" && (
          <Alert variant={batch.failed ? "warning" : "success"}>
            <CheckCircle2 />
            <AlertTitle>
              {isEmail
                ? `Emailed ${batch.succeeded} ${batch.succeeded === 1 ? "person" : "people"}`
                : `${batch.succeeded} ${batch.succeeded === 1 ? "person's" : "people's"} payslips are ready`}
            </AlertTitle>
            <AlertDescription>
              {[
                batch.skipped ? `${batch.skipped} skipped` : null,
                batch.failed ? `${batch.failed} failed` : null,
                !isEmail && batch.file_name ? `${batch.file_name} (${fileSize(batch.file_size)})` : null,
                !isEmail && !batch.file_available ? "The file was removed after a day; ask again." : null,
              ]
                .filter(Boolean)
                .join(" · ") || (isEmail ? "Everyone picked was emailed." : "Your download has started.")}
            </AlertDescription>
          </Alert>
        )}

        {batch?.status === "completed" && notDone.length > 0 && (
          <DataTable
            variant="plain"
            columns={RESULT_COLUMNS}
            data={notDone}
            getRowId={(row) => row.employee_id}
            noun="people"
          />
        )}

        <DialogFooter>
          {batch?.action === "download" && batch.status === "completed" && batch.file_available && (
            <Button variant="outline" disabled={isDownloading} onClick={() => void save(batch)}>
              {isDownloading ? <Loader2 className="animate-spin" /> : <Download />}
              {downloaded.current ? "Download again" : "Download"}
            </Button>
          )}
          <Button onClick={onClose}>{working ? "Close, keep going" : "Done"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
