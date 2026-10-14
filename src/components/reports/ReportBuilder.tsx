"use client";

import { Loader2, Play, Plus, Save, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { DataPanel } from "@/components/common/DataPanel";
import { FormField } from "@/components/common/FormField";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError, post } from "@/lib/api";
import type {
  Catalogue,
  CatalogueField,
  ChartType,
  DataType,
  Filter,
  Operator,
  ReportResult,
  ReportVisibility,
  Selection,
} from "@/lib/types/reports";

import { CHART_TYPE_LABEL, ChartTypeSelect } from "./ChartTypeSelect";
import { ReportChart } from "./ReportChart";
import { ReportResultTable } from "./ReportResultTable";

const NONE = "__none__";

/** Mirrors `_OPERATORS_FOR` in the compiler: an operator a type cannot take is not offered. */
const OPERATORS_FOR: Record<DataType, Operator[]> = {
  string: ["equals", "not_equals", "in", "not_in", "contains", "is_null", "is_not_null"],
  enum: ["equals", "not_equals", "in", "not_in", "is_null", "is_not_null"],
  boolean: ["equals", "is_null", "is_not_null"],
  integer: ["equals", "not_equals", "in", "not_in", "gt", "gte", "lt", "lte", "between", "is_null", "is_not_null"],
  decimal: ["equals", "not_equals", "in", "not_in", "gt", "gte", "lt", "lte", "between", "is_null", "is_not_null"],
  date: ["equals", "gt", "gte", "lt", "lte", "between", "relative_range", "is_null", "is_not_null"],
  datetime: ["equals", "gt", "gte", "lt", "lte", "between", "relative_range", "is_null", "is_not_null"],
};

const OPERATOR_LABEL: Record<Operator, string> = {
  equals: "is",
  not_equals: "is not",
  in: "is one of",
  not_in: "is none of",
  contains: "contains",
  gt: "is after / above",
  gte: "is on or after / at least",
  lt: "is before / below",
  lte: "is on or before / at most",
  between: "is between",
  relative_range: "is in the",
  is_null: "is empty",
  is_not_null: "is not empty",
};

const SENSITIVITY_LABEL = { public: "", hr_only: "HR", payroll_only: "Payroll" } as const;

interface FilterDraft {
  field_key: string;
  operator: Operator;
  value: string;
  second: string;
}

function detail(caught: unknown, fallback: string): string {
  return caught instanceof ApiError ? caught.detail : fallback;
}

/**
 * Build a report from the catalogue.
 *
 * Only fields this role may see are offered, and only operators that make
 * sense for a field's type. The preview runs the definition as it stands; the
 * API re-checks everything, so the picker is a courtesy and the compiler is the
 * gate.
 */
export function ReportBuilder({ catalogue, onSaved }: { catalogue: Catalogue; onSaved: () => void }) {
  const [entityKey, setEntityKey] = useState(catalogue.entities[0]?.key ?? "");
  const [selections, setSelections] = useState<Selection[]>([]);
  const [filters, setFilters] = useState<FilterDraft[]>([]);
  const [groupBy, setGroupBy] = useState<string[]>([]);
  const [limit, setLimit] = useState("100");
  const [result, setResult] = useState<ReportResult | null>(null);
  const [chartType, setChartType] = useState<ChartType>("bar");
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);

  const entity = catalogue.entities.find((row) => row.key === entityKey);
  const fields = useMemo(() => new Map((entity?.fields ?? []).map((field) => [field.key, field])), [entity]);

  useEffect(() => {
    setSelections([]);
    setFilters([]);
    setGroupBy([]);
    setResult(null);
  }, [entityKey]);

  const hasAggregate = selections.some((row) => row.aggregation);

  const definition = () => ({
    entity_key: entityKey,
    selections,
    filters: filters.map((row) => toFilter(row, fields.get(row.field_key))),
    group_by: hasAggregate ? groupBy : [],
    sort_by: [],
    limit: Math.min(1000, Math.max(1, Number(limit) || 100)),
    offset: 0,
  });

  const run = async () => {
    setRunning(true);
    try {
      setResult(await post<ReportResult>("/reports/run", definition()));
    } catch (caught) {
      toast.error(detail(caught, "The report did not run."));
    } finally {
      setRunning(false);
    }
  };

  const addField = (key: string) => {
    const field = fields.get(key);
    if (!field || selections.some((row) => row.field_key === key && !row.aggregation)) return;
    setSelections([...selections, { field_key: key, aggregation: null, label: field.display_name }]);
  };

  const fieldLabel = (field: CatalogueField) =>
    `${field.display_name}${SENSITIVITY_LABEL[field.sensitivity] ? ` (${SENSITIVITY_LABEL[field.sensitivity]})` : ""}`;

  return (
    <div className="grid gap-4">
      <DataPanel title="Build a report" description={entity?.description}>
        <div className="grid gap-5 p-5">
          <FormField htmlFor="builder-entity" label="Report on">
            <Select value={entityKey} onValueChange={setEntityKey}>
              <SelectTrigger id="builder-entity" className="w-full max-w-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {catalogue.entities.map((row) => (
                  <SelectItem key={row.key} value={row.key}>
                    {row.display_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <section className="grid gap-2">
            <h3 className="text-sm font-medium text-foreground">Columns</h3>
            {selections.map((row, index) => {
              const field = fields.get(row.field_key);
              return (
                <div key={index} className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="min-w-40 justify-start">
                    {field ? fieldLabel(field) : row.field_key}
                  </Badge>
                  <Select
                    value={row.aggregation ?? NONE}
                    onValueChange={(next) =>
                      setSelections(
                        selections.map((item, at) =>
                          at === index
                            ? {
                                ...item,
                                aggregation: next === NONE ? null : next,
                                label: next === NONE ? field?.display_name ?? item.label : `${next.replaceAll("_", " ")} of ${field?.display_name ?? item.field_key}`,
                              }
                            : item,
                        ),
                      )
                    }
                  >
                    <SelectTrigger className="h-8 w-44" aria-label="Aggregation">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Each value</SelectItem>
                      {(field?.aggregations ?? []).map((aggregation) => (
                        <SelectItem key={aggregation} value={aggregation}>
                          {aggregation.replaceAll("_", " ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Remove column"
                    onClick={() => setSelections(selections.filter((_, at) => at !== index))}
                  >
                    <X />
                  </Button>
                </div>
              );
            })}
            <Select value="" onValueChange={addField}>
              <SelectTrigger className="w-full max-w-sm" aria-label="Add a column">
                <SelectValue placeholder="Add a column" />
              </SelectTrigger>
              <SelectContent>
                {(entity?.fields ?? []).map((field) => (
                  <SelectItem key={field.key} value={field.key}>
                    {fieldLabel(field)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </section>

          {hasAggregate && (
            <section className="grid gap-2">
              <h3 className="text-sm font-medium text-foreground">Group by</h3>
              <p className="text-xs text-muted-foreground">
                With a count or sum, every other column must be a grouping.
              </p>
              <div className="flex flex-wrap gap-2">
                {selections
                  .filter((row) => !row.aggregation)
                  .map((row) => {
                    const on = groupBy.includes(row.field_key);
                    return (
                      <Button
                        key={row.field_key}
                        size="sm"
                        variant={on ? "default" : "outline"}
                        aria-pressed={on}
                        onClick={() =>
                          setGroupBy(on ? groupBy.filter((key) => key !== row.field_key) : [...groupBy, row.field_key])
                        }
                      >
                        {fields.get(row.field_key)?.display_name ?? row.field_key}
                      </Button>
                    );
                  })}
              </div>
            </section>
          )}

          <section className="grid gap-2">
            <h3 className="text-sm font-medium text-foreground">Filters</h3>
            {filters.map((row, index) => {
              const field = fields.get(row.field_key);
              const operators = field ? OPERATORS_FOR[field.data_type] : [];
              const set = (patch: Partial<FilterDraft>) =>
                setFilters(filters.map((item, at) => (at === index ? { ...item, ...patch } : item)));
              const inputType = field?.data_type === "date" || field?.data_type === "datetime" ? "date" : "text";
              return (
                <div key={index} className="flex flex-wrap items-center gap-2">
                  <Select value={row.field_key} onValueChange={(next) => set({ field_key: next, operator: OPERATORS_FOR[fields.get(next)!.data_type][0], value: "", second: "" })}>
                    <SelectTrigger className="h-8 w-48" aria-label="Filter field">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(entity?.fields ?? []).map((item) => (
                        <SelectItem key={item.key} value={item.key}>
                          {item.display_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={row.operator} onValueChange={(next) => set({ operator: next as Operator })}>
                    <SelectTrigger className="h-8 w-48" aria-label="Condition">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {operators.map((operator) => (
                        <SelectItem key={operator} value={operator}>
                          {OPERATOR_LABEL[operator]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {row.operator === "relative_range" ? (
                    <Select value={row.value} onValueChange={(next) => set({ value: next })}>
                      <SelectTrigger className="h-8 w-48" aria-label="Range">
                        <SelectValue placeholder="Choose a range" />
                      </SelectTrigger>
                      <SelectContent>
                        {catalogue.relative_ranges.map((range) => (
                          <SelectItem key={range.key} value={range.key}>
                            {range.key.replaceAll("_", " ")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : row.operator === "is_null" || row.operator === "is_not_null" ? null : (
                    <>
                      <Input
                        className="h-8 w-44"
                        type={inputType}
                        aria-label="Value"
                        value={row.value}
                        placeholder={row.operator === "in" || row.operator === "not_in" ? "a, b, c" : ""}
                        onChange={(event) => set({ value: event.target.value })}
                      />
                      {row.operator === "between" && (
                        <Input
                          className="h-8 w-44"
                          type={inputType}
                          aria-label="And"
                          value={row.second}
                          onChange={(event) => set({ second: event.target.value })}
                        />
                      )}
                    </>
                  )}
                  <Button variant="ghost" size="icon" aria-label="Remove filter" onClick={() => setFilters(filters.filter((_, at) => at !== index))}>
                    <X />
                  </Button>
                </div>
              );
            })}
            <Button
              variant="outline"
              size="sm"
              className="w-fit"
              disabled={!entity || entity.fields.length === 0}
              onClick={() => {
                const first = entity!.fields[0];
                setFilters([...filters, { field_key: first.key, operator: OPERATORS_FOR[first.data_type][0], value: "", second: "" }]);
              }}
            >
              <Plus /> Add filter
            </Button>
          </section>

          <div className="flex flex-wrap items-end gap-3">
            <FormField htmlFor="builder-limit" label="Rows">
              <Input id="builder-limit" className="w-28" inputMode="numeric" value={limit} onChange={(e) => setLimit(e.target.value.replace(/\D/g, ""))} />
            </FormField>
            <FormField htmlFor="builder-chart" label="Show as">
              <ChartTypeSelect id="builder-chart" value={chartType} onChange={setChartType} />
            </FormField>
            <Button onClick={run} disabled={running || selections.length === 0}>
              {running ? <Loader2 className="animate-spin" /> : <Play />} Preview
            </Button>
            <Button variant="outline" onClick={() => setSaving(true)} disabled={selections.length === 0}>
              <Save /> Save report
            </Button>
          </div>
        </div>
      </DataPanel>

      {result && (
        <DataPanel title="Preview" description={CHART_TYPE_LABEL[chartType]}>
          <div className="grid gap-5 p-5">
            <ReportChart result={result} chartType={chartType} />
            <ReportResultTable result={result} />
          </div>
        </DataPanel>
      )}

      <SaveDialog
        open={saving}
        onOpenChange={setSaving}
        definition={definition}
        chartType={chartType}
        onSaved={() => {
          onSaved();
          toast.success("Report saved. Find it under My reports.");
        }}
      />
    </div>
  );
}

function toFilter(row: FilterDraft, field: CatalogueField | undefined): Filter {
  const numeric = field?.data_type === "integer" || field?.data_type === "decimal";
  const cast = (value: string): unknown => {
    if (field?.data_type === "boolean") return value.toLowerCase() === "true" || value.toLowerCase() === "yes";
    if (numeric && field?.data_type === "integer") return Number(value);
    return value;
  };
  if (row.operator === "in" || row.operator === "not_in") {
    return { field_key: row.field_key, operator: row.operator, value: null, values: row.value.split(",").map((item) => cast(item.trim())).filter((item) => item !== "") };
  }
  if (row.operator === "between") {
    return { field_key: row.field_key, operator: row.operator, value: null, values: [cast(row.value), cast(row.second)] };
  }
  if (row.operator === "is_null" || row.operator === "is_not_null") {
    return { field_key: row.field_key, operator: row.operator, value: null, values: [] };
  }
  return { field_key: row.field_key, operator: row.operator, value: cast(row.value), values: [] };
}

function SaveDialog({
  open,
  onOpenChange,
  definition,
  chartType,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  definition: () => unknown;
  chartType: ChartType;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<ReportVisibility>("private");
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setName("");
      setDescription("");
      setVisibility("private");
    }
  }, [open]);

  const submit = async () => {
    setIsBusy(true);
    try {
      await post("/reports", {
        name: name.trim(),
        description: description.trim() || null,
        definition: definition(),
        chart_type: chartType,
        visibility,
      });
      onSaved();
      onOpenChange(false);
    } catch (caught) {
      toast.error(detail(caught, "Could not save the report."));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !isBusy && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Save report</DialogTitle>
          <DialogDescription>
            Sharing a report shares the question, not the answer: whoever opens it sees only rows and fields their own
            role allows.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <FormField htmlFor="save-name" label="Name">
            <Input id="save-name" value={name} onChange={(e) => setName(e.target.value)} />
          </FormField>
          <FormField htmlFor="save-description" label="Description" optional>
            <Input id="save-description" value={description} onChange={(e) => setDescription(e.target.value)} />
          </FormField>
          <FormField htmlFor="save-visibility" label="Who can open it">
            <Select value={visibility} onValueChange={(next) => setVisibility(next as ReportVisibility)}>
              <SelectTrigger id="save-visibility" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="private">Only me</SelectItem>
                <SelectItem value="tenant">Everyone who can use reports</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isBusy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={isBusy || !name.trim()}>
            {isBusy && <Loader2 className="animate-spin" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
