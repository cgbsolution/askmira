"use client";

import { Loader2 } from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/common/FormField";
import { REQUISITION_STATUS } from "@/components/hiring/labels";
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
import { ApiError, post } from "@/lib/api";
import type { RequisitionDetail, RequisitionStatus } from "@/lib/types/hiring";

export type RequisitionStatusTarget = Extract<
  RequisitionStatus,
  "on_hold" | "open" | "closed" | "cancelled"
>;

export const STATUS_ACTION: Record<RequisitionStatusTarget, { label: string; explain: string }> = {
  on_hold: {
    label: "Put on hold",
    explain: "Sourcing pauses. Candidates already in the pipeline stay where they are.",
  },
  open: { label: "Reopen", explain: "The requisition goes back to open and can take candidates." },
  closed: { label: "Close", explain: "No further candidates are taken against this requisition." },
  cancelled: {
    label: "Cancel requisition",
    explain: "The requisition is withdrawn and any pending approvals stop.",
  },
};

/** Which HR status changes the API accepts from each status (mirrors the backend's table). */
export const STATUS_MOVES: Partial<Record<RequisitionStatus, RequisitionStatusTarget[]>> = {
  open: ["on_hold", "closed"],
  on_hold: ["open", "closed"],
  draft: ["cancelled"],
  rejected: ["cancelled"],
  pending_approval: ["cancelled"],
  fulfilled: ["closed"],
};

/** HR: hold, reopen, close or cancel a requisition — always with a reason on record. */
export function RequisitionStatusDialog({
  requisition,
  target,
  onOpenChange,
  onChanged,
}: {
  requisition: Pick<RequisitionDetail, "id" | "code">;
  /** The status to move to; `null` keeps the dialog closed. */
  target: RequisitionStatusTarget | null;
  onOpenChange: (open: boolean) => void;
  onChanged: (detail: RequisitionDetail) => void;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (target) {
      setReason("");
      setError(null);
    }
  }, [target]);

  const save = async () => {
    if (!target) return;
    if (reason.trim().length < 3) {
      setError("Give a reason; it is kept on the requisition's record.");
      return;
    }
    setIsSaving(true);
    try {
      const detail = await post<RequisitionDetail>(`/hiring/requisitions/${requisition.id}/status`, {
        status: target,
        reason: reason.trim(),
      });
      toast.success(`${requisition.code} is now ${(REQUISITION_STATUS[detail.status]?.[0] ?? detail.status).toLowerCase()}`);
      onOpenChange(false);
      onChanged(detail);
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.detail : "The status could not be changed.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={target !== null} onOpenChange={(next) => !isSaving && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {target ? STATUS_ACTION[target].label : ""} · {requisition.code}
          </DialogTitle>
          <DialogDescription>{target ? STATUS_ACTION[target].explain : ""}</DialogDescription>
        </DialogHeader>
        <FormField htmlFor="req-status-reason" label="Reason" error={error}>
          <Textarea
            id="req-status-reason"
            rows={3}
            maxLength={2000}
            value={reason}
            onChange={(event) => {
              setReason(event.target.value);
              if (error) setError(null);
            }}
          />
        </FormField>
        <DialogFooter>
          <Button variant="outline" disabled={isSaving} onClick={() => onOpenChange(false)}>
            Back
          </Button>
          <Button
            variant={target === "cancelled" || target === "closed" ? "destructive" : "default"}
            disabled={isSaving}
            onClick={() => void save()}
          >
            {isSaving && <Loader2 className="animate-spin" />}
            {target ? STATUS_ACTION[target].label : "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
