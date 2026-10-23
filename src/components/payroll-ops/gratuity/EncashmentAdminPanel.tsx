"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { CalendarClock, Coins, Loader2, Lock, Pencil, Plus } from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

import { DataTable } from "@/components/common/data-table/DataTable";
import { FormField } from "@/components/common/FormField";
import { Money } from "@/components/common/Money";
import { isWholeNumber, ToggleRow } from "@/components/payroll-ops/loans/common";
import { apiErrorMessage, InlineProblem, isMoneyInput } from "@/components/payroll-ops/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import { useApiQuery } from "@/hooks/useApiQuery";
import { patch, put } from "@/lib/api";
import type { LeaveType } from "@/lib/types";
import type {
  EncashmentPolicy,
  EncashmentPolicyInput,
  EncashmentRequest,
} from "@/lib/types/payroll-ops";
import { formatDays, formatMoney } from "@/lib/utils";

import { EncashmentRequestsTable } from "./EncashmentRequestsTable";
import { TextField } from "./TextField";

/** Leave encashment: the policy per leave type, and requests to decide. */
export function EncashmentAdminPanel({ isHr, isAdmin }: { isHr: boolean; isAdmin: boolean }) {
  return (
    <div className="space-y-4">
      <PoliciesPanel isAdmin={isAdmin} />
      <RequestsPanel canDecide={isHr} />
    </div>
  );
}

function PoliciesPanel({ isAdmin }: { isAdmin: boolean }) {
  const query = useApiQuery<EncashmentPolicy[]>("/encashment/policies");
  const [editing, setEditing] = useState<EncashmentPolicy | "new" | null>(null);
  // A 403 is "no access", not a failed load: retrying will not help.
  const forbidden = query.error?.status === 403;

  const columns: ColumnDef<EncashmentPolicy>[] = [
    {
      accessorKey: "leave_type_code",
      header: "Leave type",
      meta: {
        cellClassName: "font-medium text-foreground",
        text: (policy) =>
          policy.active ? policy.leave_type_code : `${policy.leave_type_code} · Inactive`,
      },
      cell: ({ row }) => (
        <>
          {row.original.leave_type_code}
          {!row.original.active && (
            <Badge variant="muted" className="ml-2">
              Inactive
            </Badge>
          )}
        </>
      ),
    },
    {
      id: "when",
      header: "When",
      accessorFn: (policy) =>
        [policy.encashable_in_service && "In service", policy.encashable_on_exit && "On exit"]
          .filter(Boolean)
          .join(", ") || "Never",
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          {row.original.encashable_in_service && <Badge variant="outline">In service</Badge>}
          {row.original.encashable_on_exit && <Badge variant="outline">On exit</Badge>}
          {!row.original.encashable_in_service && !row.original.encashable_on_exit && (
            <span className="text-sm text-muted-foreground">Never</span>
          )}
        </div>
      ),
    },
    {
      accessorKey: "max_days_per_year",
      header: "Max / year",
      sortingFn: "alphanumeric",
      meta: { className: "text-right", cellClassName: "tabular-nums" },
      cell: ({ row }) =>
        row.original.max_days_per_year ? formatDays(row.original.max_days_per_year) : "—",
    },
    {
      accessorKey: "cap_days",
      header: "Cap",
      sortingFn: "alphanumeric",
      meta: { className: "text-right", cellClassName: "tabular-nums" },
      cell: ({ row }) => (row.original.cap_days ? formatDays(row.original.cap_days) : "—"),
    },
    {
      accessorKey: "min_balance_after_encashment",
      header: "Keep after",
      sortingFn: "alphanumeric",
      meta: { className: "text-right", cellClassName: "tabular-nums" },
      cell: ({ row }) => formatDays(row.original.min_balance_after_encashment),
    },
    {
      id: "wage_basis",
      header: "Wage basis",
      accessorFn: (policy) =>
        `${policy.formula_basis.join(", ")} ÷ ${policy.days_per_month_divisor}`,
      meta: { cellClassName: "text-sm" },
      cell: ({ row }) => (
        <>
          {row.original.formula_basis.join(", ")}{" "}
          <span className="text-muted-foreground">÷ {row.original.days_per_month_divisor}</span>
        </>
      ),
    },
    {
      id: "tax",
      header: "Tax",
      accessorFn: (policy) =>
        [
          policy.in_service_fully_taxable ? "In service: fully taxable" : "In service: per server",
          policy.exempt_on_retirement
            ? `Retirement exempt${
                policy.retirement_exemption_ceiling
                  ? ` up to ${formatMoney(policy.retirement_exemption_ceiling)}`
                  : ""
              }`
            : null,
        ]
          .filter(Boolean)
          .join(" · "),
      meta: { cellClassName: "text-xs text-muted-foreground" },
      cell: ({ row }) => (
        <>
          {row.original.in_service_fully_taxable
            ? "In service: fully taxable"
            : "In service: per server"}
          {row.original.exempt_on_retirement && (
            <span className="block">
              Retirement exempt
              {row.original.retirement_exemption_ceiling && (
                <>
                  {" "}
                  up to <Money value={row.original.retirement_exemption_ceiling} />
                </>
              )}
            </span>
          )}
        </>
      ),
    },
    {
      id: "actions",
      header: "",
      enableHiding: false,
      meta: { className: "text-right", headClassName: "w-16", text: false },
      cell: ({ row }) =>
        isAdmin && (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Edit ${row.original.leave_type_code} policy`}
            onClick={() => setEditing(row.original)}
          >
            <Pencil />
          </Button>
        ),
    },
  ];

  return (
    <>
      <DataTable
        title="Encashment policies"
        description="Which leave can be encashed, when, how much, and how it is taxed. One policy per leave type."
        actions={
          isAdmin && (
            <Button size="sm" className="h-9" onClick={() => setEditing("new")}>
              <Plus /> New policy
            </Button>
          )
        }
        columns={columns}
        data={forbidden ? [] : (query.data ?? [])}
        noun="policies"
        exportName="encashment-policies"
        searchPlaceholder="Search policies"
        isLoading={query.isLoading && query.data === null}
        error={forbidden ? null : (query.error?.detail ?? null)}
        onRetry={query.reload}
        empty={
          forbidden
            ? { icon: Lock, title: "You don't have access to this", description: query.error?.detail }
            : {
                icon: Coins,
                title: "No encashment policies",
                description: "No leave type can be encashed until a policy exists for it.",
              }
        }
      />
      {isAdmin && (
        <PolicyDialog
          editing={editing}
          existingCodes={(query.data ?? []).map((policy) => policy.leave_type_code)}
          onClose={() => setEditing(null)}
          onSaved={query.reload}
        />
      )}
    </>
  );
}

interface PolicyForm {
  code: string;
  onExit: boolean;
  inService: boolean;
  maxPerYear: string;
  cap: string;
  minBalance: string;
  basis: string;
  divisor: string;
  exemptOnRetirement: boolean;
  retirementCeiling: string;
  fullyTaxable: boolean;
}

function toPolicyForm(policy: EncashmentPolicy | null): PolicyForm {
  return {
    code: policy?.leave_type_code ?? "",
    onExit: policy?.encashable_on_exit ?? true,
    inService: policy?.encashable_in_service ?? false,
    maxPerYear: policy?.max_days_per_year ?? "",
    cap: policy?.cap_days ?? "",
    minBalance: policy?.min_balance_after_encashment ?? "0",
    basis: policy ? policy.formula_basis.join(", ") : "",
    divisor: policy ? String(policy.days_per_month_divisor) : "",
    exemptOnRetirement: policy?.exempt_on_retirement ?? false,
    retirementCeiling: policy?.retirement_exemption_ceiling ?? "",
    fullyTaxable: policy?.in_service_fully_taxable ?? true,
  };
}

const DAYS_PATTERN = /^\d+(\.\d{1,2})?$/;

function PolicyDialog({
  editing,
  existingCodes,
  onClose,
  onSaved,
}: {
  editing: EncashmentPolicy | "new" | null;
  existingCodes: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const existing = editing && editing !== "new" ? editing : null;
  const [form, setForm] = useState<PolicyForm>(toPolicyForm(existing));
  const [problem, setProblem] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (editing === null) return;
    setForm(toPolicyForm(editing === "new" ? null : editing));
    setProblem(null);
  }, [editing]);

  const leaveTypesQuery = useApiQuery<LeaveType[]>(editing === "new" ? "/leave/types" : null);
  const leaveTypes = leaveTypesQuery.data;
  const leaveTypesError = leaveTypesQuery.error?.detail ?? null;

  const set = <K extends keyof PolicyForm>(key: K, value: PolicyForm[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const close = () => {
    if (!isBusy) onClose();
  };

  const submit = async () => {
    if (!form.code) return setProblem("Choose a leave type.");
    if (form.maxPerYear.trim() && !DAYS_PATTERN.test(form.maxPerYear.trim())) {
      return setProblem("Maximum days per year must be a number, or left blank.");
    }
    if (form.cap.trim() && !DAYS_PATTERN.test(form.cap.trim())) {
      return setProblem("The cap must be a number of days, or left blank.");
    }
    if (!DAYS_PATTERN.test(form.minBalance.trim())) {
      return setProblem("Minimum balance to keep must be a number of days (0 for none).");
    }
    const basis = form.basis
      .split(",")
      .map((code) => code.trim())
      .filter(Boolean);
    if (basis.length === 0) {
      return setProblem("List at least one salary component code for the wage basis.");
    }
    if (!isWholeNumber(form.divisor, 1)) {
      return setProblem("The days-per-month divisor must be a whole number above 0.");
    }
    if (
      form.exemptOnRetirement &&
      form.retirementCeiling.trim() &&
      !isMoneyInput(form.retirementCeiling)
    ) {
      return setProblem("The retirement exemption ceiling must be in rupees, or left blank.");
    }
    setProblem(null);
    setIsBusy(true);
    const body: EncashmentPolicyInput = {
      leave_type_code: form.code,
      encashable_on_exit: form.onExit,
      encashable_in_service: form.inService,
      max_days_per_year: form.maxPerYear.trim() || null,
      cap_days: form.cap.trim() || null,
      min_balance_after_encashment: form.minBalance.trim(),
      formula_basis: basis,
      days_per_month_divisor: Number(form.divisor.trim()),
      exempt_on_retirement: form.exemptOnRetirement,
      retirement_exemption_ceiling:
        form.exemptOnRetirement && form.retirementCeiling.trim()
          ? form.retirementCeiling.trim()
          : null,
      in_service_fully_taxable: form.fullyTaxable,
    };
    try {
      await put<EncashmentPolicy>("/encashment/policies", body);
      toast.success(`Encashment policy for ${body.leave_type_code} saved`);
      onClose();
      onSaved();
    } catch (error) {
      setProblem(apiErrorMessage(error, "The policy could not be saved."));
    } finally {
      setIsBusy(false);
    }
  };

  const availableTypes = (leaveTypes ?? []).filter((type) => !existingCodes.includes(type.code));

  return (
    <Dialog open={editing !== null} onOpenChange={(open) => !open && close()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {existing ? `Encashment policy · ${existing.leave_type_code}` : "New encashment policy"}
          </DialogTitle>
          <DialogDescription>Requests are capped by these limits on the server.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          {!existing && (
            <FormField htmlFor="policy-type" label="Leave type">
              {leaveTypesError ? (
                <InlineProblem>{leaveTypesError}</InlineProblem>
              ) : leaveTypes === null ? (
                <p className="text-sm text-muted-foreground">Loading leave types…</p>
              ) : availableTypes.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Every leave type already has an encashment policy.
                </p>
              ) : (
                <Select
                  value={form.code}
                  disabled={isBusy}
                  onValueChange={(value) => set("code", value)}
                >
                  <SelectTrigger id="policy-type" className="w-full">
                    <SelectValue placeholder="Choose a leave type" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTypes.map((type) => (
                      <SelectItem key={type.id} value={type.code}>
                        {type.name} ({type.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </FormField>
          )}

          <ToggleRow
            id="policy-in-service"
            label="Encashable while in service"
            checked={form.inService}
            disabled={isBusy}
            onChange={(checked) => set("inService", checked)}
          />
          <ToggleRow
            id="policy-on-exit"
            label="Encashable on exit"
            checked={form.onExit}
            disabled={isBusy}
            onChange={(checked) => set("onExit", checked)}
          />

          <div className="grid grid-cols-3 gap-3">
            <TextField
              id="policy-max-year"
              label="Max days / year"
              hint="In service only. At exit the whole balance is paid, up to the cap."
              optional
              numeric
              value={form.maxPerYear}
              disabled={isBusy}
              onChange={(value) => set("maxPerYear", value)}
            />
            <TextField
              id="policy-cap"
              label="Cap (days)"
              optional
              numeric
              value={form.cap}
              disabled={isBusy}
              onChange={(value) => set("cap", value)}
            />
            <TextField
              id="policy-min-balance"
              label="Keep at least (days)"
              hint="After an in-service encashment."
              required
              numeric
              value={form.minBalance}
              disabled={isBusy}
              onChange={(value) => set("minBalance", value)}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <TextField
              id="policy-basis"
              className="col-span-2"
              label="Wage basis (component codes, comma-separated)"
              required
              value={form.basis}
              disabled={isBusy}
              onChange={(value) => set("basis", value)}
            />
            <TextField
              id="policy-divisor"
              label="Days / month divisor"
              required
              numeric
              value={form.divisor}
              disabled={isBusy}
              onChange={(value) => set("divisor", value)}
            />
          </div>

          <ToggleRow
            id="policy-fully-taxable"
            label="In-service encashment is fully taxable"
            checked={form.fullyTaxable}
            disabled={isBusy}
            onChange={(checked) => set("fullyTaxable", checked)}
          />
          <ToggleRow
            id="policy-retirement"
            label="Exempt on retirement"
            checked={form.exemptOnRetirement}
            disabled={isBusy}
            onChange={(checked) => set("exemptOnRetirement", checked)}
          />
          {form.exemptOnRetirement && (
            <TextField
              id="policy-retirement-ceiling"
              label="Retirement exemption ceiling (₹)"
              optional
              numeric
              value={form.retirementCeiling}
              disabled={isBusy}
              onChange={(value) => set("retirementCeiling", value)}
            />
          )}

          {problem && <InlineProblem>{problem}</InlineProblem>}
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={isBusy} onClick={close}>
            Cancel
          </Button>
          <Button disabled={isBusy} onClick={() => void submit()}>
            {isBusy && <Loader2 className="animate-spin" />}
            Save policy
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RequestsPanel({ canDecide }: { canDecide: boolean }) {
  const { user } = useAuth();
  const [pendingOnly, setPendingOnly] = useState(true);
  const query = useApiQuery<EncashmentRequest[]>(
    `/encashment/requests?pending_only=${pendingOnly}`,
  );
  const [deciding, setDeciding] = useState<{
    request: EncashmentRequest;
    approve: boolean;
  } | null>(null);
  // A 403 is "no access", not a failed load: retrying will not help.
  const forbidden = query.error?.status === 403;

  return (
    <>
      <EncashmentRequestsTable
        title="Encashment requests"
        description="The server has already capped each request by policy and balance. An approved in-service encashment is paid in a future payroll run."
        filters={
          <div className="flex items-center gap-2">
            <Switch
              id="encash-pending-only"
              checked={pendingOnly}
              onCheckedChange={setPendingOnly}
            />
            <Label htmlFor="encash-pending-only">Pending only</Label>
          </div>
        }
        rows={forbidden ? [] : (query.data ?? [])}
        showEmployee
        actions={(row) => {
          const isOwn = Boolean(user?.employee_id) && row.employee_id === user?.employee_id;
          if (!canDecide || row.status !== "requested" || isOwn) return null;
          return (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setDeciding({ request: row, approve: false })}
              >
                Reject
              </Button>
              <Button size="sm" onClick={() => setDeciding({ request: row, approve: true })}>
                Approve
              </Button>
            </>
          );
        }}
        isLoading={query.isLoading && query.data === null}
        error={forbidden ? null : (query.error?.detail ?? null)}
        onRetry={query.reload}
        filtered={!forbidden && pendingOnly}
        empty={
          forbidden
            ? { icon: Lock, title: "You don't have access to this", description: query.error?.detail }
            : {
                icon: CalendarClock,
                title: "No encashment requests",
                description: "Requests employees make appear here.",
              }
        }
        emptyMessage={
          pendingOnly
            ? "No requests waiting for a decision. Turn off “Pending only” to see decided requests."
            : undefined
        }
      />
      <DecisionDialog
        decision={deciding}
        onClose={() => setDeciding(null)}
        onDecided={query.reload}
      />
    </>
  );
}

function DecisionDialog({
  decision,
  onClose,
  onDecided,
}: {
  decision: { request: EncashmentRequest; approve: boolean } | null;
  onClose: () => void;
  onDecided: () => void;
}) {
  const [note, setNote] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    setNote("");
    setProblem(null);
  }, [decision]);

  const submit = async () => {
    if (!decision) return;
    setIsBusy(true);
    setProblem(null);
    try {
      await patch<EncashmentRequest>(`/encashment/requests/${decision.request.id}`, {
        approve: decision.approve,
        note: note.trim() || null,
      });
      toast.success(decision.approve ? "Encashment approved" : "Encashment rejected");
      onClose();
      onDecided();
    } catch (error) {
      setProblem(apiErrorMessage(error, "The decision could not be saved."));
    } finally {
      setIsBusy(false);
    }
  };

  const request = decision?.request;

  return (
    <Dialog open={decision !== null} onOpenChange={(open) => !open && !isBusy && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {decision?.approve ? "Approve encashment?" : "Reject encashment?"}
          </DialogTitle>
          <DialogDescription>
            {request &&
              `${request.employee_name ?? "Employee"} · ${formatDays(request.days_approved)} days of ${request.leave_type_code}.`}
            {decision?.approve &&
              request &&
              !request.is_exit_encashment &&
              " It is paid in a future payroll run."}
          </DialogDescription>
        </DialogHeader>
        {request && (
          <p className="text-sm text-muted-foreground">
            Gross <Money value={request.gross_amount} className="font-medium text-foreground" />,
            of which taxable{" "}
            <Money value={request.taxable_amount} className="font-medium text-foreground" />.
          </p>
        )}
        <FormField htmlFor="encash-decision-note" label="Note" optional>
          <Textarea
            id="encash-decision-note"
            rows={3}
            maxLength={1000}
            value={note}
            disabled={isBusy}
            onChange={(event) => setNote(event.target.value)}
          />
        </FormField>
        {problem && <InlineProblem>{problem}</InlineProblem>}
        <DialogFooter>
          <Button variant="outline" disabled={isBusy} onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={decision?.approve ? "default" : "destructive"}
            disabled={isBusy}
            onClick={() => void submit()}
          >
            {isBusy && <Loader2 className="animate-spin" />}
            {decision?.approve ? "Approve" : "Reject"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
