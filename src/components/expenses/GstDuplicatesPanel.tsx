"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Copy } from "lucide-react";
import React from "react";

import { DataTable } from "@/components/common/data-table/DataTable";
import { QueryBoundary, StatTile } from "@/components/expenses/ReviewCommon";
import { formatMoney } from "@/components/expenses/shared";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useApiQuery } from "@/hooks/useApiQuery";
import type { GstDuplicateGroup, GstDuplicates } from "@/lib/types/expenses";

const COLUMNS: ColumnDef<GstDuplicateGroup>[] = [
  { accessorKey: "vendor_gstin", header: "Vendor GSTIN", meta: { cellClassName: "tabular-nums" } },
  { accessorKey: "normalised_invoice_number", header: "Invoice number" },
  {
    accessorKey: "claim_count",
    header: "Captures",
    meta: { className: "text-right", cellClassName: "tabular-nums" },
  },
  {
    id: "employees",
    header: "Employees",
    accessorFn: (group) => group.employee_ids.length,
    meta: { className: "text-right", cellClassName: "tabular-nums" },
  },
  {
    accessorKey: "total_tax",
    header: "Total tax",
    sortingFn: "alphanumeric",
    meta: { className: "text-right", cellClassName: "tabular-nums" },
    cell: ({ row }) => formatMoney(row.original.total_tax),
  },
  {
    accessorKey: "detail",
    header: "Detail",
    meta: {
      cellClassName: "max-w-96 whitespace-normal",
      text: (group) => (group.across_employees ? `Different employees · ${group.detail}` : group.detail),
    },
    cell: ({ row }) => (
      <>
        {row.original.across_employees && (
          <Badge variant="destructive" className="mb-1">
            Different employees
          </Badge>
        )}
        <p className="text-muted-foreground">{row.original.detail}</p>
      </>
    ),
  },
];

/** The same vendor invoice captured more than once, possibly by different people. */
export function GstDuplicatesPanel() {
  const query = useApiQuery<GstDuplicates>("/gst/duplicates");

  return (
    <Card tier="tier1">
      <CardHeader>
        <CardTitle>Duplicates</CardTitle>
        <CardDescription>
          Invoices from one vendor GSTIN whose numbers match once spacing and punctuation are ignored.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <QueryBoundary query={query}>
          {(data) => (
            <div className="grid gap-4">
              <div className="grid gap-3 px-5 sm:grid-cols-2">
                <StatTile label="Duplicate groups" tone={data.duplicate_groups > 0 ? "warning" : "default"} value={data.duplicate_groups} />
                <StatTile
                  label="Across employees"
                  tone={data.across_employees > 0 ? "destructive" : "default"}
                  value={data.across_employees}
                />
              </div>
              {data.note && <p className="px-5 text-sm text-muted-foreground">{data.note}</p>}
              <DataTable
                bordered={false}
                columns={COLUMNS}
                data={data.duplicates}
                getRowId={(group) => `${group.vendor_gstin}-${group.normalised_invoice_number}`}
                noun="duplicates"
                exportName="gst-duplicates"
                searchPlaceholder="Search GSTIN or invoice"
                empty={{
                  icon: Copy,
                  title: "No duplicates found",
                  description: "No vendor invoice has been captured more than once.",
                }}
              />
            </div>
          )}
        </QueryBoundary>
      </CardContent>
    </Card>
  );
}
