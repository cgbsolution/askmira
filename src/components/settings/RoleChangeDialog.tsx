"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { patch } from "@/lib/api";
import type { ManagedUser } from "@/lib/types/admin";
import type { UserRole } from "@/lib/types";

import { ASSIGNABLE_ROLES, ROLE_LABEL, ROLE_SCOPE, errorDetail } from "./settingsShared";

/**
 * Change somebody's role.
 *
 * The reason is mandatory because the role is what gates payroll, and a
 * permission change with no stated reason is the audit entry that answers
 * nothing six months later. Changing the role ends their sessions, so the
 * new gate applies on their next request rather than whenever their token
 * happens to expire.
 */
export function RoleChangeDialog({
  target,
  onOpenChange,
  onChanged,
}: {
  target: ManagedUser | null;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}) {
  const [role, setRole] = useState<UserRole>("employee");
  const [reason, setReason] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (target) {
      setRole(target.role);
      setReason("");
    }
  }, [target]);

  const submit = async () => {
    if (!target) return;
    setIsBusy(true);
    try {
      await patch(`/admin/users/${target.id}/role`, { role, reason: reason.trim() });
      toast.success(`${target.full_name} is now ${ROLE_LABEL[role].toLowerCase()}.`);
      onChanged();
      onOpenChange(false);
    } catch (caught) {
      toast.error(errorDetail(caught, "Could not change the role."));
    } finally {
      setIsBusy(false);
    }
  };

  const unchanged = target !== null && role === target.role;

  return (
    <Dialog open={target !== null} onOpenChange={(next) => !isBusy && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Change {target?.full_name}&apos;s role</DialogTitle>
          <DialogDescription>
            Currently {target ? ROLE_LABEL[target.role].toLowerCase() : ""}. The change is recorded
            in the audit trail with the reason you give.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <FormField htmlFor="role-change-role" label="New role" hint={ROLE_SCOPE[role]}>
            <Select value={role} onValueChange={(next) => setRole(next as UserRole)}>
              <SelectTrigger id="role-change-role">
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

          <FormField
            htmlFor="role-change-reason"
            label="Reason"
            hint="At least a few words. This is what the audit entry will say."
          >
            <Textarea
              id="role-change-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Moved into the payroll team from 1 October."
              rows={3}
            />
          </FormField>

          {role === "admin" && target?.role !== "admin" && (
            <Alert>
              <AlertTitle>An admin reaches everything</AlertTitle>
              <AlertDescription>
                Including module switches, other people&apos;s roles and payroll approval.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isBusy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={isBusy || unchanged || reason.trim().length < 3}>
            {isBusy && <Loader2 className="animate-spin" />} Change role
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
