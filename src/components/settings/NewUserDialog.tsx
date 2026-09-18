"use client";

import { Copy, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/common/FormField";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { post } from "@/lib/api";
import type { ManagedUserCreated } from "@/lib/types/admin";
import type { UserRole } from "@/lib/types";

import { ASSIGNABLE_ROLES, ROLE_LABEL, ROLE_SCOPE, errorDetail } from "./settingsShared";

/**
 * Create a login.
 *
 * The temporary password comes back once and is never retrievable — only its
 * hash is stored — so the dialog switches to showing it and refuses to close
 * on a stray click until it has been acknowledged.
 */
export function NewUserDialog({
  open,
  onOpenChange,
  canGrantTenantAdmin,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canGrantTenantAdmin: boolean;
  onCreated: () => void;
}) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<UserRole>("employee");
  const [isBusy, setIsBusy] = useState(false);
  const [issued, setIssued] = useState<ManagedUserCreated | null>(null);

  const roles = ASSIGNABLE_ROLES.filter(
    (candidate) => canGrantTenantAdmin || candidate !== "tenant_admin",
  );

  const reset = () => {
    setEmail("");
    setFullName("");
    setRole("employee");
    setIssued(null);
  };

  const close = () => {
    reset();
    onOpenChange(false);
  };

  const submit = async () => {
    setIsBusy(true);
    try {
      const created = await post<ManagedUserCreated>("/admin/users", {
        email: email.trim(),
        full_name: fullName.trim(),
        role,
      });
      setIssued(created);
      onCreated();
    } catch (caught) {
      toast.error(errorDetail(caught, "Could not create the login."));
    } finally {
      setIsBusy(false);
    }
  };

  const copyPassword = async () => {
    if (!issued) return;
    try {
      await navigator.clipboard.writeText(issued.temporary_password);
      toast.success("Copied. Send it over a channel they already trust.");
    } catch {
      toast.error("Could not copy. Select the password and copy it by hand.");
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (isBusy) return;
        if (!next) close();
        else onOpenChange(true);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        {issued ? (
          <>
            <DialogHeader>
              <DialogTitle>Login created for {issued.user.full_name}</DialogTitle>
              <DialogDescription>
                This password is shown once. Only its hash is stored, so nobody — including you —
                can read it again.
              </DialogDescription>
            </DialogHeader>
            <Alert>
              <AlertTitle>Temporary password</AlertTitle>
              <AlertDescription>
                <code className="mt-1 block rounded bg-muted px-3 py-2 font-mono text-sm text-foreground">
                  {issued.temporary_password}
                </code>
                <p className="mt-2">
                  They are asked to change it when they first sign in.
                </p>
              </AlertDescription>
            </Alert>
            <DialogFooter>
              <Button variant="outline" onClick={copyPassword}>
                <Copy /> Copy password
              </Button>
              <Button onClick={close}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Add a login</DialogTitle>
              <DialogDescription>
                A login is how somebody signs in. Linking it to an employee record is done from
                that person&apos;s profile.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4">
              <FormField htmlFor="new-user-name" label="Full name">
                <Input
                  id="new-user-name"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="Priya Sharma"
                  autoComplete="off"
                />
              </FormField>
              <FormField
                htmlFor="new-user-email"
                label="Work email"
                hint="They sign in with this, and it must be unique in this workspace."
              >
                <Input
                  id="new-user-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="priya@company.com"
                  autoComplete="off"
                />
              </FormField>
              <FormField htmlFor="new-user-role" label="Role" hint={ROLE_SCOPE[role]}>
                <Select value={role} onValueChange={(next) => setRole(next as UserRole)}>
                  <SelectTrigger id="new-user-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((candidate) => (
                      <SelectItem key={candidate} value={candidate}>
                        {ROLE_LABEL[candidate]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={close} disabled={isBusy}>
                Cancel
              </Button>
              <Button
                onClick={submit}
                disabled={isBusy || fullName.trim().length < 2 || !email.trim().includes("@")}
              >
                {isBusy && <Loader2 className="animate-spin" />} Create login
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
