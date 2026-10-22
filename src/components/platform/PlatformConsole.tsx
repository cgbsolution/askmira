"use client";

import {
  AlertTriangle,
  Ban,
  Building2,
  Copy,
  Eye,
  KeyRound,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  UserPlus,
} from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { DataPanel } from "@/components/common/DataPanel";
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
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApiQuery } from "@/hooks/useApiQuery";
import { WelcomeEmailNotice } from "@/components/settings/WelcomeEmailNotice";
import { ApiError, del, get, post } from "@/lib/api";
import type { WelcomeEmail } from "@/lib/types/admin";
import { formatDate } from "@/lib/utils";

import { CreateWorkspaceDialog, type EditTarget, type Issued } from "./CreateWorkspaceDialog";
import { type WorkspaceDetail, WorkspaceSheet } from "./WorkspaceSheet";

interface Admin {
  id: string;
  full_name: string;
  email: string;
  is_active: boolean;
  must_change_password: boolean;
  last_login_at: string | null;
}

interface Workspace {
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


function failure(caught: unknown, fallback: string): string {
  return caught instanceof ApiError ? caught.detail : fallback;
}

/**
 * Platform → Workspaces. Super admin only.
 *
 * There is no public sign-up: every organisation starts here, with its first
 * admin, who then sets up everything inside it. This page shows each
 * workspace's admins and size, and nothing from inside it.
 */
export function PlatformConsole() {
  const { data, error, isLoading, reload } = useApiQuery<Workspace[]>("/platform/workspaces");
  const [creating, setCreating] = useState(false);
  const [addingTo, setAddingTo] = useState<Workspace | null>(null);
  const [suspending, setSuspending] = useState<Workspace | null>(null);
  const [deleting, setDeleting] = useState<Workspace | null>(null);
  const [issued, setIssued] = useState<Issued | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditTarget | null>(null);

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

  return (
    <PageShell
      title="Workspaces"
      description="Every organisation on AskMira. Only you create them; each admin then sets up their own."
      icon={Building2}
      actions={
        <Button onClick={() => setCreating(true)}>
          <Plus /> New organisation
        </Button>
      }
    >
      <DataPanel
        title="Organisations"
        isLoading={isLoading}
        error={error?.detail}
        onRetry={reload}
        isEmpty={(data ?? []).length === 0}
        empty={{ icon: Building2, title: "No organisations yet" }}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Organisation</TableHead>
              <TableHead>Admins</TableHead>
              <TableHead className="text-right">People</TableHead>
              <TableHead>Last sign-in</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data ?? []).map((row) => (
              <TableRow key={row.id} className={row.is_active ? undefined : "opacity-60"}>
                <TableCell className="align-top">
                  <div className="flex items-start gap-3">
                  {row.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={row.logo_url} alt="" className="size-9 rounded object-contain" />
                  ) : (
                    <span className="flex size-9 items-center justify-center rounded bg-muted text-muted-foreground">
                      <Building2 className="size-4" />
                    </span>
                  )}
                  <div>
                  <p className="font-medium">
                    {row.name}
                    {row.is_own ? (
                      <Badge variant="outline" className="ml-2">
                        Yours
                      </Badge>
                    ) : null}
                    {!row.is_active ? (
                      <Badge variant="destructive" className="ml-2">
                        Suspended
                      </Badge>
                    ) : null}
                  </p>
                  <p className="font-mono text-xs text-muted-foreground">{row.workspace}</p>
                  {row.legal_name && row.legal_name !== row.name ? (
                    <p className="text-xs text-muted-foreground">{row.legal_name}</p>
                  ) : null}
                  <p className="text-xs text-muted-foreground">
                    {[row.city, row.state_code].filter(Boolean).join(", ")}
                    {row.gstin ? ` · GSTIN ${row.gstin}` : row.pan ? ` · PAN ${row.pan}` : ""}
                  </p>
                  {row.created_at ? (
                    <p className="text-xs text-muted-foreground">Created {formatDate(row.created_at)}</p>
                  ) : null}
                  </div>
                  </div>
                </TableCell>
                <TableCell className="align-top">
                  <div className="grid gap-1">
                    {row.admins.map((admin) => (
                      <div key={admin.id} className="flex flex-wrap items-center gap-2 text-sm">
                        <span>{admin.full_name}</span>
                        <span className="text-xs text-muted-foreground">{admin.email}</span>
                        {admin.must_change_password ? <Badge variant="outline">Not signed in yet</Badge> : null}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2"
                          onClick={() => void resetPassword(row, admin)}
                        >
                          <KeyRound className="size-3.5" /> Reset password
                        </Button>
                      </div>
                    ))}
                    {row.admins.length === 0 ? <span className="text-sm text-muted-foreground">No admin</span> : null}
                  </div>
                </TableCell>
                <TableCell className="text-right align-top tabular-nums">
                  {row.employees}
                  <p className="text-xs text-muted-foreground">{row.active_logins} logins</p>
                </TableCell>
                <TableCell className="align-top text-sm">
                  {row.last_sign_in ? formatDate(row.last_sign_in) : "Never"}
                </TableCell>
                <TableCell className="text-right align-top">
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => setViewingId(row.id)}>
                      <Eye /> View
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => void openEdit(row.id)}>
                      <Pencil /> Edit
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost" className="size-8" aria-label={`More for ${row.name}`}>
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setAddingTo(row)}>
                          <UserPlus /> Add admin
                        </DropdownMenuItem>
                        {row.is_own ? null : row.is_active ? (
                          <DropdownMenuItem variant="destructive" onClick={() => setSuspending(row)}>
                            <Ban /> Suspend
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={() => void reactivate(row)}>
                            <RotateCcw /> Reactivate
                          </DropdownMenuItem>
                        )}
                        {row.is_own ? null : (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem variant="destructive" onClick={() => setDeleting(row)}>
                              <Trash2 /> Delete organisation
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DataPanel>

      <CreateWorkspaceDialog
        open={creating}
        onOpenChange={setCreating}
        onCreated={(result) => {
          setIssued(result);
          reload();
        }}
      />
      <CreateWorkspaceDialog
        open={editing !== null}
        onOpenChange={(next) => !next && setEditing(null)}
        editing={editing}
        onSaved={() => {
          setEditing(null);
          setViewingId(null);
          reload();
        }}
      />
      <WorkspaceSheet
        workspaceId={viewingId}
        onClose={() => setViewingId(null)}
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
      <DeleteDialog workspace={deleting} onClose={() => setDeleting(null)} onDone={reload} />
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
            Nobody in it can sign in or use AskMira until you reactivate it. Nothing is deleted.
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
 * Deleting closes the organisation for good without erasing it: its audit
 * trail is insert-only and its payroll and statutory records must be kept.
 * The address is typed out, so it is never one stray click.
 */
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
          <DialogDescription>This cannot be undone from AskMira.</DialogDescription>
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
            <p>Its payroll, statutory and audit records are kept, out of reach, for as long as the law requires.</p>
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
