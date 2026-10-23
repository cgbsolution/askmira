"use client";

import { CheckCircle2, Download, Loader2, Lock, Paperclip, Pencil, X } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { DatePicker } from "@/components/common/DatePicker";
import { FormField } from "@/components/common/FormField";
import { Money } from "@/components/common/Money";
import { apiMessage } from "@/components/payroll/labels";
import { StatusAvatar, employeeLabel } from "@/components/payroll/salary-master/EmployeeSearch";
import { WageTypeTable } from "@/components/payroll/salary-master/WageTypeTable";
import {
  BASIS_LABEL,
  WAGE_GROUPS,
  type WageLine,
  type WageRow,
  isTypedAmount,
  periodName,
  revisionDate,
} from "@/components/payroll/salary-master/shared";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useApiQuery } from "@/hooks/useApiQuery";
import { del, downloadFile, post, put } from "@/lib/api";
import type { EmployeeSummary } from "@/lib/types";
import type {
  PayBasis,
  SalaryAmountsInput,
  SalaryBreakdown,
  SalaryComponent,
  SalaryRevision,
  SalaryRevisionInput,
  SalarySaveResult,
  SalaryStructure,
  SalaryStructureDetail,
  SalaryTypeTotal,
} from "@/lib/types/payroll";

export type EditorMode =
  /** A new revision, starting from the latest one's structure and typed amounts. */
  | { kind: "new"; base: SalaryRevision | null; min?: string }
  | { kind: "edit"; revision: SalaryRevision; hasLater: boolean; min?: string; max?: string }
  | { kind: "view"; revision: SalaryRevision };

/** The typed amounts and remarks a revision carries, as editor rows. */
function rowsFrom(revision: SalaryRevision | null): Record<string, WageRow> {
  const rows: Record<string, WageRow> = {};
  for (const component of revision?.components ?? []) {
    const basis: PayBasis = component.pay_basis ?? "monthly";
    if (component.is_manual || component.remarks) {
      rows[component.component_code] = {
        manual: Boolean(component.is_manual),
        amount: component.is_manual
          ? basis === "monthly"
            ? component.monthly_amount
            : component.annual_amount
          : "",
        basis,
        remarks: component.remarks ?? "",
      };
    }
  }
  return rows;
}

/**
 * The Salary master's editor: one revision for one person, every wage type
 * grouped by kind, with live figures from the server as HR types.
 */
export function SalaryEditor({
  employee,
  mode,
  structures,
  components,
  onClose,
  onSaved,
  onEdit,
}: {
  employee: EmployeeSummary;
  mode: EditorMode | null;
  structures: SalaryStructure[];
  components: SalaryComponent[];
  onClose: () => void;
  onSaved: () => void;
  /** From the read-only view: switch to editing this revision. */
  onEdit?: (revision: SalaryRevision) => void;
}) {
  const revision = mode && mode.kind !== "new" ? mode.revision : null;
  const readOnly = mode?.kind === "view";

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

  useEffect(() => {
    if (!mode) return;
    const source = mode.kind === "new" ? mode.base : mode.revision;
    const firstActive = structures.find((s) => s.active)?.id ?? "";
    setStructureId(source?.structure_id ?? firstActive);
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
    // Structures load once; resetting on their arrival would wipe what was typed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

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

  // Every wage type the grid lists: the structure's, the tenant's active ones
  // (to type an amount for), and any this salary already pays.
  const lines = useMemo<WageLine[]>(() => {
    type Resolved = {
      monthly: string;
      annual: string;
      name: string;
      type: WageLine["type"];
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
              partOfCtc: c.part_of_ctc,
              order: c.display_order,
            },
          ]),
    );
    const inStructure = new Map((structure.data?.components ?? []).map((c) => [c.component_code, c]));
    const byCode = new Map<string, WageLine & { order: number }>();
    const add = (
      code: string,
      base: { name: string; type: WageLine["type"]; partOfCtc: boolean; order: number },
    ) => {
      if (byCode.has(code)) return;
      const link = inStructure.get(code);
      const amounts = resolved.get(code);
      byCode.set(code, {
        code,
        name: base.name,
        type: base.type,
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
          partOfCtc: component.part_of_ctc,
          order: component.display_order,
        });
      }
    }
    return [...byCode.values()].sort((a, b) => a.order - b.order || a.code.localeCompare(b.code));
  }, [readOnly, revision, preview, structure.data, components]);

  const totals: SalaryTypeTotal[] = (readOnly ? revision?.totals : preview?.totals) ?? [];
  const totalOf = (type: string) => totals.find((t) => t.component_type === type);
  const ctcAnnual = readOnly ? revision?.ctc_annual : preview?.ctc_annual;
  const ctcMonthly = readOnly ? revision?.ctc_monthly : preview?.monthly_total_in_ctc;
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
        ? "New salary revision"
        : "Assign a salary"
      : mode?.kind === "edit"
        ? `Edit the revision from ${revisionDate(mode.revision.effective_from)}`
        : revision
          ? `Salary from ${revisionDate(revision.effective_from)}`
          : "";
  const busy = saving !== null;

  return (
    <Sheet open={mode !== null} onOpenChange={(open) => !open && !busy && onClose()}>
      <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-6xl">
        <SheetHeader className="border-b border-border px-6 py-4">
          <SheetTitle className="text-lg">{title}</SheetTitle>
          <SheetDescription>
            {readOnly
              ? (revision?.structure_name ?? "Salary structure")
              : "Amounts you type override the structure for this person. Shaded amounts are worked out from the CTC."}
          </SheetDescription>
        </SheetHeader>

        {/* One shrinkable column, so the wide wage grids scroll inside themselves on a phone. */}
        <div className="grid grid-cols-1 gap-6 px-4 py-5 sm:px-6">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex min-w-60 flex-1 items-center gap-3">
              <StatusAvatar employee={employee} className="size-11" />
              <div className="min-w-0">
                <p className="truncate font-semibold text-foreground">{employeeLabel(employee)}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {employee.designation ?? employee.work_email}
                </p>
              </div>
            </div>
            {readOnly && revision ? (
              <div className="flex flex-wrap items-center gap-2">
                {revision.locked && (
                  <Badge variant="muted">
                    <Lock /> Locked
                  </Badge>
                )}
                {attachmentName && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      void downloadFile(`/employees/${employee.id}/salary/${revision.id}/attachment`, attachmentName).catch(
                        (caught) => toast.error(apiMessage(caught, "Could not download the file.")),
                      )
                    }
                  >
                    <Download /> {attachmentName}
                  </Button>
                )}
              </div>
            ) : (
              <>
                <FormField htmlFor="sm-from" label="Effective from" className="w-48">
                  <DatePicker
                    id="sm-from"
                    value={effectiveFrom}
                    onChange={setEffectiveFrom}
                    min={mode && mode.kind !== "view" ? mode.min : undefined}
                    max={mode?.kind === "edit" ? mode.max : undefined}
                  />
                </FormField>
                <FormField htmlFor="sm-structure" label="Salary structure" className="w-60">
                  <Select value={structureId} onValueChange={setStructureId}>
                    <SelectTrigger id="sm-structure" className="h-11 w-full">
                      <SelectValue placeholder={structures.length ? "Choose" : "No structures yet"} />
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
                </FormField>
                <FormField htmlFor="sm-file" label="Attachment" optional className="w-64">
                  {attachmentName && !removeAttachment && !file ? (
                    <div className="flex h-11 items-center gap-2 rounded-lg border border-border px-3 text-sm">
                      <Paperclip className="size-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate">{attachmentName}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        aria-label="Remove the attachment"
                        onClick={() => setRemoveAttachment(true)}
                      >
                        <X />
                      </Button>
                    </div>
                  ) : (
                    <Input
                      id="sm-file"
                      type="file"
                      accept="application/pdf,image/png,image/jpeg"
                      onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                    />
                  )}
                </FormField>
              </>
            )}
          </div>

          {!readOnly && (
            <FormField
              htmlFor="sm-reason"
              label="Reason"
              optional={!(mode?.kind === "new" && mode.base)}
            >
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

          <Card tier="tier1" className="gap-3 py-4">
            <CardContent className="flex flex-wrap items-end gap-4 px-4">
              {!readOnly && (
                <>
                  <FormField htmlFor="sm-ctc" label="CTC (₹)" className="w-52">
                    <Input
                      id="sm-ctc"
                      inputMode="decimal"
                      className="text-right tabular-nums"
                      value={ctc}
                      aria-invalid={(ctc.trim() !== "" && !ctcValid) || undefined}
                      onChange={(event) => setCtc(event.target.value)}
                    />
                  </FormField>
                  <FormField htmlFor="sm-ctc-basis" label="Pay basis" className="w-36">
                    <Select
                      value={ctcBasis}
                      onValueChange={(value) => {
                        // A yearly CTC is not a monthly one: start the figure again.
                        setCtcBasis(value as PayBasis);
                        setCtc("");
                      }}
                    >
                      <SelectTrigger id="sm-ctc-basis" className="h-11 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="annual">{BASIS_LABEL.annual}</SelectItem>
                        <SelectItem value="monthly">{BASIS_LABEL.monthly}</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormField>
                </>
              )}
              <Figure label="CTC a year" value={ctcAnnual} />
              <Figure label="CTC a month" value={ctcMonthly} />
              <Figure label="Monthly gross" value={totalOf("earning")?.monthly} />
              <Figure label="Deductions a month" value={totalOf("deduction")?.monthly} />
              <div className="ml-auto self-center">
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
            </CardContent>
          </Card>

          {previewError && !readOnly && (
            <Alert variant="destructive">
              <AlertDescription>{previewError}</AlertDescription>
            </Alert>
          )}

          {structure.isLoading && !structure.data ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            WAGE_GROUPS.map((group) => {
              const groupLines = lines.filter((line) => line.type === group.type);
              if (groupLines.length === 0) return null;
              return (
                <WageTypeTable
                  key={group.type}
                  title={group.title}
                  lines={groupLines}
                  rows={rows}
                  total={totalOf(group.type)}
                  readOnly={readOnly}
                  onChange={(code, row) => setRows((current) => ({ ...current, [code]: row }))}
                />
              );
            })
          )}
          {!readOnly && !ctcValid && (
            <p className="text-sm text-muted-foreground">Enter the CTC to see how it splits.</p>
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
              <Button disabled={busy || previewing || Boolean(previewError)} onClick={() => void save(false)}>
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
                  Save &amp; update later revisions
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

function Figure({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="min-w-28">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-base font-semibold text-foreground">
        <Money value={value ?? null} />
      </p>
    </div>
  );
}
