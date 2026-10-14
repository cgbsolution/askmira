"use client";

import { CalendarX2 } from "lucide-react";
import Link from "next/link";
import React from "react";

import { DataPanel } from "@/components/common/DataPanel";
import { PersonCell } from "@/components/common/PersonCell";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApiQuery } from "@/hooks/useApiQuery";
import type { AbsenceScores } from "@/lib/types/reports";
import { formatDate } from "@/lib/utils";

/** The Bradford factor per person, always beside the spells and days it is made of. */
export function AbsenceScoresPanel() {
  const { data, error, isLoading, reload } = useApiQuery<AbsenceScores>("/reports/analytics/absence-scores");

  return (
    <DataPanel
      tier="tier1"
      title="Unplanned absence"
      description={data ? `${data.method} ${formatDate(data.from)} to ${formatDate(data.to)}.` : undefined}
      isLoading={isLoading}
      error={error?.detail ?? null}
      onRetry={reload}
      isEmpty={(data?.people ?? []).length === 0}
      empty={{ icon: CalendarX2, title: "No unplanned absence", description: "Nobody you can see was marked absent in the last 52 weeks." }}
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Person</TableHead>
            <TableHead className="text-right">Spells</TableHead>
            <TableHead className="text-right">Days</TableHead>
            <TableHead className="text-right">Bradford factor</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {(data?.people ?? []).map((row) => (
            <TableRow key={row.employee_id}>
              <TableCell>
                <Link href={`/people/${row.employee_id}`} className="hover:underline">
                  <PersonCell name={row.employee_name} subtitle={row.employee_code} size="sm" />
                </Link>
              </TableCell>
              <TableCell className="text-right tabular-nums">{row.spells}</TableCell>
              <TableCell className="text-right tabular-nums">{row.days}</TableCell>
              <TableCell className="text-right font-medium tabular-nums">{row.bradford_factor}</TableCell>
              <TableCell>
                {row.at_or_above_review && <Badge variant="warning">{data?.review_threshold}+ — worth a conversation</Badge>}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </DataPanel>
  );
}
