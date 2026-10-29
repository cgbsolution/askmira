"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { FileSpreadsheet, FolderKanban, Info, Network, Plus } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { DataTable } from "@/components/common/data-table/DataTable";
import type { ProjectRow } from "@/components/time/TimesheetScreen";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useApiQuery } from "@/hooks/useApiQuery";
import type { Department, LegalEntity } from "@/lib/types/people";

import { AssignFromSheetDialog, FromDepartmentsDialog, ProjectDialog } from "./ProjectDialogs";

/**
 * Settings → Organisation → Projects.
 *
 * Where people work: a client's project (DXC INET, JK Paper, UIDAI…) or the
 * company's own (Internal). Under the legal entity, which still pays them and
 * files their returns. The same list timesheets log hours against.
 */
export function ProjectsTab({
  canManage,
  entities,
  departments,
  onDepartmentsChanged,
}: {
  canManage: boolean;
  entities: LegalEntity[];
  departments: Department[];
  onDepartmentsChanged: () => void;
}) {
  const projects = useApiQuery<ProjectRow[]>("/timesheets/projects?include_inactive=true");
  const [form, setForm] = useState<{ open: boolean; editing: ProjectRow | null }>({
    open: false,
    editing: null,
  });
  const [fromDepartments, setFromDepartments] = useState(false);
  const [fromSheet, setFromSheet] = useState(false);

  const entityName = useMemo(() => new Map(entities.map((row) => [row.id, row.name])), [entities]);
  const rows = projects.data ?? [];
  const onClient = rows.filter((row) => row.billable).reduce((sum, row) => sum + (row.headcount ?? 0), 0);
  const internal = rows.filter((row) => !row.billable).reduce((sum, row) => sum + (row.headcount ?? 0), 0);

  const columns: ColumnDef<ProjectRow>[] = [
    {
      accessorKey: "name",
      header: "Project",
      meta: { text: (row) => `${row.name} · ${row.code}${row.active ? "" : " · Closed"}` },
      cell: ({ row }) => (
        <>
          <div className="font-medium text-foreground">{row.original.name}</div>
          <div className="font-mono text-xs text-muted-foreground">{row.original.code}</div>
        </>
      ),
    },
    {
      id: "type",
      header: "Type",
      accessorFn: (row) => (row.billable ? "Client project" : "Internal"),
      cell: ({ row }) =>
        row.original.billable ? (
          <Badge variant="secondary">Client project</Badge>
        ) : (
          <Badge variant="outline">Internal</Badge>
        ),
    },
    {
      id: "client",
      header: "Client",
      accessorFn: (row) => row.client ?? "—",
      meta: { cellClassName: "text-muted-foreground" },
    },
    {
      id: "company",
      header: "Company",
      accessorFn: (row) => (row.legal_entity_id ? (entityName.get(row.legal_entity_id) ?? "—") : "—"),
      meta: { cellClassName: "text-muted-foreground" },
    },
    {
      id: "people",
      header: "People",
      accessorFn: (row) => row.headcount ?? 0,
      meta: { className: "text-right", cellClassName: "tabular-nums" },
      cell: ({ row }) => (
        <Link
          href={`/people?project=${row.original.id}&status=current`}
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          {row.original.headcount ?? 0}
        </Link>
      ),
    },
    {
      id: "status",
      header: "Status",
      accessorFn: (row) => (row.active ? "Open" : "Closed"),
      cell: ({ row }) => (
        <Badge variant={row.original.active ? "success" : "muted"}>{row.original.active ? "Open" : "Closed"}</Badge>
      ),
    },
    ...(canManage
      ? [
          {
            id: "actions",
            header: "Actions",
            enableHiding: false,
            meta: { className: "text-right", text: false },
            cell: ({ row }) => (
              <Button variant="outline" size="sm" onClick={() => setForm({ open: true, editing: row.original })}>
                Edit
              </Button>
            ),
          } satisfies ColumnDef<ProjectRow>,
        ]
      : []),
  ];

  const reloadAll = () => {
    projects.reload();
    onDepartmentsChanged();
  };

  return (
    <div className="flex flex-col gap-4">
      <Alert>
        <Info />
        <AlertTitle>A project is where somebody works</AlertTitle>
        <AlertDescription>
          Your legal entity employs and pays everyone; most of them work on a client&apos;s project
          (DXC, JK Paper, UIDAI…), the rest are Internal. Put each person on their project: the
          directory, reports and the salary register group them by it, and their payroll stays with
          their company.
          {rows.length > 0 && ` Right now ${onClient} on client projects and ${internal} Internal.`}
        </AlertDescription>
      </Alert>

      <DataTable
        title="Projects"
        columns={columns}
        data={rows}
        noun="projects"
        exportName="projects"
        searchPlaceholder="Search projects"
        rowClassName={(row) => (row.active ? undefined : "opacity-60")}
        actions={
          canManage ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" className="h-9" onClick={() => setFromDepartments(true)}>
                <Network /> From departments
              </Button>
              <Button size="sm" variant="outline" className="h-9" onClick={() => setFromSheet(true)}>
                <FileSpreadsheet /> From a sheet
              </Button>
              <Button size="sm" className="h-9" onClick={() => setForm({ open: true, editing: null })}>
                <Plus /> Add project
              </Button>
            </div>
          ) : undefined
        }
        isLoading={projects.isLoading}
        error={projects.error?.detail}
        onRetry={projects.reload}
        empty={{
          icon: FolderKanban,
          title: "No projects yet",
          description:
            "Add Internal and each client project, make them from departments, or upload your old salary register.",
        }}
      />

      <ProjectDialog
        open={form.open}
        editing={form.editing}
        entities={entities}
        onOpenChange={(open) => setForm({ open, editing: open ? form.editing : null })}
        onSaved={projects.reload}
      />
      <FromDepartmentsDialog
        open={fromDepartments}
        departments={departments}
        onOpenChange={setFromDepartments}
        onDone={reloadAll}
      />
      <AssignFromSheetDialog open={fromSheet} onOpenChange={setFromSheet} onDone={projects.reload} />
    </div>
  );
}
