"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { CheckCircle2, Download, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { DataTable } from "@/components/common/data-table/DataTable";
import { FormField } from "@/components/common/FormField";
import { Money } from "@/components/common/Money";
import { apiMessage } from "@/components/payroll/labels";
import { revisionDate } from "@/components/payroll/salary-master/shared";
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
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { downloadFile, post } from "@/lib/api";
import type { SalaryImportResult, SalaryImportRow } from "@/lib/types/payroll";
import { FileInput } from "@/components/ui/file-input";

const STATUS: Record<SalaryImportRow["status"], { label: string; variant: "success" | "destructive" | "muted" }> = {
  ready: { label: "Ready", variant: "success" },
  error: { label: "Error", variant: "destructive" },
  skipped: { label: "Skipped", variant: "muted" },
};

/**
 * Salaries for many people from one Excel sheet. The template lists everyone
 * with their present structure; the upload is checked row by row and shown
 * first, and nothing is saved while any row has an error.
 */
export function BulkUploadDialog({
  open,
  onOpenChange,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<SalaryImportResult | null>(null);
  const [busy, setBusy] = useState<"template" | "check" | "save" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSkipped, setShowSkipped] = useState(false);

  const reset = () => {
    setFile(null);
    setResult(null);
    setError(null);
    setShowSkipped(false);
  };

  const send = (apply: boolean) => {
    const form = new FormData();
    if (file) form.append("file", file);
    form.append("apply", apply ? "true" : "false");
    return post<SalaryImportResult>("/salaries/import", form, {
      timeout: 120_000,
    });
  };

  const template = async () => {
    setBusy("template");
    try {
      await downloadFile("/salaries/import/template", "salary-upload-template.xlsx");
    } catch (caught) {
      toast.error(apiMessage(caught, "Could not download the template."));
    } finally {
      setBusy(null);
    }
  };

  const check = async () => {
    if (!file) return setError("Choose the filled sheet first.");
    setBusy("check");
    setError(null);
    try {
      setResult(await send(false));
    } catch (caught) {
      setResult(null);
      setError(apiMessage(caught, "Could not read the file."));
    } finally {
      setBusy(null);
    }
  };

  const save = async () => {
    setBusy("save");
    setError(null);
    try {
      const saved = await send(true);
      toast.success(`${saved.ready} salary revision${saved.ready === 1 ? "" : "s"} saved.`, {
        description: "Each one is in the person's change history.",
      });
      onDone();
      reset();
      onOpenChange(false);
    } catch (caught) {
      setError(apiMessage(caught, "Could not save the salaries."));
    } finally {
      setBusy(null);
    }
  };

  const columns: ColumnDef<SalaryImportRow>[] = [
    { accessorKey: "row", header: "Row", meta: { className: "w-16" } },
    {
      id: "employee",
      header: "Employee",
      accessorFn: (row) => `${row.employee_code ?? ""} ${row.employee_name ?? ""}`,
      cell: ({ row }) => (
        <div className="min-w-0">
          <p className="font-medium text-foreground">{row.original.employee_code ?? "—"}</p>
          <p className="truncate text-xs text-muted-foreground">{row.original.employee_name ?? ""}</p>
        </div>
      ),
    },
    {
      id: "from",
      header: "Effective from",
      accessorFn: (row) => row.effective_from ?? "",
      cell: ({ row }) => (row.original.effective_from ? revisionDate(row.original.effective_from) : "—"),
    },
    {
      id: "structure",
      header: "Structure",
      accessorFn: (row) => row.structure_name ?? "—",
    },
    {
      id: "ctc",
      header: "CTC yearly",
      meta: { className: "text-right" },
      accessorFn: (row) => row.ctc_annual ?? "",
      cell: ({ row }) => <Money value={row.original.ctc_annual} />,
    },
    {
      id: "gross",
      header: "Gross a month",
      meta: { className: "text-right" },
      accessorFn: (row) => row.gross_monthly ?? "",
      cell: ({ row }) => <Money value={row.original.gross_monthly} />,
    },
    {
      accessorKey: "typed",
      header: "Typed",
      meta: { className: "w-16 text-right" },
    },
    {
      id: "status",
      header: "Status",
      accessorFn: (row) => `${STATUS[row.status].label} ${row.message ?? ""} ${(row.notes ?? []).join(" ")}`,
      meta: { cellClassName: "min-w-72 max-w-96 whitespace-normal" },
      cell: ({ row }) => (
        <div className="grid gap-1">
          <div className="flex flex-wrap gap-1">
            <Badge variant={STATUS[row.original.status].variant}>{STATUS[row.original.status].label}</Badge>
            {row.original.notes?.length ? <Badge variant="warning">Check</Badge> : null}
          </div>
          {row.original.message && <p className="text-xs text-muted-foreground">{row.original.message}</p>}
          {row.original.notes?.map((note) => (
            <p key={note} className="text-xs text-marigold-900 dark:text-marigold-100">
              {note}
            </p>
          ))}
        </div>
      ),
    },
  ];

  const rows = (result?.rows ?? []).filter((row) => showSkipped || row.status !== "skipped");

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (busy) return;
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle>Bulk upload salaries</DialogTitle>
          <DialogDescription>
            Fill the template, upload it, check every row, then save them all at once.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid content-start gap-2 rounded-xl border border-border p-4">
            <p className="font-medium text-foreground">1. Download the template</p>
            <p className="text-sm text-muted-foreground">
              The Employee Salary Master sheet: Employee Code, WEF, Pay Basis, Replace all future salary revisions, CTC
              TOTAL, MONTHLY GROSS and a column per wage type, with everyone listed. Fill the rows you want to change;
              rows without a CTC or amount are skipped. A sheet from your old system uploads as it is.
            </p>
            <div>
              <Button variant="outline" disabled={busy !== null} onClick={() => void template()}>
                {busy === "template" ? <Loader2 className="animate-spin" /> : <Download />}
                Download template
              </Button>
            </div>
          </div>
          <div className="grid content-start gap-2 rounded-xl border border-border p-4">
            <p className="font-medium text-foreground">2. Upload the filled sheet</p>
            <FormField htmlFor="bulk-file" label="Excel or CSV file">
              <FileInput
                id="bulk-file"
                accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                onChange={(event) => {
                  setFile(event.target.files?.[0] ?? null);
                  setResult(null);
                  setError(null);
                }}
              />
            </FormField>
            <div>
              <Button disabled={!file || busy !== null} onClick={() => void check()}>
                {busy === "check" ? <Loader2 className="animate-spin" /> : <FileSpreadsheet />}
                Check file
              </Button>
            </div>
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {result && (
          <div className="grid gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="success">
                <CheckCircle2 /> {result.ready} ready
              </Badge>
              <Badge variant={result.errors ? "destructive" : "muted"}>{result.errors} with errors</Badge>
              <Badge variant="muted">{result.skipped} skipped</Badge>
              {result.noted ? <Badge variant="warning">{result.noted} to check</Badge> : null}
              <div className="ml-auto flex items-center gap-2">
                <Switch id="bulk-skipped" checked={showSkipped} onCheckedChange={setShowSkipped} />
                <Label htmlFor="bulk-skipped" className="text-sm font-normal">
                  Show skipped rows
                </Label>
              </div>
            </div>
            {result.errors > 0 && (
              <Alert variant="warning">
                <AlertDescription>
                  Nothing is saved while any row has an error. Fix the rows marked Error in the sheet and check it
                  again.
                </AlertDescription>
              </Alert>
            )}
            <DataTable
              columns={columns}
              data={rows}
              getRowId={(row) => String(row.row)}
              noun="rows"
              selectable={false}
              exportName={false}
              columnPicker={false}
              searchPlaceholder="Search rows"
              emptyMessage={result.skipped ? "Every row was skipped: none has a CTC." : "No rows in this file."}
            />
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" disabled={busy !== null} onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            disabled={!result || result.errors > 0 || result.ready === 0 || busy !== null}
            onClick={() => void save()}
          >
            {busy === "save" ? <Loader2 className="animate-spin" /> : <Upload />}
            {result?.ready ? `Save ${result.ready} salar${result.ready === 1 ? "y" : "ies"}` : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
