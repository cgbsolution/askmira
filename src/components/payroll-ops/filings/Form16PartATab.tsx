"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { FileUp, Loader2 } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { DataTable } from "@/components/common/data-table/DataTable";
import { FormField } from "@/components/common/FormField";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ApiError, post } from "@/lib/api";

interface UploadResult {
  financial_year: string;
  stored: { file: string; employee_code: string }[];
  skipped: { file: string; reason: string }[];
}

const SKIPPED_COLUMNS: ColumnDef<UploadResult["skipped"][number]>[] = [
  { accessorKey: "file", header: "File", meta: { cellClassName: "font-mono text-xs" } },
  { accessorKey: "reason", header: "Why" },
];

function lastFinancialYear(): string {
  const now = new Date();
  const start = now.getMonth() >= 3 ? now.getFullYear() - 1 : now.getFullYear() - 2;
  return `${start}-${String(start + 1).slice(-2)}`;
}

/**
 * Part A of Form 16 comes only from TRACES. Upload the ZIP TRACES gives for
 * the TAN; each PDF is matched to its person by the PAN in its file name, and
 * every employee's Form 16 download then carries Part A before Part B.
 */
export function Form16PartATab() {
  const [year, setYear] = useState(lastFinancialYear);
  const [file, setFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);

  const upload = async () => {
    if (!file) return;
    setBusy(true);
    setResult(null);
    const form = new FormData();
    form.append("financial_year", year);
    form.append("file", file);
    try {
      const done = await post<UploadResult>("/tax/form-16/part-a", form);
      setResult(done);
      toast.success(`${done.stored.length} Part A file(s) stored.`);
      setFile(null);
      setFileKey((key) => key + 1);
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.detail : "The upload did not go through.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card tier="tier1">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileUp className="size-4 text-primary" /> Form 16 Part A from TRACES
        </CardTitle>
        <CardDescription>
          Download the Part A ZIP for your TAN from TRACES and upload it here. Files are matched to people by the PAN
          in each file name; anything that does not match exactly one person is listed and not stored.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-[10rem_1fr_auto] sm:items-end">
          <FormField htmlFor="part-a-year" label="Financial year">
            <Input id="part-a-year" value={year} maxLength={7} onChange={(e) => setYear(e.target.value)} />
          </FormField>
          <FormField htmlFor="part-a-file" label="TRACES ZIP">
            <Input key={fileKey} id="part-a-file" type="file" accept=".zip,application/zip" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </FormField>
          <Button disabled={busy || !file || !/^\d{4}-\d{2}$/.test(year)} onClick={() => void upload()}>
            {busy && <Loader2 className="animate-spin" />} Upload
          </Button>
        </div>
        {result && result.skipped.length > 0 && (
          <Alert variant="warning">
            <AlertTitle>{result.skipped.length} file(s) not matched</AlertTitle>
            <AlertDescription>
              <DataTable
                columns={SKIPPED_COLUMNS}
                data={result.skipped}
                getRowId={(row) => row.file}
                noun="files"
                exportName={`form-16-part-a-not-matched-${result.financial_year}`}
                searchPlaceholder="Search files"
                className="w-full"
              />
            </AlertDescription>
          </Alert>
        )}
        {result && result.stored.length > 0 && (
          <p className="text-sm text-muted-foreground">
            Stored for: {result.stored.map((row) => row.employee_code).join(", ")}.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
