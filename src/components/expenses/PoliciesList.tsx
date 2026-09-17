"use client";

import { Copy, FileText, Plus, PowerOff } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { EmptyState } from "@/components/common/EmptyState";
import { PoliciesVersionDialog } from "@/components/expenses/PoliciesVersionDialog";
import { QueryBoundary, errorDetail } from "@/components/expenses/ReviewCommon";
import {
  CITY_TIER_LABEL,
  LIMIT_TYPE_LABEL,
  VIOLATION_ACTION_LABEL,
  formatMoney,
  humanizeKey,
} from "@/components/expenses/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useApiQuery } from "@/hooks/useApiQuery";
import { post } from "@/lib/api";
import type { OrgLocation, Policy } from "@/lib/types/expenses";
import { formatDay } from "@/lib/utils";

/**
 * Expense policies, newest first as the server orders them. A policy is never
 * edited: a change is a new version, and the old one is deactivated.
 */
export function PoliciesList({ canAdmin }: { canAdmin: boolean }) {
  const query = useApiQuery<Policy[]>("/expenses/policies?include_inactive=true");
  const locations = useApiQuery<OrgLocation[]>("/org/locations");
  const [dialog, setDialog] = useState<{ base: Policy | null } | null>(null);
  const [deactivating, setDeactivating] = useState<Policy | null>(null);

  const locationName = (id: string) => locations.data?.find((row) => row.id === id)?.name ?? "Unknown location";

  const deactivate = async () => {
    if (!deactivating) return;
    try {
      await post<Policy>(`/expenses/policies/${deactivating.id}/deactivate`);
      toast.success(`${deactivating.name} deactivated`);
      query.reload();
    } catch (error) {
      toast.error(errorDetail(error, "Could not deactivate the policy."));
      throw error;
    }
  };

  return (
    <div className="grid gap-4">
      <Card tier="tier1">
        <CardHeader>
          <CardTitle>Expense policies</CardTitle>
          <CardDescription>
            A policy is never edited. Saving creates a new version with its own start date; the existing
            version stays as it was, so past claims keep the verdict they were given.
          </CardDescription>
          {canAdmin && (
            <CardAction>
              <Button size="sm" onClick={() => setDialog({ base: null })}>
                <Plus /> New policy
              </Button>
            </CardAction>
          )}
        </CardHeader>
      </Card>

      <QueryBoundary query={query} skeletonRows={4}>
        {(policies) =>
          policies.length === 0 ? (
            <Card tier="tier1">
              <EmptyState
                icon={FileText}
                title="No expense policies yet"
                description="Until a policy exists, every claim is captured with the verdict “No rule”."
              />
            </Card>
          ) : (
            <div className="grid gap-4">
              {policies.map((policy) => (
                <Card key={policy.id} tier="tier1">
                  <CardHeader>
                    <CardTitle className="flex flex-wrap items-center gap-2">
                      {policy.name}
                      <Badge variant={policy.is_active ? "success" : "muted"}>
                        {policy.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </CardTitle>
                    <CardDescription>
                      In force from {formatDay(policy.effective_from, true)} ·{" "}
                      {policy.applicable_grades.length > 0
                        ? `grades ${policy.applicable_grades.join(", ")}`
                        : "all grades"}{" "}
                      ·{" "}
                      {policy.applicable_locations.length > 0
                        ? policy.applicable_locations.map(locationName).join(", ")
                        : "all locations"}
                      {policy.description && (
                        <span className="mt-1 block text-foreground">{policy.description}</span>
                      )}
                    </CardDescription>
                    {canAdmin && (
                      <CardAction className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" onClick={() => setDialog({ base: policy })}>
                          <Copy /> New version
                        </Button>
                        {policy.is_active && (
                          <Button variant="outline" size="sm" onClick={() => setDeactivating(policy)}>
                            <PowerOff /> Deactivate
                          </Button>
                        )}
                      </CardAction>
                    )}
                  </CardHeader>
                  <CardContent className="p-0">
                    {policy.rules.length === 0 ? (
                      <p className="px-5 pb-2 text-sm text-muted-foreground">This version has no rules.</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="pl-5">Category</TableHead>
                            <TableHead>Tier</TableHead>
                            <TableHead>Limit</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                            <TableHead>Breach</TableHead>
                            <TableHead>Receipt</TableHead>
                            <TableHead className="pr-5">Other</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {policy.rules.map((rule) => (
                            <TableRow key={rule.id}>
                              <TableCell className="pl-5 font-medium text-foreground">
                                {humanizeKey(rule.category_key)}
                              </TableCell>
                              <TableCell>{CITY_TIER_LABEL[rule.city_tier]}</TableCell>
                              <TableCell>{LIMIT_TYPE_LABEL[rule.limit_type]}</TableCell>
                              <TableCell className="text-right tabular-nums">
                                {formatMoney(rule.limit_amount)}
                              </TableCell>
                              <TableCell>{VIOLATION_ACTION_LABEL[rule.violation_action]}</TableCell>
                              <TableCell className="tabular-nums">
                                {rule.requires_receipt
                                  ? `Above ${formatMoney(rule.receipt_threshold)}`
                                  : "Not required"}
                              </TableCell>
                              <TableCell className="pr-5">
                                <div className="flex flex-wrap gap-1">
                                  {rule.requires_pre_approval && <Badge variant="outline">Pre-approval</Badge>}
                                  {rule.is_per_diem && <Badge variant="outline">Per-diem</Badge>}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )
        }
      </QueryBoundary>

      {canAdmin && (
        <PoliciesVersionDialog
          open={dialog !== null}
          base={dialog?.base ?? null}
          locations={locations.data ?? []}
          locationsError={locations.error?.detail ?? null}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            query.reload();
          }}
        />
      )}

      <ConfirmDialog
        open={deactivating !== null}
        onOpenChange={(open) => !open && setDeactivating(null)}
        title={`Deactivate ${deactivating?.name ?? "this policy"}?`}
        description="New claims will no longer be checked against it. Claims already captured keep the verdict they were given. The policy itself is not changed or deleted."
        confirmLabel="Deactivate"
        destructive
        onConfirm={deactivate}
      />
    </div>
  );
}
