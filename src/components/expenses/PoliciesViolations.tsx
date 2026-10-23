"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { BarChart3, Lock } from "lucide-react";
import React, { useState } from "react";

import { DataTable } from "@/components/common/data-table/DataTable";
import { humanizeKey } from "@/components/expenses/shared";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useApiQuery } from "@/hooks/useApiQuery";
import type { ViolationRateGroup, ViolationRates } from "@/lib/types/expenses";

type Scope = ViolationRates["scope"];

const SCOPE_LABEL: Record<Scope, string> = {
  employee: "By employee",
  department: "By department",
  category: "By category",
};

/** "Showing 1–5 of 5 categories". */
const SCOPE_NOUN: Record<Scope, string> = {
  employee: "employees",
  department: "departments",
  category: "categories",
};

/** The API sends a fraction (0.25); shown as a percentage to one decimal. */
function percent(rate: number): string {
  return `${Math.round(rate * 1000) / 10}%`;
}

/** How often claims breach policy, with no rate shown below a usable sample. */
export function PoliciesViolations() {
  const [scope, setScope] = useState<Scope>("category");
  const query = useApiQuery<ViolationRates>(`/expenses/violation-rates?scope=${scope}`);
  // A 403 reads as "no access", not as a failed load that a retry could fix.
  const forbidden = query.error?.status === 403;
  const data = query.error ? null : query.data;
  // The groups' own scope: the one just picked may still be loading.
  const shownScope = data?.scope ?? scope;

  const columns: ColumnDef<ViolationRateGroup>[] = [
    {
      id: "key",
      header: SCOPE_LABEL[shownScope].replace("By ", ""),
      accessorFn: (group) => (shownScope === "category" ? humanizeKey(group.key) : group.key),
      meta: { cellClassName: "font-medium text-foreground" },
    },
    {
      accessorKey: "total_claims",
      header: "Claims",
      meta: { className: "text-right", cellClassName: "tabular-nums" },
    },
    {
      accessorKey: "violations",
      header: "Violations",
      meta: { className: "text-right", cellClassName: "tabular-nums" },
    },
    {
      accessorKey: "rate",
      header: "Rate",
      meta: {
        className: "text-right",
        cellClassName: "tabular-nums",
        text: (group) => (group.rate === null ? "too few claims" : percent(group.rate)),
      },
      cell: ({ row }) =>
        row.original.rate === null ? (
          <span className="text-muted-foreground">too few claims</span>
        ) : (
          percent(row.original.rate)
        ),
    },
    {
      accessorKey: "interpretation",
      header: "Reading",
      meta: { cellClassName: "max-w-96 whitespace-normal text-muted-foreground" },
    },
  ];

  return (
    <DataTable
      title="Violation rates"
      description="The share of claims that breached a policy rule. A group with too few claims shows no rate rather than a misleading one."
      filters={
        <Select value={scope} onValueChange={(value) => setScope(value as Scope)}>
          <SelectTrigger className="h-9 w-40" aria-label="Group by">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(SCOPE_LABEL).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
      tabs={
        data && (
          <p className="text-sm text-muted-foreground">
            Rate across everyone:{" "}
            <span className="font-medium tabular-nums text-foreground">
              {data.peer_rate === null ? "too few claims" : percent(data.peer_rate)}
            </span>
            {data.note && <span className="block pt-1">{data.note}</span>}
          </p>
        )
      }
      columns={columns}
      data={data?.groups ?? []}
      getRowId={(group) => group.key}
      noun={SCOPE_NOUN[shownScope]}
      exportName={`violation-rates-by-${shownScope}`}
      searchPlaceholder={`Search ${SCOPE_NOUN[shownScope]}`}
      loadingRows={3}
      isLoading={query.isLoading && query.data === null}
      error={forbidden ? null : (query.error?.detail ?? null)}
      onRetry={query.reload}
      empty={
        forbidden
          ? { icon: Lock, title: "You don't have access to this", description: query.error?.detail }
          : {
              icon: BarChart3,
              title: "No claims to measure",
              description: "Rates appear once claims have been captured against a policy.",
            }
      }
    />
  );
}
