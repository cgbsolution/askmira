"use client";

import { GitBranch, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { DataPanel } from "@/components/common/DataPanel";
import { FormField } from "@/components/common/FormField";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApiQuery } from "@/hooks/useApiQuery";
import { ApiError, del, patch, post } from "@/lib/api";
import type { ManagedUser } from "@/lib/types/admin";

type Process = "leave" | "expense";
type StepKind = "line_manager" | "skip_level" | "user" | "hr";

interface Step {
  kind: StepKind;
  user_id?: string;
}

interface Rule {
  id: string;
  process: Process;
  name: string;
  priority: number;
  active: boolean;
  min_amount: string | null;
  max_amount: string | null;
  min_days: string | null;
  leave_type_ids: string[];
  expense_categories: string[];
  department_ids: string[];
  location_ids: string[];
  steps: Step[];
  escalate_after_hours: number | null;
  description: string | null;
}

interface Option {
  id: string;
  name: string;
}

const STEP_LABEL: Record<StepKind, string> = {
  line_manager: "Line manager",
  skip_level: "Manager's manager",
  user: "A named person",
  hr: "Anybody in HR",
};

function failure(caught: unknown, fallback: string): string {
  return caught instanceof ApiError ? caught.detail : fallback;
}

/**
 * Who approves leave and expenses, in order, under which conditions. The first
 * active rule that matches (lowest priority number first) decides; with none,
 * the line manager approves alone. Requests already submitted keep their chain.
 */
export function ApprovalRulesPanel() {
  const { data, error, isLoading, reload } = useApiQuery<Rule[]>("/approvals/rules");
  const users = useApiQuery<ManagedUser[]>("/admin/users");
  const [editing, setEditing] = useState<Rule | "new" | null>(null);
  const [deleting, setDeleting] = useState<Rule | null>(null);

  const userName = (id?: string) => users.data?.find((u) => u.id === id)?.full_name ?? "someone";

  const remove = async () => {
    if (!deleting) return;
    try {
      await del(`/approvals/rules/${deleting.id}`);
      toast.success("Rule deleted.");
      reload();
    } catch (caught) {
      toast.error(failure(caught, "The rule could not be deleted."));
      throw caught;
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Alert>
        <GitBranch />
        <AlertDescription>
          With no rule, the line manager approves alone (HR when there is none). A step nobody can take — no manager,
          a deactivated login — is skipped; a step on the requester themselves is skipped too.
        </AlertDescription>
      </Alert>
      <DataPanel
        tier="tier1"
        title="Approval rules"
        actions={
          <Button size="sm" onClick={() => setEditing("new")}>
            <Plus /> New rule
          </Button>
        }
        isLoading={isLoading}
        error={error?.detail ?? null}
        onRetry={reload}
        isEmpty={(data ?? []).length === 0}
        empty={{ icon: GitBranch, title: "No rules yet", description: "Leave and expenses go to the line manager." }}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Rule</TableHead>
              <TableHead>When</TableHead>
              <TableHead>Approvers, in order</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data ?? []).map((rule) => (
              <TableRow key={rule.id}>
                <TableCell>
                  <div className="font-medium text-foreground">{rule.name}</div>
                  <div className="flex flex-wrap gap-1 pt-1">
                    <Badge variant="outline" className="capitalize">
                      {rule.process}
                    </Badge>
                    <Badge variant="muted">Priority {rule.priority}</Badge>
                    {!rule.active && <Badge variant="warning">Off</Badge>}
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {[
                    rule.min_amount && `from ₹${rule.min_amount}`,
                    rule.max_amount && `up to ₹${rule.max_amount}`,
                    rule.min_days && `${rule.min_days}+ days`,
                    rule.expense_categories.length > 0 && rule.expense_categories.join(", "),
                    rule.leave_type_ids.length > 0 && `${rule.leave_type_ids.length} leave type(s)`,
                    rule.department_ids.length > 0 && `${rule.department_ids.length} department(s)`,
                    rule.location_ids.length > 0 && `${rule.location_ids.length} location(s)`,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "Always"}
                  {rule.escalate_after_hours ? ` · escalates after ${rule.escalate_after_hours}h` : ""}
                </TableCell>
                <TableCell className="text-sm">
                  {rule.steps
                    .map((step) => (step.kind === "user" ? userName(step.user_id) : STEP_LABEL[step.kind]))
                    .join(" → ")}
                  {rule.process === "expense" && " → finance"}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" aria-label={`Edit ${rule.name}`} onClick={() => setEditing(rule)}>
                      <Pencil />
                    </Button>
                    <Button size="sm" variant="ghost" aria-label={`Delete ${rule.name}`} onClick={() => setDeleting(rule)}>
                      <Trash2 />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DataPanel>
      {editing && (
        <RuleDialog
          rule={editing === "new" ? null : editing}
          users={users.data ?? []}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete ${deleting?.name ?? ""}?`}
        description="New requests stop using it. Requests already submitted keep the chain they were given."
        confirmLabel="Delete rule"
        destructive
        onConfirm={remove}
      />
    </div>
  );
}

function RuleDialog({
  rule,
  users,
  onClose,
  onSaved,
}: {
  rule: Rule | null;
  users: ManagedUser[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const departments = useApiQuery<Option[]>("/org/departments");
  const locations = useApiQuery<Option[]>("/org/locations");
  const leaveTypes = useApiQuery<Option[]>("/leave/types");
  const [process, setProcess] = useState<Process>(rule?.process ?? "expense");
  const [name, setName] = useState(rule?.name ?? "");
  const [priority, setPriority] = useState(String(rule?.priority ?? 100));
  const [active, setActive] = useState(rule?.active ?? true);
  const [minAmount, setMinAmount] = useState(rule?.min_amount ?? "");
  const [maxAmount, setMaxAmount] = useState(rule?.max_amount ?? "");
  const [minDays, setMinDays] = useState(rule?.min_days ?? "");
  const [categories, setCategories] = useState((rule?.expense_categories ?? []).join(", "));
  const [leaveTypeIds, setLeaveTypeIds] = useState<Set<string>>(new Set(rule?.leave_type_ids ?? []));
  const [deptIds, setDeptIds] = useState<Set<string>>(new Set(rule?.department_ids ?? []));
  const [locIds, setLocIds] = useState<Set<string>>(new Set(rule?.location_ids ?? []));
  const [steps, setSteps] = useState<Step[]>(rule?.steps ?? [{ kind: "line_manager" }]);
  const [escalate, setEscalate] = useState(rule?.escalate_after_hours ? String(rule.escalate_after_hours) : "");
  const [busy, setBusy] = useState(false);

  const toggle = (set: Set<string>, id: string, on: boolean) => {
    const next = new Set(set);
    if (on) next.add(id);
    else next.delete(id);
    return next;
  };

  const save = async () => {
    setBusy(true);
    const body = {
      name: name.trim(),
      priority: Number(priority) || 100,
      active,
      min_amount: process === "expense" && minAmount ? minAmount : null,
      max_amount: process === "expense" && maxAmount ? maxAmount : null,
      min_days: process === "leave" && minDays ? minDays : null,
      expense_categories:
        process === "expense"
          ? categories
              .split(",")
              .map((c) => c.trim().toLowerCase())
              .filter(Boolean)
          : [],
      leave_type_ids: process === "leave" ? [...leaveTypeIds] : [],
      department_ids: [...deptIds],
      location_ids: [...locIds],
      steps,
      escalate_after_hours: escalate ? Number(escalate) : null,
    };
    try {
      if (rule) await patch(`/approvals/rules/${rule.id}`, body);
      else await post("/approvals/rules", { ...body, process });
      toast.success("Rule saved. New requests use it; submitted ones keep their chain.");
      onSaved();
    } catch (caught) {
      toast.error(failure(caught, "The rule could not be saved."));
    } finally {
      setBusy(false);
    }
  };

  const valid = name.trim() && steps.length > 0 && steps.every((s) => s.kind !== "user" || s.user_id);

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{rule ? `Edit ${rule.name}` : "New approval rule"}</DialogTitle>
          <DialogDescription>The first active rule that matches decides. Leave every condition empty to match everything.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <FormField htmlFor="rule-name" label="Name">
              <Input id="rule-name" maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
            </FormField>
            <FormField htmlFor="rule-process" label="For">
              <Select value={process} onValueChange={(v) => setProcess(v as Process)} disabled={rule !== null}>
                <SelectTrigger id="rule-process" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense">Expense claims</SelectItem>
                  <SelectItem value="leave">Leave requests</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
            <FormField htmlFor="rule-priority" label="Priority" hint="Lower runs first">
              <Input id="rule-priority" inputMode="numeric" value={priority} onChange={(e) => setPriority(e.target.value.replace(/\D/g, ""))} />
            </FormField>
          </div>

          {process === "expense" ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <FormField htmlFor="rule-min" label="From amount (₹)" optional>
                <Input id="rule-min" inputMode="decimal" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} />
              </FormField>
              <FormField htmlFor="rule-max" label="Up to amount (₹)" optional>
                <Input id="rule-max" inputMode="decimal" value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)} />
              </FormField>
              <FormField htmlFor="rule-cats" label="Categories" optional hint="Comma separated, e.g. hotel, airfare">
                <Input id="rule-cats" value={categories} onChange={(e) => setCategories(e.target.value)} />
              </FormField>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-3">
              <FormField htmlFor="rule-days" label="From days" optional>
                <Input id="rule-days" inputMode="decimal" value={minDays} onChange={(e) => setMinDays(e.target.value)} />
              </FormField>
              <fieldset className="grid gap-1.5 sm:col-span-2">
                <legend className="mb-1 text-sm font-medium">Leave types (none = all)</legend>
                <div className="flex flex-wrap gap-3">
                  {(leaveTypes.data ?? []).map((option) => (
                    <div key={option.id} className="flex items-center gap-1.5">
                      <Checkbox
                        id={`rule-lt-${option.id}`}
                        checked={leaveTypeIds.has(option.id)}
                        onCheckedChange={(on) => setLeaveTypeIds((c) => toggle(c, option.id, on === true))}
                      />
                      <Label htmlFor={`rule-lt-${option.id}`} className="text-sm font-normal">
                        {option.name}
                      </Label>
                    </div>
                  ))}
                </div>
              </fieldset>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <fieldset className="grid gap-1.5">
              <legend className="mb-1 text-sm font-medium">Departments (none = all)</legend>
              {(departments.data ?? []).map((option) => (
                <div key={option.id} className="flex items-center gap-1.5">
                  <Checkbox
                    id={`rule-dept-${option.id}`}
                    checked={deptIds.has(option.id)}
                    onCheckedChange={(on) => setDeptIds((c) => toggle(c, option.id, on === true))}
                  />
                  <Label htmlFor={`rule-dept-${option.id}`} className="text-sm font-normal">
                    {option.name}
                  </Label>
                </div>
              ))}
            </fieldset>
            <fieldset className="grid gap-1.5">
              <legend className="mb-1 text-sm font-medium">Locations (none = all)</legend>
              {(locations.data ?? []).map((option) => (
                <div key={option.id} className="flex items-center gap-1.5">
                  <Checkbox
                    id={`rule-loc-${option.id}`}
                    checked={locIds.has(option.id)}
                    onCheckedChange={(on) => setLocIds((c) => toggle(c, option.id, on === true))}
                  />
                  <Label htmlFor={`rule-loc-${option.id}`} className="text-sm font-normal">
                    {option.name}
                  </Label>
                </div>
              ))}
            </fieldset>
          </div>

          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-medium">Approvers, in order{process === "expense" ? " (finance decides last)" : ""}</legend>
            {steps.map((step, index) => (
              <div key={index} className="flex flex-wrap items-center gap-2">
                <span className="w-6 text-sm text-muted-foreground">{index + 1}.</span>
                <Select
                  value={step.kind}
                  onValueChange={(kind) =>
                    setSteps((current) => current.map((s, i) => (i === index ? { kind: kind as StepKind } : s)))
                  }
                >
                  <SelectTrigger className="w-52" aria-label={`Step ${index + 1}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(STEP_LABEL) as StepKind[]).map((kind) => (
                      <SelectItem key={kind} value={kind}>
                        {STEP_LABEL[kind]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {step.kind === "user" && (
                  <Select
                    value={step.user_id ?? ""}
                    onValueChange={(id) =>
                      setSteps((current) => current.map((s, i) => (i === index ? { kind: "user", user_id: id } : s)))
                    }
                  >
                    <SelectTrigger className="w-56" aria-label={`Step ${index + 1} person`}>
                      <SelectValue placeholder="Choose a person" />
                    </SelectTrigger>
                    <SelectContent>
                      {users
                        .filter((u) => u.is_active)
                        .map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.full_name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                )}
                {steps.length > 1 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Remove step ${index + 1}`}
                    onClick={() => setSteps((current) => current.filter((_, i) => i !== index))}
                  >
                    <X />
                  </Button>
                )}
              </div>
            ))}
            {steps.length < 5 && (
              <div>
                <Button size="sm" variant="outline" onClick={() => setSteps((current) => [...current, { kind: "hr" }])}>
                  <Plus /> Add a step
                </Button>
              </div>
            )}
          </fieldset>

          <div className="grid gap-3 sm:grid-cols-2">
            <FormField htmlFor="rule-escalate" label="Escalate after (hours)" optional hint="A step waiting longer goes to the approver's manager, else HR">
              <Input id="rule-escalate" inputMode="numeric" value={escalate} onChange={(e) => setEscalate(e.target.value.replace(/\D/g, ""))} />
            </FormField>
            <div className="flex items-center gap-3 pt-6">
              <Switch id="rule-active" checked={active} onCheckedChange={setActive} />
              <Label htmlFor="rule-active" className="text-sm font-normal">
                Active
              </Label>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={busy || !valid} onClick={() => void save()}>
            {busy && <Loader2 className="animate-spin" />} Save rule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
