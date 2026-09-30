"use client";

import { Laptop } from "lucide-react";
import Link from "next/link";
import React from "react";

import { Money } from "@/components/common/Money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useApiQuery } from "@/hooks/useApiQuery";
import type { AssetAssignment } from "@/lib/types/assets";

import { dayOrDash, OutcomeBadge, QueryPanel, stampDay, useAssetRoles } from "./shared";

/**
 * The assets one person holds and has held, for their HR record. Shown to HR
 * and the person's line manager; the API decides which of them may see it.
 */
export function EmployeeAssetsCard({
  employeeId,
  className,
}: {
  employeeId: string;
  className?: string;
}) {
  const { isHr, isManager } = useAssetRoles();
  const query = useApiQuery<AssetAssignment[]>(
    isManager ? `/assets/employees/${employeeId}` : null,
  );
  // A manager looking at somebody outside their reporting line is told the
  // record does not exist; the card then has nothing to say and is left out.
  if (!isManager || query.error?.status === 404 || query.error?.status === 403) return null;

  return (
    <QueryPanel
      className={className}
      title="Assets"
      description="Company equipment handed to this person, current first."
      actions={
        isHr ? (
          <Button asChild variant="outline" size="sm">
            <Link href="/assets/inventory">Asset register</Link>
          </Button>
        ) : undefined
      }
      query={query}
      isEmpty={(rows) => rows.length === 0}
      empty={{
        icon: Laptop,
        title: "No assets handed over",
        description: isHr
          ? "Hand over an asset from the asset register and it appears here."
          : "Nothing has been handed to this person.",
      }}
    >
      {(rows) => (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Asset</TableHead>
                <TableHead>Held</TableHead>
                <TableHead>Due back</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Recovery</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <p className="font-medium text-foreground">{row.asset_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {row.asset_tag} · {row.category_name}
                    </p>
                  </TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums">
                    {stampDay(row.assigned_at)} – {row.is_open ? "now" : stampDay(row.closed_at)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums">
                    {row.is_open ? dayOrDash(row.expected_return_date) : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      <OutcomeBadge outcome={row.outcome} />
                      {row.is_overdue && <Badge variant="destructive">Overdue</Badge>}
                      {row.is_open && row.requires_acknowledgement && !row.acknowledged_at && (
                        <Badge variant="warning">Not acknowledged</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {row.recovery_amount ? <Money value={row.recovery_amount} /> : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </QueryPanel>
  );
}
