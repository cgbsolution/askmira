"use client";

import { CheckCircle2, Download, Loader2, Lock, Paperclip, Pencil, X } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { DatePicker } from "@/components/common/DatePicker";
import { FormField } from "@/components/common/FormField";
import { apiMessage } from "@/components/payroll/labels";
import { StatusAvatar, employeeLabel } from "@/components/payroll/salary-master/EmployeeSearch";
import { SalaryGrid } from "@/components/payroll/salary-master/SalaryGrid";
import { StandardSetupCallout } from "@/components/payroll/salary-master/StandardSetupCallout";
import {
  type WageLine,
  type WageRow,
  isTypedAmount,
  periodName,
  revisionDate,
} from "@/components/payroll/salary-master/shared";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useApiQuery } from "@/hooks/useApiQuery";
import { del, downloadFile, post, put } from "@/lib/api";
import type { EmployeeSummary } from "@/lib/types";
import {
  DEFAULT_WAGE_GROUP,
  type PayBasis,
  type SalaryAmountsInput,
  type SalaryBreakdown,
  type SalaryComponent,
  type SalaryRevision,
  type SalaryRevisionInput,
  type SalarySaveResult,
  type SalaryStructure,
  type SalaryStructureDetail,
  type WageGroup,
} from "@/lib/types/payroll";

export type EditorMode =
  /** A new revision, starting from the latest one's structure and typed amounts. */
  | { kind: "new"; base: SalaryRevision | null; min?: string }
  | {
      kind: "edit";
      revision: SalaryRevision;
      hasLater: boolean;
      min?: string;
      max?: string;
    }
  | { kind: "view"; revision: SalaryRevision };

/** The typed amounts and remarks a revision carries, as editor rows. */
function rowsFrom(revision: SalaryRevision | null): Record<string, WageRow> {
  const rows: Record<string, WageRow> = {};
  for (const component of revision?.components ?? []) {
    const basis: PayBasis = component.pay_basis ?? "monthly";
    if (component.is_manual || component.remarks) {
      rows[component.component_code] = {
        manual: Boolean(component.is_manual),
        amount: component.is_manual ? (basis === "monthly" ? component.monthly_amount : component.annual_amount) : "",
        basis,
        remarks: component.remarks ?? "",
      };
    }
  }
  return rows;
}

/**
 * The Salary master's editor: one revision for one person, every wage type in
 * one grid, with live figures from the server as HR types.
 */
export function SalaryEditor({
  employee,
  mode,
  structures,
  structuresLoaded,
  components,
  onClose,
  onSaved,
  onEdit,
  onSetupDone,
}: {
  employee: EmployeeSummary;
  mode: EditorMode | null;
  structures: SalaryStructure[];
  /** False until the structure list has arrived, so the setup prompt does not flash. */
  structuresLoaded: boolean;
  components: SalaryComponent[];
  onClose: () => void;
  onSaved: () => void;
  /** From the read-only view: switch to editing this revision. */
  onEdit?: (revision: SalaryRevision) => void;
  /** The standard structure was just set up: reload structures and wage types. */
  onSetupDone: () => void;
}) {
  const revision = mode && mode.kind !== "new" ? mode.revision : null;
  const readOnly = mode?.kind === "view";
  const activeStructures = structures.filter((s) => s.active);

  const [structureId, setStructureId] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [reason, setReason] = useState("");
  const [ctc, setCtc] = useState("");
  const [ctcBasis, setCtcBasis] = useState<PayBasis>("annual");
  const [rows, setRows] = useState<Record<string, WageRow>>({});
  const [file, setFile] = useState<File | null>(null);
  const [removeAttachment, setRemoveAttachment] = useState(false);
  const [preview, setPreview] = useState<SalaryBreakdown | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<"save" | "forward" | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!mode) return;
    const source = mode.kind === "new" ? mode.base : mode.revision;
    setStructureId(source?.structure_id ?? "");
    setEffectiveFrom(mode.kind === "new" ? "" : mode.revision.effective_from);
    setReason(mode.kind === "new" ? "" : (mode.revision.revision_reason ?? ""));
    setCtc(mode.kind === "new" ? "" : mode.revision.ctc_annual);
    setCtcBasis("annual");
    setRows(rowsFrom(source));
    setFile(null);
    setRemoveAttachment(false);
    setPreview(null);
    setPreviewError(null);
    setError(null);
  }, [mode]);

  // With nothing to start from, take the workspace's structure as soon as there is one.
  const firstActive = activeStructures[0]?.id ?? "";
  useEffect(() => {
    if (mode && !structureId && firstActive) setStructureId(firstActive);
  }, [mode, structureId, firstActive]);

  const structure = useApiQuery<SalaryStructureDetail>(
    mode && structureId ? `/salary-structures/${structureId}` : null,
  );

  // What the server is asked to resolve: the CTC and every typed amount.
  const typed = Object.entries(rows).filter(([, row]) => row.manual);
  const invalidTyped = typed.some(([, row]) => !isTypedAmount(row.amount));
  const ctcValid = isTypedAmount(ctc) && !/^0+(\.0+)?$/.test(ctc.trim());
  const request: SalaryAmountsInput | null =
    readOnly || !ctcValid || invalidTyped
      ? null
      : {
          ...(ctcBasis === "annual" ? { ctc_annual: ctc.trim() } : { ctc_monthly: ctc.trim() }),
          components: typed.map(([code, row]) => ({
            component_code: code,
            amount: row.amount.trim(),
            basis: row.basis,
          })),
        };
  const requestKey = request && structureId ? JSON.stringify([structureId, request]) : null;

  useEffect(() => {
    if (!requestKey) {
      setPreview(null);
      setPreviewError(null);
      return;
    }
    const [id, body] = JSON.parse(requestKey) as [string, SalaryAmountsInput];
    let cancelled = false;
    setPreviewing(true);
    const timer = setTimeout(() => {
      post<SalaryBreakdown>(`/salary-structures/${id}/preview`, body)
        .then((result) => {
          if (cancelled) return;
          setPreview(result);
          setPreviewError(null);
        })
        .catch((caught) => {
          if (cancelled) return;
          setPreviewError(apiMessage(caught, "These amounts do not resolve against the structure."));
        })
        .finally(() => {
          if (!cancelled) setPreviewing(false);
        });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [requestKey]);

  // Every wage type the grid lists: the structure's, the workspace's active ones
  // (to type an amount for), and any this salary already pays.
  const lines = useMemo<WageLine[]>(() => {
    const groupOf = new Map<string, WageGroup>(
      components.map((c) => [c.code, c.wage_group ?? DEFAULT_WAGE_GROUP[c.component_type]]),
    );
    type Resolved = {
      monthly: string;
      annual: string;
      name: string;
      type: WageLine["type"];
      group: WageGroup;
      partOfCtc: boolean;
      order: number;
    };
    const resolved = new Map<string, Resolved>(
      readOnly
        ? (revision?.components ?? []).map((c): [string, Resolved] => [
            c.component_code,
            {
              monthly: c.monthly_amount,
              annual: c.annual_amount,
              name: c.component_name,
              type: c.component_type,
              group: c.wage_group ?? groupOf.get(c.component_code) ?? DEFAULT_WAGE_GROUP[c.component_type],
              partOfCtc: c.part_of_ctc,
              order: c.display_order,
            },
          ])
        : (preview?.components ?? []).map((c): [string, Resolved] => [
            c.code,
            {
              monthly: c.monthly_amount,
              annual: c.annual_amount,
              name: c.name,
              type: c.component_type,
              group: c.wage_group ?? groupOf.get(c.code) ?? DEFAULT_WAGE_GROUP[c.component_type],
              partOfCtc: c.part_of_ctc,
              order: c.display_order,
            },
          ]),
    );
    const inStructure = new Map((structure.data?.components ?? []).map((c) => [c.component_code, c]));
    const byCode = new Map<string, WageLine & { order: number }>();
    const add = (code: string, base: Omit<Resolved, "monthly" | "annual">) => {
      if (byCode.has(code)) return;
      const link = inStructure.get(code);
      const amounts = resolved.get(code);
      byCode.set(code, {
        code,
        name: base.name,
        type: base.type,
        group: base.group,
        balance: link?.calculation_type === "balance",
        partOfCtc: base.partOfCtc,
        inStructure: Boolean(link),
        monthly: amounts?.monthly ?? null,
        annual: amounts?.annual ?? null,
        order: base.order,
      });
    };
    for (const link of structure.data?.components ?? []) {
      add(link.component_code, {
        name: link.component_name,
        type: link.component_type,
        group: groupOf.get(link.component_code) ?? DEFAULT_WAGE_GROUP[link.component_type],
        partOfCtc: link.part_of_ctc,
        order: link.display_order,
      });
    }
    for (const [code, item] of resolved) add(code, item);
    if (!readOnly) {
      for (const component of components.filter((c) => c.active)) {
        add(component.code, {
          name: component.name,
          type: component.component_type,
          group: groupOf.get(component.code) ?? DEFAULT_WAGE_GROUP[component.component_type],
          partOfCtc: component.part_of_ctc,
          order: component.display_order,
        });
      }
    }
    return [...byCode.values()].sort((a, b) => a.order - b.order || a.code.localeCompare(b.code));
  }, [readOnly, revision, preview, structure.data, components]);

  const earnings = (readOnly ? revision?.totals : preview?.totals)?.find((t) => t.component_type === "earning");
  const attachmentName = revision?.attachment_name ?? null;

  const save = async (forward: boolean) => {
    if (!mode || mode.kind === "view") return;
    if (!structureId) return setError("Choose a salary structure.");
    if (!effectiveFrom) return setError("Give the date this salary applies from.");
    if (!ctcValid) return setError("Enter the CTC.");
    if (invalidTyped) return setError("Fix the amounts marked in red: digits only, up to two decimals.");
    if (mode.kind === "new" && mode.base && !reason.trim()) return setError("Say why the salary is being revised.");
    if (previewError) return setError(previewError);
    setSaving(forward ? "forward" : "save");
    setError(null);
    const body: SalaryRevisionInput = {
      structure_id: structureId,
      effective_from: effectiveFrom,
      revision_reason: reason.trim() || null,
      ...(ctcBasis === "annual" ? { ctc_annual: ctc.trim() } : { ctc_monthly: ctc.trim() }),
      components: Object.entries(rows)
        .filter(([, row]) => row.manual || row.remarks.trim())
        .map(([code, row]) => ({
          component_code: code,
          amount: row.manual ? row.amount.trim() : null,
          basis: row.basis,
          remarks: row.remarks.trim() || null,
        })),
    };
    try {
      const saved =
        mode.kind === "new"
          ? await post<SalarySaveResult>(`/employees/${employee.id}/salary`, body)
          : await put<SalarySaveResult>(`/employees/${employee.id}/salary/${mode.revision.id}`, {
              ...body,
              apply_to_later_revisions: forward,
            });
      const notes: string[] = [];
      try {
        if (file) {
          const form = new FormData();
          form.append("file", file);
          await post(`/employees/${employee.id}/salary/${saved.id}/attachment`, form);
        } else if (removeAttachment && attachmentName) {
          await del(`/employees/${employee.id}/salary/${saved.id}/attachment`);
        }
      } catch (caught) {
        notes.push(`The salary is saved, but the file was not: ${apiMessage(caught, "upload failed")}.`);
      }
      const paid = saved.paid_months_affected ?? [];
      if (paid.length) {
        notes.push(
          `Payroll already paid ${paid.length === 1 ? periodName(paid[0]) : `${periodName(paid[0])} to ${periodName(paid[paid.length - 1])}`} at the earlier amounts. Raise arrears under Payroll → Arrears to pay the difference.`,
        );
      }
      const runs = saved.runs_to_recompute ?? [];
      if (runs.length) {
        notes.push(`Recompute payroll for ${runs.map(periodName).join(", ")} to pick this up.`);
      }
      const carried = saved.carried_forward_to ?? [];
      if (carried.length) {
        notes.push(
          `Also updated ${carried.length === 1 ? "the revision" : `${carried.length} revisions`} from ${carried.map(revisionDate).join(", ")}.`,
        );
      }
      const title = mode.kind === "new" ? (mode.base ? "Salary revised." : "Salary assigned.") : "Revision saved.";
      if (notes.length) toast.warning(title, { description: notes.join(" "), duration: 15000 });
      else toast.success(title);
      onSaved();
      onClose();
    } catch (caught) {
      setError(apiMessage(caught, "Could not save the salary."));
    } finally {
      setSaving(null);
    }
  };

  const title =
    mode?.kind === "new"
      ? mode.base
        ? "Salary master · new revision"
        : "Salary master · assign a salary"
      : mode?.kind === "edit"
        ? `Salary master · edit the revision from ${revisionDate(mode.revision.effective_from)}`
        : revision
          ? `Salary master · ${revisionDate(revision.effective_from)}`
          : "Salary master";
  const busy = saving !== null;
  const noStructure = !readOnly && structuresLoaded && activeStructures.length === 0;

  return (
    <Sheet open={mode !== null} onOpenChange={(open) => !open && !busy && onClose()}>
      <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-6xl">
        <SheetHeader className="border-b border-border px-6 py-4">
          <SheetTitle className="text-lg">{title}</SheetTitle>
          <SheetDescription>
            {readOnly
              ? (revision?.structure_name ?? "Salary structure")
              : "Shaded amounts are worked out from the CTC. Type over one, or tick Manually, to set it for this person."}
          </SheetDescription>
        </SheetHeader>

        {/* One shrinkable column, so the wide grid scrolls inside itself on a phone. */}
        <div className="grid grid-cols-1 gap-5 px-4 py-5 sm:px-6">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex min-w-60 flex-1 items-center gap-3">
              <StatusAvatar employee={employee} className="size-10" />
              <div className="min-w-0">
                <p className="truncate font-semibold text-foreground">{employeeLabel(employee)}</p>
                <p className="truncate text-xs text-muted-foreground">{employee.designation ?? employee.work_email}</p>
              </div>
            </div>
            {readOnly && revision ? (
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">From {revisionDate(revision.effective_from)}</Badge>
                {revision.locked && (
                  <Badge variant="muted">
                    <Lock /> Locked
                  </Badge>
                )}
                {attachmentName ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      void downloadFile(
                        `/employees/${employee.id}/salary/${revision.id}/attachment`,
                        attachmentName,
                      ).catch((caught) => toast.error(apiMessage(caught, "Could not download the file.")))
                    }
                  >
                    <Download /> {attachmentName}
                  </Button>
                ) : (
                  <Badge variant="muted">
                    <Paperclip /> No attachment
                  </Badge>
                )}
              </div>
            ) : (
              <>
                <DatePicker
                  id="sm-from"
                  value={effectiveFrom}
                  onChange={setEffectiveFrom}
                  placeholder="Effective from"
                  className="w-44"
                  min={mode && mode.kind !== "view" ? mode.min : undefined}
                  max={mode?.kind === "edit" ? mode.max : undefined}
                />
                <Select value={structureId} onValueChange={setStructureId} disabled={structures.length === 0}>
                  <SelectTrigger id="sm-structure" aria-label="Salary structure" className="h-11 w-56">
                    <SelectValue placeholder={activeStructures.length ? "Salary structure" : "No structure yet"} />
                  </SelectTrigger>
                  <SelectContent>
                    {structures
                      .filter((s) => s.active || s.id === structureId)
                      .map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Input
                  ref={fileInput}
                  id="sm-file"
                  type="file"
                  accept="application/pdf,image/png,image/jpeg"
                  className="sr-only"
                  tabIndex={-1}
                  onChange={(event) => {
                    setFile(event.target.files?.[0] ?? null);
                    setRemoveAttachment(false);
                  }}
                />
                <div className="flex h-11 items-center gap-1 rounded-lg border border-border bg-card pr-1 pl-3 text-sm">
                  <span className="max-w-48 truncate text-muted-foreground">
                    {file?.name ?? (attachmentName && !removeAttachment ? attachmentName : "No attachments")}
                  </span>
                  {(file || (attachmentName && !removeAttachment)) && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      aria-label="Remove the attachment"
                      onClick={() => {
                        if (file) {
                          setFile(null);
                          if (fileInput.current) fileInput.current.value = "";
                        } else {
                          setRemoveAttachment(true);
                        }
                      }}
                    >
                      <X />
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label="Attach a file"
                    onClick={() => fileInput.current?.click()}
                  >
                    <Paperclip />
                  </Button>
                </div>
              </>
            )}
          </div>

          {!readOnly && (
            <FormField htmlFor="sm-reason" label="Reason" optional={!(mode?.kind === "new" && mode.base)}>
              <Input
                id="sm-reason"
                maxLength={255}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder={mode?.kind === "new" && mode.base ? "Annual increment" : "New joiner"}
              />
            </FormField>
          )}
          {readOnly && revision?.revision_reason && (
            <p className="text-sm text-muted-foreground">Reason: {revision.revision_reason}</p>
          )}
          {readOnly && revision?.locked_reason && (
            <Alert>
              <Lock />
              <AlertDescription>
                This revision is history: {revision.locked_reason}. A correction is a new revision plus arrears.
              </AlertDescription>
            </Alert>
          )}

          {noStructure ? (
            <StandardSetupCallout onDone={onSetupDone} />
          ) : (
            <>
              <div className="flex min-h-6 flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  {readOnly
                    ? "As saved."
                    : ctcValid
                      ? "Figures are worked out by the server as you type."
                      : "Enter the CTC to see how it splits."}
                </p>
                {previewing && !readOnly ? (
                  <Badge variant="muted">
                    <Loader2 className="animate-spin" /> Working out
                  </Badge>
                ) : (readOnly || preview) && !previewError ? (
                  <Badge variant="success">
                    <CheckCircle2 /> Sums exactly to CTC
                  </Badge>
                ) : null}
              </div>
              {previewError && !readOnly && (
                <Alert variant="destructive">
                  <AlertDescription>{previewError}</AlertDescription>
                </Alert>
              )}
              {structure.isLoading && !structure.data && !readOnly ? (
                <Skeleton className="h-96 w-full" />
              ) : (
                <SalaryGrid
                  lines={lines}
                  rows={rows}
                  groupTotals={(readOnly ? revision?.group_totals : preview?.group_totals) ?? []}
                  readOnly={readOnly}
                  ctc={
                    readOnly
                      ? undefined
                      : {
                          value: ctc,
                          basis: ctcBasis,
                          invalid: ctc.trim() !== "" && !ctcValid,
                          onChange: setCtc,
                          onBasis: (basis) => {
                            // A yearly CTC is not a monthly one: start the figure again.
                            setCtcBasis(basis);
                            setCtc("");
                          },
                        }
                  }
                  ctcAnnual={readOnly ? revision?.ctc_annual : preview?.ctc_annual}
                  ctcMonthly={readOnly ? revision?.ctc_monthly : preview?.monthly_total_in_ctc}
                  grossMonthly={readOnly ? revision?.gross_monthly : earnings?.monthly}
                  grossAnnual={earnings?.annual}
                  onChange={(code, row) => setRows((current) => ({ ...current, [code]: row }))}
                />
              )}
            </>
          )}

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>

        <SheetFooter className="sticky bottom-0 flex-row flex-wrap justify-start gap-2 border-t border-border bg-card px-6 py-4">
          {readOnly ? (
            <>
              {revision && !revision.locked && onEdit && (
                <Button onClick={() => onEdit(revision)}>
                  <Pencil /> Edit
                </Button>
              )}
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            </>
          ) : (
            <>
              <Button
                disabled={busy || previewing || Boolean(previewError) || noStructure}
                onClick={() => void save(false)}
              >
                {saving === "save" && <Loader2 className="animate-spin" />}
                Save
              </Button>
              {mode?.kind === "edit" && mode.hasLater && (
                <Button
                  variant="outline"
                  disabled={busy || previewing || Boolean(previewError)}
                  onClick={() => void save(true)}
                >
                  {saving === "forward" && <Loader2 className="animate-spin" />}
                  Save &amp; update future revisions
                </Button>
              )}
              <Button variant="ghost" disabled={busy} onClick={onClose}>
                Cancel
              </Button>
            </>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
