"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { ChevronDown, Download, Loader2, Upload, Users } from "lucide-react";
import Link from "next/link";
import React, { useMemo, useState } from "react";
import { toast } from "sonner";

import { DataTable } from "@/components/common/data-table/DataTable";
import { FormField } from "@/components/common/FormField";
import { StatTile } from "@/components/expenses/ReviewCommon";
import { EMPLOYMENT_STATUS, apiMessage } from "@/components/people/labels";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Stepper } from "@/components/ui/stepper";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { downloadFile, post } from "@/lib/api";
import type { ImportPreview, ImportResult, ImportRow, ImportRowOutcome } from "@/lib/types/people";
import { cn, formatDay } from "@/lib/utils";

const STEPS = [
  { title: "Choose file", description: "Template or an export" },
  { title: "Check", description: "Nothing saved yet" },
  { title: "Import", description: "Done" },
];

type RowFilter = "all" | ImportRowOutcome;

function form(file: File, extra: Record<string, string> = {}): FormData {
  const body = new FormData();
  body.append("file", file);
  for (const [key, value] of Object.entries(extra)) body.append(key, value);
  return body;
}

/**
 * Add employees → "Many from Excel": bring people in from a spreadsheet —
 * AskMira's template, or another HR system's export as it comes (factoHR's
 * Employee Detail report is read directly). The file is checked first and
 * nothing is saved until Import; the check and the import read it the same
 * way on the server.
 */
export function ImportEmployeesPanel() {
  const [step, setStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [includeLeavers, setIncludeLeavers] = useState(true);
  const [busy, setBusy] = useState<"check" | "import" | "template" | "left-out" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startOver = () => {
    setStep(0);
    setFile(null);
    setFileKey((key) => key + 1);
    setPreview(null);
    setResult(null);
    setIncludeLeavers(true);
    setError(null);
  };

  const check = async () => {
    if (!file) {
      setError("Choose the spreadsheet to import.");
      return;
    }
    setBusy("check");
    setError(null);
    try {
      const checked = await post<ImportPreview>("/employees/import/preview", form(file), {
        timeout: 120_000,
      });
      setPreview(checked);
      setIncludeLeavers(true);
      setStep(1);
    } catch (caught) {
      setError(apiMessage(caught, "The file could not be checked."));
    } finally {
      setBusy(null);
    }
  };

  const runImport = async () => {
    if (!file) return;
    setBusy("import");
    setError(null);
    try {
      const done = await post<ImportResult>(
        "/employees/import",
        form(file, { include_leavers: includeLeavers ? "true" : "false" }),
        { timeout: 300_000 },
      );
      setResult(done);
      setStep(2);
      toast.success(`${done.created} employees imported`);
    } catch (caught) {
      setError(apiMessage(caught, "The import did not go through. Nothing was saved."));
    } finally {
      setBusy(null);
    }
  };

  const template = async () => {
    setBusy("template");
    try {
      await downloadFile("/employees/import/template", "askmira-employee-import.xlsx");
    } catch (caught) {
      toast.error(apiMessage(caught, "The template could not be downloaded."));
    } finally {
      setBusy(null);
    }
  };

  /** The rows not added, with the file's own columns and why — to correct and import again. */
  const leftOut = async () => {
    if (!file) return;
    setBusy("left-out");
    try {
      await downloadFile("/employees/import/rejected", "employees-not-added.xlsx", {
        method: "POST",
        body: form(file),
        timeout: 120_000,
      });
    } catch (caught) {
      toast.error(apiMessage(caught, "The rows not added could not be downloaded."));
    } finally {
      setBusy(null);
    }
  };

  const leftOutButton = (
    <Button variant="outline" disabled={busy !== null} onClick={() => void leftOut()}>
      {busy === "left-out" ? <Loader2 className="animate-spin" /> : <Download />}
      Download rows not added
    </Button>
  );

  const toImport = preview ? preview.ready_current + (includeLeavers ? preview.ready_leavers : 0) : 0;

  return (
      <Card tier="tier1">
        <CardContent className="grid gap-6">
          {/* Done, every step shows its tick. */}
          <Stepper steps={STEPS} current={step === 2 ? STEPS.length : step} />

          {step === 0 && (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
              <div className="grid content-start gap-4">
                <FormField
                  htmlFor="import-file"
                  label="Spreadsheet"
                  hint="An .xlsx or .csv file, up to 10 MB. Nothing is saved until you press Import."
                >
                  <Input
                    key={fileKey}
                    id="import-file"
                    type="file"
                    accept=".xlsx,.csv"
                    onChange={(event) => {
                      setFile(event.target.files?.[0] ?? null);
                      setError(null);
                    }}
                  />
                </FormField>
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                <div>
                  <Button disabled={busy === "check"} onClick={() => void check()}>
                    {busy === "check" ? <Loader2 className="animate-spin" /> : <Upload />}
                    Check file
                  </Button>
                </div>
              </div>
              <div className="grid content-start gap-3 rounded-xl bg-muted/60 p-4 text-sm">
                <p className="text-muted-foreground">
                  Upload your factoHR Employee Detail file as it is, or fill in our template.
                </p>
                <div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy === "template"}
                    onClick={() => void template()}
                  >
                    {busy === "template" ? <Loader2 className="animate-spin" /> : <Download />}
                    Download template
                  </Button>
                </div>
              </div>
            </div>
          )}

          {step === 1 && preview && (
            <div className="grid gap-5">
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{preview.filename}</span> ·{" "}
                {preview.total_rows} rows. Nothing is saved yet.
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                <StatTile
                  label="Will be added"
                  value={preview.ready_current + preview.ready_leavers}
                  hint={`${preview.ready_current} working here, ${preview.ready_leavers} who have left`}
                  tone="success"
                />
                <StatTile label="Already in AskMira" value={preview.skipped} hint="Left as they are" />
                <StatTile
                  label="Can't be added"
                  value={preview.errors}
                  hint={preview.errors ? "See Problems below" : "None"}
                  tone={preview.errors ? "destructive" : "default"}
                />
              </div>

              {(preview.new_departments.length > 0 || preview.new_locations.length > 0) && (
                <Alert>
                  <AlertTitle>Also created by this import</AlertTitle>
                  <AlertDescription className="grid gap-1.5">
                    {preview.new_departments.length > 0 && (
                      <span>
                        Departments:{" "}
                        <span className="font-medium text-foreground">
                          {preview.new_departments.join(", ")}
                        </span>
                      </span>
                    )}
                    {preview.new_locations.length > 0 && (
                      <span>
                        Locations:{" "}
                        <span className="font-medium text-foreground">
                          {preview.new_locations
                            .map((location) => `${location.name} (${location.state_code})`)
                            .join(", ")}
                        </span>
                      </span>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              <ColumnsFound preview={preview} />

              <ImportRows rows={preview.rows} />

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="grid gap-4 border-t pt-4">
                {preview.ready_leavers > 0 && (
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="import-leavers"
                      checked={includeLeavers}
                      onCheckedChange={(on) => setIncludeLeavers(on === true)}
                      className="mt-0.5"
                    />
                    <div className="grid gap-1">
                      <Label htmlFor="import-leavers" className="font-medium">
                        Include the {preview.ready_leavers} people who have left
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Recorded as exited with their leaving date: kept for headcount history,
                        attrition reports and statutory records, never on the active directory.
                      </p>
                    </div>
                  </div>
                )}
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
                  <div className="flex flex-col-reverse gap-2 sm:flex-row">
                    <Button variant="outline" disabled={busy === "import"} onClick={startOver}>
                      Choose another file
                    </Button>
                    {preview.skipped + preview.errors > 0 && leftOutButton}
                  </div>
                  <Button
                    variant="accent"
                    disabled={busy === "import" || toImport === 0}
                    onClick={() => void runImport()}
                  >
                    {busy === "import" ? <Loader2 className="animate-spin" /> : <Users />}
                    {toImport === 0 ? "Nothing to import" : `Import ${toImport} employees`}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {step === 2 && result && (
            <div className="grid gap-5">
              <Alert>
                <AlertTitle>
                  {result.created} employees imported from {result.filename}
                </AlertTitle>
                <AlertDescription className="grid gap-1">
                  {result.created_leavers > 0 && (
                    <span>{result.created_leavers} of them have left and are recorded as exited.</span>
                  )}
                  {result.skipped > 0 && (
                    <span>{result.skipped} were already in AskMira and were left as they are.</span>
                  )}
                  {result.failed > 0 && (
                    <span>
                      {result.failed} could not be added. Download them, fix those rows and import
                      that sheet — everyone already brought in is skipped.
                    </span>
                  )}
                  {result.departments_created.length > 0 && (
                    <span>Departments created: {result.departments_created.join(", ")}.</span>
                  )}
                  {result.locations_created.length > 0 && (
                    <span>Locations created: {result.locations_created.join(", ")}.</span>
                  )}
                  <span>
                    Nobody was given a login. An admin gives each person one from their profile.
                  </span>
                </AlertDescription>
              </Alert>
              <ImportRows rows={result.rows} />
              <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
                {result.skipped + result.failed > 0 && leftOutButton}
                <Button variant="outline" onClick={startOver}>
                  Import another file
                </Button>
                <Button asChild>
                  <Link href="/people">Open the directory</Link>
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
  );
}

/** Which columns of the file fill which fields, and which are not used. */
function ColumnsFound({ preview }: { preview: ImportPreview }) {
  const [open, setOpen] = useState(false);
  const bySection = useMemo(() => {
    const groups = new Map<string, ImportPreview["columns_used"]>();
    for (const column of preview.columns_used) {
      groups.set(column.section, [...(groups.get(column.section) ?? []), column]);
    }
    return [...groups.entries()];
  }, [preview.columns_used]);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-xl border">
      <CollapsibleTrigger asChild>
        <Button variant="ghost" className="h-auto w-full justify-between rounded-xl px-4 py-3">
          <span className="text-sm font-medium">
            Columns: {preview.columns_used.length} used, {preview.columns_ignored.length} not used
          </span>
          <ChevronDown className={cn("transition-transform", open && "rotate-180")} />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="grid gap-4 border-t px-4 py-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {bySection.map(([section, columns]) => (
            <div key={section} className="grid content-start gap-1.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {section}
              </p>
              <ul className="grid gap-1 text-sm">
                {columns.map((column) => (
                  <li key={`${column.field}-${column.header}`}>
                    <span className="text-muted-foreground">{column.header}</span> →{" "}
                    <span className="font-medium">{column.field}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        {preview.columns_ignored.length > 0 && (
          <div className="grid gap-1.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Not used
            </p>
            <p className="text-sm text-muted-foreground">{preview.columns_ignored.join(" · ")}</p>
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

const FILTERS: { value: RowFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "ready", label: "To add" },
  { value: "error", label: "Problems" },
  { value: "skip", label: "Already here" },
];

const SKIPPED_NOTE = "This Emp Code is already in AskMira; the record is left as it is.";

/** The status badge's words, for the search and the CSV. */
function statusText(row: ImportRow): string | null {
  if (row.outcome === "skip") return "Already here";
  if (row.outcome === "error") return "Not added";
  if (!row.status) return null;
  return row.status === "exited" && row.date_of_exit
    ? `Left ${formatDay(row.date_of_exit, true)}`
    : EMPLOYMENT_STATUS[row.status].label;
}

const IMPORT_ROW_COLUMNS: ColumnDef<ImportRow>[] = [
  {
    accessorKey: "line",
    header: "Row",
    meta: { className: "w-14", cellClassName: "tabular-nums text-muted-foreground" },
  },
  {
    accessorKey: "name",
    header: "Employee",
    meta: { text: (row) => [row.name, row.employee_code].filter(Boolean).join(" ") },
    cell: ({ row }) => (
      <>
        <span className="block font-medium">{row.original.name ?? "—"}</span>
        <span className="text-xs text-muted-foreground">{row.original.employee_code ?? "No code"}</span>
      </>
    ),
  },
  {
    id: "status",
    header: "Status",
    accessorFn: (row) => statusText(row),
    cell: ({ row }) =>
      row.original.outcome === "skip" ? (
        <Badge variant="muted">Already here</Badge>
      ) : row.original.outcome === "error" ? (
        <Badge variant="destructive">Not added</Badge>
      ) : row.original.status ? (
        <Badge variant={EMPLOYMENT_STATUS[row.original.status].variant}>
          {row.original.status === "exited" && row.original.date_of_exit
            ? `Left ${formatDay(row.original.date_of_exit, true)}`
            : EMPLOYMENT_STATUS[row.original.status].label}
        </Badge>
      ) : null,
  },
  {
    accessorKey: "date_of_joining",
    header: "Joined",
    meta: {
      cellClassName: "whitespace-nowrap tabular-nums",
      text: (row) => (row.date_of_joining ? formatDay(row.date_of_joining, true) : null),
    },
    cell: ({ row }) => (row.original.date_of_joining ? formatDay(row.original.date_of_joining, true) : "—"),
  },
  {
    accessorKey: "department",
    header: "Department",
    cell: ({ row }) => row.original.department ?? "—",
  },
  {
    accessorKey: "location",
    header: "Location",
    cell: ({ row }) => row.original.location ?? "—",
  },
  {
    accessorKey: "manager",
    header: "Manager",
    meta: { cellClassName: "whitespace-nowrap" },
    cell: ({ row }) => row.original.manager ?? "—",
  },
  {
    id: "notes",
    header: "Notes",
    accessorFn: (row) =>
      [...row.errors, ...row.warnings, ...(row.outcome === "skip" ? [SKIPPED_NOTE] : [])].join("; "),
    meta: { className: "min-w-72", cellClassName: "whitespace-normal" },
    cell: ({ row }) => (
      <ul className="grid gap-1 text-xs">
        {row.original.errors.map((message) => (
          <li key={message} className="text-destructive">
            {message}
          </li>
        ))}
        {row.original.warnings.map((message) => (
          <li key={message} className="text-muted-foreground">
            {message}
          </li>
        ))}
        {row.original.outcome === "skip" && <li className="text-muted-foreground">{SKIPPED_NOTE}</li>}
      </ul>
    ),
  },
];

/** The file's rows: what happens to each, and what was left out of it. */
function ImportRows({ rows }: { rows: ImportRow[] }) {
  const [filter, setFilter] = useState<RowFilter>("all");
  const shown = filter === "all" ? rows : rows.filter((row) => row.outcome === filter);
  const count = (value: RowFilter) =>
    value === "all" ? rows.length : rows.filter((row) => row.outcome === value).length;

  return (
    <DataTable
      columns={IMPORT_ROW_COLUMNS}
      data={shown}
      getRowId={(row) => String(row.line)}
      noun="rows"
      exportName="employee-import-rows"
      searchPlaceholder="Search rows"
      emptyMessage="No rows here."
      pageSize={25}
      rowClassName={() => "align-top"}
      tabs={
        <Tabs value={filter} onValueChange={(value) => setFilter(value as RowFilter)}>
          <TabsList>
            {FILTERS.map((option) => (
              <TabsTrigger key={option.value} value={option.value}>
                {option.label} ({count(option.value)})
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      }
    />
  );
}
