"use client";

import { BarChart3 } from "lucide-react";
import React, { useState } from "react";

import { EmptyState } from "@/components/common/EmptyState";
import { QueryBoundary } from "@/components/expenses/ReviewCommon";
import { humanizeKey } from "@/components/expenses/shared";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useApiQuery } from "@/hooks/useApiQuery";
import type { ViolationRates } from "@/lib/types/expenses";

type Scope = ViolationRates["scope"];

const SCOPE_LABEL: Record<Scope, string> = {
  employee: "By employee",
  department: "By department",
  category: "By category",
};

/** The API sends a fraction (0.25); shown as a percentage to one decimal. */
function percent(rate: number): string {
  return `${Math.round(rate * 1000) / 10}%`;
}

/** How often claims breach policy, with no rate shown below a usable sample. */
export function PoliciesViolations() {
  const [scope, setScope] = useState<Scope>("category");
  const query = useApiQuery<ViolationRates>(`/expenses/violation-rates?scope=${scope}`);

  return (
    <Card tier="tier1">
      <CardHeader>
        <CardTitle>Violation rates</CardTitle>
        <CardDescription>
          The share of claims that breached a policy rule. A group with too few claims shows no rate rather than
          a misleading one.
        </CardDescription>
        <CardAction>
          <Select value={scope} onValueChange={(value) => setScope(value as Scope)}>
            <SelectTrigger size="sm" className="w-40" aria-label="Group by">
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
        </CardAction>
      </CardHeader>
      <CardContent className="p-0">
        <QueryBoundary query={query}>
          {(data) => (
            <div className="grid gap-3">
              <p className="px-5 text-sm text-muted-foreground">
                Rate across everyone:{" "}
                <span className="font-medium tabular-nums text-foreground">
                  {data.peer_rate === null ? "too few claims" : percent(data.peer_rate)}
                </span>
                {data.note && <span className="block pt-1">{data.note}</span>}
              </p>
              {data.groups.length === 0 ? (
                <EmptyState
                  icon={BarChart3}
                  title="No claims to measure"
                  description="Rates appear once claims have been captured against a policy."
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-5">{SCOPE_LABEL[data.scope].replace("By ", "")}</TableHead>
                      <TableHead className="text-right">Claims</TableHead>
                      <TableHead className="text-right">Violations</TableHead>
                      <TableHead className="text-right">Rate</TableHead>
                      <TableHead className="pr-5">Reading</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.groups.map((group) => (
                      <TableRow key={group.key}>
                        <TableCell className="pl-5 font-medium text-foreground">
                          {data.scope === "category" ? humanizeKey(group.key) : group.key}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{group.total_claims}</TableCell>
                        <TableCell className="text-right tabular-nums">{group.violations}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {group.rate === null ? (
                            <span className="text-muted-foreground">too few claims</span>
                          ) : (
                            percent(group.rate)
                          )}
                        </TableCell>
                        <TableCell className="max-w-96 whitespace-normal pr-5 text-muted-foreground">
                          {group.interpretation}
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
