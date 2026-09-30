"use client";

import { Copy, Loader2 } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { post } from "@/lib/api";
import type { ManagedUser, ManagedUserCreated } from "@/lib/types/admin";

import { errorDetail } from "./settingsShared";

/**
 * Issue a temporary password for someone who is locked out.
 *
 * Shown once, like a new login's; they must replace it when they sign in, and
 * every session they had ends now. Self-service "Forgot password?" on the
 * sign-in page is the first thing to suggest — this is for when email is not
 * getting through.
 */
export function ResetPasswordDialog({
  target,
  onOpenChange,
}: {
  target: ManagedUser | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [reason, setReason] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [issued, setIssued] = useState<string | null>(null);

  useEffect(() => {
    if (!target) return;
    setReason("");
    setIssued(null);
  }, [target]);

  const submit = async () => {
    if (!target) return;
    setIsBusy(true);
    try {
      const result = await post<ManagedUserCreated>(`/admin/users/${target.id}/reset-password`, {
        reason: reason.trim(),
      });
      setIssued(result.temporary_password);
    } catch (caught) {
      toast.error(errorDetail(caught, "Could not reset the password."));
    } finally {
      setIsBusy(false);
    }
  };

  const copy = async () => {
    if (!issued) return;
    try {
      await navigator.clipboard.writeText(issued);
      toast.success("Copied. Send it over a channel they already trust.");
    } catch {
      toast.error("Could not copy. Select the password and copy it by hand.");
    }
  };

  return (
    <Dialog open={target !== null} onOpenChange={(open) => !isBusy && onOpenChange(open)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Reset {target?.full_name}&apos;s password</DialogTitle>
          <DialogDescription>
            {issued
              ? "This password is shown once. They must change it when they sign in."
              : "They can also reset it themselves with “Forgot password?” on the sign-in page. Every session they have ends now."}
          </DialogDescription>
        </DialogHeader>
        {issued ? (
          <Alert>
            <AlertTitle>Temporary password</AlertTitle>
            <AlertDescription>
              <code className="mt-1 block rounded bg-muted px-3 py-2 font-mono text-sm text-foreground">
                {issued}
              </code>
            </AlertDescription>
          </Alert>
        ) : (
          <FormField htmlFor="reset-reason" label="Reason" hint="Recorded in the audit trail.">
            <Textarea
              id="reset-reason"
              rows={2}
              value={reason}
              placeholder="e.g. Locked out, reset email not arriving"
              onChange={(event) => setReason(event.target.value)}
            />
          </FormField>
        )}
        <DialogFooter>
          {issued ? (
            <>
              <Button variant="outline" onClick={copy}>
                <Copy /> Copy password
              </Button>
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </>
          ) : (
            <>
              <Button variant="outline" disabled={isBusy} onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button disabled={isBusy || reason.trim().length < 3} onClick={() => void submit()}>
                {isBusy && <Loader2 className="animate-spin" />} Issue temporary password
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
