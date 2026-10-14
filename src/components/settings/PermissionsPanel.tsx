"use client";

import { Info, Loader2, RotateCcw, Save, ShieldCheck, SlidersHorizontal } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { DataPanel } from "@/components/common/DataPanel";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApiQuery } from "@/hooks/useApiQuery";
import { ApiError, del, put } from "@/lib/api";

const RIGHT_LABEL: Record<string, string> = {
  can_view: "View",
  can_create: "Create",
  can_edit: "Edit",
  can_delete: "Delete",
  can_approve: "Approve",
  can_export: "Export",
};

type Rights = Record<string, boolean>;

interface AccessOverview {
  areas: Array<{ key: string; description: string }>;
  rights: string[];
  role: string;
  role_rights: Record<string, Rights>;
  people: Array<{
    user_id: string;
    full_name: string;
    email: string;
    rights: Record<string, Rights>;
    scope: { department_ids: string[]; location_ids: string[] } | null;
  }>;
  note: string;
}

interface OrgOption {
  id: string;
  name: string;
}

function full(rights: string[]): Rights {
  return Object.fromEntries(rights.map((right) => [right, true]));
}

function failure(caught: unknown, fallback: string): string {
  return caught instanceof ApiError ? caught.detail : fallback;
}

/**
 * What HR operators (sub-admins) may do, by area and right, and whose records
 * they cover. Enforced by the API on every request: a withheld right makes the
 * sub-admin an ordinary employee for that action. Admins are never narrowed.
 */
export function PermissionsPanel() {
  const { data, error, isLoading, reload } = useApiQuery<AccessOverview>("/admin/access");

  return (
    <div className="flex flex-col gap-4">
      <Alert>
        <Info />
        <AlertTitle>The API enforces this on every request</AlertTitle>
        <AlertDescription>
          {data?.note ??
            "No row means full HR rights in that area. A person's own rights win over the role's. Admins are never narrowed."}{" "}
          Each change asks you to confirm it is you, and is recorded in the audit trail.
        </AlertDescription>
      </Alert>
      <Tabs defaultValue="role">
        <TabsList>
          <TabsTrigger value="role">Sub-admin role</TabsTrigger>
          <TabsTrigger value="people">People</TabsTrigger>
        </TabsList>
        <TabsContent value="role" className="mt-4">
          <DataPanel
            tier="tier1"
            title="What every sub-admin may do"
            description="Per area. Untick a right to withhold it from every sub-admin, unless a person has their own rights."
            isLoading={isLoading}
            error={error?.detail ?? null}
            onRetry={reload}
          >
            {data && <RoleMatrix overview={data} onChanged={reload} />}
          </DataPanel>
        </TabsContent>
        <TabsContent value="people" className="mt-4">
          <DataPanel
            tier="tier1"
            title="Sub-admins"
            description="Give one person different rights, or limit them to some departments or locations."
            isLoading={isLoading}
            error={error?.detail ?? null}
            onRetry={reload}
            isEmpty={(data?.people ?? []).length === 0}
            empty={{ icon: ShieldCheck, title: "No sub-admins", description: "Give somebody the sub-admin role under Users & roles first." }}
          >
            {data && <PeopleTable overview={data} onChanged={reload} />}
          </DataPanel>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function RightsRow({
  area,
  description,
  rights,
  value,
  isDefault,
  busy,
  onToggle,
  onSave,
  onReset,
  dirty,
}: {
  area: string;
  description: string;
  rights: string[];
  value: Rights;
  isDefault: boolean;
  busy: boolean;
  onToggle: (right: string, on: boolean) => void;
  onSave: () => void;
  onReset: () => void;
  dirty: boolean;
}) {
  return (
    <TableRow>
      <TableCell>
        <div className="font-medium capitalize text-foreground">{area}</div>
        <div className="max-w-xs text-xs text-muted-foreground">{description}</div>
        {isDefault && !dirty && (
          <Badge variant="muted" className="mt-1">
            Default: full
          </Badge>
        )}
      </TableCell>
      {rights.map((right) => (
        <TableCell key={right} className="text-center">
          <Checkbox
            aria-label={`${area} ${RIGHT_LABEL[right] ?? right}`}
            checked={value[right] ?? false}
            onCheckedChange={(on) => onToggle(right, on === true)}
          />
        </TableCell>
      ))}
      <TableCell className="text-right">
        <div className="flex justify-end gap-1">
          <Button size="sm" disabled={!dirty || busy} onClick={onSave}>
            {busy ? <Loader2 className="animate-spin" /> : <Save />} Save
          </Button>
          {!isDefault && (
            <Button size="sm" variant="ghost" disabled={busy} onClick={onReset} aria-label={`Reset ${area}`}>
              <RotateCcw />
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}

function RoleMatrix({ overview, onChanged }: { overview: AccessOverview; onChanged: () => void }) {
  const initial = useMemo(
    () =>
      Object.fromEntries(
        overview.areas.map((area) => [area.key, overview.role_rights[area.key] ?? full(overview.rights)]),
      ) as Record<string, Rights>,
    [overview],
  );
  const [draft, setDraft] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => setDraft(initial), [initial]);

  const save = async (area: string) => {
    setBusy(area);
    try {
      await put(`/admin/access/role/${area}`, draft[area]);
      toast.success(`Sub-admin rights in ${area} saved.`);
      onChanged();
    } catch (caught) {
      toast.error(failure(caught, "The rights could not be saved."));
    } finally {
      setBusy(null);
    }
  };

  const reset = async (area: string) => {
    setBusy(area);
    try {
      await del(`/admin/access/role/${area}`);
      toast.success(`Sub-admins have full rights in ${area} again.`);
      onChanged();
    } catch (caught) {
      toast.error(failure(caught, "The rights could not be reset."));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Area</TableHead>
            {overview.rights.map((right) => (
              <TableHead key={right} className="text-center">
                {RIGHT_LABEL[right] ?? right}
              </TableHead>
            ))}
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {overview.areas.map((area) => (
            <RightsRow
              key={area.key}
              area={area.key}
              description={area.description}
              rights={overview.rights}
              value={draft[area.key] ?? {}}
              isDefault={!overview.role_rights[area.key]}
              busy={busy === area.key}
              dirty={JSON.stringify(draft[area.key]) !== JSON.stringify(initial[area.key])}
              onToggle={(right, on) =>
                setDraft((current) => ({ ...current, [area.key]: { ...current[area.key], [right]: on } }))
              }
              onSave={() => void save(area.key)}
              onReset={() => void reset(area.key)}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function PeopleTable({ overview, onChanged }: { overview: AccessOverview; onChanged: () => void }) {
  const [editing, setEditing] = useState<AccessOverview["people"][number] | null>(null);

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Sub-admin</TableHead>
            <TableHead>Own rights</TableHead>
            <TableHead>Covers</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {overview.people.map((person) => (
            <TableRow key={person.user_id}>
              <TableCell>
                <div className="font-medium text-foreground">{person.full_name}</div>
                <div className="text-xs text-muted-foreground">{person.email}</div>
              </TableCell>
              <TableCell>
                {Object.keys(person.rights).length === 0 ? (
                  <span className="text-sm text-muted-foreground">The role&apos;s</span>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {Object.keys(person.rights).map((area) => (
                      <Badge key={area} variant="outline" className="capitalize">
                        {area}
                      </Badge>
                    ))}
                  </div>
                )}
              </TableCell>
              <TableCell className="text-sm">
                {person.scope
                  ? `${person.scope.department_ids.length} department(s), ${person.scope.location_ids.length} location(s)`
                  : "Everybody"}
              </TableCell>
              <TableCell className="text-right">
                <Button size="sm" variant="outline" onClick={() => setEditing(person)}>
                  <SlidersHorizontal /> Customise
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {editing && (
        <PersonDialog
          overview={overview}
          person={editing}
          onClose={() => setEditing(null)}
          onChanged={() => {
            onChanged();
          }}
        />
      )}
    </>
  );
}

function PersonDialog({
  overview,
  person,
  onClose,
  onChanged,
}: {
  overview: AccessOverview;
  person: AccessOverview["people"][number];
  onClose: () => void;
  onChanged: () => void;
}) {
  const departments = useApiQuery<OrgOption[]>("/org/departments");
  const locations = useApiQuery<OrgOption[]>("/org/locations");
  const [rights, setRights] = useState<Record<string, Rights>>(() =>
    Object.fromEntries(
      overview.areas.map((area) => [
        area.key,
        person.rights[area.key] ?? overview.role_rights[area.key] ?? full(overview.rights),
      ]),
    ),
  );
  const [own, setOwn] = useState<Set<string>>(() => new Set(Object.keys(person.rights)));
  const [deptIds, setDeptIds] = useState<Set<string>>(() => new Set(person.scope?.department_ids ?? []));
  const [locIds, setLocIds] = useState<Set<string>>(() => new Set(person.scope?.location_ids ?? []));
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      for (const area of overview.areas) {
        const had = area.key in person.rights;
        if (own.has(area.key)) {
          await put(`/admin/access/users/${person.user_id}/areas/${area.key}`, rights[area.key]);
        } else if (had) {
          await del(`/admin/access/users/${person.user_id}/areas/${area.key}`);
        }
      }
      await put(`/admin/access/users/${person.user_id}/scope`, {
        department_ids: [...deptIds],
        location_ids: [...locIds],
      });
      toast.success(`${person.full_name}'s access saved.`);
      onChanged();
      onClose();
    } catch (caught) {
      toast.error(failure(caught, "The access could not be saved."));
    } finally {
      setBusy(false);
    }
  };

  const toggleSet = (set: Set<string>, id: string, on: boolean) => {
    const next = new Set(set);
    if (on) next.add(id);
    else next.delete(id);
    return next;
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{person.full_name}</DialogTitle>
          <DialogDescription>
            Tick &quot;Own&quot; to give this person rights different from the role in an area. Leave every department and
            location unticked to let them cover everybody.
          </DialogDescription>
        </DialogHeader>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Area</TableHead>
                <TableHead className="text-center">Own</TableHead>
                {overview.rights.map((right) => (
                  <TableHead key={right} className="text-center">
                    {RIGHT_LABEL[right] ?? right}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {overview.areas.map((area) => (
                <TableRow key={area.key}>
                  <TableCell className="font-medium capitalize">{area.key}</TableCell>
                  <TableCell className="text-center">
                    <Checkbox
                      aria-label={`Own rights in ${area.key}`}
                      checked={own.has(area.key)}
                      onCheckedChange={(on) => setOwn((current) => toggleSet(current, area.key, on === true))}
                    />
                  </TableCell>
                  {overview.rights.map((right) => (
                    <TableCell key={right} className="text-center">
                      <Checkbox
                        aria-label={`${area.key} ${RIGHT_LABEL[right] ?? right}`}
                        disabled={!own.has(area.key)}
                        checked={rights[area.key]?.[right] ?? false}
                        onCheckedChange={(on) =>
                          setRights((current) => ({ ...current, [area.key]: { ...current[area.key], [right]: on === true } }))
                        }
                      />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-medium">Departments</legend>
            {(departments.data ?? []).map((option) => (
              <div key={option.id} className="flex items-center gap-2">
                <Checkbox
                  id={`scope-dept-${option.id}`}
                  checked={deptIds.has(option.id)}
                  onCheckedChange={(on) => setDeptIds((current) => toggleSet(current, option.id, on === true))}
                />
                <Label htmlFor={`scope-dept-${option.id}`} className="text-sm font-normal">
                  {option.name}
                </Label>
              </div>
            ))}
          </fieldset>
          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-medium">Locations</legend>
            {(locations.data ?? []).map((option) => (
              <div key={option.id} className="flex items-center gap-2">
                <Checkbox
                  id={`scope-loc-${option.id}`}
                  checked={locIds.has(option.id)}
                  onCheckedChange={(on) => setLocIds((current) => toggleSet(current, option.id, on === true))}
                />
                <Label htmlFor={`scope-loc-${option.id}`} className="text-sm font-normal">
                  {option.name}
                </Label>
              </div>
            ))}
          </fieldset>
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={busy} onClick={() => void save()}>
            {busy && <Loader2 className="animate-spin" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
