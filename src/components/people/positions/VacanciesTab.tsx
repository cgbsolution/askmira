"use client";

import { Armchair, Info } from "lucide-react";

import { DataPanel } from "@/components/common/DataPanel";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApiQuery } from "@/hooks/useApiQuery";
import type { VacancyReport } from "@/lib/types/people";
import { formatDate } from "@/lib/utils";

import { POSITION_STATUS } from "../labels";

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

      <DataPanel
        title="Vacancies"
        description={data ? `As of ${formatDate(data.as_of)}.` : undefined}
        isLoading={isLoading}
        error={error?.detail ?? null}
        onRetry={reload}
        isEmpty={rows.length === 0}
        empty={{ icon: Armchair, title: "No vacant seats", description: "Every approved seat is filled." }}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Position</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Open for</TableHead>
              <TableHead>Covered by</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const status = POSITION_STATUS[row.status];
              return (
                <TableRow key={row.position_id}>
                  <TableCell>
                    <div className="font-medium text-foreground">{row.title}</div>
                    <div className="font-mono text-xs text-muted-foreground">
                      {row.code}
                      {Number(row.fte) < 1 && ` · ${row.fte} FTE`}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{row.department || "—"}</TableCell>
                  <TableCell className="text-sm">
                    {row.days_vacant !== null ? (
                      <>
                        <span className="tabular-nums">{row.days_vacant}</span> days
                        {row.since && (
                          <div className="text-xs text-muted-foreground">since {formatDate(row.since)}</div>
                        )}
                      </>
                    ) : (
                      <span className="text-muted-foreground">Never filled</span>
                    )}
                    {row.stale && (
                      <Badge variant="warning" className="ml-2">
                        Stale
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {row.covered_by.length > 0 ? row.covered_by.join(", ") : "Nobody"}
                  </TableCell>
                  <TableCell>{status && <Badge variant={status.variant}>{status.label}</Badge>}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </DataPanel>
    </div>
  );
}
