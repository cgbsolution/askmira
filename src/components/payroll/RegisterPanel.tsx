"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { FolderKanban, Users } from "lucide-react";
import Link from "next/link";
import React, { useMemo } from "react";

import { DataTable } from "@/components/common/data-table/DataTable";
import { Money } from "@/components/common/Money";
import { isImported, isZero } from "@/components/payroll/labels";
import { RegisterDownloadMenu } from "@/components/payroll/RegisterDownloadMenu";
import { Badge } from "@/components/ui/badge";
import { useApiQuery } from "@/hooks/useApiQuery";
import type { RegisterRow, RunRegister } from "@/lib/types/payroll";
import { formatDays } from "@/lib/utils";

type MoneyKey = keyof RunRegister["rows"][number] & string;

const MONEY_COLUMNS: { key: MoneyKey; label: string }[] = [
  { key: "gross_earnings", label: "Gross" },
  { key: "other_earnings", label: "Other pay" },
  { key: "pf_employee", label: "PF" },
  { key: "vpf", label: "VPF" },
  { key: "esi_employee", label: "ESI" },
  { key: "professional_tax", label: "PT" },
  { key: "lwf_employee", label: "LWF" },
  { key: "tds", label: "TDS" },
  { key: "other_deductions", label: "Other deductions" },
  { key: "net_pay", label: "Net pay" },
  { key: "employer_cost", label: "Employer cost" },
];

/** Shown only when a row has one, so the deduction columns still add up when someone pays VPF. */
const ONLY_WHEN_USED: ReadonlySet<MoneyKey> = new Set(["vpf"]);

const REGISTER_TEXT_HINT = "As written in the factoHR register; not matched to an AskMira project";

/**
 * The project shown for a row. An imported payslip whose register account was
 * not matched to a project shows the register's own client text, never the
 * person's project today.
 */
function projectOf(row: RegisterRow, imported: boolean): { label: string; fromRegister: boolean } {
  if (row.project_name) return { label: row.project_name, fromRegister: false };
  if (!imported) return { label: "No project", fromRegister: false };
  const client = row.import_summary?.client?.trim();
  return { label: client || "Not recorded", fromRegister: Boolean(client) };
}

/** Everyone on the run, with a drill-down to each payslip's full trace. */
export function RegisterPanel({ runId, version }: { runId: string; version: number }) {
  const { data, error, isLoading, reload } = useApiQuery<RunRegister>(
    `/payroll/runs/${runId}/register?v=${version}`,
  );
  const rows = data?.rows ?? [];
  const imported = isImported(data?.run);
  const moneyColumns = MONEY_COLUMNS.filter(
    (column) => !ONLY_WHEN_USED.has(column.key) || rows.some((row) => !isZero(String(row[column.key]))),
  );

  const columns: ColumnDef<RegisterRow>[] = [
    {
      accessorKey: "employee_name",
      header: "Employee",
      meta: { text: (row) => `${row.employee_name} ${row.employee_code}` },
      cell: ({ row }) => (
        <>
          <Link
            href={`/payroll/runs/${runId}/payslips/${row.original.payslip_id}`}
            className="font-medium text-foreground hover:underline"
          >
            {row.original.employee_name}
          </Link>
          <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
            {row.original.employee_code}
            {row.original.has_variance && <Badge variant="warning">Variance</Badge>}
            {row.original.review_flags.length > 0 && <Badge variant="destructive">Review</Badge>}
            {row.original.skipped_recoveries > 0 && <Badge variant="muted">Recovery held</Badge>}
            {!isZero(row.original.not_employed_days) && (
              <Badge variant="muted">Not employed: {formatDays(row.original.not_employed_days)} days</Badge>
            )}
          </div>
        </>
      ),
      footer: () => <span className="font-semibold">Total</span>,
    },
    {
      id: "project",
      header: "Project",
      accessorFn: (row) => projectOf(row, imported).label,
      meta: { cellClassName: "text-muted-foreground" },
      cell: ({ row }) => {
        const project = projectOf(row.original, imported);
        return project.fromRegister ? (
          <span className="italic" title={REGISTER_TEXT_HINT}>
            {project.label}
          </span>
        ) : (
          project.label
        );
      },
      footer: () => null,
    },
    {
      accessorKey: "paid_days",
      header: "Paid days",
      meta: {
        className: "text-right",
        cellClassName: "tabular-nums",
        text: (row) => `${formatDays(row.paid_days)}/${formatDays(row.working_days)}`,
      },
      cell: ({ row }) => `${formatDays(row.original.paid_days)}/${formatDays(row.original.working_days)}`,
      footer: () => null,
    },
    ...moneyColumns.map(
      (column): ColumnDef<RegisterRow> => ({
        id: column.key,
        header: column.label,
        accessorFn: (row) => String(row[column.key]),
        meta: { className: "text-right" },
        cell: ({ row }) => <Money value={String(row.original[column.key])} currency={false} />,
        footer: () =>
          data ? <Money value={data.totals[column.key]} currency={false} className="font-semibold" /> : null,
      }),
    ),
  ];

  return (
    <div className="flex flex-col gap-4">
      <ByProject rows={rows} imported={imported} />
    <DataTable
      title="Register"
      description={
        imported
          ? "Every payslip on this run, as paid on factoHR. A project in italics is the register's own client text. The download is recorded in the audit log."
          : "Every payslip on this run. The download is recorded in the audit log."
      }
      columns={columns}
      data={rows}
      getRowId={(row) => row.payslip_id}
      noun="payslips"
      // The register leaves only through the audited download below.
      exportName={false}
      searchPlaceholder="Search by name or code"
      actions={
        rows.length > 0 ? (
          <RegisterDownloadMenu run={{ id: runId, employee_count: rows.length }} size="sm" />
        ) : undefined
      }
      isLoading={isLoading && !data}
      error={error?.detail}
      onRetry={reload}
      empty={{
        icon: Users,
        title: "No payslips yet",
        description: "Payslips appear here once the run is computed.",
      }}
    />
    </div>
  );
}

/** "1234.56" -> 123456. */
function paise(value: string): number {
  return Math.round(Number(value) * 100);
}

/** 123456 -> "1234.56". */
function rupees(value: number): string {
  return (value / 100).toFixed(2);
}

interface ProjectTotal {
  key: string;
  project: string;
  people: number;
  gross: number;
  net: number;
  cost: number;
}

/**
 * The run by project: what each client's project (and Internal) cost this
 * month. Shown once a run has more than one project on it.
 */
function ByProject({ rows, imported }: { rows: RegisterRow[]; imported: boolean }) {
  const totals = useMemo(() => {
    const groups = new Map<string, ProjectTotal>();
    for (const row of rows) {
      const project = projectOf(row, imported);
      // Imported rows with no matched project group by the register's client text.
      const key = row.project_id ?? (project.fromRegister ? `register:${project.label.toLowerCase()}` : "none");
      const group = groups.get(key) ?? {
        key,
        project: project.fromRegister ? `${project.label} (register text)` : project.label,
        people: 0,
        gross: 0,
        net: 0,
        cost: 0,
      };
      group.people += 1;
      // Summed in whole paise, so the totals never drift by a fraction.
      group.gross += paise(row.gross_earnings) + paise(row.other_earnings);
      group.net += paise(row.net_pay);
      group.cost += paise(row.employer_cost);
      groups.set(key, group);
    }
    return [...groups.values()].sort((a, b) => b.cost - a.cost);
  }, [rows, imported]);

  if (totals.length < 2) return null;

  const columns: ColumnDef<ProjectTotal>[] = [
    { accessorKey: "project", header: "Project", meta: { cellClassName: "font-medium text-foreground" } },
    { accessorKey: "people", header: "People", meta: { className: "text-right", cellClassName: "tabular-nums" } },
    {
      accessorKey: "gross",
      header: "Gross pay",
      meta: { className: "text-right", text: (row) => rupees(row.gross) },
      cell: ({ row }) => <Money value={rupees(row.original.gross)} currency={false} />,
    },
    {
      accessorKey: "net",
      header: "Net pay",
      meta: { className: "text-right", text: (row) => rupees(row.net) },
      cell: ({ row }) => <Money value={rupees(row.original.net)} currency={false} />,
    },
    {
      accessorKey: "cost",
      header: "Cost to company",
      meta: { className: "text-right", text: (row) => rupees(row.cost) },
      cell: ({ row }) => <Money value={rupees(row.original.cost)} currency={false} />,
    },
  ];

  return (
    <DataTable
      title="By project"
      description="What each project's people cost this month: gross pay, net pay and cost to company."
      columns={columns}
      data={totals}
      getRowId={(row) => row.key}
      noun="projects"
      exportName="payroll-by-project"
      selectable={false}
      searchPlaceholder={false}
      paginate={false}
      empty={{ icon: FolderKanban, title: "No projects" }}
    />
  );
}
