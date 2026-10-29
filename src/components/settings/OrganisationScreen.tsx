"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { AlertTriangle, ArrowRightLeft, Building2, Info, MapPin, Network, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { DataTable } from "@/components/common/data-table/DataTable";
import { PageShell } from "@/components/common/PageShell";
import type { ProjectRow } from "@/components/time/TimesheetScreen";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/context/AuthContext";
import { useApiQuery } from "@/hooks/useApiQuery";
import { weeklyOffLabel } from "@/components/attendance/shared";
import { del } from "@/lib/api";
import type { Page } from "@/lib/types";
import type { Shift } from "@/lib/types/attendance";
import type { Department, DirectoryEmployee, LegalEntity, Location } from "@/lib/types/people";
import { initials } from "@/lib/utils";

import { DepartmentDialog } from "./DepartmentDialog";
import { LegalEntityDialog, salaryDaysLabel } from "./LegalEntityDialog";
import { LocationDialog } from "./LocationDialog";
import { FromDepartmentsDialog, projectLikeDepartments } from "./ProjectDialogs";
import { ProjectsTab } from "./ProjectsTab";
import { errorDetail } from "./settingsShared";

/**
 * Settings → Organisation.
 *
 * The three structures every other module resolves against: the legal entities
 * that file returns, the locations whose state decides professional tax and
 * holidays, and the department tree. None of them is cosmetic — a location's
 * state code changes what somebody is taxed — so each is edited deliberately
 * rather than inline.
 */
export function OrganisationScreen() {
  const { hasRole } = useAuth();
  const canManage = hasRole("admin");

  const entities = useApiQuery<LegalEntity[]>("/org/legal-entities");
  // People with no company: no payroll run pays them. Counted, not listed.
  const withoutCompany = useApiQuery<Page<DirectoryEmployee>>(
    "/employees?without_legal_entity=true&current=true&page_size=1",
  );
  const unplaced = withoutCompany.data?.total ?? 0;
  const locations = useApiQuery<Location[]>("/org/locations");
  const departments = useApiQuery<Department[]>("/org/departments");
  const projects = useApiQuery<ProjectRow[]>("/timesheets/projects?include_inactive=true");
  const shifts = useApiQuery<Shift[]>("/attendance/shifts?include_inactive=true");
  const shiftById = useMemo(
    () => new Map((shifts.data ?? []).map((row) => [row.id, row])),
    [shifts.data],
  );

  const [entityForm, setEntityForm] = useState<{ open: boolean; editing: LegalEntity | null }>({
    open: false,
    editing: null,
  });
  const [locationForm, setLocationForm] = useState<{ open: boolean; editing: Location | null }>({
    open: false,
    editing: null,
  });
  const [departmentForm, setDepartmentForm] = useState<{
    open: boolean;
    editing: Department | null;
  }>({ open: false, editing: null });
  const [deletingDepartment, setDeletingDepartment] = useState<Department | null>(null);
  const [movingToProjects, setMovingToProjects] = useState(false);
  // Internal / External / a client: where people work, so it belongs under Projects.
  const projectLike = useMemo(
    () => projectLikeDepartments(departments.data ?? [], projects.data ?? []),
    [departments.data, projects.data],
  );

  const deleteDepartment = async () => {
    if (!deletingDepartment) return;
    try {
      await del(`/org/departments/${deletingDepartment.id}`);
      toast.success(`${deletingDepartment.name} deleted.`);
      departments.reload();
    } catch (caught) {
      toast.error(errorDetail(caught, "The department could not be deleted."));
    }
  };

  const entityName = useMemo(
    () => new Map((entities.data ?? []).map((row) => [row.id, row.name])),
    [entities.data],
  );
  const departmentName = useMemo(
    () => new Map((departments.data ?? []).map((row) => [row.id, row.name])),
    [departments.data],
  );

  const entityEditColumn: ColumnDef<LegalEntity> = {
    id: "actions",
    header: "Actions",
    enableHiding: false,
    meta: { className: "text-right", text: false },
    cell: ({ row }) => (
      <Button variant="outline" size="sm" onClick={() => setEntityForm({ open: true, editing: row.original })}>
        Edit
      </Button>
    ),
  };
  const entityColumns: ColumnDef<LegalEntity>[] = [
    {
      accessorKey: "name",
      header: "Entity",
      meta: { text: (row) => [row.name, row.code, !row.is_active && "Inactive"].filter(Boolean).join(" · ") },
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <EntityLogo entity={row.original} />
          <div className="min-w-0">
            <div className="font-medium text-foreground">{row.original.name}</div>
            <div className="font-mono text-xs text-muted-foreground">{row.original.code}</div>
            {!row.original.is_active && (
              <Badge variant="outline" className="mt-1">
                Inactive
              </Badge>
            )}
          </div>
        </div>
      ),
    },
    {
      id: "people",
      header: "People",
      accessorFn: (row) => row.headcount ?? 0,
      meta: { className: "text-right", cellClassName: "tabular-nums" },
      cell: ({ row }) => (
        <Link
          href={`/people?company=${row.original.id}&status=current`}
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          {row.original.headcount ?? 0}
        </Link>
      ),
    },
    {
      id: "pan_tan",
      header: "PAN / TAN",
      accessorFn: (row) => `${registration(row.pan, "PAN")} / ${registration(row.tan, "TAN")}`,
      meta: { cellClassName: "font-mono text-xs" },
      cell: ({ row }) => (
        <>
          <Missing value={row.original.pan} label="PAN" />
          <br />
          <Missing value={row.original.tan} label="TAN" />
        </>
      ),
    },
    {
      id: "pf_esi",
      header: "PF / ESI",
      accessorFn: (row) =>
        `${registration(row.pf_registration_no, "PF")} / ${registration(row.esi_registration_no, "ESI")}`,
      meta: { cellClassName: "font-mono text-xs" },
      cell: ({ row }) => (
        <>
          <Missing value={row.original.pf_registration_no} label="PF" />
          <br />
          <Missing value={row.original.esi_registration_no} label="ESI" />
        </>
      ),
    },
    {
      id: "gstin",
      header: "GSTIN",
      accessorFn: (row) => registration(row.gstin, "GSTIN"),
      meta: { cellClassName: "font-mono text-xs" },
      cell: ({ row }) => <Missing value={row.original.gstin} label="GSTIN" />,
    },
    {
      id: "work_week",
      header: "Work week",
      accessorFn: (row) => {
        const shift = row.default_shift_id ? shiftById.get(row.default_shift_id) : undefined;
        return shift ? `${shift.name} · off ${weeklyOffLabel(shift)}` : "Workspace default";
      },
      cell: ({ row }) => {
        const shift = row.original.default_shift_id
          ? shiftById.get(row.original.default_shift_id)
          : undefined;
        if (!shift) return <span className="text-muted-foreground">Workspace default</span>;
        return (
          <>
            <div className="text-foreground">{shift.name}</div>
            <div className="text-xs text-muted-foreground">Off {weeklyOffLabel(shift)}</div>
          </>
        );
      },
    },
    {
      id: "salary_days",
      header: "Salary days",
      accessorFn: (row) => salaryDaysLabel(row),
    },
    ...(canManage ? [entityEditColumn] : []),
  ];

  const locationEditColumn: ColumnDef<Location> = {
    id: "actions",
    header: "Actions",
    enableHiding: false,
    meta: { className: "text-right", text: false },
    cell: ({ row }) => (
      <Button variant="outline" size="sm" onClick={() => setLocationForm({ open: true, editing: row.original })}>
        Edit
      </Button>
    ),
  };
  const locationColumns: ColumnDef<Location>[] = [
    {
      accessorKey: "name",
      header: "Location",
      meta: {
        text: (row) =>
          `${row.name} · ${row.code}${row.city ? ` · ${row.city}` : ""}${row.pincode ? ` ${row.pincode}` : ""}`,
      },
      cell: ({ row }) => (
        <>
          <div className="font-medium text-foreground">{row.original.name}</div>
          <div className="text-xs text-muted-foreground">
            <span className="font-mono">{row.original.code}</span>
            {row.original.city && ` · ${row.original.city}`}
            {row.original.pincode && ` ${row.original.pincode}`}
          </div>
        </>
      ),
    },
    {
      id: "legal_entity",
      header: "Legal entity",
      accessorFn: (row) => entityName.get(row.legal_entity_id) ?? "—",
      meta: { cellClassName: "text-sm" },
    },
    {
      accessorKey: "state_code",
      header: "State",
      cell: ({ row }) => (
        <Badge variant="outline" className="font-mono">
          {row.original.state_code}
        </Badge>
      ),
    },
    { accessorKey: "timezone", header: "Timezone", meta: { cellClassName: "text-xs text-muted-foreground" } },
    ...(canManage ? [locationEditColumn] : []),
  ];

  const departmentEditColumn: ColumnDef<Department> = {
    id: "actions",
    header: "Actions",
    enableHiding: false,
    meta: { className: "text-right", text: false },
    cell: ({ row }) => (
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={() => setDepartmentForm({ open: true, editing: row.original })}>
          Edit
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="text-destructive hover:text-destructive"
          aria-label={`Delete ${row.original.name}`}
          onClick={() => setDeletingDepartment(row.original)}
        >
          <Trash2 /> Delete
        </Button>
      </div>
    ),
  };
  const departmentColumns: ColumnDef<Department>[] = [
    {
      accessorKey: "name",
      header: "Department",
      meta: { text: (row) => `${row.name} · ${row.code}` },
      cell: ({ row }) => (
        <>
          <div className="font-medium text-foreground">{row.original.name}</div>
          <div className="font-mono text-xs text-muted-foreground">{row.original.code}</div>
        </>
      ),
    },
    {
      id: "parent",
      header: "Parent",
      accessorFn: (row) => (row.parent_id ? (departmentName.get(row.parent_id) ?? "—") : "Top level"),
      meta: { cellClassName: "text-sm text-muted-foreground" },
    },
    {
      id: "status",
      header: "Status",
      accessorFn: (row) => (row.is_active ? "Active" : "Inactive"),
      cell: ({ row }) => (
        <Badge variant={row.original.is_active ? "secondary" : "outline"}>
          {row.original.is_active ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    ...(canManage ? [departmentEditColumn] : []),
  ];

  return (
    <PageShell
      title="Organisation"
      description="Legal entities, projects, work locations and departments — the structures every other module resolves against."
    >
      <Tabs defaultValue="entities">
        <TabsList>
          <TabsTrigger value="entities">Legal entities</TabsTrigger>
          <TabsTrigger value="projects">Projects</TabsTrigger>
          <TabsTrigger value="locations">Locations</TabsTrigger>
          <TabsTrigger value="departments">Departments</TabsTrigger>
        </TabsList>

        <TabsContent value="entities" className="mt-4 flex flex-col gap-4">
          <Alert>
            <Info />
            <AlertTitle>One legal entity per company of your group</AlertTitle>
            <AlertDescription>
              Add each company your people work for — your own, a sister company, or a client
              whose staff you employ. Each one has its own payroll run, files PF, ESI,
              professional tax and TDS under its own registration numbers, and shows its own
              logo to its people after they sign in. Put people in a company on their record, or
              many at once from People → Employees: tick them, then Move to company. A client
              whose staff are on your payroll can carry your registration numbers; an entity with
              none produces a return the portal will reject.
            </AlertDescription>
          </Alert>

          {unplaced > 0 && (
            <Alert variant="warning">
              <AlertTriangle />
              <AlertTitle>
                {unplaced} {unplaced === 1 ? "person has" : "people have"} no company
              </AlertTitle>
              <AlertDescription>
                <span>
                  No payroll run pays them and their returns are filed nowhere until they are put
                  in one.{" "}
                  <Link
                    href="/people?company=none&status=current"
                    className="font-medium underline underline-offset-4"
                  >
                    Show them
                  </Link>
                </span>
              </AlertDescription>
            </Alert>
          )}

          <DataTable
            title="Legal entities"
            columns={entityColumns}
            data={entities.data ?? []}
            noun="entities"
            exportName="legal-entities"
            searchPlaceholder="Search entities"
            rowClassName={(row) => (row.is_active ? undefined : "opacity-60")}
            actions={
              canManage ? (
                <Button size="sm" className="h-9" onClick={() => setEntityForm({ open: true, editing: null })}>
                  <Plus /> Add entity
                </Button>
              ) : undefined
            }
            isLoading={entities.isLoading}
            error={entities.error?.detail}
            onRetry={entities.reload}
            empty={{
              icon: Building2,
              title: "No legal entities yet",
              description: "Payroll cannot be run until at least one entity exists.",
            }}
          />
        </TabsContent>

        <TabsContent value="locations" className="mt-4 flex flex-col gap-4">
          <Alert>
            <Info />
            <AlertTitle>The state code is a tax decision</AlertTitle>
            <AlertDescription>
              Professional tax slabs, labour welfare fund months and the public holiday list all
              follow the location&apos;s state. Changing it changes what people at that location
              are deducted.
            </AlertDescription>
          </Alert>

          <DataTable
            title="Work locations"
            columns={locationColumns}
            data={locations.data ?? []}
            noun="locations"
            exportName="work-locations"
            searchPlaceholder="Search locations"
            rowClassName={(row) => (row.is_active ? undefined : "opacity-60")}
            actions={
              canManage ? (
                <Button
                  size="sm"
                  className="h-9"
                  onClick={() => setLocationForm({ open: true, editing: null })}
                  disabled={(entities.data ?? []).length === 0}
                >
                  <Plus /> Add location
                </Button>
              ) : undefined
            }
            isLoading={locations.isLoading}
            error={locations.error?.detail}
            onRetry={locations.reload}
            empty={{
              icon: MapPin,
              title: "No locations yet",
              description:
                (entities.data ?? []).length === 0
                  ? "Add a legal entity first — every location belongs to one."
                  : "Employees are assigned to a location, which decides their state taxes.",
            }}
          />
        </TabsContent>

        <TabsContent value="projects" className="mt-4">
          <ProjectsTab
            canManage={canManage}
            projects={projects}
            entities={entities.data ?? []}
            departments={departments.data ?? []}
            onDepartmentsChanged={departments.reload}
          />
        </TabsContent>

        <TabsContent value="departments" className="mt-4 flex flex-col gap-4">
          {projectLike.length > 0 ? (
            <Alert variant="warning">
              <AlertTriangle />
              <AlertTitle>
                {projectLike.map((row) => row.name).join(", ")}{" "}
                {projectLike.length === 1 ? "is a project, not a department" : "are projects, not departments"}
              </AlertTitle>
              <AlertDescription>
                <p>
                  Departments are for functions like HR, IT and Finance; Internal, External and
                  client names say where people work, so they belong under Projects. Moving them
                  makes each a project, puts its people on it and removes the department.
                </p>
                {canManage && (
                  <Button size="sm" className="mt-3 h-9" onClick={() => setMovingToProjects(true)}>
                    <ArrowRightLeft /> Move {projectLike.length === 1 ? "it" : "them"} to Projects
                  </Button>
                )}
              </AlertDescription>
            </Alert>
          ) : (
            <Alert>
              <Info />
              <AlertTitle>Departments are what people do; projects are where they work</AlertTitle>
              <AlertDescription>
                HR, IT, Finance… go here. Internal and client projects go on the Projects tab, and
                each person&apos;s project is set on their profile.
              </AlertDescription>
            </Alert>
          )}
          <DataTable
            title="Departments"
            description="Departments nest. The tree is what reports, approvals and the org chart group by."
            columns={departmentColumns}
            data={departments.data ?? []}
            noun="departments"
            exportName="departments"
            searchPlaceholder="Search departments"
            rowClassName={(row) => (row.is_active ? undefined : "opacity-60")}
            actions={
              canManage ? (
                <Button
                  size="sm"
                  className="h-9"
                  onClick={() => setDepartmentForm({ open: true, editing: null })}
                >
                  <Plus /> Add department
                </Button>
              ) : undefined
            }
            isLoading={departments.isLoading}
            error={departments.error?.detail}
            onRetry={departments.reload}
            empty={{ icon: Network, title: "No departments yet" }}
          />
        </TabsContent>
      </Tabs>

      <LegalEntityDialog
        open={entityForm.open}
        editing={entityForm.editing}
        shifts={shifts.data ?? []}
        onOpenChange={(open) => setEntityForm({ open, editing: open ? entityForm.editing : null })}
        onSaved={entities.reload}
      />
      <LocationDialog
        open={locationForm.open}
        editing={locationForm.editing}
        entities={entities.data ?? []}
        onOpenChange={(open) =>
          setLocationForm({ open, editing: open ? locationForm.editing : null })
        }
        onSaved={locations.reload}
      />
      <DepartmentDialog
        open={departmentForm.open}
        editing={departmentForm.editing}
        departments={departments.data ?? []}
        onOpenChange={(open) =>
          setDepartmentForm({ open, editing: open ? departmentForm.editing : null })
        }
        onSaved={departments.reload}
      />
      <ConfirmDialog
        open={deletingDepartment !== null}
        onOpenChange={(open) => !open && setDeletingDepartment(null)}
        title={`Delete ${deletingDepartment?.name ?? "this department"}?`}
        description="It is removed for good, and people who have left lose it from their record. If anyone still works in it, or a department, position, budget or approval rule uses it, you are told what and nothing changes."
        confirmLabel="Delete department"
        destructive
        onConfirm={deleteDepartment}
      />
      <FromDepartmentsDialog
        open={movingToProjects}
        departments={departments.data ?? []}
        preselected={projectLike.map((row) => row.id)}
        onOpenChange={setMovingToProjects}
        onDone={() => {
          departments.reload();
          projects.reload();
        }}
      />
    </PageShell>
  );
}

/** The company's logo on a light plate, or its initials. */
function EntityLogo({ entity }: { entity: LegalEntity }) {
  return (
    <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-logo-plate p-1">
      {entity.logo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={entity.logo_url} alt="" className="max-h-full max-w-full object-contain" />
      ) : (
        <span aria-hidden className="text-xs font-bold text-logo-plate-foreground">
          {initials(entity.name)}
        </span>
      )}
    </span>
  );
}

/** A registration number as the search and the CSV read it: the number, or that it is not set. */
function registration(value: string | null, label: string): string {
  return value || `${label} not set`;
}

/** A registration number that is absent is a filing that will fail, so say so. */
function Missing({ value, label }: { value: string | null; label: string }) {
  if (value) return <span>{value}</span>;
  return (
    <span className="text-muted-foreground">
      {label} not set
    </span>
  );
}
