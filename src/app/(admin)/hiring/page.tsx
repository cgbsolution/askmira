"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Briefcase, Plus } from "lucide-react";
import React, { useState } from "react";

import { DataTable } from "@/components/common/data-table/DataTable";
import { PageShell } from "@/components/common/PageShell";
import { RequireRole } from "@/components/common/RequireRole";
import { ApprovalQueue } from "@/components/hiring/ApprovalQueue";
import { formatDateTime, humanize, REQUISITION_STATUS, StatusBadge } from "@/components/hiring/labels";
import { RequisitionFormDialog } from "@/components/hiring/RequisitionFormDialog";
import { RequisitionSheet } from "@/components/hiring/RequisitionSheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/context/AuthContext";
import { useApiQuery } from "@/hooks/useApiQuery";
import { MANAGERS } from "@/lib/access";
import type { Page } from "@/lib/types";
import type { RequisitionStatus, RequisitionSummary } from "@/lib/types/hiring";
import { formatDate } from "@/lib/utils";

const PAGE_SIZE = 25;

const STATUS_FILTERS = Object.entries(REQUISITION_STATUS) as [RequisitionStatus, [string, unknown]][];

/** Requisitions: what the organisation is hiring for, and what waits on your signature. */
export default function RequisitionsPage() {
  const { hasRole, user } = useAuth();
  const isManager = hasRole(...MANAGERS);
  const isHr = hasRole("admin", "sub_admin");
  // Every open role is listed so anyone can refer into it, but only HR and the
  // role's own hiring team may open its detail (budget, approvals, candidates).
  const canOpen = (row: RequisitionSummary) =>
    isHr ||
    (user?.employee_id != null &&
      (row.hiring_manager_id === user.employee_id || row.recruiter_id === user.employee_id)) ||
    (user != null && row.raised_by_user_id === user.id);
  const [status, setStatus] = useState<RequisitionStatus | "all">("all");
  const [mine, setMine] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const query =
    `/hiring/requisitions?page=${page}&page_size=${pageSize}` +
    (status === "all" ? "" : `&status=${status}`) +
    (mine && isManager ? "&mine=true" : "");
  const { data, error, isLoading, reload } = useApiQuery<Page<RequisitionSummary>>(query);
  const rows = data?.items ?? [];

  const columns: ColumnDef<RequisitionSummary>[] = [
    {
      accessorKey: "title",
      header: "Requisition",
      meta: { text: (row) => `${row.title} ${row.code}` },
      cell: ({ row }) => (
        <>
          {isManager && canOpen(row.original) ? (
            <Button
              variant="link"
              className="h-auto p-0 font-medium text-foreground"
              onClick={(event) => {
                event.stopPropagation();
                setSelectedId(row.original.id);
              }}
            >
              {row.original.title}
            </Button>
          ) : (
            <span className="font-medium text-foreground">{row.original.title}</span>
          )}
          {isManager && !canOpen(row.original) ? (
            <p className="text-xs text-muted-foreground">
              Open for referrals; its details are with the hiring team.
            </p>
          ) : null}
          <p className="font-mono text-xs text-muted-foreground">{row.original.code}</p>
        </>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      meta: { text: (row) => REQUISITION_STATUS[row.status][0] },
      cell: ({ row }) => <StatusBadge map={REQUISITION_STATUS} value={row.original.status} />,
    },
    {
      id: "employment_type",
      header: "Type",
      accessorFn: (row) => humanize(row.employment_type),
    },
    { accessorKey: "openings", header: "Openings", meta: { className: "text-right", cellClassName: "tabular-nums" } },
    {
      accessorKey: "open_vacancies",
      header: "Still open",
      meta: { className: "text-right", cellClassName: "tabular-nums" },
    },
    {
      accessorKey: "target_close_date",
      header: "Target close",
      meta: { text: (row) => formatDate(row.target_close_date) },
      cell: ({ row }) => formatDate(row.original.target_close_date),
    },
    {
      accessorKey: "created_at",
      header: "Raised",
      meta: { cellClassName: "text-muted-foreground", text: (row) => formatDateTime(row.created_at) },
      cell: ({ row }) => formatDateTime(row.original.created_at),
    },
  ];

  return (
    <PageShell
      title="Requisitions"
      description="Roles the organisation is hiring for. A requisition takes candidates only after its approval chain signs it off."
      actions={
        <RequireRole roles={MANAGERS}>
          <Button variant="accent" onClick={() => setCreateOpen(true)}>
            <Plus /> Raise requisition
          </Button>
        </RequireRole>
      }
    >
      {isManager && <ApprovalQueue onDecided={reload} />}

      <DataTable
        title="Requisitions"
        columns={columns}
        data={rows}
        noun="requisitions"
        isLoading={isLoading && !data}
        error={error?.detail}
        onRetry={reload}
        filtered={status !== "all" || mine}
        empty={{
          icon: Briefcase,
          title: "No requisitions yet",
          description: isManager
            ? "Raise a requisition to start hiring. It stays a draft until you submit it for approval."
            : "Open roles appear here once they are approved.",
        }}
        emptyMessage="No requisitions match these filters."
        onRowClick={
          isManager
            ? (row) => {
                if (canOpen(row)) setSelectedId(row.id);
              }
            : undefined
        }
        rowClassName={(row) => (isManager && !canOpen(row) ? "cursor-default" : undefined)}
        server={{
          page,
          pageSize,
          total: data?.total ?? 0,
          onPageChange: setPage,
          onPageSizeChange: (size) => {
            setPageSize(size);
            setPage(1);
          },
        }}
        filters={
          <>
            <Select
              value={status}
              onValueChange={(next) => {
                setStatus(next as RequisitionStatus | "all");
                setPage(1);
              }}
            >
              <SelectTrigger className="h-9 w-48" aria-label="Filter by status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {STATUS_FILTERS.map(([value, [label]]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isManager && (
              <div className="flex items-center gap-2">
                <Switch
                  id="req-only-mine"
                  checked={mine}
                  onCheckedChange={(next) => {
                    setMine(next);
                    setPage(1);
                  }}
                />
                <Label htmlFor="req-only-mine">Only mine</Label>
              </div>
            )}
          </>
        }
      />

      <RequisitionFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSaved={(saved) => {
          reload();
          setSelectedId(saved.id);
        }}
      />
      <RequisitionSheet
        requisitionId={selectedId}
        onOpenChange={(open) => !open && setSelectedId(null)}
        onChanged={reload}
      />
    </PageShell>
  );
}
