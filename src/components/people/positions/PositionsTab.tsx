"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Briefcase, MoreHorizontal, Plus } from "lucide-react";
import { useMemo, useState } from "react";

import { DataTable } from "@/components/common/data-table/DataTable";
import { Money } from "@/components/common/Money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/context/AuthContext";
import { useApiQuery } from "@/hooks/useApiQuery";
import type { Occupancy, Position, PositionStatus } from "@/lib/types/people";
import { formatDate } from "@/lib/utils";

import { POSITION_STATUS } from "../labels";
import { useOrgReference } from "../useOrgReference";
import { AssignmentsSheet } from "./AssignmentsSheet";
import { AssignDialog, StatusDialog, VacateDialog, type StatusAction } from "./PositionActionDialogs";
import { PositionDialog } from "./PositionDialog";

const ANY = "__any__";

/** The positions list: who sits where, and the actions a seat allows in its current state. */
export function PositionsTab() {
  const { hasRole } = useAuth();
  const canManage = hasRole("admin");
  const canStaff = hasRole("admin", "sub_admin");

  const [statusFilter, setStatusFilter] = useState<string>(ANY);

  const path =
    statusFilter === ANY ? "/positions" : `/positions?position_status=${statusFilter}`;
  const positions = useApiQuery<Position[]>(path);
  const occupancy = useApiQuery<Occupancy>("/positions/occupancy");
  const org = useOrgReference();

  const [form, setForm] = useState<{ open: boolean; editing: Position | null }>({
    open: false,
    editing: null,
  });
  const [statusAction, setStatusAction] = useState<{ position: Position; action: StatusAction } | null>(
    null,
  );
  const [assigning, setAssigning] = useState<Position | null>(null);
  const [vacating, setVacating] = useState<Position | null>(null);
  const [viewing, setViewing] = useState<Position | null>(null);

  const holders = useMemo(
    () => new Map((occupancy.data?.positions ?? []).map((row) => [row.position_id, row])),
    [occupancy.data],
  );
  const titleOf = useMemo(
    () => new Map((positions.data ?? []).map((row) => [row.id, `${row.title} (${row.code})`])),
    [positions.data],
  );

  const reloadAll = () => {
    positions.reload();
    occupancy.reload();
  };

  const holderText = (row: Position) => {
    const holder = holders.get(row.id);
    return (
      holder?.primary_holder ?? (holder?.covering.length ? `Covered by ${holder.covering.join(", ")}` : "Empty")
    );
  };

  const columns: ColumnDef<Position>[] = [
    {
      accessorKey: "title",
      header: "Position",
      meta: { text: (row) => `${row.title} ${row.code}` },
      cell: ({ row }) => (
        <>
          <div className="font-medium text-foreground">{row.original.title}</div>
          <div className="text-xs text-muted-foreground">
            <span className="font-mono">{row.original.code}</span>
            {row.original.grade && ` · ${row.original.grade}`}
            {Number(row.original.fte) < 1 && ` · ${row.original.fte} FTE`}
          </div>
          {row.original.reports_to_position_id && (
            <div className="text-[11px] text-muted-foreground">
              Reports to {titleOf.get(row.original.reports_to_position_id) ?? "another position"}
            </div>
          )}
        </>
      ),
    },
    {
      id: "holder",
      header: "Holder",
      accessorFn: holderText,
      meta: { cellClassName: "text-sm" },
      cell: ({ row }) =>
        holders.get(row.original.id)?.primary_holder ?? (
          <span className="text-muted-foreground">{holderText(row.original)}</span>
        ),
    },
    {
      id: "department",
      header: "Department",
      accessorFn: (row) => org.departmentName(row.department_id),
      meta: { cellClassName: "text-sm text-muted-foreground" },
    },
    {
      id: "budgeted_ctc",
      header: "Budgeted CTC",
      accessorFn: (row) => row.budgeted_ctc_max,
      sortingFn: "alphanumeric",
      meta: {
        cellClassName: "text-sm",
        text: (row) =>
          row.budgeted_ctc_max
            ? row.budgeted_ctc_min
              ? `${row.budgeted_ctc_min} – ${row.budgeted_ctc_max}`
              : row.budgeted_ctc_max
            : "Not set",
      },
      cell: ({ row }) =>
        row.original.budgeted_ctc_max ? (
          <>
            {row.original.budgeted_ctc_min && (
              <>
                <Money value={row.original.budgeted_ctc_min} /> –{" "}
              </>
            )}
            <Money value={row.original.budgeted_ctc_max} />
          </>
        ) : (
          <span className="text-muted-foreground">Not set</span>
        ),
    },
    {
      accessorKey: "status",
      header: "Status",
      meta: {
        text: (row) => {
          const label = POSITION_STATUS[row.status]?.label ?? row.status;
          return row.vacated_on && row.status === "vacant" ? `${label} since ${formatDate(row.vacated_on)}` : label;
        },
      },
      cell: ({ row }) => {
        const status = POSITION_STATUS[row.original.status];
        return (
          <>
            {status && <Badge variant={status.variant}>{status.label}</Badge>}
            {row.original.vacated_on && row.original.status === "vacant" && (
              <div className="mt-1 text-[11px] text-muted-foreground">since {formatDate(row.original.vacated_on)}</div>
            )}
          </>
        );
      },
    },
    {
      id: "actions",
      header: "",
      enableHiding: false,
      meta: { className: "w-12 text-right", text: false },
      cell: ({ row }) => {
        const position = row.original;
        const open = position.status !== "abolished";
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label={`Actions for ${position.title}`}>
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setViewing(position)}>Assignment history</DropdownMenuItem>
              {canStaff && open && position.status !== "frozen" && (
                <DropdownMenuItem onSelect={() => setAssigning(position)}>Assign someone</DropdownMenuItem>
              )}
              {canStaff && position.status === "filled" && (
                <DropdownMenuItem onSelect={() => setVacating(position)}>Vacate</DropdownMenuItem>
              )}
              {canManage && open && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => setForm({ open: true, editing: position })}>Edit</DropdownMenuItem>
                  {position.status === "frozen" ? (
                    <DropdownMenuItem onSelect={() => setStatusAction({ position, action: "unfreeze" })}>
                      Unfreeze
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem onSelect={() => setStatusAction({ position, action: "freeze" })}>
                      Freeze
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    className="text-destructive"
                    onSelect={() => setStatusAction({ position, action: "abolish" })}
                  >
                    Abolish
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  return (
    <>
      <DataTable
        title="Positions"
        columns={columns}
        data={positions.data ?? []}
        noun="positions"
        exportName="positions"
        searchPlaceholder="Search title, code or holder"
        rowClassName={(row) => (row.status !== "abolished" ? undefined : "opacity-60")}
        actions={
          canManage ? (
            <Button size="sm" className="h-9" onClick={() => setForm({ open: true, editing: null })}>
              <Plus /> New position
            </Button>
          ) : undefined
        }
        filters={
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 w-44" aria-label="Filter by status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Every status</SelectItem>
              {(Object.keys(POSITION_STATUS) as PositionStatus[]).map((key) => (
                <SelectItem key={key} value={key}>
                  {POSITION_STATUS[key].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
        isLoading={positions.isLoading}
        error={positions.error?.detail ?? null}
        onRetry={positions.reload}
        filtered={statusFilter !== ANY}
        empty={{
          icon: Briefcase,
          title: "No positions yet",
          description: "A position is a seat that exists whether or not somebody sits in it.",
        }}
        emptyMessage="No positions match. Clear the search or the status filter."
      />

      <PositionDialog
        open={form.open}
        editing={form.editing}
        positions={positions.data ?? []}
        onOpenChange={(open) => setForm({ open, editing: open ? form.editing : null })}
        onSaved={reloadAll}
      />
      <StatusDialog
        target={statusAction}
        onOpenChange={(open) => !open && setStatusAction(null)}
        onDone={reloadAll}
      />
      <AssignDialog
        position={assigning}
        onOpenChange={(open) => !open && setAssigning(null)}
        onDone={reloadAll}
      />
      <VacateDialog
        position={vacating}
        onOpenChange={(open) => !open && setVacating(null)}
        onDone={reloadAll}
      />
      <AssignmentsSheet
        position={viewing}
        canEnd={canStaff}
        onOpenChange={(open) => !open && setViewing(null)}
        onChanged={reloadAll}
      />
    </>
  );
}
