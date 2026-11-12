"use client";

import type { ColumnDef } from "@tanstack/react-table";
import {
  AlertTriangle,
  Ban,
  Building2,
  CheckCircle2,
  Copy,
  Download,
  Eye,
  KeyRound,
  Loader2,
  Mail,
  MoreHorizontal,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  UserPlus,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { DataPanel } from "@/components/common/DataPanel";
import { DataTable } from "@/components/common/data-table/DataTable";
import { FormField } from "@/components/common/FormField";
import { PageShell } from "@/components/common/PageShell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useApiQuery } from "@/hooks/useApiQuery";
import { WelcomeEmailNotice } from "@/components/settings/WelcomeEmailNotice";
import { ApiError, del, downloadFile, get, patch, post } from "@/lib/api";
import type { WelcomeEmail } from "@/lib/types/admin";
import { cn, formatDate } from "@/lib/utils";

import { CreateWorkspaceDialog, type EditTarget, type Issued } from "./CreateWorkspaceDialog";
import type { WorkspaceTool } from "./tools";
import { type WorkspaceDetail, WorkspaceSheet } from "./WorkspaceSheet";

export interface Admin {
  id: string;
  full_name: string;
  email: string;
  is_active: boolean;
  must_change_password: boolean;
  last_login_at: string | null;
}

export interface Workspace {
  id: string;
  name: string;
  workspace: string;
  is_active: boolean;
  is_own: boolean;
  logo_url: string | null;
  legal_name: string | null;
  pan: string | null;
  gstin: string | null;
  city: string | null;
  state_code: string | null;
  industry: string | null;
  company_size: string | null;
  created_at: string | null;
  active_logins: number;
  employees: number;
  last_sign_in: string | null;
  modules_on: string[];
  admins: Admin[];
}

/** One organisation's standing in every tool (GET /platform/connections). */
export interface Connection {
  id: string;
  name: string;
  workspace: string;
  is_active: boolean;
  tools: WorkspaceTool[];
}

type StatusFilter = "all" | "active" | "suspended";

function failure(caught: unknown, fallback: string): string {
  return caught instanceof ApiError ? caught.detail : fallback;
}

/** The organisation's logo, or a building where it has none. */
export function OrgLogo({ url, className }: { url: string | null; className?: string }) {
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" className={cn("size-9 shrink-0 rounded-md object-contain", className)} />
  ) : (
    <span
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground",
        className,
      )}
    >
      <Building2 className="size-4" />
    </span>
  );
}

/**
 * Platform → Organisations. Super admin only.
 *
 * There is no public sign-up: every organisation starts here, with its first
 * admin, who then sets up everything inside it. This page shows each
 * organisation's admins, size and tools, and nothing from inside it.
 *
 * Deep links: `?open=<id>` opens one, `?new=1` the create form, `?search=` the
 * search box (from the header search and the overview).
 */
export function PlatformConsole() {
  const params = useSearchParams();
  const router = useRouter();
  const { data, error, isLoading, reload } = useApiQuery<Workspace[]>("/platform/workspaces");
  const connections = useApiQuery<Connection[]>("/platform/connections");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState(params.get("search") ?? "");
  const [creating, setCreating] = useState(params.get("new") === "1");
  const [addingTo, setAddingTo] = useState<Workspace | null>(null);
  const [suspending, setSuspending] = useState<Workspace | null>(null);
  const [deleting, setDeleting] = useState<Workspace | null>(null);
  const [changingEmail, setChangingEmail] = useState<{ workspace: Workspace; admin: Admin } | null>(null);
  const [issued, setIssued] = useState<Issued | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(params.get("open"));
  const [editing, setEditing] = useState<EditTarget | null>(null);

  // A later deep link while the page is open (the header search) takes effect too.
  const linkedOpen = params.get("open");
  const linkedSearch = params.get("search");
  const linkedNew = params.get("new");
  useEffect(() => {
    if (linkedOpen) setViewingId(linkedOpen);
  }, [linkedOpen]);
  useEffect(() => {
    if (linkedSearch !== null) setSearch(linkedSearch);
  }, [linkedSearch]);
  useEffect(() => {
    if (linkedNew === "1") setCreating(true);
  }, [linkedNew]);

  /** Drops a used deep link, so a reload does not reopen the sheet or the form. */
  const clearLink = () => {
    if (params.has("open") || params.has("new")) router.replace("/platform/organisations");
  };

  const reloadConnections = connections.reload;
  const reloadAll = () => {
    reload();
    reloadConnections();
  };

  const toolsByOrg = useMemo(() => {
    const map = new Map<string, WorkspaceTool[]>();
    (connections.data ?? []).forEach((row) => map.set(row.id, row.tools));
    return map;
  }, [connections.data]);
  const toolsLoading = connections.isLoading && !connections.data;

  const openEdit = async (workspaceId: string) => {
    try {
      setEditing(await get<WorkspaceDetail>(`/platform/workspaces/${workspaceId}`));
    } catch (caught) {
      toast.error(failure(caught, "Could not load the company's details."));
    }
  };

  const resetPassword = async (workspace: Workspace, admin: Admin) => {
    try {
      const result = await post<{ admin: { email: string; temporary_password: string } }>(
        `/platform/workspaces/${workspace.id}/admins/${admin.id}/reset-password`,
      );
      setIssued({
        title: `New temporary password for ${admin.full_name}`,
        email: result.admin.email,
        password: result.admin.temporary_password,
      });
      reload();
    } catch (caught) {
      toast.error(failure(caught, "Could not reset the password."));
    }
  };

  const reactivate = async (workspace: Workspace) => {
    try {
      await post(`/platform/workspaces/${workspace.id}/status`, { active: true, reason: "Reactivated" });
      toast.success(`${workspace.name} is active again.`);
      reload();
    } catch (caught) {
      toast.error(failure(caught, "Could not reactivate."));
    }
  };

  const rows = (data ?? []).filter((row) =>
    statusFilter === "all" ? true : statusFilter === "active" ? row.is_active : !row.is_active,
  );

  const columns: ColumnDef<Workspace>[] = [
    {
      accessorKey: "name",
      header: "Organisation",
      cell: ({ row: { original: row } }) => (
        <div className="flex min-w-56 items-start gap-3">
          <OrgLogo url={row.logo_url} />
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-1.5 font-medium text-foreground">
              {row.name}
              {row.is_own ? <Badge variant="outline">Yours</Badge> : null}
              {!row.is_active ? <Badge variant="destructive">Suspended</Badge> : null}
            </p>
            <p className="font-mono text-xs text-muted-foreground">{row.workspace}</p>
            {row.legal_name && row.legal_name !== row.name ? (
              <p className="text-xs text-muted-foreground">{row.legal_name}</p>
            ) : null}
            {row.city || row.gstin || row.pan ? (
              <p className="text-xs text-muted-foreground">
                {[row.city, row.state_code].filter(Boolean).join(", ")}
                {row.gstin ? ` · GSTIN ${row.gstin}` : row.pan ? ` · PAN ${row.pan}` : ""}
              </p>
            ) : null}
          </div>
        </div>
      ),
    },
    {
      id: "admins",
      header: "Admins",
      accessorFn: (row) => row.admins.map((a) => `${a.full_name} ${a.email}`).join(" "),
      cell: ({ row: { original: row } }) =>
        row.admins.length === 0 ? (
          <Badge variant="warning">No admin</Badge>
        ) : (
          <div className="grid gap-1.5">
            {row.admins.map((admin) => (
              <div key={admin.id} className="min-w-0 text-sm">
                <p className="flex flex-wrap items-center gap-1.5">
                  {admin.full_name}
                  {admin.must_change_password ? <Badge variant="warning">Not signed in yet</Badge> : null}
                  {!admin.is_active ? <Badge variant="muted">Inactive</Badge> : null}
                </p>
                <p className="truncate text-xs text-muted-foreground">{admin.email}</p>
              </div>
            ))}
          </div>
        ),
    },
    {
      accessorKey: "employees",
      header: "People",
      cell: ({ row: { original: row } }) => (
        <div className="tabular-nums">
          {row.employees}
          <p className="text-xs text-muted-foreground">{row.active_logins} logins</p>
        </div>
      ),
    },
    {
      id: "tools",
      header: "Connected tools",
      accessorFn: (row) =>
        (toolsByOrg.get(row.id) ?? [])
          .filter((tool) => tool.connected)
          .map((tool) => tool.brand)
          .join(", "),
      cell: ({ row: { original: row } }) => {
        if (toolsLoading) return <span className="text-muted-foreground">…</span>;
        const tools = (toolsByOrg.get(row.id) ?? []).filter((tool) => tool.connected);
        if (tools.length === 0) return <span className="text-sm text-muted-foreground">None</span>;
        return (
          <div className="flex max-w-56 flex-wrap gap-1">
            {tools.map((tool) => (
              <Badge
                key={tool.key}
                variant={tool.last_error ? "destructive" : "secondary"}
                title={tool.last_error ? `People sync failed: ${tool.last_error}` : undefined}
              >
                {tool.last_error ? <AlertTriangle /> : null}
                {tool.brand}
              </Badge>
            ))}
          </div>
        );
      },
    },
    {
      accessorKey: "last_sign_in",
      header: "Last sign-in",
      cell: ({ row: { original: row } }) => (
        <span className="whitespace-nowrap text-sm">{row.last_sign_in ? formatDate(row.last_sign_in) : "Never"}</span>
      ),
    },
    {
      accessorKey: "created_at",
      header: "Created",
      cell: ({ row: { original: row } }) => (
        <span className="whitespace-nowrap text-sm">{row.created_at ? formatDate(row.created_at) : "—"}</span>
      ),
    },
    {
      id: "actions",
      header: "",
      enableHiding: false,
      enableSorting: false,
      meta: { text: false },
      cell: ({ row: { original: row } }) => (
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={() => void openEdit(row.id)}>
            <Pencil /> Edit
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" className="size-8" aria-label={`More for ${row.name}`}>
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuItem onClick={() => setViewingId(row.id)}>
                <Eye /> View details and tools
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setAddingTo(row)}>
                <UserPlus /> Add admin
              </DropdownMenuItem>
              {row.admins.map((admin) => (
                <DropdownMenuGroup key={admin.id}>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="truncate text-xs font-normal text-muted-foreground">
                    {admin.full_name}
                  </DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => void resetPassword(row, admin)}>
                    <KeyRound /> Reset password
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setChangingEmail({ workspace: row, admin })}>
                    <Mail /> Change email
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              ))}
              {row.is_own ? null : (
                <>
                  <DropdownMenuSeparator />
                  {row.is_active ? (
                    <DropdownMenuItem variant="destructive" onClick={() => setSuspending(row)}>
                      <Ban /> Suspend
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem onClick={() => void reactivate(row)}>
                      <RotateCcw /> Reactivate
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem variant="destructive" onClick={() => setDeleting(row)}>
                    <Trash2 /> Delete organisation
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  const total = data?.length ?? 0;
  const suspendedCount = (data ?? []).filter((row) => !row.is_active).length;

  return (
    <PageShell
      title="Organisations"
      eyebrow="Platform console"
      description="Every organisation on AskMiraa. Only you create them; each admin then sets up their own."
      actions={
        <Button onClick={() => setCreating(true)}>
          <Plus /> New organisation
        </Button>
      }
    >
      <DataTable
        title="All organisations"
        description={
          data
            ? `${total} ${total === 1 ? "organisation" : "organisations"}${
                suspendedCount ? `, ${suspendedCount} suspended` : ""
              }. Click a row for its details and tools.`
            : undefined
        }
        columns={columns}
        data={rows}
        getRowId={(row) => row.id}
        noun="organisations"
        isLoading={isLoading}
        error={error?.detail ?? null}
        onRetry={reloadAll}
        selectable={false}
        exportName="organisations"
        searchPlaceholder="Search name, address, admin or GSTIN"
        search={search}
        onSearchChange={setSearch}
        onRowClick={(row) => setViewingId(row.id)}
        rowClassName={(row) => (row.is_active ? undefined : "opacity-60")}
        filtered={statusFilter !== "all"}
        filters={
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger className="w-40" aria-label="Status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
            </SelectContent>
          </Select>
        }
        empty={{
          icon: Building2,
          title: statusFilter === "suspended" ? "No suspended organisations" : "No organisations yet",
          description: statusFilter === "all" ? "Create the first one with New organisation." : undefined,
        }}
      />

      <CreateWorkspaceDialog
        open={creating}
        onOpenChange={(next) => {
          setCreating(next);
          if (!next) clearLink();
        }}
        onCreated={(result) => {
          setIssued(result);
          reloadAll();
        }}
      />
      <CreateWorkspaceDialog
        open={editing !== null}
        onOpenChange={(next) => !next && setEditing(null)}
        editing={editing}
        onSaved={() => {
          setEditing(null);
          setViewingId(null);
          reloadAll();
        }}
      />
      <WorkspaceSheet
        workspaceId={viewingId}
        onClose={() => {
          setViewingId(null);
          clearLink();
          // Tools may have been connected, synced or disconnected from the sheet.
          reloadConnections();
        }}
        onEdit={(detail) => {
          setViewingId(null);
          setEditing(detail);
        }}
      />
      <AddAdminDialog
        workspace={addingTo}
        onClose={() => setAddingTo(null)}
        onCreated={(result) => {
          setIssued(result);
          reload();
        }}
      />

      <SuspendDialog workspace={suspending} onClose={() => setSuspending(null)} onDone={reload} />
      <DeleteDialog workspace={deleting} onClose={() => setDeleting(null)} onDone={reloadAll} />
      <ChangeEmailDialog
        target={changingEmail}
        onClose={() => setChangingEmail(null)}
        onChanged={(result) => {
          setIssued(result);
          reload();
        }}
      />
      <IssuedDialog issued={issued} onClose={() => setIssued(null)} />
    </PageShell>
  );
}

function AddAdminDialog({
  workspace,
  onClose,
  onCreated,
}: {
  workspace: Workspace | null;
  onClose: () => void;
  onCreated: (issued: Issued) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);

  const add = async () => {
    if (!workspace) return;
    setSaving(true);
    try {
      const result = await post<{
        admin: { email: string; temporary_password: string };
        welcome_email: WelcomeEmail | null;
      }>(`/platform/workspaces/${workspace.id}/admins`, {
        full_name: name.trim(),
        email: email.trim(),
      });
      setName("");
      setEmail("");
      onClose();
      onCreated({
        title: `New admin for ${workspace.name}`,
        email: result.admin.email,
        password: result.admin.temporary_password,
        welcome: result.welcome_email,
      });
    } catch (caught) {
      toast.error(failure(caught, "Could not add the admin."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={workspace !== null} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add an admin to {workspace?.name}</DialogTitle>
          <DialogDescription>For when an organisation&apos;s admin has left or is locked out.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <FormField label="Full name" htmlFor="add-admin-name" required>
            <Input id="add-admin-name" value={name} onChange={(e) => setName(e.target.value)} />
          </FormField>
          <FormField label="Work email" htmlFor="add-admin-email" required>
            <Input id="add-admin-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </FormField>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={add} disabled={saving || name.trim().length < 2 || !email.trim()}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            Add admin
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SuspendDialog({
  workspace,
  onClose,
  onDone,
}: {
  workspace: Workspace | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const suspend = async () => {
    if (!workspace) return;
    setSaving(true);
    try {
      await post(`/platform/workspaces/${workspace.id}/status`, { active: false, reason: reason.trim() });
      toast.success(`${workspace.name} is suspended.`);
      setReason("");
      onClose();
      onDone();
    } catch (caught) {
      toast.error(failure(caught, "Could not suspend."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={workspace !== null} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Suspend {workspace?.name}?</DialogTitle>
          <DialogDescription>
            Nobody in it can sign in or use AskMiraa until you reactivate it. Nothing is deleted.
          </DialogDescription>
        </DialogHeader>
        <FormField label="Reason" htmlFor="suspend-reason" required hint="Recorded in their audit trail.">
          <Input id="suspend-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
        </FormField>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={suspend} disabled={saving || reason.trim().length < 3}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            Suspend
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * For an admin login given the wrong email. The login is issued afresh to the
 * new address: links sent to the old one stop working, and a new temporary
 * password is shown once.
 */
function ChangeEmailDialog({
  target,
  onClose,
  onChanged,
}: {
  target: { workspace: Workspace; admin: Admin } | null;
  onClose: () => void;
  onChanged: (issued: Issued) => void;
}) {
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);

  const close = () => {
    setEmail("");
    onClose();
  };

  const change = async () => {
    if (!target) return;
    setSaving(true);
    try {
      const result = await patch<{
        admin: { email: string; temporary_password: string };
        welcome_email: WelcomeEmail | null;
      }>(`/platform/workspaces/${target.workspace.id}/admins/${target.admin.id}`, { email: email.trim() });
      close();
      onChanged({
        title: `New sign-in details for ${target.admin.full_name}`,
        email: result.admin.email,
        password: result.admin.temporary_password,
        welcome: result.welcome_email,
      });
    } catch (caught) {
      toast.error(failure(caught, "Could not change the email."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={target !== null} onOpenChange={(next) => !next && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change {target?.admin.full_name}&apos;s email</DialogTitle>
          <DialogDescription>
            Now <span className="font-mono">{target?.admin.email}</span>. The new address gets a fresh welcome email and
            temporary password; anything sent to the old one stops working.
          </DialogDescription>
        </DialogHeader>
        <FormField label="New work email" htmlFor="change-admin-email" required>
          <Input
            id="change-admin-email"
            type="email"
            autoComplete="off"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </FormField>
        <DialogFooter>
          <Button variant="outline" onClick={close}>
            Cancel
          </Button>
          <Button onClick={change} disabled={saving || !email.trim()}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            Change email
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Deleting closes the organisation for good without erasing it: its audit
 * trail is insert-only and its payroll and statutory records must be kept.
 * The address is typed out, so it is never one stray click.
 */
interface DeletedWorkspace {
  id: string;
  name: string;
  deleted_at: string | null;
  purge_after: string | null;
  purged_at: string | null;
  can_export: boolean;
}

/**
 * Deleted organisations, each with the day its data is purged (DPDP s.8(7)(b)).
 * Until then the data can be downloaded to hand back to the company.
 */
export function DeletedWorkspacesPanel() {
  const { data, error, isLoading, reload } = useApiQuery<DeletedWorkspace[]>("/platform/workspaces/deleted");
  const [downloading, setDownloading] = useState<string | null>(null);

  const download = async (row: DeletedWorkspace) => {
    setDownloading(row.id);
    try {
      await downloadFile(`/platform/workspaces/deleted/${row.id}/export`, `askmira-workspace-${row.id}.zip`);
    } catch (caught) {
      toast.error(failure(caught, "The download failed."));
    } finally {
      setDownloading(null);
    }
  };

  const when = (row: DeletedWorkspace): string => {
    const parts = [row.deleted_at ? `Deleted ${formatDate(row.deleted_at)}` : null];
    if (row.purged_at) parts.push(`data purged ${formatDate(row.purged_at)}`);
    else if (row.purge_after) parts.push(`data purged on ${formatDate(row.purge_after)}`);
    return parts.filter(Boolean).join(" · ");
  };

  return (
    <DataPanel
      title="Deleted organisations"
      description="Kept for 90 days after deletion so their data can be handed back, then purged — every record and file except the audit trail."
      isLoading={isLoading}
      error={error?.detail ?? null}
      onRetry={reload}
      isEmpty={(data ?? []).length === 0}
      empty={{ icon: Trash2, title: "No deleted organisations" }}
    >
      <ul className="divide-y divide-border">
        {(data ?? []).map((row) => (
          <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
            <div className="min-w-0">
              <div className="font-medium text-foreground">{row.name}</div>
              <div className="text-xs text-muted-foreground">{when(row)}</div>
            </div>
            {row.can_export ? (
              <Button size="sm" variant="outline" disabled={downloading === row.id} onClick={() => void download(row)}>
                {downloading === row.id ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                Download data
              </Button>
            ) : (
              <Badge variant="muted">Purged</Badge>
            )}
          </li>
        ))}
      </ul>
    </DataPanel>
  );
}

function DeleteDialog({
  workspace,
  onClose,
  onDone,
}: {
  workspace: Workspace | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [confirm, setConfirm] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const confirmed = workspace !== null && confirm.trim().toLowerCase() === workspace.workspace;

  const close = () => {
    setConfirm("");
    setReason("");
    onClose();
  };

  const remove = async () => {
    if (!workspace) return;
    setSaving(true);
    try {
      await del(`/platform/workspaces/${workspace.id}`, {
        body: { confirm: confirm.trim(), reason: reason.trim() },
      });
      toast.success(`${workspace.name} is deleted.`);
      close();
      onDone();
    } catch (caught) {
      toast.error(failure(caught, "Could not delete."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={workspace !== null} onOpenChange={(next) => !next && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {workspace?.name}?</DialogTitle>
          <DialogDescription>This cannot be undone from AskMiraa.</DialogDescription>
        </DialogHeader>
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>What happens</AlertTitle>
          <AlertDescription>
            <p>
              Everyone in it is signed out and cannot sign in again. Its API keys, directory sync, MCP connections,
              attendance devices and careers page stop working.
            </p>
            <p>
              It leaves this list, and its people&apos;s emails and the address{" "}
              <span className="font-mono">{workspace?.workspace}</span> can be used again.
            </p>
            <p>
              Its data is kept, out of everyone&apos;s reach, for 90 days so you can download it from Deleted
              organisations and give it to the company — it must keep its own payroll and statutory records. Then every
              record and file is deleted for good. Only the audit trail is kept.
            </p>
          </AlertDescription>
        </Alert>
        <div className="grid gap-4">
          <FormField label="Reason" htmlFor="delete-reason" required hint="Recorded in their audit trail and yours.">
            <Input id="delete-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          </FormField>
          <FormField
            label={
              <>
                Type <span className="font-mono">{workspace?.workspace}</span> to confirm
              </>
            }
            htmlFor="delete-confirm"
            required
          >
            <Input
              id="delete-confirm"
              autoComplete="off"
              className="font-mono"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </FormField>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={close}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={remove} disabled={saving || !confirmed || reason.trim().length < 3}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            Delete organisation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function IssuedDialog({ issued, onClose }: { issued: Issued | null; onClose: () => void }) {
  const copy = async () => {
    if (!issued) return;
    try {
      await navigator.clipboard.writeText(`${issued.email}\n${issued.password}`);
      toast.success("Copied.");
    } catch {
      toast.error("Could not copy; select the text instead.");
    }
  };

  return (
    <Dialog open={issued !== null} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{issued?.title}</DialogTitle>
          <DialogDescription>
            {issued?.welcome?.status === "sent"
              ? "They were emailed their sign-in page and a link to set a password. The password below is a fallback, shown only now."
              : "Give these to the admin yourself. The password is shown only now."}
          </DialogDescription>
        </DialogHeader>
        {issued?.welcome && <WelcomeEmailNotice welcome={issued.welcome} />}
        {issued?.tools?.length ? (
          <div className="grid gap-2">
            <p className="text-sm font-medium">Connected tools</p>
            <ul className="grid gap-1.5">
              {issued.tools.map((tool) => (
                <li key={tool.key} className="flex items-start gap-2 text-sm">
                  {tool.status === "connected" ? (
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
                  ) : (
                    <AlertTriangle
                      className={cn(
                        "mt-0.5 size-4 shrink-0",
                        tool.status === "existing" ? "text-warning" : "text-destructive",
                      )}
                    />
                  )}
                  <span>
                    <span className="font-medium">{tool.brand}:</span> {tool.message}
                  </span>
                </li>
              ))}
            </ul>
            {issued.tools.some((tool) => tool.status === "connected") ? (
              <p className="text-xs text-muted-foreground">
                The admin opens each connected tool from AskMiraa, without a second password.
              </p>
            ) : null}
          </div>
        ) : null}
        <Alert>
          <KeyRound />
          <AlertTitle>Sign-in details</AlertTitle>
          <AlertDescription>
            <p>
              Email: <span className="font-mono">{issued?.email}</span>
            </p>
            <p>
              Temporary password: <span className="font-mono">{issued?.password}</span>
            </p>
            <p className="mt-1 text-xs">They will be asked to choose their own password at first sign-in.</p>
          </AlertDescription>
        </Alert>
        <DialogFooter>
          <Button variant="outline" onClick={() => void copy()}>
            <Copy /> Copy
          </Button>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
