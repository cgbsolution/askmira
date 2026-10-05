"use client";

import { Briefcase, MoreHorizontal, Plus } from "lucide-react";
import { useMemo, useState } from "react";

import { DataPanel } from "@/components/common/DataPanel";
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
  const [search, setSearch] = useState("");

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

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const all = positions.data ?? [];
    if (!term) return all;
    return all.filter(
      (row) =>
        row.title.toLowerCase().includes(term) ||
        row.code.toLowerCase().includes(term) ||
        (holders.get(row.id)?.primary_holder ?? "").toLowerCase().includes(term),
    );
  }, [positions.data, search, holders]);

  const reloadAll = () => {
    positions.reload();
    occupancy.reload();
  };

  return (
    <>
      <DataPanel
        title="Positions"
        description={positions.data ? `${positions.data.length} positions.` : undefined}
        actions={
          canManage ? (
            <Button size="sm" onClick={() => setForm({ open: true, editing: null })}>
              <Plus /> New position
            </Button>
          ) : undefined
        }
        toolbar={
          <>
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search title, code or holder"
              aria-label="Search positions"
              className="max-w-xs"
            />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-44" aria-label="Filter by status">
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
          </>
        }
        isLoading={positions.isLoading}
        error={positions.error?.detail ?? null}
        onRetry={positions.reload}
        isEmpty={rows.length === 0}
        empty={{
          icon: Briefcase,
          title: search || statusFilter !== ANY ? "No positions match" : "No positions yet",
          description:
            search || statusFilter !== ANY
              ? "Clear the search or the status filter."
              : "A position is a seat that exists whether or not somebody sits in it.",
        }}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Position</TableHead>
              <TableHead>Holder</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Budgeted CTC</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const holder = holders.get(row.id);
              const status = POSITION_STATUS[row.status];
              const open = row.status !== "abolished";
              return (
                <TableRow key={row.id} className={open ? undefined : "opacity-60"}>
                  <TableCell>
                    <div className="font-medium text-foreground">{row.title}</div>
                    <div className="text-xs text-muted-foreground">
                      <span className="font-mono">{row.code}</span>
                      {row.grade && ` · ${row.grade}`}
                      {Number(row.fte) < 1 && ` · ${row.fte} FTE`}
                    </div>
                    {row.reports_to_position_id && (
                      <div className="text-[11px] text-muted-foreground">
                        Reports to {titleOf.get(row.reports_to_position_id) ?? "another position"}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {holder?.primary_holder ?? (
                      <span className="text-muted-foreground">
                        {holder?.covering.length
                          ? `Covered by ${holder.covering.join(", ")}`
                          : "Empty"}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {org.departmentName(row.department_id)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {row.budgeted_ctc_max ? (
                      <>
                        {row.budgeted_ctc_min && (
                          <>
                            <Money value={row.budgeted_ctc_min} /> –{" "}
                          </>
                        )}
                        <Money value={row.budgeted_ctc_max} />
                      </>
                    ) : (
                      <span className="text-muted-foreground">Not set</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {status && <Badge variant={status.variant}>{status.label}</Badge>}
                    {row.vacated_on && row.status === "vacant" && (
                      <div className="mt-1 text-[11px] text-muted-foreground">
                        since {formatDate(row.vacated_on)}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label={`Actions for ${row.title}`}>
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => setViewing(row)}>
                          Assignment history
                        </DropdownMenuItem>
                        {canStaff && open && row.status !== "frozen" && (
                          <DropdownMenuItem onSelect={() => setAssigning(row)}>
                            Assign someone
                          </DropdownMenuItem>
                        )}
                        {canStaff && row.status === "filled" && (
                          <DropdownMenuItem onSelect={() => setVacating(row)}>
                            Vacate
                          </DropdownMenuItem>
                        )}
                        {canManage && open && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onSelect={() => setForm({ open: true, editing: row })}>
                              Edit
                            </DropdownMenuItem>
                            {row.status === "frozen" ? (
                              <DropdownMenuItem
                                onSelect={() => setStatusAction({ position: row, action: "unfreeze" })}
                              >
                                Unfreeze
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                onSelect={() => setStatusAction({ position: row, action: "freeze" })}
                              >
                                Freeze
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              className="text-destructive"
                              onSelect={() => setStatusAction({ position: row, action: "abolish" })}
                            >
                              Abolish
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </DataPanel>

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
