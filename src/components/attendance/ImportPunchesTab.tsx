"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { FileWarning, Loader2, Upload } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { DataTable } from "@/components/common/data-table/DataTable";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { post } from "@/lib/api";
import type { PunchImportResult, PunchImportRowError } from "@/lib/types/attendance";

import { errorDetail } from "./shared";
import { Field } from "./ShiftsTab";
import { FileInput } from "@/components/ui/file-input";

const MAX_BYTES = 2 * 1024 * 1024;

const ERROR_COLUMNS: ColumnDef<PunchImportRowError>[] = [
  { accessorKey: "row", header: "Row", meta: { cellClassName: "tabular-nums" } },
  {
    accessorKey: "employee_code",
    header: "Employee code",
    cell: ({ row }) => row.original.employee_code ?? "—",
  },
  {
    accessorKey: "error",
    header: "Error",
    meta: { cellClassName: "whitespace-normal text-destructive" },
  },
];

export function ImportPunchesTab() {
  const [file, setFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [submitted, setSubmitted] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [result, setResult] = useState<PunchImportResult | null>(null);

  const fileError = !file
    ? "Choose a CSV file."
    : !file.name.toLowerCase().endsWith(".csv")
      ? "The file must be a .csv."
      : file.size > MAX_BYTES
        ? "The file is larger than 2 MB."
        : null;
  const timezoneError = timezone.trim() ? null : "A timezone is required, e.g. Asia/Kolkata.";

  const upload = async () => {
    setSubmitted(true);
    if (!file || fileError || timezoneError) return;
    const form = new FormData();
    form.append("file", file);
    form.append("assumed_timezone", timezone.trim());
    setIsUploading(true);
    setServerError(null);
    setResult(null);
    try {
      const imported = await post<PunchImportResult>("/attendance/import/csv", form, {
        timeout: 120_000,
      });
      setResult(imported);
      toast.success(`${imported.imported.toLocaleString("en-IN")} punches imported`);
      setFile(null);
      setFileKey((current) => current + 1);
      setSubmitted(false);
    } catch (caught) {
      setServerError(errorDetail(caught, "Could not import the file."));
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <Card tier="tier1">
        <CardHeader>
          <CardTitle>Import punches</CardTitle>
          <CardDescription>
            For devices that cannot push, or a backfill. A punch already recorded is counted as a
            duplicate, not imported twice.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="rounded-md bg-muted px-3 py-2.5 text-sm text-muted-foreground">
            <p>
              Header row:{" "}
              <code className="rounded bg-card px-1 text-foreground">
                employee_code,punched_at,direction[,device_id]
              </code>
            </p>
            <p className="mt-1">
              <code className="text-foreground">direction</code> is <code>in</code> or{" "}
              <code>out</code>. Up to 2 MB and 5,000 rows. A timestamp without a UTC offset is read
              in the timezone below.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field id="import-file" label="CSV file" error={submitted ? (fileError ?? undefined) : undefined}>
              <FileInput
                key={fileKey}
                id="import-file"
                accept=".csv,text/csv"
                aria-invalid={submitted && Boolean(fileError)}
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
            </Field>
            <Field
              id="import-timezone"
              label="Timezone for timestamps without an offset"
              error={submitted ? (timezoneError ?? undefined) : undefined}
            >
              <Input
                id="import-timezone"
                value={timezone}
                maxLength={64}
                aria-invalid={submitted && Boolean(timezoneError)}
                onChange={(event) => setTimezone(event.target.value)}
              />
            </Field>
          </div>

          {serverError && (
            <Alert variant="destructive">
              <AlertDescription>{serverError}</AlertDescription>
            </Alert>
          )}

          <div>
            <Button disabled={isUploading} onClick={() => void upload()}>
              {isUploading ? <Loader2 className="animate-spin" /> : <Upload />}
              Upload and import
            </Button>
          </div>
        </CardContent>
      </Card>

      {result && <ImportResult result={result} />}
    </div>
  );
}

function ImportResult({ result }: { result: PunchImportResult }) {
  return (
    <Card tier="tier1" className="pb-0">
      <CardHeader>
        <CardTitle>Import result</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Figure label="Imported" value={result.imported} />
        <Figure label="Duplicates skipped" value={result.duplicates} />
        <Figure label="Unknown employee codes" value={result.skipped_unknown_employee.length} />
        <Figure label="Rows with errors" value={result.errors.length} />
      </CardContent>

      {result.skipped_unknown_employee.length > 0 && (
        <CardContent className="mt-4 space-y-1.5">
          <p className="text-sm font-medium">Codes not found in the employee directory</p>
          <div className="flex flex-wrap gap-1.5">
            {result.skipped_unknown_employee.map((code) => (
              <Badge key={code} variant="warning">
                {code}
              </Badge>
            ))}
          </div>
        </CardContent>
      )}

      <div className="mt-5">
        <DataTable
          bordered={false}
          columns={ERROR_COLUMNS}
          data={result.errors}
          getRowId={(row, index) => `${row.row}-${index}`}
          noun="errors"
          exportName="punch-import-errors"
          searchPlaceholder="Search row errors"
          empty={{
            icon: FileWarning,
            title: "No row errors",
            description: "Every row was either imported, a duplicate, or had an unknown employee code.",
          }}
        />
      </div>
    </Card>
  );
}

function Figure({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border px-3 py-2.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-xl font-semibold tabular-nums">{value.toLocaleString("en-IN")}</p>
    </div>
  );
}
