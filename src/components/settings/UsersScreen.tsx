"use client";

import { KeyRound, Plus, ShieldAlert, UserCog, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { DataPanel } from "@/components/common/DataPanel";
import { PageShell } from "@/components/common/PageShell";
import { SectionNav } from "@/components/common/SectionNav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/context/AuthContext";
import { useApiQuery } from "@/hooks/useApiQuery";
import type { ManagedUser } from "@/lib/types/admin";
import type { UserRole } from "@/lib/types";

import { NewUserDialog } from "./NewUserDialog";
import { RoleChangeDialog } from "./RoleChangeDialog";
import { ActiveChangeDialog } from "./ActiveChangeDialog";
import { ROLE_LABEL, formatDateTime } from "./settingsShared";

/**
 * Settings → Users & roles.
 *
 * The role is the coarse gate on every router, so this screen is the one that
 * decides who can reach payroll. Every change asks for a reason and lands in
 * the audit trail, and the rules the API enforces — you cannot change your own
 * role, only a tenant admin grants tenant admin, the last tenant admin and the
 * break-glass account cannot be stranded — are shown here rather than
 * discovered as a refusal.
 */
export function UsersScreen() {
  const { hasRole } = useAuth();
  const isTenantAdmin = hasRole("tenant_admin");
  const { data, error, isLoading, reload } = useApiQuery<ManagedUser[]>("/admin/users");

  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [changingRole, setChangingRole] = useState<ManagedUser | null>(null);
  const [changingActive, setChangingActive] = useState<ManagedUser | null>(null);

  const rows = useMemo(() => {
    const all = data ?? [];
    const term = search.trim().toLowerCase();
    if (!term) return all;
    return all.filter(
      (row) =>
        row.full_name.toLowerCase().includes(term) ||
        row.email.toLowerCase().includes(term) ||
        (row.employee_code ?? "").toLowerCase().includes(term),
    );
  }, [data, search]);

  const activeTenantAdmins = (data ?? []).filter(
    (row) => row.role === "tenant_admin" && row.is_active,
  ).length;

  /** Why a row's role cannot be changed, or null when it can. */
  const roleBlockedBecause = (row: ManagedUser): string | null => {
    if (row.is_you) return "You cannot change your own role. Ask another administrator.";
    if (row.role === "tenant_admin" && !isTenantAdmin)
      return "Only a tenant admin can change another tenant admin's role.";
    if (row.role === "tenant_admin" && activeTenantAdmins <= 1)
      return "This is the last tenant admin; the workspace needs one.";
    return null;
  };

  const activeBlockedBecause = (row: ManagedUser): string | null => {
    if (row.is_you) return "You cannot disable your own login.";
    if (row.is_break_glass)
      return "This is the break-glass account. Designate another one before disabling it.";
    if (row.is_active && row.role === "tenant_admin" && activeTenantAdmins <= 1)
      return "This is the last active tenant admin; the workspace needs one.";
    return null;
  };

  return (
    <PageShell
      title="Users & roles"
      description="Who can sign in to this workspace, and what their role lets them reach."
      actions={
        <Button onClick={() => setCreating(true)}>
          <Plus /> Add login
        </Button>
      }
    >
      <SectionNav section="settings" />

      <DataPanel
        title="Logins"
        description={
          data
            ? `${data.length} login${data.length === 1 ? "" : "s"}, ${activeTenantAdmins} active tenant admin${activeTenantAdmins === 1 ? "" : "s"}.`
            : undefined
        }
        toolbar={
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name, email or employee code"
            aria-label="Search logins"
            className="max-w-sm"
          />
        }
        isLoading={isLoading}
        error={error?.detail ?? null}
        onRetry={reload}
        isEmpty={rows.length === 0}
        empty={{
          icon: Users,
          title: search ? "Nobody matches that search" : "No logins yet",
          description: search ? "Try a different name or email." : undefined,
        }}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Person</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Employee</TableHead>
              <TableHead>Last signed in</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const roleBlocked = roleBlockedBecause(row);
              const activeBlocked = activeBlockedBecause(row);
              return (
                <TableRow key={row.id} className={row.is_active ? undefined : "opacity-60"}>
                  <TableCell>
                    <div className="font-medium text-foreground">
                      {row.full_name}
                      {row.is_you && (
                        <Badge variant="secondary" className="ml-2">
                          You
                        </Badge>
                      )}
                      {row.is_break_glass && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge variant="outline" className="ml-2">
                              <KeyRound /> Break-glass
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            Signs in with a password even when SSO is enforced, so an identity
                            provider outage does not lock the workspace out.
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">{row.email}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={row.role === "tenant_admin" ? "default" : "outline"}>
                      {ROLE_LABEL[row.role as UserRole] ?? row.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {row.employee_name ? (
                      <>
                        {row.employee_name}
                        {row.employee_code && (
                          <span className="ml-1 font-mono text-xs">({row.employee_code})</span>
                        )}
                      </>
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        <ShieldAlert className="size-3.5" /> Not linked
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {row.last_login_at ? formatDateTime(row.last_login_at) : "Never"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <ActionButton
                        blocked={roleBlocked}
                        onClick={() => setChangingRole(row)}
                        label="Change role"
                      >
                        <UserCog /> Role
                      </ActionButton>
                      <ActionButton
                        blocked={activeBlocked}
                        onClick={() => setChangingActive(row)}
                        label={row.is_active ? "Disable login" : "Enable login"}
                        destructive={row.is_active}
                      >
                        {row.is_active ? "Disable" : "Enable"}
                      </ActionButton>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </DataPanel>

      <NewUserDialog
        open={creating}
        onOpenChange={setCreating}
        canGrantTenantAdmin={isTenantAdmin}
        onCreated={reload}
      />
      <RoleChangeDialog
        target={changingRole}
        onOpenChange={(open) => !open && setChangingRole(null)}
        canGrantTenantAdmin={isTenantAdmin}
        onChanged={reload}
      />
      <ActiveChangeDialog
        target={changingActive}
        onOpenChange={(open) => !open && setChangingActive(null)}
        onChanged={() => {
          reload();
          toast.success("Their sessions were ended as well.");
        }}
      />
    </PageShell>
  );
}

/**
 * A button that explains itself when it is unavailable.
 *
 * A disabled control with no reason is the thing an admin files a support
 * ticket about, so the tooltip carries the same sentence the API would return.
 */
function ActionButton({
  blocked,
  onClick,
  label,
  destructive = false,
  children,
}: {
  blocked: string | null;
  onClick: () => void;
  label: string;
  destructive?: boolean;
  children: React.ReactNode;
}) {
  const button = (
    <Button
      variant={destructive ? "outline" : "outline"}
      size="sm"
      aria-label={label}
      disabled={blocked !== null}
      onClick={onClick}
      className={destructive && !blocked ? "text-destructive" : undefined}
    >
      {children}
    </Button>
  );
  if (!blocked) return button;
  return (
    <Tooltip>
      {/* A disabled button fires no pointer events, so the trigger wraps it. */}
      <TooltipTrigger asChild>
        <span tabIndex={0}>{button}</span>
      </TooltipTrigger>
      <TooltipContent>{blocked}</TooltipContent>
    </Tooltip>
  );
}
