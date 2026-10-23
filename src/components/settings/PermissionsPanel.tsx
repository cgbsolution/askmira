"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Info, Loader2, RotateCcw, Save, ShieldCheck, SlidersHorizontal } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { DataTable } from "@/components/common/data-table/DataTable";
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

type Area = AccessOverview["areas"][number];
type Person = AccessOverview["people"][number];

const ROLE_MATRIX_TITLE = "What every sub-admin may do";
const ROLE_MATRIX_DESCRIPTION =
  "Per area. Untick a right to withhold it from every sub-admin, unless a person has their own rights.";

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
          {/* The matrix mounts only once the overview is loaded, so its draft starts
              from it; until then its card shows the loading or the error. */}
          {data && !isLoading && !error ? (
            <RoleMatrix overview={data} onChanged={reload} />
          ) : (
            <DataTable
              variant="plain"
              tier="tier1"
              title={ROLE_MATRIX_TITLE}
              description={ROLE_MATRIX_DESCRIPTION}
              columns={[]}
              data={[]}
              isLoading={isLoading}
              error={error?.detail}
              onRetry={reload}
            />
          )}
        </TabsContent>
        <TabsContent value="people" className="mt-4">
          <PeopleTable
            overview={data}
            isLoading={isLoading}
            error={error?.detail}
            onRetry={reload}
            onChanged={reload}
          />
        </TabsContent>
      </Tabs>
    </div>
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

  const isDirty = (area: string) => JSON.stringify(draft[area]) !== JSON.stringify(initial[area]);

  const columns: ColumnDef<Area>[] = [
    {
      id: "area",
      header: "Area",
      cell: ({ row }) => (
        <>
          <div className="font-medium capitalize text-foreground">{row.original.key}</div>
          <div className="max-w-xs text-xs text-muted-foreground">{row.original.description}</div>
          {!overview.role_rights[row.original.key] && !isDirty(row.original.key) && (
            <Badge variant="muted" className="mt-1">
              Default: full
            </Badge>
          )}
        </>
      ),
    },
    ...overview.rights.map(
      (right): ColumnDef<Area> => ({
        id: right,
        header: RIGHT_LABEL[right] ?? right,
        meta: { className: "text-center" },
        cell: ({ row }) => (
          <Checkbox
            aria-label={`${row.original.key} ${RIGHT_LABEL[right] ?? right}`}
            checked={draft[row.original.key]?.[right] ?? false}
            onCheckedChange={(on) =>
              setDraft((current) => ({
                ...current,
                [row.original.key]: { ...current[row.original.key], [right]: on === true },
              }))
            }
          />
        ),
      }),
    ),
    {
      id: "actions",
      header: "",
      meta: { className: "text-right" },
      cell: ({ row }) => {
        const area = row.original.key;
        const isDefault = !overview.role_rights[area];
        const working = busy === area;
        return (
          <div className="flex justify-end gap-1">
            <Button size="sm" disabled={!isDirty(area) || working} onClick={() => void save(area)}>
              {working ? <Loader2 className="animate-spin" /> : <Save />} Save
            </Button>
            {!isDefault && (
              <Button
                size="sm"
                variant="ghost"
                disabled={working}
                onClick={() => void reset(area)}
                aria-label={`Reset ${area}`}
              >
                <RotateCcw />
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  // A form grid: every area on show, each saved by its own row.
  return (
    <DataTable
      variant="plain"
      tier="tier1"
      title={ROLE_MATRIX_TITLE}
      description={ROLE_MATRIX_DESCRIPTION}
      columns={columns}
      data={overview.areas}
      getRowId={(area) => area.key}
    />
  );
}

function PeopleTable({
  overview,
  isLoading,
  error,
  onRetry,
  onChanged,
}: {
  overview: AccessOverview | null;
  isLoading: boolean;
  error?: string;
  onRetry: () => void;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState<Person | null>(null);

  const columns: ColumnDef<Person>[] = [
    {
      accessorKey: "full_name",
      header: "Sub-admin",
      meta: { text: (person) => `${person.full_name} ${person.email}` },
      cell: ({ row }) => (
        <>
          <div className="font-medium text-foreground">{row.original.full_name}</div>
          <div className="text-xs text-muted-foreground">{row.original.email}</div>
        </>
      ),
    },
    {
      id: "own_rights",
      header: "Own rights",
      accessorFn: (person) =>
        Object.keys(person.rights).length === 0 ? "The role's" : Object.keys(person.rights).join(", "),
      cell: ({ row }) =>
        Object.keys(row.original.rights).length === 0 ? (
          <span className="text-sm text-muted-foreground">The role&apos;s</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {Object.keys(row.original.rights).map((area) => (
              <Badge key={area} variant="outline" className="capitalize">
                {area}
              </Badge>
            ))}
          </div>
        ),
    },
    {
      id: "covers",
      header: "Covers",
      accessorFn: (person) =>
        person.scope
          ? `${person.scope.department_ids.length} department(s), ${person.scope.location_ids.length} location(s)`
          : "Everybody",
      meta: { cellClassName: "text-sm" },
    },
    {
      id: "actions",
      header: "",
      enableHiding: false,
      meta: { className: "text-right", text: false },
      cell: ({ row }) => (
        <Button size="sm" variant="outline" onClick={() => setEditing(row.original)}>
          <SlidersHorizontal /> Customise
        </Button>
      ),
    },
  ];

  return (
    <>
      <DataTable
        tier="tier1"
        title="Sub-admins"
        description="Give one person different rights, or limit them to some departments or locations."
        columns={columns}
        data={overview?.people ?? []}
        getRowId={(person) => person.user_id}
        noun="sub-admins"
        exportName="sub-admins"
        searchPlaceholder="Search sub-admins"
        isLoading={isLoading}
        error={error}
        onRetry={onRetry}
        empty={{
          icon: ShieldCheck,
          title: "No sub-admins",
          description: "Give somebody the sub-admin role under Users & roles first.",
        }}
      />
      {editing && overview && (
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

  const columns: ColumnDef<Area>[] = [
    {
      id: "area",
      header: "Area",
      meta: { cellClassName: "font-medium capitalize" },
      cell: ({ row }) => row.original.key,
    },
    {
      id: "own",
      header: "Own",
      meta: { className: "text-center" },
      cell: ({ row }) => (
        <Checkbox
          aria-label={`Own rights in ${row.original.key}`}
          checked={own.has(row.original.key)}
          onCheckedChange={(on) => setOwn((current) => toggleSet(current, row.original.key, on === true))}
        />
      ),
    },
    ...overview.rights.map(
      (right): ColumnDef<Area> => ({
        id: right,
        header: RIGHT_LABEL[right] ?? right,
        meta: { className: "text-center" },
        cell: ({ row }) => (
          <Checkbox
            aria-label={`${row.original.key} ${RIGHT_LABEL[right] ?? right}`}
            disabled={!own.has(row.original.key)}
            checked={rights[row.original.key]?.[right] ?? false}
            onCheckedChange={(on) =>
              setRights((current) => ({
                ...current,
                [row.original.key]: { ...current[row.original.key], [right]: on === true },
              }))
            }
          />
        ),
      }),
    ),
  ];

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
        <DataTable variant="plain" columns={columns} data={overview.areas} getRowId={(area) => area.key} />
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
