"use client";

import { Search, Users } from "lucide-react";
import Link from "next/link";
import React, { useEffect, useState } from "react";

import { DataPanel } from "@/components/common/DataPanel";
import { IconInput } from "@/components/common/IconInput";
import { PersonCell } from "@/components/common/PersonCell";
import { TablePager } from "@/components/common/TablePager";
import { DownloadButton } from "@/components/payroll-ops/shared";
import { useOrgReference } from "@/components/people/useOrgReference";
import { BalancesPanel } from "@/components/time/BalancesPanel";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useApiQuery } from "@/hooks/useApiQuery";
import type { TeamBalanceCell, TeamBalanceColumn, TeamBalanceRow, TeamBalances } from "@/lib/types";
import { cn, formatDays } from "@/lib/utils";

const PAGE_SIZE = 25;
const ANY = "any";

const isZero = (value: string) => /^-?0(\.0+)?$/.test(value);

/** Statutory and unpaid leave are not drawn down from a balance: count the days taken. */
const countsTaken = (column: TeamBalanceColumn) => !column.is_paid || column.is_statutory;

/**
 * Balances for a team at once: a manager's reporting line, or everybody for HR.
 *
 * One column per leave type, so the question "who still has leave, who has
 * run out" is answered without opening thirty profiles. Every figure is the
 * API's — the same computation as each person's own Time page — and a row
 * opens that person's cards and history.
 */
export function TeamBalancesTable({
  isHr,
  ownEmployeeId,
  version,
  onChanged,
}: {
  isHr: boolean;
  ownEmployeeId: string | null;
  version: number;
  onChanged: () => void;
}) {
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const [term, setTerm] = useState("");
  const [search, setSearch] = useState("");
  const [departmentId, setDepartmentId] = useState(ANY);
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<TeamBalanceRow | null>(null);
  const org = useOrgReference();

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(term.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [term]);

  const filters = new URLSearchParams({ year: String(year) });
  if (search) filters.set("q", search);
  if (departmentId !== ANY) filters.set("department_id", departmentId);
  const listParams = new URLSearchParams(filters);
  listParams.set("page", String(page));
  listParams.set("page_size", String(PAGE_SIZE));

  const list = useApiQuery<TeamBalances>(`/leave/balances/team?${listParams}`);
  const { reload } = list;
  useEffect(() => {
    if (version > 0) reload();
  }, [version, reload]);

  const data = list.data;
  const columns = data?.leave_types ?? [];
  const rows = data?.items ?? [];
  const total = data?.total ?? 0;
  const filtered = Boolean(search) || departmentId !== ANY;

  return (
    <>
      <DataPanel
        title={
          <span className="flex items-center gap-2">
            <Users className="size-4 text-muted-foreground" />
            {isHr ? "Everyone's balances" : "Your team's balances"}
          </span>
        }
        description={
          isHr
            ? "Every current employee, one column per leave type. Open a person for the history behind it."
            : "Everybody who reports to you, directly or through their manager."
        }
        toolbar={
          <div className="flex flex-wrap items-center gap-3">
            <IconInput
              icon={Search}
              aria-label="Search people"
              placeholder="Search by name or code"
              className="w-full sm:w-72"
              value={term}
              onChange={(event) => setTerm(event.target.value)}
            />
            {isHr && org.departments.length > 0 && (
              <Select
                value={departmentId}
                onValueChange={(value) => {
                  setDepartmentId(value);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-48" aria-label="Department">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY}>All departments</SelectItem>
                  {org.departments.map((department) => (
                    <SelectItem key={department.id} value={department.id}>
                      {department.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select
              value={String(year)}
              onValueChange={(value) => {
                setYear(Number(value));
                setPage(1);
              }}
            >
              <SelectTrigger className="w-24" aria-label="Leave year">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[thisYear - 1, thisYear, thisYear + 1].map((option) => (
                  <SelectItem key={option} value={String(option)}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="ml-auto">
              <DownloadButton
                path={`/leave/balances/team.csv?${filters}`}
                fallbackName={`leave-balances-${year}.csv`}
                label="Export CSV"
                size="default"
                disabled={total === 0}
              />
            </div>
          </div>
        }
        isLoading={list.isLoading && !data}
        error={list.error?.detail}
        onRetry={list.reload}
        isEmpty={rows.length === 0}
        empty={{
          icon: Users,
          title: filtered ? "Nobody matches" : "Nobody to show",
          description: filtered
            ? "Try another name, code or department."
            : isHr
              ? "Balances appear here once employees are added."
              : "People who report to you appear here.",
        }}
        footer={
          total > PAGE_SIZE ? (
            <TablePager
              paged={{
                offset: (page - 1) * PAGE_SIZE,
                page,
                pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
                total,
                pageSize: PAGE_SIZE,
                setPage,
              }}
              noun="people"
            />
          ) : undefined
        }
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-5">Employee</TableHead>
              {columns.map((column, index) => (
                <TableHead
                  key={column.leave_type_id}
                  className={cn("text-right whitespace-nowrap", index === columns.length - 1 && "pr-5")}
                >
                  <span className="block text-foreground">{column.name}</span>
                  <span className="block text-[11px] font-normal text-muted-foreground">
                    {countsTaken(column) ? "taken" : "available"}
                  </span>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const cells = new Map(row.balances.map((cell) => [cell.leave_type_id, cell]));
              return (
                <TableRow
                  key={row.employee_id}
                  className="cursor-pointer"
                  onClick={() => setOpen(row)}
                >
                  <TableCell className="pl-5">
                    {/* The row is clickable; the name is the keyboard's way in. */}
                    <Button
                      variant="ghost"
                      className="h-auto max-w-full justify-start p-0 text-left hover:bg-transparent"
                      aria-label={`${row.employee_name}: balances and history`}
                      onClick={(event) => {
                        event.stopPropagation();
                        setOpen(row);
                      }}
                    >
                      <PersonCell
                        name={row.employee_name}
                        photoUrl={row.photo_url}
                        size="sm"
                        subtitle={[row.employee_code, row.department_name ?? row.designation]
                          .filter(Boolean)
                          .join(" · ")}
                      />
                    </Button>
                  </TableCell>
                  {columns.map((column, index) => (
                    <TableCell
                      key={column.leave_type_id}
                      className={cn("text-right", index === columns.length - 1 && "pr-5")}
                    >
                      <BalanceFigure column={column} cell={cells.get(column.leave_type_id)} />
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </DataPanel>

      <Sheet open={open !== null} onOpenChange={(next) => !next && setOpen(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-3xl">
          {open && (
            <>
              <SheetHeader>
                <SheetTitle>{open.employee_name}&apos;s balances</SheetTitle>
                <SheetDescription>
                  {open.employee_code}
                  {open.designation ? ` · ${open.designation}` : ""} ·{" "}
                  <Link className="text-primary hover:underline" href={`/people/${open.employee_id}`}>
                    Open profile
                  </Link>
                </SheetDescription>
              </SheetHeader>
              <div className="px-4 pb-6">
                <BalancesPanel
                  isHr={isHr}
                  ownEmployeeId={ownEmployeeId}
                  fixed={{ id: open.employee_id, name: open.employee_name }}
                  version={version}
                  onChanged={() => {
                    list.reload();
                    onChanged();
                  }}
                />
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

function BalanceFigure({
  column,
  cell,
}: {
  column: TeamBalanceColumn;
  cell: TeamBalanceCell | undefined;
}) {
  // No policy covers this person for the type and nothing was ever posted.
  if (!cell) return <span className="text-muted-foreground">—</span>;

  if (countsTaken(column)) {
    return isZero(cell.used) ? (
      <span className="text-muted-foreground">—</span>
    ) : (
      <span className="text-foreground tabular-nums">{formatDays(cell.used)}</span>
    );
  }

  return (
    <span className="inline-flex flex-col items-end leading-tight">
      <span
        className={cn(
          "font-semibold tabular-nums",
          cell.available.startsWith("-") ? "text-destructive" : "text-foreground",
        )}
      >
        {formatDays(cell.available)}
      </span>
      <span className="text-[11px] text-muted-foreground tabular-nums">
        of {formatDays(cell.entitled)}
        {!isZero(cell.pending) && (
          <span className="text-warning"> · {formatDays(cell.pending)} pending</span>
        )}
      </span>
    </span>
  );
}
