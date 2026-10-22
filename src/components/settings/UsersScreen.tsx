"use client";

import { KeyRound, Link2, Loader2, Mail, Plus, ShieldAlert, Trash2, UserCog, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { DataPanel } from "@/components/common/DataPanel";
import { PageShell } from "@/components/common/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useApiQuery } from "@/hooks/useApiQuery";
import { post } from "@/lib/api";
import type { ManagedUser, WelcomeEmail } from "@/lib/types/admin";
import type { UserRole } from "@/lib/types";

import { LinkEmployeeDialog } from "./LinkEmployeeDialog";
import { NewUserDialog } from "./NewUserDialog";
import { ResetPasswordDialog } from "./ResetPasswordDialog";
import { RoleChangeDialog } from "./RoleChangeDialog";
import { ActiveChangeDialog } from "./ActiveChangeDialog";
import { DeleteLoginDialog } from "./DeleteLoginDialog";
import { ROLE_LABEL, errorDetail, formatDateTime } from "./settingsShared";

/**
 * Settings → Users & roles.
 *
 * The role is the coarse gate on every router, so this screen is the one that
 * decides who can reach payroll. Every change asks for a reason and lands in
 * the audit trail, and the rules the API enforces — you cannot change your own
 * role, the last admin and the break-glass account cannot be stranded — are
 * shown here rather than discovered as a refusal.
 */
export function UsersScreen() {
  const { data, error, isLoading, reload } = useApiQuery<ManagedUser[]>("/admin/users");

  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [changingRole, setChangingRole] = useState<ManagedUser | null>(null);
  const [changingActive, setChangingActive] = useState<ManagedUser | null>(null);
  const [deleting, setDeleting] = useState<ManagedUser | null>(null);
  const [linking, setLinking] = useState<ManagedUser | null>(null);
  const [resetting, setResetting] = useState<ManagedUser | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);

  const resendWelcome = async (row: ManagedUser) => {
    setResendingId(row.id);
    try {
      const welcome = await post<WelcomeEmail>(`/admin/users/${row.id}/welcome-email`, {});
      if (welcome.status === "sent") {
        toast.success(`Welcome email sent to ${welcome.sent_to}`, {
          description: "Any earlier set-password link no longer works.",
        });
      } else if (welcome.status === "queued") {
        toast.info(`Welcome email to ${welcome.sent_to} is queued`, { description: welcome.detail });
      } else {
        toast.warning(`The welcome email did not reach ${welcome.sent_to}`, {
          description: welcome.detail,
        });
      }
    } catch (caught) {
      toast.error(errorDetail(caught, "Could not send the welcome email."));
    } finally {
      setResendingId(null);
    }
  };

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

  const activeAdmins = (data ?? []).filter(
    (row) => row.role === "admin" && row.is_active,
  ).length;

  /** Why a row's role cannot be changed, or null when it can. */
  const roleBlockedBecause = (row: ManagedUser): string | null => {
    if (row.is_you) return "You cannot change your own role. Ask another administrator.";
    if (row.role === "admin" && activeAdmins <= 1)
      return "This is the last admin; the workspace needs one.";
    return null;
  };

  const activeBlockedBecause = (row: ManagedUser): string | null => {
    if (row.is_you) return "You cannot disable your own login.";
    if (row.is_break_glass)
      return "This is the break-glass account. Designate another one before disabling it.";
    if (row.is_active && row.role === "admin" && activeAdmins <= 1)
      return "This is the last active admin; the workspace needs one.";
    return null;
  };

  const deleteBlockedBecause = (row: ManagedUser): string | null => {
    if (row.is_you) return "You cannot delete your own login.";
    if (row.is_break_glass)
      return "This is the break-glass account. Designate another one before removing it.";
    if (row.is_active && row.role === "admin" && activeAdmins <= 1)
      return "This is the last active admin; the workspace needs one.";
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
      <DataPanel
        title="Logins"
        description={
          data
            ? `${data.length} login${data.length === 1 ? "" : "s"}, ${activeAdmins} active admin${activeAdmins === 1 ? "" : "s"}.`
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
                    <Badge variant={row.role === "admin" ? "default" : "outline"}>
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
                      <span className="inline-flex items-center gap-1 text-mustard-900 dark:text-mustard-100">
                        <ShieldAlert className="size-3.5" /> Not linked
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {row.last_login_at ? formatDateTime(row.last_login_at) : "Never"}
                    {row.invite_pending && row.is_active && (
                      <Badge variant="warning" className="ml-2">
                        Password not set
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {row.invite_pending && row.is_active && !row.is_you && (
                        <ActionButton
                          blocked={null}
                          onClick={() => void resendWelcome(row)}
                          label="Resend the welcome email"
                          disabled={resendingId === row.id}
                        >
                          {resendingId === row.id ? <Loader2 className="animate-spin" /> : <Mail />}{" "}
                          Resend welcome
                        </ActionButton>
                      )}
                      <ActionButton
                        blocked={null}
                        onClick={() => setLinking(row)}
                        label="Link to an employee record"
                      >
                        <Link2 /> {row.employee_id ? "Relink" : "Link"}
                      </ActionButton>
                      <ActionButton
                        blocked={row.is_you ? "Change your own password from your profile." : null}
                        onClick={() => setResetting(row)}
                        label="Reset password"
                      >
                        <KeyRound /> Password
                      </ActionButton>
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
                      <ActionButton
                        blocked={deleteBlockedBecause(row)}
                        onClick={() => setDeleting(row)}
                        label="Delete login"
                        destructive
                      >
                        <Trash2 /> Delete
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
        onCreated={reload}
      />
      <LinkEmployeeDialog
        target={linking}
        onOpenChange={(open) => !open && setLinking(null)}
        onChanged={reload}
      />
      <ResetPasswordDialog
        target={resetting}
        onOpenChange={(open) => !open && setResetting(null)}
      />
      <RoleChangeDialog
        target={changingRole}
        onOpenChange={(open) => !open && setChangingRole(null)}
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
      <DeleteLoginDialog
        target={deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        onDeleted={reload}
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
  disabled = false,
  children,
}: {
  blocked: string | null;
  onClick: () => void;
  label: string;
  destructive?: boolean;
  /** Busy rather than refused: no tooltip. */
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const button = (
    <Button
      variant={destructive ? "outline" : "outline"}
      size="sm"
      aria-label={label}
      disabled={blocked !== null || disabled}
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
