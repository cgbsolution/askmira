"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Building2, Info, MapPin, Network, Plus } from "lucide-react";
import { useMemo, useState } from "react";

import { DataTable } from "@/components/common/data-table/DataTable";
import { PageShell } from "@/components/common/PageShell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/context/AuthContext";
import { useApiQuery } from "@/hooks/useApiQuery";
import type { Department, LegalEntity, Location } from "@/lib/types/people";

import { DepartmentDialog } from "./DepartmentDialog";
import { LegalEntityDialog } from "./LegalEntityDialog";
import { LocationDialog } from "./LocationDialog";

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
  const locations = useApiQuery<Location[]>("/org/locations");
  const departments = useApiQuery<Department[]>("/org/departments");

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
        <>
          <div className="font-medium text-foreground">{row.original.name}</div>
          <div className="font-mono text-xs text-muted-foreground">{row.original.code}</div>
          {!row.original.is_active && (
            <Badge variant="outline" className="mt-1">
              Inactive
            </Badge>
          )}
        </>
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
      <Button variant="outline" size="sm" onClick={() => setDepartmentForm({ open: true, editing: row.original })}>
        Edit
      </Button>
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
      description="Legal entities, work locations and departments — the structures every other module resolves against."
    >
      <Tabs defaultValue="entities">
        <TabsList>
          <TabsTrigger value="entities">Legal entities</TabsTrigger>
          <TabsTrigger value="locations">Locations</TabsTrigger>
          <TabsTrigger value="departments">Departments</TabsTrigger>
        </TabsList>

        <TabsContent value="entities" className="mt-4 flex flex-col gap-4">
          <Alert>
            <Info />
            <AlertTitle>A legal entity is who files</AlertTitle>
            <AlertDescription>
              PF, ESI, professional tax and TDS returns are filed per entity, under its own
              registration numbers. An employee&apos;s entity comes from their location, so an
              entity with no registration number produces a return the portal will reject.
            </AlertDescription>
          </Alert>

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

        <TabsContent value="departments" className="mt-4">
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
    </PageShell>
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
