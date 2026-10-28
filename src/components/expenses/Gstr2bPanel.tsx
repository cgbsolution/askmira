"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { FileUp, GitCompareArrows, Loader2, Lock, Upload } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { DataTable } from "@/components/common/data-table/DataTable";
import { InlineProblem, StatTile, errorDetail, todayISO } from "@/components/expenses/ReviewCommon";
import { formatMoney, humanizeKey } from "@/components/expenses/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useApiQuery } from "@/hooks/useApiQuery";
import { post } from "@/lib/api";
import type {
  GstReconcileInput,
  GstReconciliation,
  GstReconciliationReport,
  Gstr2bCsvResult,
  Gstr2bImport,
  OrgLegalEntity,
} from "@/lib/types/expenses";
import { formatDate, formatDay } from "@/lib/utils";
import { DatePicker } from "@/components/common/DatePicker";
import { FileInput } from "@/components/ui/file-input";

const MAX_BYTES = 2 * 1024 * 1024;
const CSV_HEADER = "vendor_gstin,vendor_name,invoice_number,invoice_date,taxable_value,cgst,sgst,igst,cess";
const NO_ENTITY = "__none__";

function when(value: string): string {
  return value.length === 10 ? formatDay(value, true) : formatDate(value);
}

type UploadProblem = Gstr2bCsvResult["errors"][number];

const PROBLEM_COLUMNS: ColumnDef<UploadProblem>[] = [
  { accessorKey: "row", header: "Row", meta: { headClassName: "w-20", cellClassName: "tabular-nums" } },
  { accessorKey: "error", header: "Problem", meta: { cellClassName: "whitespace-normal text-destructive" } },
];

type TaxField = "matched_tax" | "missing_in_2b_tax" | "missing_in_register_tax" | "at_risk_tax";

function taxColumn(key: TaxField, header: string): ColumnDef<GstReconciliation> {
  return {
    accessorKey: key,
    header,
    sortingFn: "alphanumeric",
    meta: { className: "text-right", cellClassName: "tabular-nums" },
    cell: ({ row }) => formatMoney(row.original[key]),
  };
}

function ReconciliationFigures({
  matched,
  missingIn2b,
  missingInRegister,
  atRisk,
  capturedLines,
  portalLines,
  counts,
}: {
  matched: string;
  missingIn2b: string;
  missingInRegister: string;
  atRisk: string;
  capturedLines: number;
  portalLines: number;
  counts: Record<string, number>;
}) {
  return (
    <div className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Matched" tone="success" value={formatMoney(matched)} hint="Tax in both the register and 2B" />
        <StatTile
          label="Missing in 2B"
          tone="destructive"
          value={formatMoney(missingIn2b)}
          hint="Tax captured here, not in the vendor's filing"
        />
        <StatTile
          label="Missing in register"
          tone="warning"
          value={formatMoney(missingInRegister)}
          hint="Tax in 2B with no captured invoice"
        />
        <StatTile
          label="At risk — vendor has not filed"
          tone="destructive"
          value={formatMoney(atRisk)}
          hint="Eligible credit only"
        />
      </div>
      <p className="text-sm text-muted-foreground">
        <span className="tabular-nums">{capturedLines}</span> captured lines ·{" "}
        <span className="tabular-nums">{portalLines}</span> GSTR-2B lines
      </p>
      {Object.keys(counts).length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(counts).map(([key, count]) => (
            <Badge key={key} variant="outline" className="tabular-nums">
              {humanizeKey(key)}: {count}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

/** Upload the GSTR-2B, reconcile the register against it, and see past runs. */
export function Gstr2bPanel() {
  const imports = useApiQuery<Gstr2bImport[]>("/gst/gstr2b-imports");
  const reconciliations = useApiQuery<GstReconciliation[]>("/gst/reconciliations");
  const entities = useApiQuery<OrgLegalEntity[]>("/org/legal-entities");

  // Upload
  const [file, setFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const [uploadLabel, setUploadLabel] = useState("");
  const [importedOn, setImportedOn] = useState(todayISO());
  const [sourceNote, setSourceNote] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProblem, setUploadProblem] = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<Gstr2bCsvResult | null>(null);

  // Reconcile
  const [recLabel, setRecLabel] = useState("");
  const [recStart, setRecStart] = useState("");
  const [recEnd, setRecEnd] = useState("");
  const [recEntity, setRecEntity] = useState(NO_ENTITY);
  const [reconciling, setReconciling] = useState(false);
  const [recProblem, setRecProblem] = useState<string | null>(null);
  const [report, setReport] = useState<GstReconciliationReport | null>(null);

  const fileProblem = file && file.size > MAX_BYTES ? "The file is larger than 2 MB." : null;
  const canUpload = Boolean(file) && !fileProblem && uploadLabel.trim().length > 0 && Boolean(importedOn);

  const upload = async () => {
    if (!file || !canUpload) return;
    setUploading(true);
    setUploadProblem(null);
    setUploadResult(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("period_label", uploadLabel.trim());
      form.append("imported_on", importedOn);
      if (sourceNote.trim()) form.append("source_note", sourceNote.trim());
      const result = await post<Gstr2bCsvResult>("/gst/gstr2b-imports/csv", form, { timeout: 60_000 });
      setUploadResult(result);
      if (result.imported) {
        toast.success(`Imported ${result.imported.line_count} GSTR-2B lines`);
        setFile(null);
        setFileKey((current) => current + 1);
        imports.reload();
      }
    } catch (error) {
      setUploadProblem(errorDetail(error, "Could not import the file."));
    } finally {
      setUploading(false);
    }
  };

  const recPeriodProblem = recStart && recEnd && recStart > recEnd ? "The start date is after the end date." : null;
  const canReconcile = recLabel.trim().length > 0 && Boolean(recStart && recEnd) && !recPeriodProblem;

  const reconcile = async () => {
    if (!canReconcile) return;
    setReconciling(true);
    setRecProblem(null);
    setReport(null);
    try {
      const body: GstReconcileInput = {
        period_label: recLabel.trim(),
        period_start: recStart,
        period_end: recEnd,
        legal_entity_id: recEntity === NO_ENTITY ? null : recEntity,
      };
      const result = await post<GstReconciliationReport>("/gst/reconciliations", body, { timeout: 60_000 });
      setReport(result);
      toast.success("Reconciliation complete");
      reconciliations.reload();
    } catch (error) {
      setRecProblem(errorDetail(error, "Could not run the reconciliation."));
    } finally {
      setReconciling(false);
    }
  };

  const entityName = (id: string | null) =>
    id ? (entities.data?.find((entity) => entity.id === id)?.name ?? "Unknown entity") : "—";

  // A 403 reads as "no access", not as a failed load.
  const importsForbidden = imports.error?.status === 403;
  const reconciliationsForbidden = reconciliations.error?.status === 403;

  const importColumns: ColumnDef<Gstr2bImport>[] = [
    { accessorKey: "period_label", header: "Period", meta: { cellClassName: "font-medium text-foreground" } },
    { id: "entity", header: "Entity", accessorFn: (row) => entityName(row.legal_entity_id) },
    {
      accessorKey: "line_count",
      header: "Lines",
      meta: { className: "text-right", cellClassName: "tabular-nums" },
    },
    {
      accessorKey: "total_tax",
      header: "Total tax",
      sortingFn: "alphanumeric",
      meta: { className: "text-right", cellClassName: "tabular-nums" },
      cell: ({ row }) => formatMoney(row.original.total_tax),
    },
    {
      accessorKey: "imported_on",
      header: "Downloaded on",
      meta: { text: (row) => formatDay(row.imported_on, true) },
      cell: ({ row }) => formatDay(row.original.imported_on, true),
    },
    {
      accessorKey: "source_note",
      header: "Note",
      meta: { cellClassName: "max-w-72 whitespace-normal text-muted-foreground" },
      cell: ({ row }) => row.original.source_note ?? "—",
    },
  ];

  const reconciliationColumns: ColumnDef<GstReconciliation>[] = [
    {
      accessorKey: "period_label",
      header: "Period",
      meta: {
        text: (row) =>
          row.legal_entity_id ? `${row.period_label} · ${entityName(row.legal_entity_id)}` : row.period_label,
      },
      cell: ({ row }) => (
        <>
          <p className="font-medium text-foreground">{row.original.period_label}</p>
          {row.original.legal_entity_id && (
            <p className="text-xs text-muted-foreground">{entityName(row.original.legal_entity_id)}</p>
          )}
        </>
      ),
    },
    {
      accessorKey: "run_on",
      header: "Run",
      meta: { cellClassName: "whitespace-nowrap", text: (row) => when(row.run_on) },
      cell: ({ row }) => when(row.original.run_on),
    },
    {
      id: "lines",
      header: "Lines (ours / 2B)",
      accessorFn: (row) => `${row.captured_lines} / ${row.portal_lines}`,
      sortingFn: "alphanumeric",
      meta: { className: "text-right", cellClassName: "tabular-nums" },
    },
    taxColumn("matched_tax", "Matched"),
    taxColumn("missing_in_2b_tax", "Missing in 2B"),
    taxColumn("missing_in_register_tax", "Missing in register"),
    taxColumn("at_risk_tax", "At risk"),
  ];

  return (
    <div className="grid gap-6">
      <Card tier="tier1">
        <CardHeader>
          <CardTitle>Upload a GSTR-2B</CardTitle>
          <CardDescription>
            Download the GSTR-2B from the GST portal yourself and upload it as CSV — this module does not connect to
            the portal. Up to 2 MB, with this header row:
            <code className="mt-1 block overflow-x-auto whitespace-nowrap rounded bg-muted px-2 py-1 text-xs text-foreground">
              {CSV_HEADER}
            </code>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              void upload();
            }}
          >
            <div className="grid gap-3 md:grid-cols-3">
              <div className="grid gap-1.5">
                <Label htmlFor="gstr2b-file">CSV file</Label>
                <FileInput
                  key={fileKey}
                  id="gstr2b-file"
                  accept=".csv,text/csv"
                  aria-invalid={Boolean(fileProblem)}
                  onChange={(event) => {
                    setFile(event.target.files?.[0] ?? null);
                    setUploadResult(null);
                  }}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="gstr2b-label">Return period label</Label>
                <Input
                  id="gstr2b-label"
                  value={uploadLabel}
                  maxLength={16}
                  onChange={(e) => setUploadLabel(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="gstr2b-imported-on">Downloaded on</Label>
                <DatePicker id="gstr2b-imported-on" value={importedOn} onChange={setImportedOn} />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="gstr2b-note">
                Source note <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Textarea id="gstr2b-note" rows={2} maxLength={2000} value={sourceNote} onChange={(e) => setSourceNote(e.target.value)} />
            </div>
            {fileProblem && <p className="text-sm text-destructive">{fileProblem}</p>}
            {uploadProblem && <InlineProblem>{uploadProblem}</InlineProblem>}
            <div>
              <Button type="submit" disabled={!canUpload || uploading}>
                {uploading ? <Loader2 className="animate-spin" /> : <Upload />}
                Import
              </Button>
            </div>
          </form>

          {uploadResult && (
            <div className="mt-4 grid gap-3">
              <p className="text-sm text-foreground">
                Read <span className="tabular-nums">{uploadResult.rows_read}</span>{" "}
                {uploadResult.rows_read === 1 ? "row" : "rows"}.{" "}
                {uploadResult.imported
                  ? `Imported ${uploadResult.imported.line_count} lines for ${uploadResult.imported.period_label}, total tax ${formatMoney(uploadResult.imported.total_tax)}.`
                  : "Nothing was imported."}
              </p>
              {uploadResult.errors.length > 0 && (
                <DataTable
                  columns={PROBLEM_COLUMNS}
                  data={uploadResult.errors}
                  getRowId={(row, index) => `${row.row}-${index}`}
                  noun="problems"
                  exportName="gstr2b-import-problems"
                  searchPlaceholder="Search problems"
                  selectable={false}
                />
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <DataTable
        title="Imports"
        columns={importColumns}
        data={importsForbidden ? [] : (imports.data ?? [])}
        noun="imports"
        exportName="gstr2b-imports"
        searchPlaceholder="Search imports"
        isLoading={imports.isLoading && imports.data === null}
        error={importsForbidden ? null : (imports.error?.detail ?? null)}
        onRetry={imports.reload}
        loadingRows={3}
        empty={
          importsForbidden
            ? { icon: Lock, title: "You don't have access to this", description: imports.error?.detail }
            : {
                icon: FileUp,
                title: "No GSTR-2B imported",
                description: "Nothing can be reconciled, or confirmed claimable, until a GSTR-2B is imported.",
              }
        }
      />

      <Card tier="tier1">
        <CardHeader>
          <CardTitle>Reconcile</CardTitle>
          <CardDescription>
            Match the captured register for a period against the imported GSTR-2B with the same label.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <form
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto] lg:items-end"
            onSubmit={(event) => {
              event.preventDefault();
              void reconcile();
            }}
          >
            <div className="grid gap-1.5">
              <Label htmlFor="rec-label">Return period label</Label>
              <Input id="rec-label" value={recLabel} maxLength={16} onChange={(e) => setRecLabel(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="rec-start">From</Label>
              <DatePicker id="rec-start" value={recStart} onChange={setRecStart} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="rec-end">To</Label>
              <DatePicker id="rec-end" value={recEnd} onChange={setRecEnd} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="rec-entity">Legal entity</Label>
              <Select value={recEntity} onValueChange={setRecEntity}>
                <SelectTrigger id="rec-entity" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_ENTITY}>Not specified</SelectItem>
                  {(entities.data ?? []).map((entity) => (
                    <SelectItem key={entity.id} value={entity.id}>
                      {entity.name} ({entity.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={!canReconcile || reconciling}>
              {reconciling ? <Loader2 className="animate-spin" /> : <GitCompareArrows />}
              Reconcile
            </Button>
          </form>
          {recPeriodProblem && <p className="text-sm text-destructive">{recPeriodProblem}</p>}
          {recProblem && <InlineProblem>{recProblem}</InlineProblem>}
          {report && (
            <ReconciliationFigures
              matched={report.matched_tax}
              missingIn2b={report.missing_in_2b_tax}
              missingInRegister={report.missing_in_register_tax}
              atRisk={report.at_risk_from_unfiled_vendors}
              capturedLines={report.captured_lines}
              portalLines={report.portal_lines}
              counts={report.counts ?? {}}
            />
          )}
        </CardContent>
      </Card>

      <DataTable
        title="Past reconciliations"
        columns={reconciliationColumns}
        data={reconciliationsForbidden ? [] : (reconciliations.data ?? [])}
        noun="reconciliations"
        exportName="gst-reconciliations"
        searchPlaceholder="Search reconciliations"
        isLoading={reconciliations.isLoading && reconciliations.data === null}
        error={reconciliationsForbidden ? null : (reconciliations.error?.detail ?? null)}
        onRetry={reconciliations.reload}
        loadingRows={3}
        empty={
          reconciliationsForbidden
            ? { icon: Lock, title: "You don't have access to this", description: reconciliations.error?.detail }
            : {
                icon: GitCompareArrows,
                title: "No reconciliations run",
                description: "Every credit reads as not reconciled until one is run for its period.",
              }
        }
      />
    </div>
  );
}
