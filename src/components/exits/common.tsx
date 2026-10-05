"use client";

import { Loader2 } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";

import { DataPanel } from "@/components/common/DataPanel";
import { FormField } from "@/components/common/FormField";
import { PersonCell } from "@/components/common/PersonCell";
import { apiErrorMessage, ForbiddenState, InlineProblem } from "@/components/payroll-ops/shared";
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
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import type {
  ClearanceItem,
  ClearanceOwnerRole,
  ClearanceStatus,
  ExitStatus,
  ExitType,
  SettlementStatus,
} from "@/lib/types/payroll-ops";
import type { ApiError } from "@/lib/api";
import type { Audience, UserRole } from "@/lib/types";
import { formatDate, formatDay } from "@/lib/utils";

/**
 * Shared pieces for the exit and full & final screens (prompt 13).
 *
 * Every label here names a value the API sent; nothing is derived or guessed.
 */

// ── Roles ───────────────────────────────────────────────────────────────────

export const HR_ROLES: UserRole[] = ["admin", "sub_admin"];
export const ADMIN_ROLES: UserRole[] = ["admin"];
export const MANAGER_ROLES: Audience[] = [...HR_ROLES, "manager"];

export function useExitRoles() {
  const { user, hasRole } = useAuth();
  return {
    isHr: hasRole(...HR_ROLES),
    isAdmin: hasRole(...ADMIN_ROLES),
    isManager: hasRole(...MANAGER_ROLES),
    /** The caller's own employee id: nobody acts on their own exit or settlement. */
    ownEmployeeId: user?.employee_id ?? null,
  };
}

/**
 * Reload a `useApiQuery` when a parent's change counter moves, without a
 * second request on mount.
 */
export function useReloadOn(version: number, reload: () => void) {
  const isFirst = useRef(true);
  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false;
      return;
    }
    reload();
  }, [version, reload]);
}

// ── Labels ──────────────────────────────────────────────────────────────────

export const EXIT_TYPE_LABELS: Record<ExitType, string> = {
  resignation: "Resignation",
  termination: "Termination",
  retirement: "Retirement",
  absconding: "Absconding",
  death: "Death",
  end_of_contract: "End of contract",
};

export const EXIT_STATUS_LABELS: Record<ExitStatus, string> = {
  initiated: "Initiated",
  notice_period: "Serving notice",
  clearance_pending: "Clearance pending",
  settlement_pending: "Settlement pending",
  settled: "Settled",
  on_hold: "On hold",
  cancelled: "Cancelled",
};

export const SETTLEMENT_STATUS_LABELS: Record<SettlementStatus, string> = {
  draft: "Computed",
  pending_approval: "Awaiting approval",
  approved: "Approved for payment",
  on_hold: "On hold",
  paid: "Paid",
  demand_raised: "Demand raised",
};

export const CLEARANCE_STATUS_LABELS: Record<ClearanceStatus, string> = {
  pending: "Pending",
  cleared: "Cleared",
  cleared_with_recovery: "Cleared with recovery",
  waived: "Waived",
};

export const OWNER_ROLE_LABELS: Record<ClearanceOwnerRole, string> = {
  hr: "HR",
  reporting_manager: "Reporting manager",
  named_user: "Named person",
};

type BadgeVariant = React.ComponentProps<typeof Badge>["variant"];

const EXIT_STATUS_VARIANT: Record<ExitStatus, BadgeVariant> = {
  initiated: "secondary",
  notice_period: "secondary",
  clearance_pending: "warning",
  settlement_pending: "warning",
  settled: "success",
  on_hold: "destructive",
  cancelled: "muted",
};

const SETTLEMENT_STATUS_VARIANT: Record<SettlementStatus, BadgeVariant> = {
  draft: "secondary",
  pending_approval: "warning",
  approved: "success",
  on_hold: "destructive",
  paid: "success",
  demand_raised: "destructive",
};

const CLEARANCE_STATUS_VARIANT: Record<ClearanceStatus, BadgeVariant> = {
  pending: "warning",
  cleared: "success",
  cleared_with_recovery: "accent",
  waived: "muted",
};

export function ExitStatusBadge({ status }: { status: ExitStatus }) {
  return <Badge variant={EXIT_STATUS_VARIANT[status]}>{EXIT_STATUS_LABELS[status] ?? status}</Badge>;
}

export function SettlementStatusBadge({ status }: { status: SettlementStatus | null }) {
  if (!status) return <span className="text-sm text-muted-foreground">Not computed</span>;
  return (
    <Badge variant={SETTLEMENT_STATUS_VARIANT[status]}>
      {SETTLEMENT_STATUS_LABELS[status] ?? status}
    </Badge>
  );
}

export function ClearanceStatusBadge({ status }: { status: ClearanceStatus }) {
  return (
    <Badge variant={CLEARANCE_STATUS_VARIANT[status]}>
      {CLEARANCE_STATUS_LABELS[status] ?? status}
    </Badge>
  );
}

/** Who signs an item off, as the API described it. */
export function ownerLabel(item: Pick<ClearanceItem, "owner_role" | "owner_name">): string {
  if (item.owner_role === "named_user") return item.owner_name ?? "Named person";
  return OWNER_ROLE_LABELS[item.owner_role] ?? item.owner_role;
}

// ── Formatting ──────────────────────────────────────────────────────────────

/** A calendar date ("2026-09-30") or a dash. */
export function dayOrDash(value: string | null | undefined): string {
  return value ? formatDay(value, true) : "—";
}

/** A timestamp or a dash. */
export function timestampOrDash(value: string | null | undefined): string {
  return value ? formatDate(value) : "—";
}

export function personLabel(name: string | null, code: string | null): string {
  if (name && code) return `${name} (${code})`;
  return name ?? code ?? "Unnamed employee";
}

export function pluralCount(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** An employee in a table: avatar, name and employee code. */
export function ExitPersonCell({ name, code }: { name: string | null; code: string | null }) {
  return (
    <PersonCell
      size="sm"
      name={name ?? code ?? "Unnamed employee"}
      subtitle={name && code ? code : undefined}
    />
  );
}

type Query<T> = { data: T | null; error: ApiError | null; isLoading: boolean; reload: () => void };

/**
 * `DataPanel` driven by a `useApiQuery` result: skeleton while loading, the
 * API's refusal as a 403 state, other errors with a retry, then the rows.
 */
export function QueryPanel<T>({
  query,
  isEmpty,
  children,
  ...panel
}: Omit<
  React.ComponentProps<typeof DataPanel>,
  "isLoading" | "error" | "onRetry" | "isEmpty" | "children"
> & {
  query: Query<T>;
  isEmpty: (data: T) => boolean;
  children: (data: T) => React.ReactNode;
}) {
  const forbidden = query.error?.status === 403;
  const data = query.data;
  return (
    <DataPanel
      {...panel}
      isLoading={query.isLoading && data === null}
      error={forbidden ? null : (query.error?.detail ?? null)}
      onRetry={query.reload}
      isEmpty={!forbidden && data !== null && isEmpty(data)}
    >
      {forbidden ? (
        <ForbiddenState message={query.error?.detail} />
      ) : data !== null ? (
        children(data)
      ) : null}
    </DataPanel>
  );
}

/** A label/value row in a detail panel. */
export function Fact({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm text-foreground tabular-nums">{children}</dd>
    </div>
  );
}

// ── Reason dialog ───────────────────────────────────────────────────────────

/**
 * An action that needs a written reason (cancel an exit, waive notice, put a
 * settlement on hold). The server's refusal is shown verbatim inside the
 * dialog, which stays open until the action succeeds.
 */
export function ReasonDialog({
  open,
  onOpenChange,
  title,
  description,
  label,
  placeholder,
  confirmLabel,
  required = true,
  destructive = false,
  children,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  label: string;
  placeholder?: string;
  confirmLabel: string;
  required?: boolean;
  destructive?: boolean;
  children?: React.ReactNode;
  onSubmit: (text: string) => Promise<void>;
}) {
  const [text, setText] = useState("");
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const missing = required && text.trim() === "";

  const close = (next: boolean) => {
    if (isBusy) return;
    onOpenChange(next);
    if (!next) {
      setText("");
      setTouched(false);
      setError(null);
    }
  };

  const submit = async () => {
    setTouched(true);
    if (missing) return;
    setIsBusy(true);
    setError(null);
    try {
      await onSubmit(text.trim());
      setText("");
      setTouched(false);
      onOpenChange(false);
    } catch (caught) {
      setError(apiErrorMessage(caught, "This could not be saved."));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="grid gap-4">
          {children}
          <FormField
            htmlFor="exit-reason-text"
            label={label}
            optional={!required}
            error={touched && missing ? `${label} is required.` : null}
          >
            <Textarea
              id="exit-reason-text"
              rows={3}
              maxLength={2000}
              value={text}
              placeholder={placeholder}
              disabled={isBusy}
              aria-invalid={touched && missing}
              onChange={(event) => setText(event.target.value)}
            />
          </FormField>
          {error && <InlineProblem>{error}</InlineProblem>}
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={isBusy} onClick={() => close(false)}>
            Cancel
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            disabled={isBusy}
            onClick={() => void submit()}
          >
            {isBusy && <Loader2 className="animate-spin" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
