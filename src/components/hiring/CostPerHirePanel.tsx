"use client";

import { Plus, Receipt } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { DataPanel } from "@/components/common/DataPanel";
import { FormField } from "@/components/common/FormField";
import { Money } from "@/components/common/Money";
import { BoardFormDialog } from "@/components/hiring/BoardFormDialog";
import { humanize } from "@/components/hiring/labels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useApiQuery } from "@/hooks/useApiQuery";
import { ApiError, put } from "@/lib/api";
import type { CostComponent, CostPerHireReport } from "@/lib/types/hiring";

const PERIOD = /^\d{4}(-(0[1-9]|1[0-2]))?$/;
const AMOUNT = /^\d{1,14}(\.\d{1,2})?$/;

export const COST_COMPONENTS: { value: CostComponent; label: string }[] = [
  { value: "job_board_spend", label: "Job-board spend" },
  { value: "agency_fees", label: "Agency fees" },
  { value: "referral_bonuses", label: "Referral bonuses" },
  { value: "recruiter_time", label: "Recruiter time" },
];

function componentLabel(value: string): string {
  return COST_COMPONENTS.find((item) => item.value === value)?.label ?? humanize(value);
}

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** Record one recruitment cost line for a period (HR). */
export function CostRecordDialog({
  defaultPeriod,
  onRecorded,
}: {
  defaultPeriod: string;
  onRecorded: () => void;
}) {
  const [period, setPeriod] = useState(defaultPeriod);
  const [component, setComponent] = useState<CostComponent | "">("");
  const [amount, setAmount] = useState("");
  const [source, setSource] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Partial<Record<"period" | "component" | "amount", string>>>({});

  const reset = () => {
    setPeriod(defaultPeriod);
    setComponent("");
    setAmount("");
    setSource("");
    setNote("");
    setErrors({});
  };

  const submit = async (): Promise<boolean> => {
    const next: typeof errors = {};
    if (!PERIOD.test(period.trim())) next.period = "Use YYYY or YYYY-MM.";
    if (!component) next.component = "Choose what the cost was for.";
    if (!AMOUNT.test(amount.trim())) next.amount = "Enter an amount in rupees (up to 2 decimals).";
    setErrors(next);
    if (Object.keys(next).length > 0) return false;
    try {
      await put("/recruiting/costs", {
        period_label: period.trim(),
        component,
        amount: amount.trim(),
        source: source.trim(),
        note: note.trim() || null,
      });
      toast.success(`${componentLabel(component)} recorded for ${period.trim()}`);
      onRecorded();
      return true;
    } catch (error) {
      toast.error(error instanceof ApiError ? error.detail : "Could not record the cost.");
      return false;
    }
  };

  return (
    <BoardFormDialog
      trigger={
        <Button size="sm" variant="outline">
          <Plus /> Record cost
        </Button>
      }
      title="Record a recruitment cost"
      description="Cost per hire is only complete once every component for the period is recorded."
      submitLabel="Record cost"
      onSubmit={submit}
      onClosed={reset}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField htmlFor="cost-period" label="Period" hint="YYYY or YYYY-MM" error={errors.period}>
          <Input
            id="cost-period"
            value={period}
            maxLength={16}
            required
            onChange={(event) => setPeriod(event.target.value)}
          />
        </FormField>
        <FormField htmlFor="cost-component" label="Component" error={errors.component}>
          <Select value={component} onValueChange={(next) => setComponent(next as CostComponent)}>
            <SelectTrigger id="cost-component" className="w-full">
              <SelectValue placeholder="Choose" />
            </SelectTrigger>
            <SelectContent>
              {COST_COMPONENTS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <FormField htmlFor="cost-amount" label="Amount (₹)" error={errors.amount}>
          <Input
            id="cost-amount"
            inputMode="decimal"
            className="tabular-nums"
            value={amount}
            required
            onChange={(event) => setAmount(event.target.value)}
          />
        </FormField>
        <FormField
          htmlFor="cost-source"
          label="Source"
          optional
          hint="For job-board spend, the board (e.g. naukri), so spend shows against it."
        >
          <Input
            id="cost-source"
            value={source}
            maxLength={80}
            onChange={(event) => setSource(event.target.value)}
          />
        </FormField>
      </div>
      <FormField htmlFor="cost-note" label="Note" optional>
        <Textarea
          id="cost-note"
          value={note}
          rows={2}
          maxLength={2000}
          onChange={(event) => setNote(event.target.value)}
        />
      </FormField>
    </BoardFormDialog>
  );
}

/**
 * Cost per hire for a period. When a component has not been recorded, the
 * figure is a floor, not the cost, and the panel says which parts are missing.
 */
export function CostPerHirePanel() {
  const [period, setPeriod] = useState(currentMonth);
  const valid = PERIOD.test(period.trim());
  const { data, error, isLoading, reload } = useApiQuery<CostPerHireReport>(
    valid ? `/recruiting/analytics/cost-per-hire?period_label=${encodeURIComponent(period.trim())}` : null,
  );
  const report = valid ? data : null;
  const lines = report?.cost_lines ?? [];

  return (
    <DataPanel
      title="Cost per hire"
      actions={<CostRecordDialog defaultPeriod={valid ? period.trim() : currentMonth()} onRecorded={reload} />}
      toolbar={
        <FormField
          htmlFor="cost-period-filter"
          label="Period"
          error={valid ? null : "Use YYYY or YYYY-MM."}
          className="w-48"
        >
          <Input
            id="cost-period-filter"
            value={period}
            maxLength={7}
            onChange={(event) => setPeriod(event.target.value)}
          />
        </FormField>
      }
      isLoading={valid && isLoading && !data}
      error={valid ? error?.detail : null}
      onRetry={reload}
    >
      {!report ? (
        <p className="px-5 py-6 text-sm text-muted-foreground">
          Enter a period to see its cost per hire.
        </p>
      ) : (
        <div className="grid gap-4 pb-4">
          <dl className="grid grid-cols-1 gap-3 px-5 pt-4 sm:grid-cols-3">
            <div className="rounded-md border border-border px-3 py-2">
              <dt className="text-xs text-muted-foreground">Total recorded cost</dt>
              <dd className="text-lg font-semibold text-foreground">
                <Money value={report.total_cost} />
              </dd>
            </div>
            <div className="rounded-md border border-border px-3 py-2">
              <dt className="text-xs text-muted-foreground">Hires</dt>
              <dd className="text-lg font-semibold tabular-nums text-foreground">{report.hires}</dd>
            </div>
            <div className="rounded-md border border-border px-3 py-2">
              <dt className="text-xs text-muted-foreground">
                Cost per hire{!report.is_complete && report.cost_per_hire ? " (at least)" : ""}
              </dt>
              <dd className="text-lg font-semibold text-foreground">
                {report.cost_per_hire ? (
                  <Money value={report.cost_per_hire} />
                ) : (
                  <span className="text-sm font-normal text-muted-foreground">Not available</span>
                )}
              </dd>
            </div>
          </dl>
          <div className="grid gap-2 px-5 text-sm">
            {report.missing_components.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-muted-foreground">Not recorded:</span>
                {report.missing_components.map((item) => (
                  <Badge key={item} variant="warning">
                    {componentLabel(item)}
                  </Badge>
                ))}
              </div>
            )}
            <p className="text-muted-foreground">{report.note}</p>
            {report.hires_counted_from && (
              <p className="text-xs text-muted-foreground">
                Hires counted from: {report.hires_counted_from}
              </p>
            )}
          </div>
          {lines.length === 0 ? (
            <div className="flex items-center gap-2 px-5 text-sm text-muted-foreground">
              <Receipt className="size-4" /> No cost lines recorded for this period.
            </div>
          ) : (
            <div className="overflow-x-auto border-t border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Component</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Note</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((line) => (
                    <TableRow key={line.id}>
                      <TableCell className="text-foreground">{componentLabel(line.component)}</TableCell>
                      <TableCell>{line.source || "—"}</TableCell>
                      <TableCell className="text-right">
                        <Money value={line.amount} />
                      </TableCell>
                      <TableCell className="max-w-80 whitespace-normal text-xs text-muted-foreground">
                        {line.note ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}
    </DataPanel>
  );
}
