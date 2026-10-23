"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Copy, FileText, ListX, Plus, PowerOff } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { DataTable } from "@/components/common/data-table/DataTable";
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
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useApiQuery } from "@/hooks/useApiQuery";
import { post } from "@/lib/api";
import type { OrgLocation, Policy, PolicyRule } from "@/lib/types/expenses";
import { formatDay } from "@/lib/utils";

const RULE_COLUMNS: ColumnDef<PolicyRule>[] = [
  {
    id: "category",
    header: "Category",
    accessorFn: (rule) => humanizeKey(rule.category_key),
    meta: { cellClassName: "font-medium text-foreground" },
  },
  {
    id: "tier",
    header: "Tier",
    accessorFn: (rule) => CITY_TIER_LABEL[rule.city_tier],
  },
  {
    id: "limit_type",
    header: "Limit",
    accessorFn: (rule) => LIMIT_TYPE_LABEL[rule.limit_type],
  },
  {
    accessorKey: "limit_amount",
    header: "Amount",
    sortingFn: "alphanumeric",
    meta: { className: "text-right", cellClassName: "tabular-nums" },
    cell: ({ row }) => formatMoney(row.original.limit_amount),
  },
  {
    id: "breach",
    header: "Breach",
    accessorFn: (rule) => VIOLATION_ACTION_LABEL[rule.violation_action],
  },
  {
    id: "receipt",
    header: "Receipt",
    accessorFn: (rule) => (rule.requires_receipt ? `Above ${formatMoney(rule.receipt_threshold)}` : "Not required"),
    meta: { cellClassName: "tabular-nums" },
  },
  {
    id: "other",
    header: "Other",
    accessorFn: (rule) =>
      [rule.requires_pre_approval && "Pre-approval", rule.is_per_diem && "Per-diem"].filter(Boolean).join(", "),
    cell: ({ row }) => (
      <div className="flex flex-wrap gap-1">
        {row.original.requires_pre_approval && <Badge variant="outline">Pre-approval</Badge>}
        {row.original.is_per_diem && <Badge variant="outline">Per-diem</Badge>}
      </div>
    ),
  },
];

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
                <DataTable
                  key={policy.id}
                  title={
                    <span className="flex flex-wrap items-center gap-2">
                      {policy.name}
                      <Badge variant={policy.is_active ? "success" : "muted"}>
                        {policy.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </span>
                  }
                  description={
                    <>
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
                    </>
                  }
                  actions={
                    canAdmin && (
                      <>
                        <Button variant="outline" size="sm" className="h-9" onClick={() => setDialog({ base: policy })}>
                          <Copy /> New version
                        </Button>
                        {policy.is_active && (
                          <Button variant="outline" size="sm" className="h-9" onClick={() => setDeactivating(policy)}>
                            <PowerOff /> Deactivate
                          </Button>
                        )}
                      </>
                    )
                  }
                  columns={RULE_COLUMNS}
                  data={policy.rules}
                  noun="rules"
                  exportName={`expense-policy-rules-${policy.name}-${policy.effective_from}`}
                  searchPlaceholder="Search rules"
                  empty={{ icon: ListX, title: "This version has no rules" }}
                />
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
