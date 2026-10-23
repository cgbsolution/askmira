"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Calculator, Loader2 } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";

import { DataPanel } from "@/components/common/DataPanel";
import { DataTable } from "@/components/common/data-table/DataTable";
import { FormField } from "@/components/common/FormField";
import { PageShell } from "@/components/common/PageShell";
import { BreakdownTable } from "@/components/payroll/BreakdownTable";
import { GradesPanel } from "@/components/payroll/GradesPanel";
import { apiMessage, COMPONENT_TYPE_LABEL, isAmount } from "@/components/payroll/labels";
import { NewComponentDialog } from "@/components/payroll/NewComponentDialog";
import { NewStructureDialog } from "@/components/payroll/NewStructureDialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApiQuery } from "@/hooks/useApiQuery";
import { get } from "@/lib/api";
import type {
  SalaryBreakdown,
  SalaryComponent,
  SalaryStructure,
  SalaryStructureDetail,
  StructureComponentDetail,
} from "@/lib/types/payroll";
import { cn, formatDay } from "@/lib/utils";

/** The figure a structure uses for a component: its own override first. */
const shownValue = (item: StructureComponentDetail) =>
  item.override_value ?? item.value ?? item.override_formula ?? item.formula;

const STRUCTURE_COMPONENT_COLUMNS: ColumnDef<StructureComponentDetail>[] = [
  {
    accessorKey: "component_name",
    header: "Component",
    meta: { text: (item) => `${item.component_name} ${item.component_code}` },
    cell: ({ row }) => (
      <>
        <p className="font-medium text-foreground">{row.original.component_name}</p>
        <p className="text-xs text-muted-foreground">{row.original.component_code}</p>
      </>
    ),
  },
  {
    id: "calculated_as",
    header: "Calculated as",
    accessorFn: (item) =>
      `${item.calculation_type.replace("_", " ")}${
        item.base_component_code ? ` ${item.override_base_component_code ?? item.base_component_code}` : ""
      }`,
    meta: { cellClassName: "text-sm" },
  },
  {
    id: "value",
    header: "Value",
    accessorFn: (item) => shownValue(item) ?? null,
    meta: {
      cellClassName: "text-sm tabular-nums",
      text: (item) => (item.override_value ? `${shownValue(item)} (override)` : shownValue(item)),
    },
    cell: ({ row }) => (
      <>
        {shownValue(row.original) ?? "—"}
        {row.original.override_value && (
          <Badge variant="outline" className="ml-1">
            override
          </Badge>
        )}
      </>
    ),
  },
  {
    id: "statutory",
    header: "Statutory",
    meta: {
      text: (item) =>
        [item.counts_toward_pf && "PF", item.counts_toward_esi && "ESI", !item.part_of_ctc && "Outside CTC"]
          .filter(Boolean)
          .join(", "),
    },
    cell: ({ row }) => (
      <div className="flex gap-1">
        {row.original.counts_toward_pf && <Badge variant="outline">PF</Badge>}
        {row.original.counts_toward_esi && <Badge variant="outline">ESI</Badge>}
        {!row.original.part_of_ctc && <Badge variant="warning">Outside CTC</Badge>}
      </div>
    ),
  },
];

const COMPONENT_COLUMNS: ColumnDef<SalaryComponent>[] = [
  {
    accessorKey: "name",
    header: "Component",
    meta: { text: (component) => `${component.name} ${component.code}` },
    cell: ({ row }) => (
      <>
        <p className="font-medium text-foreground">{row.original.name}</p>
        <p className="text-xs text-muted-foreground">{row.original.code}</p>
      </>
    ),
  },
  {
    accessorKey: "component_type",
    header: "Type",
    meta: { text: (component) => COMPONENT_TYPE_LABEL[component.component_type] },
    cell: ({ row }) => <Badge variant="muted">{COMPONENT_TYPE_LABEL[row.original.component_type]}</Badge>,
  },
  {
    id: "calculated_as",
    header: "Calculated as",
    accessorFn: (component) =>
      `${component.calculation_type.replace("_", " ")}${
        component.base_component_code ? ` ${component.base_component_code}` : ""
      }${component.value ? ` · ${component.value}` : ""}${component.formula ? ` · ${component.formula}` : ""}`,
    meta: { cellClassName: "text-sm" },
  },
  {
    id: "flags",
    header: "Flags",
    meta: {
      text: (component) =>
        [
          component.taxable ? "Taxable" : "Exempt",
          component.counts_toward_pf && "PF",
          component.counts_toward_esi && "ESI",
          component.pro_rate_on_lop && "LOP",
          !component.part_of_ctc && "Outside CTC",
        ]
          .filter(Boolean)
          .join(", "),
    },
    cell: ({ row }) => (
      <div className="flex flex-wrap gap-1">
        {row.original.taxable ? <Badge variant="outline">Taxable</Badge> : <Badge variant="outline">Exempt</Badge>}
        {row.original.counts_toward_pf && <Badge variant="outline">PF</Badge>}
        {row.original.counts_toward_esi && <Badge variant="outline">ESI</Badge>}
        {row.original.pro_rate_on_lop && <Badge variant="outline">LOP</Badge>}
        {!row.original.part_of_ctc && <Badge variant="warning">Outside CTC</Badge>}
      </div>
    ),
  },
];

/**
 * The CTC builder — Tier 1 throughout.
 *
 * Amounts arrive as strings and are rendered as strings; a CTC is sent as a
 * string too. A figure that passed through a JavaScript number could drift.
 */
export default function SalaryStructuresPage() {
  const structures = useApiQuery<SalaryStructure[]>("/salary-structures");
  const components = useApiQuery<SalaryComponent[]>("/salary-components");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const detail = useApiQuery<SalaryStructureDetail>(
    selectedId ? `/salary-structures/${selectedId}` : null,
  );
  const [ctc, setCtc] = useState("");
  const [breakdown, setBreakdown] = useState<SalaryBreakdown | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);

  const list = useMemo(() => structures.data ?? [], [structures.data]);

  useEffect(() => {
    if (!selectedId && list.length > 0) setSelectedId(list[0].id);
  }, [list, selectedId]);

  useEffect(() => {
    setBreakdown(null);
    setPreviewError(null);
  }, [selectedId]);

  const preview = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedId) return;
    if (!isAmount(ctc)) return setPreviewError("Enter an annual CTC, e.g. 1200000.");
    setPreviewing(true);
    setPreviewError(null);
    try {
      setBreakdown(
        await get<SalaryBreakdown>(
          `/salary-structures/${selectedId}/preview?ctc=${encodeURIComponent(ctc.trim())}`,
        ),
      );
    } catch (caught) {
      setBreakdown(null);
      setPreviewError(apiMessage(caught, "Could not resolve this CTC."));
    } finally {
      setPreviewing(false);
    }
  };

  return (
    <PageShell
      title="Salary structures"
      description="Define components, build a CTC template from them, and preview how any CTC resolves."
      actions={
        <>
          <NewComponentDialog onCreated={components.reload} />
          <NewStructureDialog
            components={components.data ?? []}
            onCreated={(structure) => {
              structures.reload();
              setSelectedId(structure.id);
            }}
          />
        </>
      }
    >
      <Tabs defaultValue="structures">
        <TabsList>
          <TabsTrigger value="structures">Structures</TabsTrigger>
          <TabsTrigger value="components">Components</TabsTrigger>
          <TabsTrigger value="grades">Grades and bands</TabsTrigger>
        </TabsList>

        <TabsContent value="structures" className="mt-4">
          <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
            <DataPanel
              title="Structures"
              isLoading={structures.isLoading && !structures.data}
              error={structures.error?.detail}
              onRetry={structures.reload}
              isEmpty={list.length === 0}
              empty={{
                icon: Calculator,
                title: "No salary structures yet",
                description:
                  "Create the components first, then a structure from them. Every payroll figure reads from a structure.",
              }}
            >
              <ul className="space-y-1 p-3">
                {list.map((structure) => (
                  <li key={structure.id}>
                    <Button
                      variant="ghost"
                      className={cn(
                        "h-auto w-full flex-col items-start gap-0.5 px-3 py-2 text-left",
                        selectedId === structure.id && "bg-secondary",
                      )}
                      onClick={() => setSelectedId(structure.id)}
                    >
                      <span className="w-full truncate text-sm font-medium">{structure.name}</span>
                      <span className="text-xs font-normal text-muted-foreground">
                        From {formatDay(structure.effective_from, true)}
                        {structure.rounding_precision === 0 ? " · whole rupees" : " · paise"}
                      </span>
                    </Button>
                  </li>
                ))}
              </ul>
            </DataPanel>

            <div className="flex min-w-0 flex-col gap-4">
              {selectedId && (
                <DataTable
                  title={detail.data?.name ?? "Structure"}
                  description="Components and per-structure overrides."
                  columns={STRUCTURE_COMPONENT_COLUMNS}
                  data={detail.data?.components ?? []}
                  getRowId={(item) => item.component_code}
                  noun="components"
                  exportName="salary-structure-components"
                  searchPlaceholder="Search components"
                  isLoading={detail.isLoading && !detail.data}
                  error={detail.error?.detail}
                  onRetry={detail.reload}
                />
              )}

              {selectedId && (
                <Card tier="tier1">
                  <CardContent className="space-y-4">
                    <form className="flex flex-wrap items-end gap-3" onSubmit={(event) => void preview(event)}>
                      <FormField htmlFor="ctc" label="Annual CTC (₹)">
                        <Input
                          id="ctc"
                          value={ctc}
                          onChange={(event) => setCtc(event.target.value)}
                          inputMode="decimal"
                          className="w-48 tabular-nums"
                          placeholder="1200000"
                        />
                      </FormField>
                      <Button type="submit" disabled={previewing}>
                        {previewing ? <Loader2 className="animate-spin" /> : <Calculator />}
                        Resolve
                      </Button>
                    </form>
                    {previewError && (
                      <Alert variant="destructive">
                        <AlertTitle>This CTC does not resolve</AlertTitle>
                        <AlertDescription>{previewError}</AlertDescription>
                      </Alert>
                    )}
                    {breakdown && <BreakdownTable breakdown={breakdown} />}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="grades" className="mt-4">
          <GradesPanel />
        </TabsContent>

        <TabsContent value="components" className="mt-4">
          <DataTable
            title="Components"
            columns={COMPONENT_COLUMNS}
            data={components.data ?? []}
            noun="components"
            exportName="salary-components"
            searchPlaceholder="Search components"
            isLoading={components.isLoading && !components.data}
            error={components.error?.detail}
            onRetry={components.reload}
            empty={{
              icon: Calculator,
              title: "No components yet",
              description: "Basic, HRA, allowances and employer contributions are defined here.",
            }}
          />
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}
