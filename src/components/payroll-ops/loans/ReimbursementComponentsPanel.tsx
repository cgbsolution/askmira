"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { BellRing, Loader2, Lock, Plus, Wallet } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { DataTable } from "@/components/common/data-table/DataTable";
import { FormField } from "@/components/common/FormField";
import { Money } from "@/components/common/Money";
import {
  apiErrorMessage,
  InlineProblem,
  isMoneyInput,
  toastApiError,
} from "@/components/payroll-ops/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";
import { useApiQuery } from "@/hooks/useApiQuery";
import { post } from "@/lib/api";
import type {
  ReimbursementComponent,
  ReimbursementComponentInput,
} from "@/lib/types/payroll-ops";

import { ADMIN_ROLES, isWholeNumber, ToggleRow } from "./common";

const COMPONENT_COLUMNS: ColumnDef<ReimbursementComponent>[] = [
  {
    accessorKey: "name",
    header: "Component",
    meta: { text: (component) => `${component.name} ${component.code}` },
    cell: ({ row }) => (
      <>
        <span className="font-medium text-foreground">{row.original.name}</span>
        <span className="block text-xs text-muted-foreground">{row.original.code}</span>
      </>
    ),
  },
  {
    accessorKey: "annual_entitlement",
    header: "Annual entitlement",
    sortingFn: "alphanumeric",
    meta: { className: "text-right" },
    cell: ({ row }) => <Money value={row.original.annual_entitlement} />,
  },
  {
    accessorKey: "exemption_basis",
    header: "Exemption basis",
    meta: { className: "max-w-64", cellClassName: "text-sm text-muted-foreground" },
    cell: ({ row }) => row.original.exemption_basis ?? "—",
  },
  {
    accessorKey: "reminder_months_before_year_end",
    header: "Reminder",
    meta: { className: "text-right", cellClassName: "text-sm tabular-nums" },
    cell: ({ row }) => `${row.original.reminder_months_before_year_end} mo before year end`,
  },
  {
    id: "rules",
    header: "Rules",
    meta: {
      text: (component) =>
        [
          !component.active && "Inactive",
          component.bill_required && "Bill required",
          component.carry_forward_within_year && "Carries forward in year",
        ]
          .filter(Boolean)
          .join(", "),
    },
    cell: ({ row }) => (
      <div className="flex flex-wrap gap-1">
        {!row.original.active && <Badge variant="muted">Inactive</Badge>}
        {row.original.bill_required && <Badge variant="outline">Bill required</Badge>}
        {row.original.carry_forward_within_year && <Badge variant="outline">Carries forward in year</Badge>}
      </div>
    ),
  },
];

/** Reimbursement components (fuel, telephone, books…) and their yearly entitlements. */
export function ReimbursementComponentsPanel() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole(...ADMIN_ROLES);
  const query = useApiQuery<ReimbursementComponent[]>("/reimbursements/components");
  const [confirmReminders, setConfirmReminders] = useState(false);
  // A 403 reads as "no access", not as a failed load that a retry could fix.
  const forbidden = query.error?.status === 403;

  const runReminders = async () => {
    try {
      const result = await post<{ notifications_raised: number }>("/reimbursements/reminders/run");
      toast.success(
        `${result.notifications_raised} ${
          result.notifications_raised === 1 ? "reminder" : "reminders"
        } sent`,
      );
    } catch (error) {
      toastApiError(error, "Reminders could not be sent.");
      throw error;
    }
  };

  return (
    <>
      <DataTable
        title="Reimbursement components"
        description="The yearly entitlement for each component. Entitlement not claimed against bills by year end becomes taxable."
        actions={
          isAdmin && (
            <>
              <Button size="sm" variant="outline" className="h-9" onClick={() => setConfirmReminders(true)}>
                <BellRing /> Send reminders now
              </Button>
              <CreateComponentDialog onCreated={query.reload} />
            </>
          )
        }
        columns={COMPONENT_COLUMNS}
        data={forbidden ? [] : (query.data ?? [])}
        noun="components"
        exportName="reimbursement-components"
        searchPlaceholder="Search components"
        isLoading={query.isLoading && query.data === null}
        error={forbidden ? null : (query.error?.detail ?? null)}
        onRetry={query.reload}
        empty={
          forbidden
            ? { icon: Lock, title: "You don't have access to this", description: query.error?.detail }
            : {
                icon: Wallet,
                title: "No reimbursement components yet",
                description: isAdmin
                  ? "Add a component before employees can claim against it."
                  : "An admin has to add a component before employees can claim against it.",
              }
        }
      />

      <ConfirmDialog
        open={confirmReminders}
        onOpenChange={setConfirmReminders}
        title="Send unclaimed-entitlement reminders now?"
        description="Employees with entitlement still unclaimed inside each component's reminder window get a notification. There is no scheduler connected yet, so reminders go out only when someone runs this."
        confirmLabel="Send reminders"
        onConfirm={runReminders}
      />
    </>
  );
}

function CreateComponentDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [entitlement, setEntitlement] = useState("");
  const [exemptionBasis, setExemptionBasis] = useState("");
  const [billRequired, setBillRequired] = useState(true);
  const [carryForward, setCarryForward] = useState(true);
  const [reminderMonths, setReminderMonths] = useState("2");
  const [problem, setProblem] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const reset = () => {
    setCode("");
    setName("");
    setEntitlement("");
    setExemptionBasis("");
    setBillRequired(true);
    setCarryForward(true);
    setReminderMonths("2");
    setProblem(null);
  };

  const submit = async () => {
    if (!code.trim()) return setProblem("Enter a component code.");
    if (!name.trim()) return setProblem("Enter a component name.");
    if (!isMoneyInput(entitlement)) {
      return setProblem("Annual entitlement is required, in rupees with at most two decimals.");
    }
    if (!isWholeNumber(reminderMonths, 0, 12)) {
      return setProblem("Reminder months must be a whole number from 0 to 12.");
    }
    setProblem(null);
    setIsBusy(true);
    const body: ReimbursementComponentInput = {
      code: code.trim(),
      name: name.trim(),
      annual_entitlement: entitlement.trim(),
      exemption_basis: exemptionBasis.trim() || null,
      bill_required: billRequired,
      carry_forward_within_year: carryForward,
      reminder_months_before_year_end: Number(reminderMonths.trim()),
    };
    try {
      await post<ReimbursementComponent>("/reimbursements/components", body);
      toast.success(`Component “${body.name}” added`);
      setOpen(false);
      reset();
      onCreated();
    } catch (error) {
      setProblem(apiErrorMessage(error, "The component could not be added."));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (isBusy) return;
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" className="h-9">
          <Plus /> New component
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New reimbursement component</DialogTitle>
          <DialogDescription>The entitlement is per employee, per financial year.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-3">
            <FormField htmlFor="component-code" label="Code">
              <Input
                id="component-code"
                required
                value={code}
                disabled={isBusy}
                onChange={(event) => setCode(event.target.value)}
              />
            </FormField>
            <FormField htmlFor="component-name" label="Name">
              <Input
                id="component-name"
                required
                value={name}
                disabled={isBusy}
                onChange={(event) => setName(event.target.value)}
              />
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField htmlFor="component-entitlement" label="Annual entitlement (₹)">
              <Input
                id="component-entitlement"
                inputMode="decimal"
                className="tabular-nums"
                required
                value={entitlement}
                disabled={isBusy}
                onChange={(event) => setEntitlement(event.target.value)}
              />
            </FormField>
            <FormField htmlFor="component-reminder" label="Remind (months before year end)">
              <Input
                id="component-reminder"
                type="number"
                min={0}
                max={12}
                step={1}
                className="tabular-nums"
                required
                value={reminderMonths}
                disabled={isBusy}
                onChange={(event) => setReminderMonths(event.target.value)}
              />
            </FormField>
          </div>
          <FormField
            htmlFor="component-basis"
            label="Exemption basis"
            optional
            hint="The rule this exemption rests on, as your tax adviser gave it."
          >
            <Input
              id="component-basis"
              value={exemptionBasis}
              disabled={isBusy}
              onChange={(event) => setExemptionBasis(event.target.value)}
            />
          </FormField>
          <ToggleRow
            id="component-bill"
            label="Bill required"
            hint="A claim cannot be submitted without a PDF or image of the bill."
            checked={billRequired}
            disabled={isBusy}
            onChange={setBillRequired}
          />
          <ToggleRow
            id="component-carry"
            label="Carry forward within the year"
            hint="Unused monthly entitlement rolls into later months of the same year."
            checked={carryForward}
            disabled={isBusy}
            onChange={setCarryForward}
          />
          {problem && <InlineProblem>{problem}</InlineProblem>}
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={isBusy} onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button disabled={isBusy} onClick={() => void submit()}>
            {isBusy && <Loader2 className="animate-spin" />}
            Add component
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
