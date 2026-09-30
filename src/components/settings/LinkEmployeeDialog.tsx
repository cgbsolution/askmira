"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { EmployeePicker } from "@/components/common/EmployeePicker";
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
import type { EmployeeSummary } from "@/lib/types";
import type { ManagedUser } from "@/lib/types/admin";

import { errorDetail } from "./settingsShared";

/**
 * Link a login to its employee record, or unlink it.
 *
 * Every self-service screen — punching, leave, payslips, documents — finds
 * "me" through this link, so a login without it can sign in and do nothing
 * of their own. The reason is kept in the audit trail.
 */
export function LinkEmployeeDialog({
  target,
  onOpenChange,
  onChanged,
}: {
  target: ManagedUser | null;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}) {
  const [employee, setEmployee] = useState<EmployeeSummary | null>(null);
  const [reason, setReason] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (!target) return;
    setEmployee(null);
    setReason(target.employee_id ? "" : "Link login to employee record");
  }, [target]);

  const save = async (employeeId: string | null) => {
    if (!target) return;
    setIsBusy(true);
    try {
      await patch<ManagedUser>(`/admin/users/${target.id}/employee`, {
        employee_id: employeeId,
        reason: reason.trim(),
      });
      toast.success(
        employeeId ? `Linked ${target.full_name} to their employee record` : `Unlinked ${target.full_name}`,
      );
      onChanged();
      onOpenChange(false);
    } catch (caught) {
      toast.error(errorDetail(caught, "Could not change the link."));
    } finally {
      setIsBusy(false);
    }
  };

  const reasonOk = reason.trim().length >= 3;

  return (
    <Dialog open={target !== null} onOpenChange={(open) => !isBusy && onOpenChange(open)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Employee record for {target?.full_name}</DialogTitle>
          <DialogDescription>
            {target?.employee_name
              ? `Currently linked to ${target.employee_name}${target.employee_code ? ` (${target.employee_code})` : ""}.`
              : "This login is not linked to anyone, so its self-service screens are empty."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <FormField htmlFor="link-employee" label="Link to">
            <EmployeePicker
              id="link-employee"
              value={employee}
              onChange={setEmployee}
              excludeId={target?.employee_id ?? null}
            />
          </FormField>
          <FormField
            htmlFor="link-reason"
            label="Reason"
            hint="Recorded in the audit trail."
            error={reason && !reasonOk ? "Give a reason of at least 3 characters." : null}
          >
            <Textarea
              id="link-reason"
              rows={2}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </FormField>
        </div>
        <DialogFooter className="gap-2">
          {target?.employee_id && (
            <Button
              variant="outline"
              className="text-destructive sm:mr-auto"
              disabled={isBusy || !reasonOk}
              onClick={() => void save(null)}
            >
              Unlink
            </Button>
          )}
          <Button variant="outline" disabled={isBusy} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={isBusy || !employee || !reasonOk} onClick={() => void save(employee?.id ?? null)}>
            {isBusy && <Loader2 className="animate-spin" />} Link
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
