"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { FolderKanban, Info, Network, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { DataTable } from "@/components/common/data-table/DataTable";
import type { ProjectRow } from "@/components/time/TimesheetScreen";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { useApiQuery } from "@/hooks/useApiQuery";
import { del } from "@/lib/api";
import type { Department, LegalEntity } from "@/lib/types/people";

import { FromDepartmentsDialog, ProjectDialog, projectLikeDepartments } from "./ProjectDialogs";
import { errorDetail } from "./settingsShared";

/**
 * Settings → Organisation → Projects.
 *
 * Where people work: a client's project (DXC INET, JK Paper, UIDAI…) or the
 * company's own (Internal). Under the legal entity, which still pays them and
 * files their returns. The same list timesheets log hours against. A person
 * is put on one from their profile, or several at once from People.
 */
export function ProjectsTab({
  canManage,
  projects,
  entities,
  departments,
  onDepartmentsChanged,
}: {
  canManage: boolean;
  projects: ReturnType<typeof useApiQuery<ProjectRow[]>>;
  entities: LegalEntity[];
  departments: Department[];
  onDepartmentsChanged: () => void;
}) {
  const [form, setForm] = useState<{ open: boolean; editing: ProjectRow | null }>({
    open: false,
    editing: null,
  });
  const [fromDepartments, setFromDepartments] = useState(false);
  const [deleting, setDeleting] = useState<ProjectRow | null>(null);

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
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setForm({ open: true, editing: row.original })}>
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  aria-label={`Delete ${row.original.name}`}
                  onClick={() => setDeleting(row.original)}
                >
                  <Trash2 /> Delete
                </Button>
              </div>
            ),
          } satisfies ColumnDef<ProjectRow>,
        ]
      : []),
  ];

  const reloadAll = () => {
    projects.reload();
    onDepartmentsChanged();
  };

  const remove = async () => {
    if (!deleting) return;
    try {
      await del(`/timesheets/projects/${deleting.id}`);
      toast.success(`${deleting.name} deleted.`);
      projects.reload();
    } catch (caught) {
      toast.error(errorDetail(caught, "The project could not be deleted."));
    }
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
            "Add Internal and each client project, or move departments like Internal and External here. Then put people on them from their profile.",
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
        preselected={projectLikeDepartments(departments, rows).map((row) => row.id)}
        onOpenChange={setFromDepartments}
        onDone={reloadAll}
      />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete ${deleting?.name ?? "this project"}?`}
        description="It is removed for good. Only a project nobody has been on can be deleted: one with people, payslips or timesheet hours is refused, and you can close it instead (Edit → Open off)."
        confirmLabel="Delete project"
        destructive
        onConfirm={remove}
      />
    </div>
  );
}
