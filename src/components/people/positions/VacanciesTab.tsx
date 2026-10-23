"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Armchair, Info } from "lucide-react";

import { DataTable } from "@/components/common/data-table/DataTable";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useApiQuery } from "@/hooks/useApiQuery";
import type { Vacancy, VacancyReport } from "@/lib/types/people";
import { formatDate } from "@/lib/utils";

import { POSITION_STATUS } from "../labels";

const VACANCY_COLUMNS: ColumnDef<Vacancy>[] = [
  {
    accessorKey: "title",
    header: "Position",
    meta: { text: (row) => `${row.title} ${row.code}` },
    cell: ({ row }) => (
      <>
        <div className="font-medium text-foreground">{row.original.title}</div>
        <div className="font-mono text-xs text-muted-foreground">
          {row.original.code}
          {Number(row.original.fte) < 1 && ` · ${row.original.fte} FTE`}
        </div>
      </>
    ),
  },
  {
    accessorKey: "department",
    header: "Department",
    meta: { cellClassName: "text-sm text-muted-foreground" },
    cell: ({ row }) => row.original.department || "—",
  },
  {
    accessorKey: "days_vacant",
    header: "Open for",
    meta: {
      cellClassName: "text-sm",
      text: (row) => {
        const age =
          row.days_vacant !== null
            ? `${row.days_vacant} days${row.since ? ` since ${formatDate(row.since)}` : ""}`
            : "Never filled";
        return row.stale ? `${age} · Stale` : age;
      },
    },
    cell: ({ row }) => (
      <>
        {row.original.days_vacant !== null ? (
          <>
            <span className="tabular-nums">{row.original.days_vacant}</span> days
            {row.original.since && (
              <div className="text-xs text-muted-foreground">since {formatDate(row.original.since)}</div>
            )}
          </>
        ) : (
          <span className="text-muted-foreground">Never filled</span>
        )}
        {row.original.stale && (
          <Badge variant="warning" className="ml-2">
            Stale
          </Badge>
        )}
      </>
    ),
  },
  {
    id: "covered_by",
    header: "Covered by",
    accessorFn: (row) => (row.covered_by.length > 0 ? row.covered_by.join(", ") : "Nobody"),
    meta: { cellClassName: "text-sm text-muted-foreground" },
  },
  {
    accessorKey: "status",
    header: "Status",
    meta: { text: (row) => POSITION_STATUS[row.status]?.label ?? row.status },
    cell: ({ row }) => {
      const status = POSITION_STATUS[row.original.status];
      return status && <Badge variant={status.variant}>{status.label}</Badge>;
    },
  },
];

/**
 * Empty seats, oldest first.
 *
 * Ageing starts from the date a seat was vacated, not from when it was created,
 * so a role that has been open since March does not look new because somebody
 * edited its title in August. A seat that was never filled has no age to show,
 * and says so rather than showing zero.
 */
export function VacanciesTab() {
  const { data, error, isLoading, reload } = useApiQuery<VacancyReport>("/positions/vacancies");
  const rows = data?.vacancies ?? [];
  const buckets = Object.entries(data?.buckets ?? {});

  return (
    <div className="flex flex-col gap-4">
      {buckets.length > 0 && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {buckets.map(([name, bucket]) => (
            <Card key={name} className="py-4">
              <CardContent className="px-4">
                <div className="text-xs text-muted-foreground">{name}</div>
                <div className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
                  {bucket.count}
                </div>
                <div className="text-xs text-muted-foreground">{bucket.fte} FTE</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {data && data.stale_count > 0 && (
        <Alert>
          <Info />
          <AlertTitle>
            {data.stale_count} vacanc{data.stale_count === 1 ? "y has" : "ies have"} been open long
            enough to question
          </AlertTitle>
          <AlertDescription>
            A seat nobody has filled in that long is either hard to hire for or no longer needed.
            Either answer is worth having before the next budget round.
          </AlertDescription>
        </Alert>
      )}

      <DataTable
        title="Vacancies"
        description={data ? `As of ${formatDate(data.as_of)}.` : undefined}
        columns={VACANCY_COLUMNS}
        data={rows}
        getRowId={(row) => row.position_id}
        noun="vacancies"
        exportName="vacancies"
        searchPlaceholder="Search positions"
        isLoading={isLoading}
        error={error?.detail ?? null}
        onRetry={reload}
        empty={{ icon: Armchair, title: "No vacant seats", description: "Every approved seat is filled." }}
      />
    </div>
  );
}
