"use client";

import { Check, Info, Minus, ShieldCheck } from "lucide-react";
import { useMemo } from "react";

import { DataPanel } from "@/components/common/DataPanel";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApiQuery } from "@/hooks/useApiQuery";
import type { RolePermission } from "@/lib/types/admin";
import type { UserRole } from "@/lib/types";

import { ROLE_LABEL } from "./settingsShared";

const CAPABILITIES = [
  { key: "can_view", label: "View" },
  { key: "can_create", label: "Create" },
  { key: "can_edit", label: "Edit" },
  { key: "can_delete", label: "Delete" },
  { key: "can_approve", label: "Approve" },
  { key: "can_export", label: "Export" },
] as const;

/**
 * The permission matrix, read-only.
 *
 * It is read-only deliberately: these rows are what the service layer checks,
 * and an editor here would be a way to grant somebody payroll approval without
 * the role change that the audit trail records. The screen exists so an
 * administrator can answer "who can approve payroll" without reading code —
 * changing the answer is done by changing somebody's role.
 */
export function PermissionsPanel() {
  const { data, error, isLoading, reload } = useApiQuery<RolePermission[]>("/admin/permissions");

  const { modules, byRole } = useMemo(() => {
    const rows = data ?? [];
    const modules = [...new Set(rows.map((row) => row.module))].sort();
    const byRole = new Map<string, Map<string, RolePermission>>();
    for (const row of rows) {
      if (!byRole.has(row.role)) byRole.set(row.role, new Map());
      byRole.get(row.role)!.set(row.module, row);
    }
    return { modules, byRole };
  }, [data]);

  const roles = [...byRole.keys()].sort();

  return (
    <div className="flex flex-col gap-4">
      <Alert>
        <Info />
        <AlertTitle>This matrix is what the API checks, and it is not edited here</AlertTitle>
        <AlertDescription>
          Granting somebody a capability without changing their role would be a permission change
          with nothing in the audit trail to explain it. To change what a person can do, change
          their role under Users &amp; roles.
        </AlertDescription>
      </Alert>

      <DataPanel
        title="Role permissions"
        description="Per role and module: what the service layer allows before it does anything."
        isLoading={isLoading}
        error={error?.detail ?? null}
        onRetry={reload}
        isEmpty={roles.length === 0}
        empty={{
          icon: ShieldCheck,
          title: "No permission rows configured",
          description:
            "The routers still gate on role; this table is the finer, per-module layer and is empty for this workspace.",
        }}
      >
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 bg-card">Role</TableHead>
                <TableHead>Module</TableHead>
                {CAPABILITIES.map((capability) => (
                  <TableHead key={capability.key} className="text-center">
                    {capability.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {roles.flatMap((role) =>
                modules
                  .filter((module) => byRole.get(role)?.has(module))
                  .map((module, index) => {
                    const row = byRole.get(role)!.get(module)!;
                    return (
                      <TableRow key={`${role}-${module}`}>
                        <TableCell className="sticky left-0 bg-card">
                          {index === 0 ? (
                            <Badge variant={role === "admin" ? "default" : "outline"}>
                              {ROLE_LABEL[role as UserRole] ?? role}
                            </Badge>
                          ) : null}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{module}</TableCell>
                        {CAPABILITIES.map((capability) => (
                          <TableCell key={capability.key} className="text-center">
                            {row[capability.key] ? (
                              <Check
                                className="mx-auto size-4 text-foreground"
                                aria-label="allowed"
                              />
                            ) : (
                              <Minus
                                className="mx-auto size-4 text-muted-foreground"
                                aria-label="not allowed"
                              />
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    );
                  }),
              )}
            </TableBody>
          </Table>
        </div>
      </DataPanel>
    </div>
  );
}
