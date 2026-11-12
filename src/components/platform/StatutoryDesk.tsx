"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Ban, Plus, Scale } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { DataTable } from "@/components/common/data-table/DataTable";
import { PageShell } from "@/components/common/PageShell";
import { RULE_TYPE_LABEL } from "@/components/payroll/labels";
import { PublishDialog } from "@/components/payroll/StatutoryUpdates";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useApiQuery } from "@/hooks/useApiQuery";
import { ApiError, post } from "@/lib/api";
import { formatDay } from "@/lib/utils";

interface Notice {
  id: string;
  rule_type: string;
  jurisdiction: string;
  effective_from: string;
  title: string;
  summary: string;
  source_reference: string;
  has_suggested_rules: boolean;
  withdrawn: boolean;
}

type Filter = "live" | "withdrawn" | "all";

/**
 * Platform → Statutory desk: every change in the law the platform has
 * published, to every organisation with a location in the jurisdiction.
 * Each organisation's own adoption is on its Payroll → Rule sets page.
 */
export function StatutoryDesk() {
  const { data, error, isLoading, reload } = useApiQuery<Notice[]>("/statutory-notices");
  const [publishing, setPublishing] = useState(false);
  const [withdrawing, setWithdrawing] = useState<Notice | null>(null);
  const [filter, setFilter] = useState<Filter>("live");

  const withdraw = async () => {
    if (!withdrawing) return;
    try {
      await post(`/statutory-notices/${withdrawing.id}/withdraw`);
      toast.success("Withdrawn. Organisations no longer see it.");
      setWithdrawing(null);
      reload();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.detail : "Could not withdraw the notice.");
    }
  };

  const rows = (data ?? []).filter((notice) =>
    filter === "all" ? true : filter === "live" ? !notice.withdrawn : notice.withdrawn,
  );

  const columns: ColumnDef<Notice>[] = [
    {
      accessorKey: "effective_from",
      header: "Takes effect",
      cell: ({ row }) => <span className="whitespace-nowrap">{formatDay(row.original.effective_from)}</span>,
    },
    {
      accessorKey: "jurisdiction",
      header: "Where",
      cell: ({ row }) => (row.original.jurisdiction === "IN" ? "National" : row.original.jurisdiction),
    },
    {
      id: "rule_type",
      header: "Rule",
      accessorFn: (row) => RULE_TYPE_LABEL[row.rule_type] ?? row.rule_type,
    },
    {
      accessorKey: "title",
      header: "Change",
      cell: ({ row }) => (
        <div className="max-w-md">
          <p className="font-medium text-foreground">{row.original.title}</p>
          <p className="line-clamp-2 text-xs text-muted-foreground">{row.original.summary}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{row.original.source_reference}</p>
        </div>
      ),
    },
    {
      id: "rules",
      header: "Reviewed rules",
      accessorFn: (row) => (row.has_suggested_rules ? "Included" : "None"),
      cell: ({ row }) =>
        row.original.has_suggested_rules ? (
          <Badge variant="secondary">Included</Badge>
        ) : (
          <span className="text-xs text-muted-foreground">None</span>
        ),
    },
    {
      id: "status",
      header: "Status",
      accessorFn: (row) => (row.withdrawn ? "Withdrawn" : "Published"),
      cell: ({ row }) =>
        row.original.withdrawn ? <Badge variant="muted">Withdrawn</Badge> : <Badge variant="success">Published</Badge>,
    },
    {
      id: "actions",
      header: "",
      enableHiding: false,
      enableSorting: false,
      meta: { text: false },
      cell: ({ row }) =>
        row.original.withdrawn ? null : (
          <div className="flex justify-end">
            <Button size="sm" variant="outline" onClick={() => setWithdrawing(row.original)}>
              <Ban /> Withdraw
            </Button>
          </div>
        ),
    },
  ];

  return (
    <PageShell
      title="Statutory desk"
      eyebrow="Platform console"
      icon={Scale}
      description="Changes to PF, ESI, Professional Tax, LWF and income tax, published to every organisation with a location where they apply."
      actions={
        <Button onClick={() => setPublishing(true)}>
          <Plus /> Publish a notice
        </Button>
      }
    >
      <DataTable
        title="Published notices"
        description="Each organisation's admins draft a rule set from a notice; a second admin approves it before payroll uses it."
        columns={columns}
        data={rows}
        getRowId={(row) => row.id}
        noun="notices"
        isLoading={isLoading}
        error={error?.detail ?? null}
        onRetry={reload}
        selectable={false}
        exportName="statutory-notices"
        searchPlaceholder="Search title, state or source"
        filtered={filter !== "live"}
        filters={
          <Select value={filter} onValueChange={(v) => setFilter(v as Filter)}>
            <SelectTrigger className="w-40" aria-label="Status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="live">Published</SelectItem>
              <SelectItem value="withdrawn">Withdrawn</SelectItem>
              <SelectItem value="all">All notices</SelectItem>
            </SelectContent>
          </Select>
        }
        empty={{
          icon: Scale,
          title: filter === "withdrawn" ? "No withdrawn notices" : "No notices published yet",
          description: filter === "withdrawn" ? undefined : "Publish one when a rate or slab changes.",
        }}
      />
      {publishing && (
        <PublishDialog
          onClose={() => setPublishing(false)}
          onDone={() => {
            setPublishing(false);
            reload();
          }}
        />
      )}
      <ConfirmDialog
        open={withdrawing !== null}
        onOpenChange={(open) => !open && setWithdrawing(null)}
        title={`Withdraw “${withdrawing?.title ?? ""}”?`}
        description="Organisations stop seeing it. Rule sets already drafted or approved from it stay as they are."
        confirmLabel="Withdraw"
        destructive
        onConfirm={withdraw}
      />
    </PageShell>
  );
}
