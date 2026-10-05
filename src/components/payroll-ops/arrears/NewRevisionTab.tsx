"use client";

import { Calculator, Loader2, Plus, Save, Trash2 } from "lucide-react";
import React, { useMemo, useState } from "react";
import { toast } from "sonner";

import {
  apiErrorMessage,
  InlineProblem,
  isMoneyInput,
} from "@/components/payroll-ops/shared";
import { FormField } from "@/components/common/FormField";
import { EmployeePicker } from "@/components/payroll-ops/disbursements/EmployeePicker";
import { PreviewResult } from "@/components/payroll-ops/arrears/PreviewResult";
import { REVISION_TYPE_LABEL } from "@/components/payroll-ops/arrears/labels";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import { useApiQuery } from "@/hooks/useApiQuery";
import { post } from "@/lib/api";
import type { EmployeeSummary } from "@/lib/types";
import type {
  ArrearBatch,
  ArrearPreview,
  ArrearPreviewInput,
  EmployeeSalary,
  LegalEntity,
  RevisionInput,
  RevisionType,
} from "@/lib/types/payroll-ops";
import { formatDay, formatMoney } from "@/lib/utils";

interface Row {
  key: number;
  employee: EmployeeSummary | null;
  newSalaryId: string;
  previousSalaryId: string;
}

const AUTO = "auto";

/**
 * A retrospective revision. HR can preview what it would pay; an admin
 * commits it, which computes an arrear batch for approval.
 */
export function NewRevisionTab({
  entities,
  onCommitted,
}: {
  entities: LegalEntity[];
  onCommitted: (batch: ArrearBatch) => void;
}) {
  const { hasRole } = useAuth();
  const canCommit = hasRole("admin");

  const [entityId, setEntityId] = useState(entities.length === 1 ? entities[0].id : "");
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [rows, setRows] = useState<Row[]>([
    { key: 1, employee: null, newSalaryId: "", previousSalaryId: AUTO },
  ]);
  const [nextKey, setNextKey] = useState(2);
  const [preview, setPreview] = useState<ArrearPreview | null>(null);
  const [previewedFor, setPreviewedFor] = useState("");
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);

  const [revisionType, setRevisionType] = useState<RevisionType | "">("");
  const [reason, setReason] = useState("");
  const [threshold, setThreshold] = useState("");
  const [commitError, setCommitError] = useState<string | null>(null);
  const [isCommitting, setIsCommitting] = useState(false);

  const input: ArrearPreviewInput = useMemo(
    () => ({
      legal_entity_id: entityId,
      effective_from: effectiveFrom,
      revisions: rows
        .filter((row) => row.employee && row.newSalaryId)
        .map((row) => ({
          employee_id: row.employee!.id,
          new_salary_id: row.newSalaryId,
          previous_salary_id: row.previousSalaryId === AUTO ? null : row.previousSalaryId,
        })),
    }),
    [entityId, effectiveFrom, rows],
  );
  const inputKey = JSON.stringify(input);
  const isStale = preview !== null && previewedFor !== inputKey;

  const updateRow = (key: number, change: Partial<Row>) =>
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...change } : row)));

  const runPreview = async (event: React.FormEvent) => {
    event.preventDefault();
    setPreviewError(null);
    if (!entityId || !effectiveFrom) {
      setPreviewError("Choose the legal entity and the date the revision takes effect.");
      return;
    }
    if (rows.some((row) => !row.employee || !row.newSalaryId)) {
      setPreviewError("Every row needs an employee and their new salary. Remove empty rows.");
      return;
    }
    const ids = rows.map((row) => row.employee!.id);
    if (new Set(ids).size !== ids.length) {
      setPreviewError("An employee appears more than once. Keep one row per person.");
      return;
    }
    setIsPreviewing(true);
    try {
      const result = await post<ArrearPreview>("/arrears/preview", input);
      setPreview(result);
      setPreviewedFor(inputKey);
    } catch (caught) {
      setPreview(null);
      setPreviewError(apiErrorMessage(caught, "The arrears could not be previewed."));
    } finally {
      setIsPreviewing(false);
    }
  };

  const commit = async (event: React.FormEvent) => {
    event.preventDefault();
    setCommitError(null);
    if (!preview || isStale) {
      setCommitError("Preview the current revision before committing it.");
      return;
    }
    if (!revisionType) {
      setCommitError("Choose the kind of revision.");
      return;
    }
    if (threshold.trim() && !isMoneyInput(threshold)) {
      setCommitError("The additional-approval threshold must be an amount with at most two decimals.");
      return;
    }
    const body: RevisionInput = {
      ...input,
      revision_type: revisionType,
      reason: reason.trim() || null,
      additional_approval_threshold: threshold.trim() || null,
    };
    setIsCommitting(true);
    try {
      const batch = await post<ArrearBatch>("/arrears/revisions", body);
      toast.success("Revision committed. The arrear batch is waiting for approval.");
      setPreview(null);
      setPreviewedFor("");
      setRows([{ key: nextKey, employee: null, newSalaryId: "", previousSalaryId: AUTO }]);
      setNextKey((current) => current + 1);
      setRevisionType("");
      setReason("");
      setThreshold("");
      onCommitted(batch);
    } catch (caught) {
      setCommitError(apiErrorMessage(caught, "The revision could not be committed."));
    } finally {
      setIsCommitting(false);
    }
  };

  return (
    <div className="grid gap-4">
      <Card tier="tier1">
        <CardHeader>
          <CardTitle>New salary revision</CardTitle>
          <CardDescription>
            Choose who is revised and from when. The preview recomputes every closed period since
            that date against the rules in force at the time, and shows the difference.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-5" onSubmit={(event) => void runPreview(event)} noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField htmlFor="revision-entity" label="Legal entity">
                <Select value={entityId} onValueChange={setEntityId}>
                  <SelectTrigger id="revision-entity" className="w-full">
                    <SelectValue placeholder="Choose an entity" />
                  </SelectTrigger>
                  <SelectContent>
                    {entities.map((entity) => (
                      <SelectItem key={entity.id} value={entity.id}>
                        {entity.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField htmlFor="revision-effective" label="Effective from">
                <Input
                  id="revision-effective"
                  type="date"
                  required
                  value={effectiveFrom}
                  onChange={(event) => setEffectiveFrom(event.target.value)}
                />
              </FormField>
            </div>

            <div className="grid gap-3">
              {rows.map((row, index) => (
                <RevisionRow
                  key={row.key}
                  index={index}
                  row={row}
                  canRemove={rows.length > 1}
                  onChange={(change) => updateRow(row.key, change)}
                  onRemove={() => setRows((current) => current.filter((item) => item.key !== row.key))}
                />
              ))}
              <div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setRows((current) => [
                      ...current,
                      { key: nextKey, employee: null, newSalaryId: "", previousSalaryId: AUTO },
                    ]);
                    setNextKey((current) => current + 1);
                  }}
                >
                  <Plus /> Add employee
                </Button>
              </div>
            </div>

            {previewError && <InlineProblem>{previewError}</InlineProblem>}

            <div>
              <Button type="submit" disabled={isPreviewing}>
                {isPreviewing ? <Loader2 className="animate-spin" /> : <Calculator />}
                Preview arrears
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {preview && (
        <>
          {isStale && (
            <InlineProblem>
              The revision has changed since this preview. Preview again before committing.
            </InlineProblem>
          )}
          <div className={isStale ? "opacity-60" : undefined}>
            <PreviewResult preview={preview} />
          </div>

          <Card tier="tier1">
            <CardHeader>
              <CardTitle>Commit the revision</CardTitle>
              <CardDescription>
                Committing records the revision and computes the arrear batch. Nothing is paid here:
                once approved, the arrears are paid in a future payroll run.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!canCommit ? (
                <p className="text-sm text-muted-foreground">
                  An admin commits revisions. Share this preview with them.
                </p>
              ) : (
                <form className="grid gap-4" onSubmit={(event) => void commit(event)} noValidate>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField htmlFor="revision-type" label="Kind of revision">
                      <Select
                        value={revisionType}
                        onValueChange={(value) => setRevisionType(value as RevisionType)}
                      >
                        <SelectTrigger id="revision-type" className="w-full">
                          <SelectValue placeholder="Choose one" />
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.keys(REVISION_TYPE_LABEL) as RevisionType[]).map((type) => (
                            <SelectItem key={type} value={type}>
                              {REVISION_TYPE_LABEL[type]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormField>
                    <FormField htmlFor="revision-threshold" label="Second approval above (₹)" optional>
                      <Input
                        id="revision-threshold"
                        inputMode="decimal"
                        value={threshold}
                        onChange={(event) => setThreshold(event.target.value)}
                        aria-invalid={threshold.trim() !== "" && !isMoneyInput(threshold)}
                        className="tabular-nums"
                      />
                      <p className="text-xs text-muted-foreground">
                        A batch whose net payable exceeds this needs a second, different approver.
                      </p>
                    </FormField>
                  </div>
                  <FormField htmlFor="revision-reason" label="Reason" optional>
                    <Textarea
                      id="revision-reason"
                      rows={2}
                      maxLength={2000}
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                    />
                  </FormField>
                  {preview.guardrails.length > 0 && (
                    <InlineProblem>
                      The guardrails above will refuse this commit. Resolve them first.
                    </InlineProblem>
                  )}
                  {commitError && <InlineProblem>{commitError}</InlineProblem>}
                  <div>
                    <Button
                      type="submit"
                      disabled={isCommitting || isStale || preview.guardrails.length > 0}
                    >
                      {isCommitting ? <Loader2 className="animate-spin" /> : <Save />}
                      Commit revision for {preview.summary.employee_count}{" "}
                      {preview.summary.employee_count === 1 ? "employee" : "employees"}
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function RevisionRow({
  index,
  row,
  canRemove,
  onChange,
  onRemove,
}: {
  index: number;
  row: Row;
  canRemove: boolean;
  onChange: (change: Partial<Row>) => void;
  onRemove: () => void;
}) {
  const history = useApiQuery<EmployeeSalary[]>(
    row.employee ? `/employees/${row.employee.id}/salary/history` : null,
  );
  const salaries = row.employee ? (history.data ?? []) : [];

  const salaryLabel = (salary: EmployeeSalary) =>
    `${formatMoney(salary.ctc_annual)} a year from ${formatDay(salary.effective_from, true)}${
      salary.effective_to ? ` to ${formatDay(salary.effective_to, true)}` : ""
    }`;

  return (
    <div className="grid gap-3 rounded-md border border-border p-3 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-start">
      <FormField htmlFor={`revision-employee-${row.key}`} label={`Employee ${index + 1}`}>
        <EmployeePicker
          id={`revision-employee-${row.key}`}
          value={row.employee}
          onChange={(employee) =>
            onChange({ employee, newSalaryId: "", previousSalaryId: AUTO })
          }
        />
      </FormField>
      <FormField htmlFor={`revision-new-${row.key}`} label="New salary">
        {!row.employee ? (
          <p className="text-sm text-muted-foreground">Choose the employee first.</p>
        ) : history.isLoading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading salary history…
          </p>
        ) : history.error ? (
          <p className="text-sm text-destructive">{history.error.detail}</p>
        ) : salaries.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No salary on record. Add the revised salary on the Salaries page first.
          </p>
        ) : (
          <Select value={row.newSalaryId} onValueChange={(value) => onChange({ newSalaryId: value })}>
            <SelectTrigger id={`revision-new-${row.key}`} className="w-full">
              <SelectValue placeholder="Choose the revised salary" />
            </SelectTrigger>
            <SelectContent>
              {salaries.map((salary) => (
                <SelectItem key={salary.id} value={salary.id}>
                  {salaryLabel(salary)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </FormField>
      <FormField htmlFor={`revision-previous-${row.key}`} label="Previous salary" optional>
        {row.employee && salaries.length > 0 ? (
          <Select
            value={row.previousSalaryId}
            onValueChange={(value) => onChange({ previousSalaryId: value })}
          >
            <SelectTrigger id={`revision-previous-${row.key}`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={AUTO}>What was actually paid (default)</SelectItem>
              {salaries
                .filter((salary) => salary.id !== row.newSalaryId)
                .map((salary) => (
                  <SelectItem key={salary.id} value={salary.id}>
                    {salaryLabel(salary)}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        ) : (
          <p className="text-sm text-muted-foreground">—</p>
        )}
      </FormField>
      <div className="lg:pt-6">
        {canRemove && (
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label={`Remove employee ${index + 1}`}
            onClick={onRemove}
          >
            <Trash2 />
          </Button>
        )}
      </div>
    </div>
  );
}
