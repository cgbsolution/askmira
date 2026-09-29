"use client";

import { Building2, Info, MapPin, Network, Plus } from "lucide-react";
import { useMemo, useState } from "react";

import { DataPanel } from "@/components/common/DataPanel";
import { PageShell } from "@/components/common/PageShell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
  const canManage = hasRole("tenant_admin", "hr_admin");

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

          <DataPanel
            title="Legal entities"
            actions={
              canManage ? (
                <Button size="sm" onClick={() => setEntityForm({ open: true, editing: null })}>
                  <Plus /> Add entity
                </Button>
              ) : undefined
            }
            isLoading={entities.isLoading}
            error={entities.error?.detail ?? null}
            onRetry={entities.reload}
            isEmpty={(entities.data ?? []).length === 0}
            empty={{
              icon: Building2,
              title: "No legal entities yet",
              description: "Payroll cannot be run until at least one entity exists.",
            }}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Entity</TableHead>
                  <TableHead>PAN / TAN</TableHead>
                  <TableHead>PF / ESI</TableHead>
                  <TableHead>GSTIN</TableHead>
                  {canManage && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {(entities.data ?? []).map((row) => (
                  <TableRow key={row.id} className={row.is_active ? undefined : "opacity-60"}>
                    <TableCell>
                      <div className="font-medium text-foreground">{row.name}</div>
                      <div className="font-mono text-xs text-muted-foreground">{row.code}</div>
                      {!row.is_active && (
                        <Badge variant="outline" className="mt-1">
                          Inactive
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      <Missing value={row.pan} label="PAN" />
                      <br />
                      <Missing value={row.tan} label="TAN" />
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      <Missing value={row.pf_registration_no} label="PF" />
                      <br />
                      <Missing value={row.esi_registration_no} label="ESI" />
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      <Missing value={row.gstin} label="GSTIN" />
                    </TableCell>
                    {canManage && (
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEntityForm({ open: true, editing: row })}
                        >
                          Edit
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </DataPanel>
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

          <DataPanel
            title="Work locations"
            actions={
              canManage ? (
                <Button
                  size="sm"
                  onClick={() => setLocationForm({ open: true, editing: null })}
                  disabled={(entities.data ?? []).length === 0}
                >
                  <Plus /> Add location
                </Button>
              ) : undefined
            }
            isLoading={locations.isLoading}
            error={locations.error?.detail ?? null}
            onRetry={locations.reload}
            isEmpty={(locations.data ?? []).length === 0}
            empty={{
              icon: MapPin,
              title: "No locations yet",
              description:
                (entities.data ?? []).length === 0
                  ? "Add a legal entity first — every location belongs to one."
                  : "Employees are assigned to a location, which decides their state taxes.",
            }}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Location</TableHead>
                  <TableHead>Legal entity</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Timezone</TableHead>
                  {canManage && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {(locations.data ?? []).map((row) => (
                  <TableRow key={row.id} className={row.is_active ? undefined : "opacity-60"}>
                    <TableCell>
                      <div className="font-medium text-foreground">{row.name}</div>
                      <div className="text-xs text-muted-foreground">
                        <span className="font-mono">{row.code}</span>
                        {row.city && ` · ${row.city}`}
                        {row.pincode && ` ${row.pincode}`}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {entityName.get(row.legal_entity_id) ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono">
                        {row.state_code}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{row.timezone}</TableCell>
                    {canManage && (
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setLocationForm({ open: true, editing: row })}
                        >
                          Edit
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </DataPanel>
        </TabsContent>

        <TabsContent value="departments" className="mt-4">
          <DataPanel
            title="Departments"
            description="Departments nest. The tree is what reports, approvals and the org chart group by."
            actions={
              canManage ? (
                <Button size="sm" onClick={() => setDepartmentForm({ open: true, editing: null })}>
                  <Plus /> Add department
                </Button>
              ) : undefined
            }
            isLoading={departments.isLoading}
            error={departments.error?.detail ?? null}
            onRetry={departments.reload}
            isEmpty={(departments.data ?? []).length === 0}
            empty={{ icon: Network, title: "No departments yet" }}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Department</TableHead>
                  <TableHead>Parent</TableHead>
                  <TableHead>Status</TableHead>
                  {canManage && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {(departments.data ?? []).map((row) => (
                  <TableRow key={row.id} className={row.is_active ? undefined : "opacity-60"}>
                    <TableCell>
                      <div className="font-medium text-foreground">{row.name}</div>
                      <div className="font-mono text-xs text-muted-foreground">{row.code}</div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {row.parent_id ? (departmentName.get(row.parent_id) ?? "—") : "Top level"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={row.is_active ? "secondary" : "outline"}>
                        {row.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    {canManage && (
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDepartmentForm({ open: true, editing: row })}
                        >
                          Edit
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </DataPanel>
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

/** A registration number that is absent is a filing that will fail, so say so. */
function Missing({ value, label }: { value: string | null; label: string }) {
  if (value) return <span>{value}</span>;
  return (
    <span className="text-muted-foreground">
      {label} not set
    </span>
  );
}
