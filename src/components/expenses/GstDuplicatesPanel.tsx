"use client";

import { Copy } from "lucide-react";
import React from "react";

import { EmptyState } from "@/components/common/EmptyState";
import { QueryBoundary, StatTile } from "@/components/expenses/ReviewCommon";
import { formatMoney } from "@/components/expenses/shared";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useApiQuery } from "@/hooks/useApiQuery";
import type { GstDuplicates } from "@/lib/types/expenses";

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
              {data.duplicates.length === 0 ? (
                <EmptyState
                  icon={Copy}
                  title="No duplicates found"
                  description="No vendor invoice has been captured more than once."
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-5">Vendor GSTIN</TableHead>
                      <TableHead>Invoice number</TableHead>
                      <TableHead className="text-right">Captures</TableHead>
                      <TableHead className="text-right">Employees</TableHead>
                      <TableHead className="text-right">Total tax</TableHead>
                      <TableHead className="pr-5">Detail</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.duplicates.map((group) => (
                      <TableRow key={`${group.vendor_gstin}-${group.normalised_invoice_number}`}>
                        <TableCell className="pl-5 tabular-nums">{group.vendor_gstin}</TableCell>
                        <TableCell>{group.normalised_invoice_number}</TableCell>
                        <TableCell className="text-right tabular-nums">{group.claim_count}</TableCell>
                        <TableCell className="text-right tabular-nums">{group.employee_ids.length}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatMoney(group.total_tax)}</TableCell>
                        <TableCell className="max-w-96 whitespace-normal pr-5">
                          {group.across_employees && (
                            <Badge variant="destructive" className="mb-1">
                              Different employees
                            </Badge>
                          )}
                          <p className="text-muted-foreground">{group.detail}</p>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          )}
        </QueryBoundary>
      </CardContent>
    </Card>
  );
}
