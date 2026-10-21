"use client";

import { Copy, KeyRound, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { EmployeePicker, employeeDisplayName } from "@/components/common/EmployeePicker";
import { FormField } from "@/components/common/FormField";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { post } from "@/lib/api";
import type { ManagedUserCreated } from "@/lib/types/admin";
import type { EmployeeSummary, UserRole } from "@/lib/types";

import { ASSIGNABLE_ROLES, ROLE_LABEL, ROLE_SCOPE, errorDetail } from "./settingsShared";
import { WelcomeEmailNotice } from "./WelcomeEmailNotice";

/**
 * Create a login.
 *
 * By default the person is emailed at their work address: their sign-in page,
 * a single-use link to set their own password, and their onboarding checklist
 * if one has started. The dialog then says what became of that email.
 *
 * The temporary password comes back once and is never retrievable — only its
 * hash is stored — so the dialog switches to showing it as well, the way in
 * when the email cannot reach them.
 */
export function NewUserDialog({
  open,
  onOpenChange,
  onCreated,
  initialEmployee = null,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
  /** Opened from a person's profile: the login is for them. */
  initialEmployee?: EmployeeSummary | null;
}) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<UserRole>("employee");
  const [employee, setEmployee] = useState<EmployeeSummary | null>(null);
  const [sendWelcome, setSendWelcome] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [issued, setIssued] = useState<ManagedUserCreated | null>(null);

  const pickEmployee = (picked: EmployeeSummary | null) => {
    setEmployee(picked);
    if (picked) {
      // Their record already has the name and work email; start from those.
      setFullName(employeeDisplayName(picked));
      if (picked.work_email) setEmail(picked.work_email);
    }
  };

  useEffect(() => {
    if (open && initialEmployee) pickEmployee(initialEmployee);
  }, [open, initialEmployee]);

  const reset = () => {
    setEmail("");
    setFullName("");
    setRole("employee");
    setEmployee(null);
    setSendWelcome(true);
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
        employee_id: employee?.id ?? null,
        send_welcome_email: sendWelcome,
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
                {issued.welcome_email?.status === "sent"
                  ? "They have what they need to sign in. The one-time password below is a fallback if the email goes astray."
                  : "Give them the one-time password below. It is shown once: only its hash is stored, so nobody — including you — can read it again."}
              </DialogDescription>
            </DialogHeader>
            {issued.welcome_email && <WelcomeEmailNotice welcome={issued.welcome_email} />}
            <Alert>
              <KeyRound />
              <AlertTitle>One-time password</AlertTitle>
              <AlertDescription>
                <code className="mt-1 block rounded bg-muted px-3 py-2 font-mono text-sm text-foreground">
                  {issued.temporary_password}
                </code>
                <p className="mt-2">
                  Shown once. They are asked to change it when they first sign in.
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
                A login is how somebody signs in. Link it to their employee record so they can
                punch, apply for leave and see their payslips.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4">
              <FormField
                htmlFor="new-user-employee"
                label="Employee record"
                optional
                hint="Leave empty only for someone who is not an employee, such as an auditor."
              >
                <EmployeePicker
                  id="new-user-employee"
                  value={employee}
                  onChange={pickEmployee}
                  excludeId={null}
                />
              </FormField>
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
                    {ASSIGNABLE_ROLES.map((candidate) => (
                      <SelectItem key={candidate} value={candidate}>
                        {ROLE_LABEL[candidate]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <div className="flex items-start gap-3 rounded-lg border border-border p-3">
                <Checkbox
                  id="new-user-welcome"
                  checked={sendWelcome}
                  onCheckedChange={(on) => setSendWelcome(on === true)}
                  className="mt-0.5"
                />
                <div className="grid gap-1">
                  <Label htmlFor="new-user-welcome" className="font-medium">
                    Email them their sign-in details
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Sent to the work email above: where to sign in, a link to set their own
                    password, and their onboarding checklist if it has started. Untick if that
                    mailbox is not live yet.
                  </p>
                </div>
              </div>
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
