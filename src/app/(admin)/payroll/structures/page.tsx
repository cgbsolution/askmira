"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Calculator } from "lucide-react";
import React from "react";

import { DataTable } from "@/components/common/data-table/DataTable";
import { PageShell } from "@/components/common/PageShell";
import { GradesPanel } from "@/components/payroll/GradesPanel";
import { COMPONENT_TYPE_LABEL } from "@/components/payroll/labels";
import { NewComponentDialog } from "@/components/payroll/NewComponentDialog";
import { StructuresPanel } from "@/components/payroll/structures/StructuresPanel";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApiQuery } from "@/hooks/useApiQuery";
import type { SalaryComponent } from "@/lib/types/payroll";

const COMPONENT_COLUMNS: ColumnDef<SalaryComponent>[] = [
  {
    accessorKey: "name",
    header: "Wage type",
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
    id: "flags",
    header: "Counts toward",
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
        {row.original.counts_toward_pf && <Badge variant="outline">PF wages</Badge>}
        {row.original.counts_toward_esi && <Badge variant="outline">ESI wages</Badge>}
        {row.original.pro_rate_on_lop && <Badge variant="outline">LOP</Badge>}
        {!row.original.part_of_ctc && <Badge variant="warning">Outside CTC</Badge>}
        {!row.original.active && <Badge variant="muted">Off</Badge>}
      </div>
    ),
  },
];

/**
 * Payroll → Salary structures: CTC templates (the share of the CTC each wage type
 * gets), the wage types they are built from, and grades. Tier 1 throughout.
 */
export default function SalaryStructuresPage() {
  const components = useApiQuery<SalaryComponent[]>("/salary-components");

  return (
    <PageShell
      title="Salary structures"
      description="Set the CTC split once — Basic, HRA, allowances, PF and ESIC inside the CTC, tax slabs — then fill any salary from the CTC on the Salary master."
      actions={<NewComponentDialog onCreated={components.reload} />}
    >
      <Tabs defaultValue="structures">
        <TabsList>
          <TabsTrigger value="structures">Structures</TabsTrigger>
          <TabsTrigger value="components">Wage types</TabsTrigger>
          <TabsTrigger value="grades">Grades and bands</TabsTrigger>
        </TabsList>

        <TabsContent value="structures" className="mt-4">
          <StructuresPanel components={components.data ?? []} />
        </TabsContent>

        <TabsContent value="components" className="mt-4">
          <DataTable
            title="Wage types"
            description="What a structure is built from. PF and ESI wages are the wage types flagged for them."
            columns={COMPONENT_COLUMNS}
            data={components.data ?? []}
            noun="wage types"
            exportName="salary-components"
            searchPlaceholder="Search wage types"
            isLoading={components.isLoading && !components.data}
            error={components.error?.detail}
            onRetry={components.reload}
            empty={{
              icon: Calculator,
              title: "No wage types yet",
              description: "Basic, HRA, allowances and employer contributions are defined here.",
            }}
          />
        </TabsContent>

        <TabsContent value="grades" className="mt-4">
          <GradesPanel />
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}
