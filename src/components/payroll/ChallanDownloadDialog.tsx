"use client";

import {
  AlertTriangle,
  ChevronDown,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  Landmark,
  Loader2,
  UserX,
} from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/common/FormField";
import { Money } from "@/components/common/Money";
import {
  MultiSelectFilter,
  type MultiSelectOption,
} from "@/components/common/MultiSelectFilter";
import { apiMessage } from "@/components/payroll/labels";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { downloadFile, get, post } from "@/lib/api";
import type {
  ChallanFilterChoice,
  ChallanFilters,
  ChallanKind,
  ChallanMovement,
  ChallanOptions,
  ChallanPreview,
} from "@/lib/types/payroll";
import { cn } from "@/lib/utils";

export const CHALLAN_FILES: {
  value: ChallanKind;
  label: string;
  detail: string;
  icon: React.ElementType;
}[] = [
  {
    value: "esic_mc",
    label: "ESIC MC template (.xls)",
    detail:
      "The ESIC portal's monthly contribution upload: IP number, IP name, days paid, total monthly wages, and a reason code and last working day for anyone with no days.",
    icon: FileSpreadsheet,
  },
  {
    value: "pf_ecr_csv",
    label: "PF ECR upload (.csv)",
    detail:
      "The challan upload sheet: UAN, member name, gross, EPF, EPS and EDLI wages, EPF, EPS and difference remitted, NCP days and refund of advances, under a header row.",
    icon: Landmark,
  },
  {
    value: "pf_ecr_txt",
    label: "PF ECR text file (.txt)",
    detail:
      "The same eleven fields in the EPFO's #~# format, no header: upload it to the EPFO portal as it is.",
    icon: FileText,
  },
];

const DOWNLOAD_LABEL: Record<ChallanKind, string> = {
  esic_mc: "MC template",
  pf_ecr_csv: "ECR CSV",
  pf_ecr_txt: "ECR text",
};

const EMPTY: ChallanFilters = {
  department_ids: [],
  location_ids: [],
  project_ids: [],
  designations: [],
  grades: [],
  employment_types: [],
  statuses: [],
  movement: "all",
  employee_ids: [],
  exclude_employee_ids: [],
};

const MOVEMENT_LABEL: Record<ChallanMovement, string> = {
  all: "Everyone on the run",
  joined: "Joined this month",
  left: "Left this month",
  continuing: "Neither joined nor left this month",
};

type ListKey = Exclude<keyof ChallanFilters, "movement">;

function choices(list: ChallanFilterChoice[]): MultiSelectOption[] {
  return list.map((choice) => ({
    value: choice.value,
    label: choice.label,
    count: choice.count,
  }));
}

/** How many filters narrow the file. */
function activeCount(filters: ChallanFilters): number {
  const lists = (Object.keys(EMPTY) as (keyof ChallanFilters)[]).filter(
    (key) => key !== "movement" && (filters[key] as string[]).length > 0,
  );
  return lists.length + (filters.movement === "all" ? 0 : 1);
}

/**
 * After a run is approved and locked: the month's PF and ESI upload files for
 * the people HR picks. The preview says how many rows the file holds, its
 * totals, and who is left out and why, before anything is downloaded.
 */
export function ChallanDownloadDialog({
  runId,
  open,
  onOpenChange,
  initialKind = "esic_mc",
}: {
  runId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialKind?: ChallanKind;
}) {
  const [kind, setKind] = useState<ChallanKind>(initialKind);
  const [filters, setFilters] = useState<ChallanFilters>(EMPTY);
  const [options, setOptions] = useState<ChallanOptions | null>(null);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ChallanPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [busy, setBusy] = useState(false);

  // Each opening starts on the file it was opened for, with no filters.
  useEffect(() => {
    if (!open) return;
    setKind(initialKind);
    setFilters(EMPTY);
  }, [open, initialKind]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setOptionsError(null);
    get<ChallanOptions>(`/payroll/runs/${runId}/challan-files/options`)
      .then((result) => !cancelled && setOptions(result))
      .catch((caught) => {
        if (!cancelled)
          setOptionsError(
            apiMessage(caught, "Could not load the run's people."),
          );
      });
    return () => {
      cancelled = true;
    };
  }, [open, runId]);

  // The preview follows every change, once the choices settle.
  useEffect(() => {
    if (!open || !options) return;
    let cancelled = false;
    setPreviewing(true);
    const timer = setTimeout(() => {
      post<ChallanPreview>(`/payroll/runs/${runId}/challan-files/preview`, {
        kind,
        filters,
      })
        .then((result) => {
          if (cancelled) return;
          setPreview(result);
          setPreviewError(null);
        })
        .catch((caught) => {
          if (cancelled) return;
          setPreview(null);
          setPreviewError(apiMessage(caught, "Could not work out the file."));
        })
        .finally(() => !cancelled && setPreviewing(false));
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, options, runId, kind, filters]);

  const people = useMemo<MultiSelectOption[]>(
    () =>
      (options?.employees ?? []).map((person) => ({
        value: person.id,
        label: person.name,
        hint: person.employee_code,
      })),
    [options],
  );

  const set = (key: ListKey) => (value: string[]) =>
    setFilters((current) => ({ ...current, [key]: value }));

  const chosen = CHALLAN_FILES.find((entry) => entry.value === kind)!;
  const narrowed = activeCount(filters);
  const canDownload = Boolean(
    preview && preview.rows > 0 && !previewing && !busy,
  );

  const download = async () => {
    if (!preview) return;
    setBusy(true);
    try {
      await downloadFile(
        `/payroll/runs/${runId}/challan-files/download`,
        preview.file_name,
        {
          method: "POST",
          body: { kind, filters },
          timeout: 120_000,
        },
      );
      toast.success(
        `${chosen.label} for ${preview.period_label} downloaded: ${preview.rows} ${preview.rows === 1 ? "row" : "rows"}.`,
      );
    } catch (caught) {
      toast.error(apiMessage(caught, "The file could not be downloaded."));
    } finally {
      setBusy(false);
    }
  };

  const filterField = (
    key: ListKey,
    label: string,
    list: MultiSelectOption[],
    allLabel: string,
    noun: string,
  ) =>
    list.length > 0 && (
      <FormField htmlFor={`challan-${key}`} label={label}>
        <MultiSelectFilter
          id={`challan-${key}`}
          options={list}
          value={filters[key] as string[]}
          onChange={set(key)}
          allLabel={allLabel}
          noun={noun}
        />
      </FormField>
    );

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            PF &amp; ESI challan files
            {options ? ` — ${options.period_label}` : ""}
          </DialogTitle>
          <DialogDescription>
            {options
              ? `${options.legal_entity_name ?? "This company"} · ${options.people} ${options.people === 1 ? "person" : "people"} paid by ${options.runs_included === 1 ? "the locked run" : `${options.runs_included} locked runs`} of the month. Pick the file, narrow who goes in it, check the preview, then download.`
              : "The month's PF and ESI upload files, from the locked figures."}
          </DialogDescription>
        </DialogHeader>

        {optionsError ? (
          <Alert variant="destructive">
            <AlertTriangle />
            <AlertDescription>{optionsError}</AlertDescription>
          </Alert>
        ) : !options ? (
          <div className="grid gap-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <>
            <div
              className="grid gap-2"
              role="radiogroup"
              aria-label="Which file"
            >
              <p className="text-sm font-medium">Which file</p>
              <div className="grid gap-2 sm:grid-cols-3">
                {CHALLAN_FILES.map((entry) => {
                  const Icon = entry.icon;
                  const active = entry.value === kind;
                  return (
                    <Button
                      key={entry.value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      variant="outline"
                      onClick={() => setKind(entry.value)}
                      className={cn(
                        "h-auto flex-col items-start gap-1 whitespace-normal p-3 text-left",
                        active &&
                          "border-primary bg-primary/5 ring-1 ring-primary",
                      )}
                    >
                      <span className="flex items-center gap-2 font-semibold">
                        <Icon className="size-4 text-primary" /> {entry.label}
                      </span>
                      <span className="text-xs font-normal text-muted-foreground">
                        {entry.detail}
                      </span>
                    </Button>
                  );
                })}
              </div>
            </div>

            <Collapsible
              defaultOpen
              className="rounded-lg border border-border"
            >
              <div className="flex items-center justify-between gap-2 px-3 py-2">
                <CollapsibleTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="group -ml-2"
                  >
                    <Filter />
                    Advanced filters
                    {narrowed > 0 && (
                      <span className="rounded-full bg-primary px-1.5 text-xs text-primary-foreground tabular-nums">
                        {narrowed}
                      </span>
                    )}
                    <ChevronDown className="transition-transform group-data-[state=open]:rotate-180" />
                  </Button>
                </CollapsibleTrigger>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={narrowed === 0}
                  onClick={() => setFilters(EMPTY)}
                >
                  Clear filters
                </Button>
              </div>
              <CollapsibleContent>
                <div className="grid gap-4 border-t border-border p-3 sm:grid-cols-2">
                  {filterField(
                    "department_ids",
                    "Department",
                    choices(options.departments),
                    "All departments",
                    "departments",
                  )}
                  {filterField(
                    "location_ids",
                    "Location",
                    choices(options.locations),
                    "All locations",
                    "locations",
                  )}
                  {filterField(
                    "project_ids",
                    "Project",
                    choices(options.projects),
                    "All projects",
                    "projects",
                  )}
                  {filterField(
                    "designations",
                    "Designation",
                    choices(options.designations),
                    "All designations",
                    "designations",
                  )}
                  {filterField(
                    "grades",
                    "Grade",
                    choices(options.grades),
                    "All grades",
                    "grades",
                  )}
                  {filterField(
                    "employment_types",
                    "Employment type",
                    choices(options.employment_types),
                    "All employment types",
                    "types",
                  )}
                  {filterField(
                    "statuses",
                    "Employee status",
                    choices(options.statuses),
                    "Every status",
                    "statuses",
                  )}
                  <FormField
                    htmlFor="challan-movement"
                    label="Joiners and leavers"
                  >
                    <Select
                      value={filters.movement}
                      onValueChange={(value) =>
                        setFilters((current) => ({
                          ...current,
                          movement: value as ChallanMovement,
                        }))
                      }
                    >
                      <SelectTrigger
                        id="challan-movement"
                        className="h-11 w-full"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(MOVEMENT_LABEL) as ChallanMovement[]).map(
                          (value) => (
                            <SelectItem key={value} value={value}>
                              {MOVEMENT_LABEL[value]}
                              {value === "joined" ? ` (${options.joined})` : ""}
                              {value === "left" ? ` (${options.left})` : ""}
                            </SelectItem>
                          ),
                        )}
                      </SelectContent>
                    </Select>
                  </FormField>
                  {filterField(
                    "employee_ids",
                    "Only these people",
                    people,
                    "Everyone the filters match",
                    "people",
                  )}
                  {filterField(
                    "exclude_employee_ids",
                    "Leave out these people",
                    people,
                    "Nobody left out",
                    "people",
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>

            <PreviewPanel
              kind={kind}
              preview={preview}
              error={previewError}
              loading={previewing && !preview}
              filtered={narrowed > 0}
            />
          </>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Close
          </Button>
          <Button onClick={() => void download()} disabled={!canDownload}>
            {busy || previewing ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Download />
            )}
            Download {DOWNLOAD_LABEL[kind]}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PreviewPanel({
  kind,
  preview,
  error,
  loading,
  filtered,
}: {
  kind: ChallanKind;
  preview: ChallanPreview | null;
  error: string | null;
  loading: boolean;
  filtered: boolean;
}) {
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }
  if (loading || !preview) return <Skeleton className="h-28 w-full" />;

  const scheme = kind === "esic_mc" ? "ESI" : "PF";
  const number = kind === "esic_mc" ? "IP number" : "UAN";
  return (
    <div className="grid gap-3" aria-live="polite">
      <div className="rounded-lg border border-border bg-muted/40 p-3">
        <p className="text-sm text-foreground">
          <span className="font-semibold tabular-nums">{preview.rows}</span>{" "}
          {preview.rows === 1 ? "row" : "rows"} in{" "}
          <span className="font-medium">{preview.file_name}</span>
          <span className="text-muted-foreground">
            {" "}
            · {preview.matched}{" "}
            {preview.matched === 1 ? "person matches" : "people match"} the
            filters
            {preview.not_covered > 0
              ? `, ${preview.not_covered} with no ${scheme} this month`
              : ""}
          </span>
        </p>
        {preview.rows > 0 && (
          <dl className="mt-3 grid gap-x-4 gap-y-2 sm:grid-cols-4">
            {preview.totals.map((total) => (
              <div key={total.label}>
                <dt className="text-xs text-muted-foreground">{total.label}</dt>
                <dd className="text-sm font-semibold">
                  <Money value={total.amount} />
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      {kind === "esic_mc" && filtered && (
        <p className="text-xs text-muted-foreground">
          The ESIC portal accepts an upload only when every IP mapped to your
          employer code is on it. A filtered file is for checking or for a
          separate code; upload the full file.
        </p>
      )}

      {kind === "esic_mc" && preview.wage_mismatches > 0 && (
        <Alert variant="warning">
          <AlertTriangle />
          <AlertTitle>
            Check Total Monthly Wages for {preview.wage_mismatches}{" "}
            {preview.wage_mismatches === 1 ? "person" : "people"}
          </AlertTitle>
          <AlertDescription>
            The ESI deducted on their payslips does not match the employee ESI
            rate on the ESI wages recorded for them, usually because the month was imported without
            the other HRMS&apos;s ESI wages. The ESIC portal works out the
            contribution from the wages in this file, so correct that column
            before uploading. Each person is listed under the notes below.
          </AlertDescription>
        </Alert>
      )}

      {preview.left_out.length > 0 && (
        <Alert variant="warning">
          <UserX />
          <AlertTitle>
            {preview.left_out.length} owed {scheme} but left out of the file
          </AlertTitle>
          <AlertDescription>
            <p>
              A missing or wrong {number} makes the portal reject the whole
              upload. Add it on their profile (Statutory details), then download
              again.
            </p>
            <ul className="mt-1 list-disc pl-4">
              {preview.left_out.map((issue) => (
                <li key={`${issue.employee_code}-${issue.message}`}>
                  <span className="font-medium">
                    {issue.name} ({issue.employee_code})
                  </span>
                  : {issue.message}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {preview.warnings.length > 0 && (
        <Collapsible className="rounded-lg border border-border">
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              className="group h-auto w-full justify-between px-3 py-2 font-normal"
            >
              <span className="flex items-center gap-2 text-sm">
                <AlertTriangle className="text-warning" />
                {preview.warnings.length}{" "}
                {preview.warnings.length === 1 ? "note" : "notes"} to check
                (still in the file)
              </span>
              <ChevronDown className="transition-transform group-data-[state=open]:rotate-180" />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ul className="grid gap-1 border-t border-border px-3 py-2 text-sm">
              {preview.warnings.map((issue, index) => (
                <li key={`${issue.employee_code}-${index}`}>
                  <span className="font-medium">
                    {issue.name} ({issue.employee_code})
                  </span>
                  :{" "}
                  <span className="text-muted-foreground">{issue.message}</span>
                </li>
              ))}
            </ul>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
