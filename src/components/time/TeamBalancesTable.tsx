"use client";

import { Hourglass, Users } from "lucide-react";
import Link from "next/link";
import React, { useEffect, useState } from "react";

import { DataPanel } from "@/components/common/DataPanel";
import { PersonCell } from "@/components/common/PersonCell";
import { TablePager } from "@/components/common/TablePager";
import { PredictiveSearch, valueSuggestions } from "@/components/common/PredictiveSearch";
import { DownloadButton } from "@/components/payroll-ops/shared";
import { useOrgReference } from "@/components/people/useOrgReference";
import { BalancesPanel } from "@/components/time/BalancesPanel";
import { Badge } from "@/components/ui/badge";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApiQuery } from "@/hooks/useApiQuery";
import type {
  ProbationFilter,
  TeamBalanceCell,
  TeamBalanceColumn,
  TeamBalanceRow,
  TeamBalances,
} from "@/lib/types";
import { cn, formatDay, formatDays } from "@/lib/utils";

const PAGE_SIZE = 25;
const ANY = "any";
const EVERYONE = "everyone";
type ProbationTab = typeof EVERYONE | ProbationFilter;

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
  const [probation, setProbation] = useState<ProbationTab>(EVERYONE);
  // Kept across reloads so the probation tabs do not flicker while a page loads.
  const [probationInfo, setProbationInfo] = useState({ months: 0, count: 0 });
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
  if (probation !== EVERYONE) filters.set("probation", probation);
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

  useEffect(() => {
    if (data) setProbationInfo({ months: data.probation_months, count: data.on_probation });
  }, [data]);
  const probationMonths = probationInfo.months;
  const showProbation = probationMonths > 0;

  const emptyCopy =
    probation === "only"
      ? {
          title: filtered ? "Nobody matches" : "Nobody is on probation",
          description: `Everybody here has finished their first ${probationMonths} months.`,
        }
      : probation === "exclude"
        ? {
            title: filtered ? "Nobody matches" : "Everybody is still on probation",
            description: "People appear here once their probation ends.",
          }
        : {
            title: filtered ? "Nobody matches" : "Nobody to show",
            description: filtered
              ? "Try another name, code or department."
              : isHr
                ? "Balances appear here once employees are added."
                : "People who report to you appear here.",
          };

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
          (isHr
            ? "Every current employee, one column per leave type. Open a person for the history behind it."
            : "Everybody who reports to you, directly or through their manager.") +
          (showProbation
            ? ` People in their first ${probationMonths} month${
                probationMonths === 1 ? "" : "s"
              } are on probation and earn no leave until it ends.`
            : "")
        }
        toolbar={
          <div className="flex w-full min-w-0 flex-wrap items-center gap-3">
            {showProbation && (
              <Tabs
                className="max-w-full min-w-0"
                value={probation}
                onValueChange={(value) => {
                  setProbation(value as ProbationTab);
                  setPage(1);
                }}
              >
                {/* On a phone the three choices scroll inside the pill, not the page. */}
                <TabsList
                  aria-label="Probation"
                  className="max-w-full justify-start overflow-x-auto [&>[data-slot=tabs-trigger]]:px-3"
                >
                  <TabsTrigger value={EVERYONE}>Everyone</TabsTrigger>
                  <TabsTrigger value="only">
                    On probation
                    <Badge variant="warning" className="tabular-nums">
                      {probationInfo.count}
                    </Badge>
                  </TabsTrigger>
                  <TabsTrigger value="exclude">Past probation</TabsTrigger>
                </TabsList>
              </Tabs>
            )}
            <PredictiveSearch
              aria-label="Search people"
              placeholder="Search by name or code"
              wrapperClassName="w-full sm:w-72"
              value={term}
              onValueChange={setTerm}
              historyKey="leave-team-balances"
              suggestions={valueSuggestions(rows, {
                Name: (row) => row.employee_name,
                Code: (row) => row.employee_code,
                Department: (row) => row.department_name,
              })}
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
        empty={{ icon: probation === "only" ? Hourglass : Users, ...emptyCopy }}
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
                    <div className="flex flex-col items-start gap-1">
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
                      {row.probation_until && (
                        <Badge
                          variant="warning"
                          className="ml-9"
                          title={
                            row.date_of_joining
                              ? `Joined ${formatDay(row.date_of_joining, true)}`
                              : undefined
                          }
                        >
                          <Hourglass />
                          On probation · leave from {formatDay(row.probation_until, true)}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  {columns.map((column, index) => (
                    <TableCell
                      key={column.leave_type_id}
                      className={cn("text-right", index === columns.length - 1 && "pr-5")}
                    >
                      <BalanceFigure
                        column={column}
                        cell={cells.get(column.leave_type_id)}
                        onProbation={Boolean(row.probation_until)}
                      />
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
  onProbation,
}: {
  column: TeamBalanceColumn;
  cell: TeamBalanceCell | undefined;
  onProbation: boolean;
}) {
  // No policy covers this person for the type and nothing was ever posted.
  if (!cell) return <span className="text-muted-foreground">—</span>;

  // Nothing earned yet because probation holds it back. An HR credit still shows.
  if (
    onProbation &&
    !countsTaken(column) &&
    isZero(cell.entitled) &&
    isZero(cell.used) &&
    isZero(cell.pending)
  ) {
    return <span className="text-xs text-muted-foreground">On probation</span>;
  }

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
