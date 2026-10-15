"use client";

import { Building2, Copy, KeyRound, Loader2, Plus, UserPlus } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApiQuery } from "@/hooks/useApiQuery";
import { ApiError, post } from "@/lib/api";
import { formatDate } from "@/lib/utils";

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
  created_at: string | null;
  active_logins: number;
  employees: number;
  last_sign_in: string | null;
  modules_on: string[];
  admins: Admin[];
}

interface Issued {
  title: string;
  email: string;
  password: string;
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
  const [issued, setIssued] = useState<Issued | null>(null);

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
                  {row.created_at ? (
                    <p className="text-xs text-muted-foreground">Created {formatDate(row.created_at)}</p>
                  ) : null}
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
                    <Button size="sm" variant="outline" onClick={() => setAddingTo(row)}>
                      <UserPlus /> Add admin
                    </Button>
                    {row.is_own ? null : row.is_active ? (
                      <Button size="sm" variant="outline" onClick={() => setSuspending(row)}>
                        Suspend
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => void reactivate(row)}>
                        Reactivate
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DataPanel>

      <CreateDialog
        open={creating}
        onOpenChange={setCreating}
        onCreated={(result) => {
          setIssued(result);
          reload();
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
      <IssuedDialog issued={issued} onClose={() => setIssued(null)} />
    </PageShell>
  );
}

function CreateDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (issued: Issued) => void;
}) {
  const [company, setCompany] = useState("");
  const [workspace, setWorkspace] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPhone, setAdminPhone] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setCompany("");
    setWorkspace("");
    setAdminName("");
    setAdminEmail("");
    setAdminPhone("");
  };

  const create = async () => {
    setSaving(true);
    try {
      const result = await post<{
        workspace: { name: string };
        admin: { email: string; temporary_password: string };
      }>("/platform/workspaces", {
        company_name: company.trim(),
        workspace: workspace.trim() || null,
        admin_full_name: adminName.trim(),
        admin_email: adminEmail.trim(),
        admin_phone: adminPhone.trim() || null,
      });
      onOpenChange(false);
      reset();
      onCreated({
        title: `${result.workspace.name} is ready`,
        email: result.admin.email,
        password: result.admin.temporary_password,
      });
    } catch (caught) {
      toast.error(failure(caught, "Could not create the organisation."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New organisation</DialogTitle>
          <DialogDescription>
            Creates the workspace and its first admin. You get a temporary password to give them; they
            choose their own when they first sign in.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <FormField label="Company name" htmlFor="ws-company" required>
            <Input id="ws-company" value={company} onChange={(e) => setCompany(e.target.value)} />
          </FormField>
          <FormField
            label="Workspace address"
            htmlFor="ws-slug"
            optional
            hint="Lowercase letters, digits and hyphens. Made from the company name if left empty."
          >
            <Input id="ws-slug" value={workspace} onChange={(e) => setWorkspace(e.target.value.toLowerCase())} />
          </FormField>
          <FormField label="Admin's full name" htmlFor="ws-admin-name" required>
            <Input id="ws-admin-name" value={adminName} onChange={(e) => setAdminName(e.target.value)} />
          </FormField>
          <FormField
            label="Admin's work email"
            htmlFor="ws-admin-email"
            required
            hint="Their login. An email can sign in to only one organisation."
          >
            <Input
              id="ws-admin-email"
              type="email"
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
            />
          </FormField>
          <FormField label="Admin's phone" htmlFor="ws-admin-phone" optional>
            <Input id="ws-admin-phone" value={adminPhone} onChange={(e) => setAdminPhone(e.target.value)} />
          </FormField>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={create}
            disabled={saving || company.trim().length < 2 || adminName.trim().length < 2 || !adminEmail.trim()}
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            Create organisation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
      const result = await post<{ admin: { email: string; temporary_password: string } }>(
        `/platform/workspaces/${workspace.id}/admins`,
        { full_name: name.trim(), email: email.trim() },
      );
      setName("");
      setEmail("");
      onClose();
      onCreated({
        title: `New admin for ${workspace.name}`,
        email: result.admin.email,
        password: result.admin.temporary_password,
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
          <DialogDescription>Give these to the admin yourself. The password is shown only now.</DialogDescription>
        </DialogHeader>
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
