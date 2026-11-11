"use client";

import { Calculator, Download, Info, Loader2, Lock, Paperclip, Pencil, X } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { DatePicker } from "@/components/common/DatePicker";
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
import { STATUTORY_CODES } from "@/components/payroll/structures/rules";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { del, downloadFile, post, put } from "@/lib/api";
import { formatMoney } from "@/lib/utils";
import type { EmployeeSummary } from "@/lib/types";
import {
  DEFAULT_WAGE_GROUP,
  type PayBasis,
  type SalaryAmountsInput,
  type SalaryBreakdown,
  type SalaryComponent,
  type SalaryPreviewInput,
  type SalaryRevision,
  type SalaryRevisionInput,
  type SalarySaveResult,
  type SalaryStructure,
  type StandardStatus,
  type TemplateCalc,
} from "@/lib/types/payroll";
import { HiddenFileInput } from "@/components/ui/file-input";
import { useUploadLimit } from "@/hooks/useUploadLimit";

/** What a revision may carry as its file: what the server's vault takes. */
const FILE_TYPES = ["application/pdf", "image/png", "image/jpeg"];
const FILE_EXTENSIONS = /\.(pdf|png|jpe?g)$/i;

export type EditorMode =
  /** A new revision, starting from the latest one's amounts. */
  | { kind: "new"; base: SalaryRevision | null; min?: string }
  | { kind: "edit"; revision: SalaryRevision; hasLater: boolean; min?: string; max?: string }
  | { kind: "view"; revision: SalaryRevision };

/** A revision's amounts as the boxes show them: each as typed, in its pay basis. */
function rowsFrom(revision: SalaryRevision | null): Record<string, WageRow> {
  const rows: Record<string, WageRow> = {};
  for (const component of revision?.components ?? []) {
    const basis: PayBasis = component.pay_basis ?? "monthly";
    rows[component.component_code] = {
      amount: component.entered_amount ?? (basis === "annual" ? component.annual_amount : component.monthly_amount),
      basis: component.entered_amount ? basis : basis === "annual" ? "annual" : "monthly",
      remarks: component.remarks ?? "",
    };
  }
  return rows;
}

/**
 * The Employee Salary Master: one revision for one person. Every amount is
 * typed by hand and saved exactly as shown; the yearly figures, sub-totals and
 * monthly gross come from the server as you type.
 */
export function SalaryEditor({
  employee,
  mode,
  structures,
  standard,
  components,
  onClose,
  onSaved,
  onEdit,
  onSetupDone,
}: {
  employee: EmployeeSummary;
  mode: EditorMode | null;
  structures: SalaryStructure[];
  /** Whether the workspace has the template's wage types; null while loading. */
  standard: StandardStatus | null;
  components: SalaryComponent[];
  onClose: () => void;
  onSaved: () => void;
  onEdit?: (revision: SalaryRevision) => void;
  onSetupDone: () => void;
}) {
  const revision = mode && mode.kind !== "new" ? mode.revision : null;
  const readOnly = mode?.kind === "view";
  const source = mode?.kind === "new" ? mode.base : revision;
  const limit = useUploadLimit();

  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [reason, setReason] = useState("");
  const [ctc, setCtc] = useState("");
  const [ctcBasis, setCtcBasis] = useState<PayBasis>("monthly");
  const [gross, setGross] = useState("");
  const [grossBasis, setGrossBasis] = useState<PayBasis>("monthly");
  const [rows, setRows] = useState<Record<string, WageRow>>({});
  const [initialKey, setInitialKey] = useState("");
  const [confirmClose, setConfirmClose] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [removeAttachment, setRemoveAttachment] = useState(false);
  const [preview, setPreview] = useState<SalaryBreakdown | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<"save" | "forward" | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  // The salary structure: the revision's label, and what Calculate splits the CTC by.
  const [structureId, setStructureId] = useState("");
  const [initialStructure, setInitialStructure] = useState("");
  const [calculating, setCalculating] = useState(false);
  const [confirmCalc, setConfirmCalc] = useState(false);
  // What the last Calculate said, kept while the structure and CTC are unchanged.
  const [calcInfo, setCalcInfo] = useState<{ key: string; calc: TemplateCalc } | null>(null);

  const active = structures.filter((s) => s.active);

  useEffect(() => {
    if (!mode) return;
    const startStructure =
      (source && active.some((s) => s.id === source.structure_id)
        ? source.structure_id
        : source && mode.kind !== "new"
          ? source.structure_id
          : active[0]?.id) ?? "";
    setStructureId(startStructure);
    setInitialStructure(startStructure);
    setCalcInfo(null);
    setConfirmCalc(false);
    setEffectiveFrom(mode.kind === "new" ? "" : mode.revision.effective_from);
    setReason(mode.kind === "new" ? "" : (mode.revision.revision_reason ?? ""));
    const startCtc = source ? (source.ctc_amount ?? source.ctc_annual) : "";
    const startCtcBasis: PayBasis = source ? (source.ctc_basis ?? "annual") : "monthly";
    const startGross = source?.gross_amount ?? "";
    const startGrossBasis: PayBasis = source?.gross_basis ?? "monthly";
    const startRows = rowsFrom(source);
    const startFrom = mode.kind === "new" ? "" : mode.revision.effective_from;
    const startReason = mode.kind === "new" ? "" : (mode.revision.revision_reason ?? "");
    setCtc(startCtc);
    setCtcBasis(startCtcBasis);
    setGross(startGross);
    setGrossBasis(startGrossBasis);
    setRows(startRows);
    setInitialKey(
      formKey(startFrom, startReason, startCtc, startCtcBasis, startGross, startGrossBasis, startRows, null, false),
    );
    setConfirmClose(false);
    setFile(null);
    setRemoveAttachment(false);
    setPreview(null);
    setPreviewError(null);
    setError(null);
    // `source` follows `mode`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // The structures to pick from: those switched on, and the revision's own even if it is off.
  const choices = structures.filter((s) => s.active || s.id === structureId);
  const structureName = structures.find((s) => s.id === structureId)?.name ?? revision?.structure_name ?? null;

  const typed = Object.entries(rows).filter(([, row]) => row.amount.trim() !== "");
  const invalid = typed.some(([, row]) => !isTypedAmount(row.amount)) || (gross.trim() !== "" && !isTypedAmount(gross));
  const ctcValid = isTypedAmount(ctc) && !/^0+(\.0+)?$/.test(ctc.trim());
  const amounts: SalaryAmountsInput | null =
    readOnly || !ctcValid || invalid
      ? null
      : {
          entry: "manual",
          ctc_amount: ctc.trim(),
          ctc_basis: ctcBasis,
          ...(gross.trim() ? { gross_amount: gross.trim(), gross_basis: grossBasis } : {}),
          components: typed.map(([code, row]) => ({
            component_code: code,
            amount: row.amount.trim(),
            basis: row.basis,
          })),
        };
  // Naming the person and the date adds take-home, worked out by the payroll engine.
  const previewBody: SalaryPreviewInput | null = amounts
    ? { ...amounts, employee_id: employee.id, ...(effectiveFrom ? { effective_from: effectiveFrom } : {}) }
    : null;
  const requestKey = previewBody && structureId ? JSON.stringify([structureId, previewBody]) : null;

  useEffect(() => {
    if (!requestKey) {
      setPreview(null);
      setPreviewError(null);
      return;
    }
    const [id, body] = JSON.parse(requestKey) as [string, SalaryPreviewInput];
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
          setPreviewError(apiMessage(caught, "These amounts could not be read."));
        })
        .finally(() => {
          if (!cancelled) setPreviewing(false);
        });
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [requestKey]);

  // Every wage type of the workspace, in the template's order; when viewing, the
  // revision's own lines (a wage type since switched off still shows there).
  const lines = useMemo<WageLine[]>(() => {
    if (readOnly) {
      return [...(revision?.components ?? [])]
        .sort((a, b) => a.display_order - b.display_order)
        .map((c) => ({
          code: c.component_code,
          name: c.component_name,
          type: c.component_type,
          group: c.wage_group ?? DEFAULT_WAGE_GROUP[c.component_type],
          annual: c.annual_amount,
        }));
    }
    const annual = new Map((preview?.components ?? []).map((c) => [c.code, c.annual_amount]));
    const listed = components.filter((c) => c.active || rows[c.code]?.amount.trim());
    return [...listed]
      .sort((a, b) => a.display_order - b.display_order || a.code.localeCompare(b.code))
      .map((c) => ({
        code: c.code,
        name: c.name,
        type: c.component_type,
        group: c.wage_group ?? DEFAULT_WAGE_GROUP[c.component_type],
        annual: annual.get(c.code) ?? null,
      }));
  }, [readOnly, revision, preview, components, rows]);

  const totals = readOnly ? revision?.totals : preview?.totals;
  const earnings = totals?.find((t) => t.component_type === "earning");
  const attachmentName = revision?.attachment_name ?? null;
  const noStructure = !readOnly && standard !== null && !standard.has_structure;
  // A rule the amounts break, said while typing; saving is refused until fixed.
  // Not while new figures are being worked out: the old warning would be about old amounts.
  const warning =
    (amounts && !previewing && (preview?.warnings?.[0] ?? preview?.take_home?.warnings?.[0])) || null;
  const dirty =
    !readOnly &&
    mode !== null &&
    (formKey(effectiveFrom, reason, ctc, ctcBasis, gross, grossBasis, rows, file, removeAttachment) !== initialKey ||
      structureId !== initialStructure);

  // Structures load with the page; one opened before they arrived picks the first.
  useEffect(() => {
    if (mode && !structureId && active[0]) {
      setStructureId(active[0].id);
      setInitialStructure(active[0].id);
    }
  }, [mode, structureId, active]);

  const calcKey = JSON.stringify([structureId, ctc.trim(), ctcBasis]);
  const shownCalc = calcInfo && calcInfo.key === calcKey ? calcInfo.calc : null;

  /** Calculate: split CTC TOTAL by the structure and fill the boxes, for HR to review. */
  const calculate = async () => {
    if (!structureId) return setError("Pick a salary structure first.");
    if (!ctc.trim()) return setError("Type CTC TOTAL first, then press Calculate.");
    if (!ctcValid) return setError("CTC TOTAL must be more than 0, with up to two decimals.");
    setCalculating(true);
    setError(null);
    try {
      const result = await post<TemplateCalc>(`/salary-templates/${structureId}/calculate`, {
        ctc_amount: ctc.trim(),
        ctc_basis: ctcBasis,
      });
      const byCode = new Map(result.lines.map((line) => [line.component_code, line]));
      const next: Record<string, WageRow> = { ...rows };
      const cleared: string[] = [];
      const kept: string[] = [];
      let filled = 0;
      for (const component of components) {
        const line = byCode.get(component.code);
        const existing = rows[component.code];
        if (line) {
          const zero = /^0+(\.0+)?$/.test(line.amount);
          // Nothing due is left empty (not paid), except on a statutory MANUAL row,
          // where 0 means "deduct nothing" rather than "payroll works it out".
          next[component.code] = {
            amount: zero && !STATUTORY_CODES.has(component.code) ? "" : line.amount.replace(/\.00$/, ""),
            basis: line.basis,
            remarks: existing?.remarks ?? "",
          };
          if (!zero || STATUTORY_CODES.has(component.code)) filled += 1;
        } else if (existing?.amount.trim()) {
          if (component.part_of_ctc && !STATUTORY_CODES.has(component.code)) {
            next[component.code] = { ...existing, amount: "" };
            cleared.push(component.name);
          } else {
            kept.push(component.name);
          }
        }
      }
      setRows(next);
      // MONTHLY GROSS follows the earnings again.
      setGross("");
      // Month-wise, CTC TOTAL too, when the year is exactly twelve of its months
      // (12,00,000 a year is 1,00,000 a month; 6,20,000 is not a whole paisa a month).
      let key = calcKey;
      if (ctcBasis !== "monthly" && paise(result.ctc_monthly) * BigInt(12) === paise(result.ctc_annual)) {
        const monthly = result.ctc_monthly.replace(/\.00$/, "");
        setCtc(monthly);
        setCtcBasis("monthly");
        key = JSON.stringify([structureId, monthly, "monthly"]);
      }
      setCalcInfo({ key, calc: result });
      const said = [
        cleared.length ? `Cleared (inside the CTC, not in the structure): ${cleared.join(", ")}.` : "",
        kept.length ? `Kept as typed: ${kept.join(", ")}.` : "",
        "Review the amounts, then SAVE.",
      ]
        .filter(Boolean)
        .join(" ");
      toast.success(`Filled ${filled} wage type${filled === 1 ? "" : "s"} from ${result.structure_name}.`, {
        description: said,
        duration: 9000,
      });
    } catch (caught) {
      setError(apiMessage(caught, "Could not work out the amounts from this structure."));
    } finally {
      setCalculating(false);
    }
  };
  const askCalculate = () => {
    // Say what is missing first, before asking whether to replace anything.
    if (!structureId) return setError("Pick a salary structure first.");
    if (!ctc.trim()) return setError("Type CTC TOTAL first, then press Calculate.");
    if (!ctcValid) return setError("CTC TOTAL must be more than 0, with up to two decimals.");
    const anyTyped = Object.values(rows).some((row) => row.amount.trim() !== "") || gross.trim() !== "";
    if (anyTyped) setConfirmCalc(true);
    else void calculate();
  };

  const requestClose = () => {
    if (saving) return;
    if (dirty) setConfirmClose(true);
    else onClose();
  };

  const pickFile = (picked: File | null) => {
    if (fileInput.current) fileInput.current.value = "";
    if (!picked) return;
    if (!FILE_TYPES.includes(picked.type) && !FILE_EXTENSIONS.test(picked.name)) {
      setError(`${picked.name} is not a PDF, PNG or JPEG. Attach one of those.`);
      return;
    }
    const tooBig = limit.check(picked);
    if (tooBig) {
      setError(tooBig);
      return;
    }
    if (picked.size === 0) {
      setError(`${picked.name} is empty.`);
      return;
    }
    setError(null);
    setFile(picked);
    setRemoveAttachment(false);
  };

  const save = async (forward: boolean) => {
    if (!mode || mode.kind === "view") return;
    if (!structureId) return setError("Set up the salary template first.");
    if (!effectiveFrom) return setError("Pick the date this salary applies from (Effective from).");
    if (!ctc.trim()) return setError("Enter CTC TOTAL.");
    if (!ctcValid) return setError("CTC TOTAL must be more than 0, with up to two decimals.");
    if (invalid) return setError("Fix the amounts marked in red: digits only, up to two decimals.");
    if (previewError) return setError(previewError);
    if (warning) return setError(warning);
    setSaving(forward ? "forward" : "save");
    setError(null);
    const body: SalaryRevisionInput = {
      entry: "manual",
      structure_id: structureId,
      effective_from: effectiveFrom,
      revision_reason: reason.trim() || null,
      ctc_amount: ctc.trim(),
      ctc_basis: ctcBasis,
      gross_amount: gross.trim() || null,
      gross_basis: grossBasis,
      components: Object.entries(rows)
        .filter(([, row]) => row.amount.trim() !== "")
        .map(([code, row]) => ({
          component_code: code,
          amount: row.amount.trim(),
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
      if (runs.length) notes.push(`Recompute payroll for ${runs.map(periodName).join(", ")} to pick this up.`);
      const carried = saved.carried_forward_to ?? [];
      if (carried.length) {
        notes.push(
          `Also updated ${carried.length === 1 ? "the revision" : `${carried.length} revisions`} from ${carried.map(revisionDate).join(", ")}.`,
        );
      }
      const title = mode.kind === "new" ? (mode.base ? "Salary revised." : "Salary assigned.") : "Salary saved.";
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

  const busy = saving !== null;
  const locked = readOnly && revision?.locked;

  return (
    <Sheet open={mode !== null} onOpenChange={(open) => !open && requestClose()}>
      <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-6xl">
        <SheetHeader className="border-b border-border px-6 py-4">
          <SheetTitle className="text-lg">Salary Master</SheetTitle>
          <SheetDescription className="sr-only">
            Every amount is typed by hand and saved exactly as shown.
          </SheetDescription>
        </SheetHeader>

        {/* One shrinkable column, so the wide grid scrolls inside itself on a phone. */}
        <div className="grid grid-cols-1 gap-5 px-4 py-5 sm:px-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex min-w-60 items-center gap-3">
              <StatusAvatar employee={employee} className="size-9" />
              <p className="truncate font-semibold text-foreground">{employeeLabel(employee)}</p>
            </div>
            {readOnly ? (
              <Badge variant="outline" className="h-9 px-3 text-sm">
                {revision ? revisionDate(revision.effective_from) : ""}
              </Badge>
            ) : (
              <DatePicker
                id="sm-from"
                value={effectiveFrom}
                onChange={setEffectiveFrom}
                placeholder="Effective from"
                className="h-9 w-44"
                min={mode?.kind === "new" || mode?.kind === "edit" ? mode.min : undefined}
                max={mode?.kind === "edit" ? mode.max : undefined}
              />
            )}
            {readOnly ? (
              attachmentName && revision ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9"
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
                <Badge variant="muted" className="h-9 px-3 text-sm">
                  No Attachments <Paperclip />
                </Badge>
              )
            ) : (
              <>
                <HiddenFileInput
                  ref={fileInput}
                  id="sm-file"
                  accept="application/pdf,image/png,image/jpeg"
                  tabIndex={-1}
                  onChange={(event) => pickFile(event.target.files?.[0] ?? null)}
                />
                <div className="flex h-9 items-center gap-1 rounded-lg border border-border bg-card pr-1 pl-3 text-sm">
                  <span className="max-w-48 truncate text-muted-foreground">
                    {file?.name ?? (attachmentName && !removeAttachment ? attachmentName : "No Attachments")}
                  </span>
                  {(file || (attachmentName && !removeAttachment)) && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7"
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
                    className="size-7"
                    aria-label="Attach a file"
                    onClick={() => fileInput.current?.click()}
                  >
                    <Paperclip />
                  </Button>
                </div>
              </>
            )}
            {readOnly ? (
              structureName && (
                <Badge variant="outline" className="h-9 px-3 text-sm">
                  Structure: {structureName}
                </Badge>
              )
            ) : (
              <div className="flex items-center gap-2">
                <Select value={structureId} onValueChange={setStructureId} disabled={!choices.length}>
                  <SelectTrigger aria-label="Salary structure" className="h-9 w-56">
                    <SelectValue placeholder="Salary structure" />
                  </SelectTrigger>
                  <SelectContent>
                    {choices.map((choice) => (
                      <SelectItem key={choice.id} value={choice.id}>
                        {choice.name}
                        {!choice.active ? " (switched off)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="secondary"
                  className="h-9"
                  disabled={calculating || busy || noStructure || !structureId}
                  onClick={askCalculate}
                  title="Split CTC TOTAL by the salary structure and fill the boxes"
                >
                  {calculating ? <Loader2 className="animate-spin" /> : <Calculator />}
                  Calculate
                </Button>
              </div>
            )}
            {locked && (
              <Badge variant="muted" className="h-9 px-3 text-sm">
                <Lock /> Locked
              </Badge>
            )}
            {previewing && !readOnly && (
              <Loader2 aria-label="Working out" className="size-4 animate-spin text-muted-foreground" />
            )}
          </div>

          {locked && revision?.locked_reason && (
            <Alert>
              <Lock />
              <AlertDescription>
                This revision is history: {revision.locked_reason}. A correction is a new revision plus arrears.
              </AlertDescription>
            </Alert>
          )}
          {(previewError || warning) && !readOnly && (
            <Alert variant="destructive">
              <AlertDescription>{previewError ?? warning}</AlertDescription>
            </Alert>
          )}
          {shownCalc && !readOnly && (
            <Alert>
              <Info />
              <AlertDescription>
                <span className="block">
                  Filled from <span className="font-medium text-foreground">{shownCalc.structure_name}</span> for CTC{" "}
                  {formatMoney(shownCalc.ctc_monthly)} a month ({formatMoney(shownCalc.ctc_annual)} a year). Change any
                  amount before saving.
                </span>
                {shownCalc.employer
                  .filter((row) => row.applied && !/^0+(\.0+)?$/.test(row.monthly))
                  .map((row) => (
                    <span key={row.key} className="block">
                      Inside the CTC: {row.name} {formatMoney(row.monthly)} a month ({row.rule_text}) — payroll works
                      it out each month.
                    </span>
                  ))}
                {shownCalc.employer
                  .filter((row) => !row.applied && row.note)
                  .map((row) => (
                    <span key={row.key} className="block">
                      {row.name}: {row.note}.
                    </span>
                  ))}
                {!/^0+(\.0+)?$/.test(shownCalc.unallocated_monthly) && (
                  <span className="block">
                    Rounding leaves {formatMoney(shownCalc.unallocated_monthly)} a month of the CTC unallocated.
                  </span>
                )}
              </AlertDescription>
            </Alert>
          )}

          {noStructure && standard ? (
            <StandardSetupCallout status={standard} onDone={onSetupDone} />
          ) : (
            <SalaryGrid
              lines={lines}
              rows={rows}
              groupTotals={(readOnly ? revision?.group_totals : preview?.group_totals) ?? []}
              readOnly={readOnly}
              ctc={{
                amount: ctc,
                basis: ctcBasis,
                remarks: reason,
                annual: readOnly ? revision?.ctc_annual : preview?.ctc_annual,
                onAmount: setCtc,
                onBasis: setCtcBasis,
                onRemarks: setReason,
              }}
              gross={{
                amount: readOnly ? (revision?.gross_amount ? revision.gross_monthly : "") : gross,
                basis: readOnly
                  ? revision?.gross_amount
                    ? (revision.gross_basis ?? "monthly")
                    : "monthly"
                  : grossBasis,
                earnings: readOnly
                  ? (revision?.earnings_monthly ?? earnings?.monthly)
                  : (preview?.earnings_monthly ?? null),
                annual: readOnly ? revision?.gross_annual : (preview?.gross_annual ?? null),
                differs: readOnly
                  ? Boolean(revision?.gross_amount) && revision?.gross_monthly !== revision?.earnings_monthly
                  : Boolean(gross.trim()) &&
                    Boolean(preview?.gross_monthly) &&
                    preview?.gross_monthly !== preview?.earnings_monthly,
                onAmount: setGross,
                onBasis: setGrossBasis,
              }}
              takeHome={
                readOnly ? revision?.take_home : amounts && !previewError ? (preview?.take_home ?? null) : undefined
              }
              onChange={(code, row) => setRows((current) => ({ ...current, [code]: row }))}
            />
          )}

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
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
                <Button disabled={busy || noStructure} onClick={() => void save(false)}>
                  {saving === "save" && <Loader2 className="animate-spin" />}
                  SAVE
                </Button>
                <Button variant="outline" disabled={busy || noStructure} onClick={() => void save(true)}>
                  {saving === "forward" && <Loader2 className="animate-spin" />}
                  SAVE &amp; UPDATE FUTURE REVISIONS
                </Button>
              </>
            )}
          </div>
        </div>
      </SheetContent>
      <ConfirmDialog
        open={confirmClose}
        onOpenChange={setConfirmClose}
        title="Discard your changes?"
        description="The amounts you typed in this salary have not been saved."
        confirmLabel="Discard changes"
        cancelLabel="Keep editing"
        destructive
        onConfirm={() => {
          setConfirmClose(false);
          onClose();
        }}
      />
      <ConfirmDialog
        open={confirmCalc}
        onOpenChange={setConfirmCalc}
        title="Replace the amounts?"
        description={`Calculate fills every wage type of ${structureName ?? "the structure"} from CTC TOTAL, replacing what is typed there, and clears wage types inside the CTC that the structure does not use. Deductions and reimbursements outside the CTC are kept.`}
        confirmLabel="Calculate"
        cancelLabel="Keep my amounts"
        onConfirm={async () => {
          setConfirmCalc(false);
          await calculate();
        }}
      />
    </Sheet>
  );
}

/** A money string ("51666.67") in whole paise, for an exact comparison. */
function paise(amount: string): bigint {
  const [rupees, fraction = ""] = amount.trim().split(".");
  return BigInt(rupees || "0") * BigInt(100) + BigInt((fraction + "00").slice(0, 2));
}

/** Everything the person can change, as one comparable string. */
function formKey(
  from: string,
  reason: string,
  ctc: string,
  ctcBasis: PayBasis,
  gross: string,
  grossBasis: PayBasis,
  rows: Record<string, WageRow>,
  file: File | null,
  removeAttachment: boolean,
): string {
  const filled = Object.entries(rows)
    .filter(([, row]) => row.amount.trim() || row.remarks.trim())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([code, row]) => [code, row.amount.trim(), row.basis, row.remarks.trim()]);
  return JSON.stringify([
    from,
    reason.trim(),
    ctc.trim(),
    ctcBasis,
    gross.trim(),
    gross.trim() ? grossBasis : "",
    filled,
    file?.name ?? "",
    removeAttachment,
  ]);
}
