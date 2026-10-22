"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/common/FormField";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { del } from "@/lib/api";
import type { ManagedUser } from "@/lib/types/admin";

import { errorDetail } from "./settingsShared";

/**
 * Delete a login for good.
 *
 * One email is one login across AskMira, so a login made with the wrong
 * address, or in the wrong workspace, holds that address until it is deleted.
 * Disabling stops the sign-in; deleting also frees the email and unlinks the
 * employee record, so either can be given a login again.
 */
export function DeleteLoginDialog({
  target,
  onOpenChange,
  onDeleted,
}: {
  target: ManagedUser | null;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
}) {
  const [reason, setReason] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (target) setReason("");
  }, [target]);

  const submit = async () => {
    if (!target) return;
    setIsBusy(true);
    try {
      await del(`/admin/users/${target.id}`, { body: { reason: reason.trim() } });
      toast.success(`${target.email} can be used for a login again.`);
      onDeleted();
      onOpenChange(false);
    } catch (caught) {
      toast.error(errorDetail(caught, "Could not delete the login."));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Dialog open={target !== null} onOpenChange={(next) => !isBusy && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Delete {target?.full_name}&apos;s login?</DialogTitle>
          <DialogDescription>
            They are signed out and can never sign in with it again. The email{" "}
            <span className="font-mono">{target?.email}</span> becomes free for a login here or in another
            workspace{target?.employee_name ? `, and ${target.employee_name}'s record can be given a new login` : ""}.
            Their records and history stay.
          </DialogDescription>
        </DialogHeader>

        <FormField
          htmlFor="delete-login-reason"
          label="Reason"
          hint="At least a few words. This is what the audit entry will say."
        >
          <Textarea
            id="delete-login-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Created with the wrong email address."
            rows={3}
          />
        </FormField>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isBusy}>
            Cancel
          </Button>
          <Button onClick={submit} variant="destructive" disabled={isBusy || reason.trim().length < 3}>
            {isBusy && <Loader2 className="animate-spin" />}
            Delete login
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
