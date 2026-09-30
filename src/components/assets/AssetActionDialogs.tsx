"use client";

import { Loader2 } from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

import { DatePicker } from "@/components/common/DatePicker";
import { EmployeePicker } from "@/components/common/EmployeePicker";
import { FormField } from "@/components/common/FormField";
import { apiErrorMessage, InlineProblem } from "@/components/payroll-ops/shared";
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
import { Textarea } from "@/components/ui/textarea";
import { post } from "@/lib/api";
import type { EmployeeSummary } from "@/lib/types";
import type { Asset, AssetAssignment, AssetCondition, AssetStatus } from "@/lib/types/assets";

import {
  CONDITION_LABELS,
  isAmount,
  STATUS_LABELS,
  STATUS_TRANSITIONS,
  todayISO,
  useAssetRoles,
} from "./shared";

/**
 * The register's three custody actions — hand over, take back, change status —
 * each a dialog that shows the server's refusal word for word and stays open
 * until the action succeeds.
 */

function ActionDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  destructive = false,
  isBusy,
  error,
  onConfirm,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  confirmLabel: string;
  destructive?: boolean;
  isBusy: boolean;
  error: string | null;
  onConfirm: () => void;
  children: React.ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !isBusy && onOpenChange(next)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="grid gap-4">
          {children}
          {error && <InlineProblem>{error}</InlineProblem>}
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={isBusy} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            disabled={isBusy}
            onClick={onConfirm}
          >
            {isBusy && <Loader2 className="animate-spin" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConditionSelect({
  id,
  value,
  onChange,
  disabled,
}: {
  id: string;
  value: AssetCondition;
  onChange: (value: AssetCondition) => void;
  disabled: boolean;
}) {
  return (
    <Select value={value} disabled={disabled} onValueChange={(v) => onChange(v as AssetCondition)}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {(Object.keys(CONDITION_LABELS) as AssetCondition[]).map((condition) => (
          <SelectItem key={condition} value={condition}>
            {CONDITION_LABELS[condition]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ── Hand over ───────────────────────────────────────────────────────────────

export function AssignDialog({
  asset,
  open,
  onOpenChange,
  onDone,
}: {
  asset: Asset;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const { ownEmployeeId } = useAssetRoles();
  const [employee, setEmployee] = useState<EmployeeSummary | null>(null);
  const [dueBack, setDueBack] = useState("");
  const [condition, setCondition] = useState<AssetCondition>(asset.condition);
  const [notes, setNotes] = useState("");
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setEmployee(null);
    setDueBack("");
    setCondition(asset.condition);
    setNotes("");
    setTouched(false);
    setError(null);
  }, [open, asset.condition]);

  const submit = async () => {
    setTouched(true);
    if (!employee) return;
    setIsBusy(true);
    setError(null);
    try {
      await post<AssetAssignment>(`/assets/${asset.id}/assign`, {
        employee_id: employee.id,
        expected_return_date: dueBack || null,
        condition_out: condition,
        notes: notes.trim() || null,
      });
      toast.success(`${asset.asset_tag} handed over`, {
        description: "They have been told and asked to acknowledge it.",
      });
      onOpenChange(false);
      onDone();
    } catch (caught) {
      setError(apiErrorMessage(caught, "The asset could not be handed over."));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <ActionDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Hand over ${asset.asset_tag}`}
      description={`${asset.name}. If the person is serving notice, it goes on their exit checklist too.`}
      confirmLabel="Hand over"
      isBusy={isBusy}
      error={error}
      onConfirm={() => void submit()}
    >
      <FormField
        htmlFor="assign-employee"
        label="Employee"
        required
        error={touched && !employee ? "Choose who receives it." : null}
      >
        <EmployeePicker
          id="assign-employee"
          value={employee}
          onChange={setEmployee}
          excludeId={ownEmployeeId}
          invalid={touched && !employee}
          disabled={isBusy}
        />
      </FormField>
      <FormField htmlFor="assign-due" label="Expected back" optional hint="Leave empty for a permanent issue.">
        <DatePicker
          id="assign-due"
          value={dueBack}
          min={todayISO()}
          disabled={isBusy}
          onChange={setDueBack}
        />
      </FormField>
      <FormField htmlFor="assign-condition" label="Condition at hand-over">
        <ConditionSelect
          id="assign-condition"
          value={condition}
          onChange={setCondition}
          disabled={isBusy}
        />
      </FormField>
      <FormField htmlFor="assign-notes" label="Notes" optional>
        <Textarea
          id="assign-notes"
          rows={2}
          maxLength={2000}
          value={notes}
          disabled={isBusy}
          placeholder="e.g. With charger and bag"
          onChange={(event) => setNotes(event.target.value)}
        />
      </FormField>
    </ActionDialog>
  );
}

// ── Take back ───────────────────────────────────────────────────────────────

export function ReturnDialog({
  assignment,
  open,
  onOpenChange,
  onDone,
}: {
  assignment: AssetAssignment;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const [condition, setCondition] = useState<AssetCondition>("good");
  const [nextStatus, setNextStatus] = useState<"in_stock" | "in_repair">("in_stock");
  const [recovery, setRecovery] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCondition(assignment.condition_out === "new" ? "good" : assignment.condition_out);
    setNextStatus("in_stock");
    setRecovery("");
    setNotes("");
    setError(null);
  }, [open, assignment.condition_out]);

  const damaged = condition === "damaged";
  const recoveryInvalid = damaged && recovery.trim() !== "" && !isAmount(recovery);

  const submit = async () => {
    if (recoveryInvalid) return;
    setIsBusy(true);
    setError(null);
    try {
      await post<AssetAssignment>(`/assets/assignments/${assignment.id}/return`, {
        condition_in: condition,
        next_status: nextStatus,
        notes: notes.trim() || null,
        recovery_amount: damaged && recovery.trim() ? recovery.trim() : null,
      });
      toast.success(`${assignment.asset_tag} received back`);
      onOpenChange(false);
      onDone();
    } catch (caught) {
      setError(apiErrorMessage(caught, "The return could not be recorded."));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <ActionDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Receive ${assignment.asset_tag} back`}
      description={`From ${assignment.employee_name ?? "the holder"}. If they are leaving, their exit checklist item is signed off too.`}
      confirmLabel="Record return"
      isBusy={isBusy}
      error={error}
      onConfirm={() => void submit()}
    >
      <FormField htmlFor="return-condition" label="Condition it came back in">
        <ConditionSelect
          id="return-condition"
          value={condition}
          onChange={(value) => {
            setCondition(value);
            if (value === "damaged") setNextStatus("in_repair");
          }}
          disabled={isBusy}
        />
      </FormField>
      <FormField htmlFor="return-next" label="Goes to">
        <Select
          value={nextStatus}
          disabled={isBusy}
          onValueChange={(value) => setNextStatus(value as "in_stock" | "in_repair")}
        >
          <SelectTrigger id="return-next" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="in_stock">Back in stock</SelectItem>
            <SelectItem value="in_repair">In for repair</SelectItem>
          </SelectContent>
        </Select>
      </FormField>
      {damaged && (
        <FormField
          htmlFor="return-recovery"
          label="Recover from the employee (₹)"
          optional
          hint="Recorded on the hand-over. At exit it reaches the full & final settlement."
          error={recoveryInvalid ? "Enter an amount like 2500 or 2500.50." : null}
        >
          <Input
            id="return-recovery"
            inputMode="decimal"
            value={recovery}
            disabled={isBusy}
            aria-invalid={recoveryInvalid}
            placeholder="0.00"
            onChange={(event) => setRecovery(event.target.value)}
          />
        </FormField>
      )}
      <FormField htmlFor="return-notes" label="Notes" optional>
        <Textarea
          id="return-notes"
          rows={2}
          maxLength={2000}
          value={notes}
          disabled={isBusy}
          placeholder={damaged ? "What is damaged" : "e.g. Returned with charger"}
          onChange={(event) => setNotes(event.target.value)}
        />
      </FormField>
    </ActionDialog>
  );
}

// ── Status ──────────────────────────────────────────────────────────────────

export function StatusDialog({
  asset,
  open,
  onOpenChange,
  onDone,
}: {
  asset: Asset;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const targets = STATUS_TRANSITIONS[asset.status];
  const [target, setTarget] = useState<AssetStatus | "">("");
  const [reason, setReason] = useState("");
  const [recovery, setRecovery] = useState("");
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTarget(targets.length === 1 ? targets[0] : "");
    setReason("");
    setRecovery("");
    setTouched(false);
    setError(null);
  }, [open, targets]);

  const heldAndLost = asset.status === "assigned" && target === "lost";
  const recoveryInvalid = heldAndLost && recovery.trim() !== "" && !isAmount(recovery);

  const submit = async () => {
    setTouched(true);
    if (!target || !reason.trim() || recoveryInvalid) return;
    setIsBusy(true);
    setError(null);
    try {
      await post<Asset>(`/assets/${asset.id}/status`, {
        status: target,
        reason: reason.trim(),
        recovery_amount: heldAndLost && recovery.trim() ? recovery.trim() : null,
      });
      toast.success(`${asset.asset_tag} is now ${STATUS_LABELS[target].toLowerCase()}`);
      onOpenChange(false);
      onDone();
    } catch (caught) {
      setError(apiErrorMessage(caught, "The status could not be changed."));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <ActionDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Change the status of ${asset.asset_tag}`}
      description={
        asset.status === "assigned"
          ? "An asset somebody holds can only be reported lost here. To take it back, record a return."
          : "Every change keeps its reason on the asset's record."
      }
      confirmLabel="Change status"
      destructive={target === "lost" || target === "disposed"}
      isBusy={isBusy}
      error={error}
      onConfirm={() => void submit()}
    >
      <FormField
        htmlFor="status-target"
        label="New status"
        error={touched && !target ? "Choose the new status." : null}
      >
        <Select
          value={target}
          disabled={isBusy}
          onValueChange={(value) => setTarget(value as AssetStatus)}
        >
          <SelectTrigger id="status-target" className="w-full" aria-invalid={touched && !target}>
            <SelectValue placeholder="Choose a status" />
          </SelectTrigger>
          <SelectContent>
            {targets.map((value) => (
              <SelectItem key={value} value={value}>
                {STATUS_LABELS[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>
      <FormField
        htmlFor="status-reason"
        label="Reason"
        error={touched && !reason.trim() ? "Say why." : null}
      >
        <Textarea
          id="status-reason"
          rows={3}
          maxLength={2000}
          value={reason}
          disabled={isBusy}
          aria-invalid={touched && !reason.trim()}
          placeholder="e.g. Screen replaced by the vendor; stolen, FIR filed"
          onChange={(event) => setReason(event.target.value)}
        />
      </FormField>
      {heldAndLost && (
        <FormField
          htmlFor="status-recovery"
          label="Recover from the holder (₹)"
          optional
          hint="Leave empty to decide at exit clearance, where the book value is offered."
          error={recoveryInvalid ? "Enter an amount like 25000 or 25000.50." : null}
        >
          <Input
            id="status-recovery"
            inputMode="decimal"
            value={recovery}
            disabled={isBusy}
            aria-invalid={recoveryInvalid}
            placeholder="0.00"
            onChange={(event) => setRecovery(event.target.value)}
          />
        </FormField>
      )}
    </ActionDialog>
  );
}
