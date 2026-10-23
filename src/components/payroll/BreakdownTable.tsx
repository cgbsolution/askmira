import type { ColumnDef } from "@tanstack/react-table";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import React from "react";

import { DataTable } from "@/components/common/data-table/DataTable";
import { Money } from "@/components/common/Money";
import { COMPONENT_TYPE_LABEL } from "@/components/payroll/labels";
import { Badge } from "@/components/ui/badge";
import type { SalaryBreakdown } from "@/lib/types/payroll";

type BreakdownLine = SalaryBreakdown["components"][number];

/** A CTC resolved against a structure, exactly as the API returned it. */
export function BreakdownTable({ breakdown }: { breakdown: SalaryBreakdown }) {
  // The guarantee the endpoint makes, shown rather than assumed.
  const reconciles = breakdown.annual_total_in_ctc === breakdown.ctc_annual;
  const columns: ColumnDef<BreakdownLine>[] = [
    {
      accessorKey: "name",
      header: "Component",
      cell: ({ row }) => (
        <>
          <p className="font-medium text-foreground">{row.original.name}</p>
          <p className="text-xs text-muted-foreground">{row.original.code}</p>
        </>
      ),
      footer: () => <span className="font-semibold">Total in CTC</span>,
    },
    {
      accessorKey: "component_type",
      header: "Type",
      cell: ({ row }) => <Badge variant="muted">{COMPONENT_TYPE_LABEL[row.original.component_type]}</Badge>,
      footer: () => null,
    },
    {
      accessorKey: "monthly_amount",
      header: "Monthly",
      meta: { className: "text-right" },
      cell: ({ row }) => <Money value={row.original.monthly_amount} />,
      footer: () => <Money value={breakdown.monthly_total_in_ctc} className="font-semibold" />,
    },
    {
      accessorKey: "annual_amount",
      header: "Annual",
      meta: { className: "text-right" },
      cell: ({ row }) => <Money value={row.original.annual_amount} />,
      footer: () => <Money value={breakdown.annual_total_in_ctc} className="font-semibold" />,
    },
    {
      id: "statutory",
      header: "Statutory",
      meta: { text: false },
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          {row.original.counts_toward_pf && <Badge variant="outline">PF</Badge>}
          {row.original.counts_toward_esi && <Badge variant="outline">ESI</Badge>}
          {!row.original.part_of_ctc && <Badge variant="warning">Outside CTC</Badge>}
          {!row.original.taxable && <Badge variant="outline">Exempt</Badge>}
        </div>
      ),
      footer: () => null,
    },
  ];
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <p className="text-xs text-muted-foreground">
          {breakdown.structure_name} · <Money value={breakdown.ctc_annual} /> a year
        </p>
        <Badge variant={reconciles ? "success" : "destructive"}>
          {reconciles ? <CheckCircle2 /> : <AlertTriangle />}
          {reconciles ? "Sums exactly to CTC" : "Does not reconcile"}
        </Badge>
      </div>
      <DataTable variant="plain" columns={columns} data={breakdown.components} getRowId={(line) => line.code} />
    </div>
  );
}
