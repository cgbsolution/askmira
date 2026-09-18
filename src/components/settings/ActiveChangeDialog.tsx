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
import { patch } from "@/lib/api";
import type { ManagedUser } from "@/lib/types/admin";

import { errorDetail } from "./settingsShared";

/**
 * Disable or re-enable a login.
 *
 * Disabling is the fastest lever an admin has when somebody leaves or a
 * credential is suspected — it ends their live sessions rather than waiting
 * for a token to expire — so it is one confirmation away, with a reason that
 * lands in the audit trail.
 */
export function ActiveChangeDialog({
  target,
  onOpenChange,
  onChanged,
}: {
  target: ManagedUser | null;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}) {
  const [reason, setReason] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (target) setReason("");
  }, [target]);

  const disabling = target?.is_active ?? false;

  const submit = async () => {
    if (!target) return;
    setIsBusy(true);
    try {
      await patch(`/admin/users/${target.id}/active`, {
        active: !target.is_active,
        reason: reason.trim(),
      });
      toast.success(
        disabling
          ? `${target.full_name} can no longer sign in.`
          : `${target.full_name} can sign in again.`,
      );
      onChanged();
      onOpenChange(false);
    } catch (caught) {
      toast.error(errorDetail(caught, "Could not change the login."));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Dialog open={target !== null} onOpenChange={(next) => !isBusy && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {disabling ? "Disable" : "Enable"} {target?.full_name}&apos;s login
          </DialogTitle>
          <DialogDescription>
            {disabling
              ? "They are signed out everywhere immediately and cannot sign in again. Their records and history stay exactly as they are."
              : "They will be able to sign in again with their existing password."}
          </DialogDescription>
        </DialogHeader>

        <FormField
          htmlFor="active-change-reason"
          label="Reason"
          hint="At least a few words. This is what the audit entry will say."
        >
          <Textarea
            id="active-change-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={disabling ? "Left the company on 30 September." : "Returned from a career break."}
            rows={3}
          />
        </FormField>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isBusy}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            variant={disabling ? "destructive" : "default"}
            disabled={isBusy || reason.trim().length < 3}
          >
            {isBusy && <Loader2 className="animate-spin" />}
            {disabling ? "Disable login" : "Enable login"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
