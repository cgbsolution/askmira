"use client";

import { ChevronDown, Download, FileSpreadsheet, Loader2, Upload, Users } from "lucide-react";
import Link from "next/link";
import React, { useMemo, useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/common/FormField";
import { PageShell } from "@/components/common/PageShell";
import { TablePager, usePaged } from "@/components/common/TablePager";
import { StatTile } from "@/components/expenses/ReviewCommon";
import { EMPLOYMENT_STATUS, apiMessage } from "@/components/people/labels";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Stepper } from "@/components/ui/stepper";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
 * /people/import — bring employees in from a spreadsheet: AskMira's template,
 * or another HR system's export as it comes (factoHR's Employee Detail report
 * is read directly). The file is checked first and nothing is saved until
 * Import; the check and the import read it the same way on the server.
 */
export function ImportEmployeesScreen() {
  const [step, setStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [includeLeavers, setIncludeLeavers] = useState(true);
  const [busy, setBusy] = useState<"check" | "import" | "template" | null>(null);
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

  const toImport = preview ? preview.ready_current + (includeLeavers ? preview.ready_leavers : 0) : 0;

  return (
    <PageShell
      title="Import employees"
      description="From a spreadsheet: the AskMira template, or your old HR system's export as it is."
      icon={FileSpreadsheet}
      actions={
        <Button variant="outline" disabled={busy === "template"} onClick={() => void template()}>
          {busy === "template" ? <Loader2 className="animate-spin" /> : <Download />}
          Download template
        </Button>
      }
    >
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
              <div className="grid content-start gap-2 rounded-xl bg-muted/60 p-4 text-sm">
                <p className="font-semibold">Files that work</p>
                <ul className="grid list-disc gap-1.5 pl-5 text-muted-foreground">
                  <li>The AskMira template: Download template above.</li>
                  <li>factoHR&apos;s Employee Detail report, exactly as exported.</li>
                  <li>
                    Any sheet with an Emp Code column: other columns are matched by their names.
                  </li>
                </ul>
                <p className="text-muted-foreground">
                  People who have left come in as exited, with their leaving date, for history
                  and reports. Nobody is given a login.
                </p>
              </div>
            </div>
          )}

          {step === 1 && preview && (
            <div className="grid gap-5">
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{preview.filename}</span>, read as{" "}
                {preview.source}, headings on row {preview.header_row}. {preview.total_rows} rows.
              </p>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
                <StatTile label="To add" value={preview.ready_current} hint="Working here" tone="success" />
                <StatTile
                  label="Who have left"
                  value={preview.ready_leavers}
                  hint="Added as exited"
                />
                <StatTile label="Already in AskMira" value={preview.skipped} hint="Left as they are" />
                <StatTile
                  label="Can't be added"
                  value={preview.errors}
                  hint="See Problems below"
                  tone={preview.errors ? "destructive" : "default"}
                />
                <StatTile
                  label="Added with notes"
                  value={preview.with_warnings}
                  hint="A value left out"
                  tone={preview.with_warnings ? "warning" : "default"}
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
                  <Button variant="outline" disabled={busy === "import"} onClick={startOver}>
                    Choose another file
                  </Button>
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
                      {result.failed} could not be added; fix those rows and import the same file
                      again — everyone already brought in is skipped.
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
    </PageShell>
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

/** The file's rows: what happens to each, and what was left out of it. */
function ImportRows({ rows }: { rows: ImportRow[] }) {
  const [filter, setFilter] = useState<RowFilter>("all");
  const shown = filter === "all" ? rows : rows.filter((row) => row.outcome === filter);
  const paged = usePaged(shown, 25);
  const count = (value: RowFilter) =>
    value === "all" ? rows.length : rows.filter((row) => row.outcome === value).length;

  return (
    <div className="grid gap-3">
      <Tabs value={filter} onValueChange={(value) => setFilter(value as RowFilter)}>
        <TabsList>
          {FILTERS.map((option) => (
            <TabsTrigger key={option.value} value={option.value}>
              {option.label} ({count(option.value)})
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <div className="overflow-x-auto rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-14">Row</TableHead>
              <TableHead>Employee</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Manager</TableHead>
              <TableHead className="min-w-72">Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.rows.map((row) => (
              <TableRow key={row.line} className="align-top">
                <TableCell className="tabular-nums text-muted-foreground">{row.line}</TableCell>
                <TableCell>
                  <span className="block font-medium">{row.name ?? "—"}</span>
                  <span className="text-xs text-muted-foreground">{row.employee_code ?? "No code"}</span>
                </TableCell>
                <TableCell>
                  {row.outcome === "skip" ? (
                    <Badge variant="muted">Already here</Badge>
                  ) : row.outcome === "error" ? (
                    <Badge variant="destructive">Not added</Badge>
                  ) : row.status ? (
                    <Badge variant={EMPLOYMENT_STATUS[row.status].variant}>
                      {row.status === "exited" && row.date_of_exit
                        ? `Left ${formatDay(row.date_of_exit, true)}`
                        : EMPLOYMENT_STATUS[row.status].label}
                    </Badge>
                  ) : null}
                </TableCell>
                <TableCell className="whitespace-nowrap tabular-nums">
                  {row.date_of_joining ? formatDay(row.date_of_joining, true) : "—"}
                </TableCell>
                <TableCell>{row.department ?? "—"}</TableCell>
                <TableCell>{row.location ?? "—"}</TableCell>
                <TableCell className="whitespace-nowrap">{row.manager ?? "—"}</TableCell>
                <TableCell className="min-w-72 whitespace-normal">
                  <ul className="grid gap-1 text-xs">
                    {row.errors.map((message) => (
                      <li key={message} className="text-destructive">
                        {message}
                      </li>
                    ))}
                    {row.warnings.map((message) => (
                      <li key={message} className="text-muted-foreground">
                        {message}
                      </li>
                    ))}
                    {row.outcome === "skip" && (
                      <li className="text-muted-foreground">
                        This Emp Code is already in AskMira; the record is left as it is.
                      </li>
                    )}
                  </ul>
                </TableCell>
              </TableRow>
            ))}
            {paged.rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                  No rows here.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <TablePager paged={paged} noun="rows" />
    </div>
  );
}
