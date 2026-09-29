"use client";

import { Briefcase, Plus } from "lucide-react";
import React, { useState } from "react";

import { DataPanel } from "@/components/common/DataPanel";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  const { hasRole } = useAuth();
  const isManager = hasRole(...MANAGERS);
  const [status, setStatus] = useState<RequisitionStatus | "all">("all");
  const [mine, setMine] = useState(false);
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const query =
    `/hiring/requisitions?page=${page}&page_size=${PAGE_SIZE}` +
    (status === "all" ? "" : `&status=${status}`) +
    (mine && isManager ? "&mine=true" : "");
  const { data, error, isLoading, reload } = useApiQuery<Page<RequisitionSummary>>(query);
  const rows = data?.items ?? [];
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

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

      <DataPanel
        title="Requisitions"
        description={data ? `${data.total} in view` : undefined}
        toolbar={
          <>
            <Select
              value={status}
              onValueChange={(next) => {
                setStatus(next as RequisitionStatus | "all");
                setPage(1);
              }}
            >
              <SelectTrigger className="w-48" aria-label="Filter by status">
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
        isLoading={isLoading && !data}
        error={error?.detail}
        onRetry={reload}
        isEmpty={rows.length === 0}
        empty={{
          icon: Briefcase,
          title:
            status === "all" && !mine ? "No requisitions yet" : "No requisitions match these filters",
          description: isManager
            ? "Raise a requisition to start hiring. It stays a draft until you submit it for approval."
            : "Open roles appear here once they are approved.",
        }}
        footer={
          data && data.total > PAGE_SIZE ? (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                Page {page} of {pages} · {data.total} requisitions
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= pages}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          ) : undefined
        }
      >
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Requisition</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Openings</TableHead>
                <TableHead className="text-right">Still open</TableHead>
                <TableHead>Target close</TableHead>
                <TableHead>Raised</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow
                  key={row.id}
                  className={isManager ? "cursor-pointer" : undefined}
                  onClick={isManager ? () => setSelectedId(row.id) : undefined}
                >
                  <TableCell>
                    {isManager ? (
                      <Button
                        variant="link"
                        className="h-auto p-0 font-medium text-foreground"
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedId(row.id);
                        }}
                      >
                        {row.title}
                      </Button>
                    ) : (
                      <span className="font-medium text-foreground">{row.title}</span>
                    )}
                    <p className="font-mono text-xs text-muted-foreground">{row.code}</p>
                  </TableCell>
                  <TableCell>
                    <StatusBadge map={REQUISITION_STATUS} value={row.status} />
                  </TableCell>
                  <TableCell>{humanize(row.employment_type)}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.openings}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.open_vacancies}</TableCell>
                  <TableCell>{formatDate(row.target_close_date)}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDateTime(row.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </DataPanel>

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
