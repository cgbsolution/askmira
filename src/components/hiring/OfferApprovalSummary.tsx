import type { ColumnDef } from "@tanstack/react-table";
import { AlertTriangle, Info, Scale } from "lucide-react";
import React from "react";

import { DataTable } from "@/components/common/data-table/DataTable";
import { Money } from "@/components/common/Money";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import type { BreakupLine, BudgetDeviation, InternalParity } from "@/lib/types/hiring";

/** The budget deviation — always the first thing an approver reads. */
export function OfferBudgetDeviation({ deviation }: { deviation: BudgetDeviation }) {
  return (
    <Alert variant={deviation.requires_prominent_flag ? "destructive" : "default"}>
      <AlertTriangle />
      <AlertTitle className="line-clamp-none">{deviation.headline}</AlertTitle>
      <AlertDescription>
        <p className="tabular-nums">
          Offered <Money value={deviation.offered_ctc} /> · band{" "}
          {deviation.band_min || deviation.band_max ? (
            <>
              <Money value={deviation.band_min} /> to <Money value={deviation.band_max} />
            </>
          ) : (
            "not set"
          )}
        </p>
        {deviation.is_over_band && (
          <p className="tabular-nums">
            Over the band by <Money value={deviation.amount_over} /> ({deviation.percent_over}%)
          </p>
        )}
        {deviation.is_under_band && <p>Below the bottom of the band.</p>}
      </AlertDescription>
    </Alert>
  );
}

/** How the offer compares with people already in comparable roles. */
export function OfferInternalParity({ parity }: { parity: InternalParity }) {
  return (
    <div className="space-y-2 rounded-lg border border-border p-4">
      <p className="flex items-center gap-2 font-medium text-foreground">
        <Scale className="size-4" /> Internal parity
        {parity.above_every_comparable && <Badge variant="warning">Above every comparable</Badge>}
      </p>
      <p className="text-sm">{parity.headline}</p>
      {parity.comparable_count > 0 && (
        <dl className="grid grid-cols-3 gap-2 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">Minimum</dt>
            <dd>
              <Money value={parity.minimum} />
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Median</dt>
            <dd>
              <Money value={parity.median} />
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Maximum</dt>
            <dd>
              <Money value={parity.maximum} />
            </dd>
          </div>
        </dl>
      )}
      <p className="text-xs text-muted-foreground tabular-nums">
        Compared with {parity.comparable_count} {parity.comparable_count === 1 ? "person" : "people"}
        {parity.percent_above_median !== null ? ` · ${parity.percent_above_median}% above the median` : ""}
      </p>
      {parity.is_indicative_only && (
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          Indicative only: too few comparable people for a firm comparison.
        </p>
      )}
    </div>
  );
}

const BREAKUP_COLUMNS: ColumnDef<BreakupLine>[] = [
  {
    accessorKey: "name",
    header: "Component",
    cell: ({ row }) => (
      <>
        {row.original.name}
        <span className="ml-2 font-mono text-xs text-muted-foreground">{row.original.code}</span>
      </>
    ),
  },
  {
    accessorKey: "monthly",
    header: "Monthly",
    meta: { className: "text-right" },
    cell: ({ row }) => <Money value={row.original.monthly} />,
  },
  {
    accessorKey: "annual",
    header: "Annual",
    meta: { className: "text-right" },
    cell: ({ row }) => <Money value={row.original.annual} />,
  },
  {
    accessorKey: "part_of_ctc",
    header: "In CTC",
    cell: ({ row }) =>
      row.original.part_of_ctc ? <Badge variant="secondary">Yes</Badge> : <Badge variant="muted">No</Badge>,
  },
];

/** The salary breakup the offer resolves to under its structure. */
export function OfferBreakupTable({ lines }: { lines: BreakupLine[] }) {
  if (lines.length === 0) {
    return <p className="text-sm text-muted-foreground">No breakup could be computed for this offer.</p>;
  }
  return <DataTable variant="plain" columns={BREAKUP_COLUMNS} data={lines} getRowId={(line) => line.code} />;
}
