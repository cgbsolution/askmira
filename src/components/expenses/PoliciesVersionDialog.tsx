"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Loader2, Plus, Trash2 } from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

import { DataTable } from "@/components/common/data-table/DataTable";
import { InlineProblem, MONEY_RE, errorDetail, todayISO } from "@/components/expenses/ReviewCommon";
import { CITY_TIER_LABEL, LIMIT_TYPE_LABEL, VIOLATION_ACTION_LABEL } from "@/components/expenses/shared";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { post } from "@/lib/api";
import type {
  CityTier,
  LimitType,
  OrgLocation,
  Policy,
  PolicyInput,
  RuleInput,
  ViolationAction,
} from "@/lib/types/expenses";
import { cn } from "@/lib/utils";

type RuleRow = RuleInput & { key: number };

let nextKey = 1;

function blankRule(): RuleRow {
  return {
    key: nextKey++,
    category_key: "",
    city_tier: "a",
    limit_type: "per_claim",
    limit_amount: "",
    violation_action: "flag",
    requires_receipt: true,
    receipt_threshold: "0",
    requires_pre_approval: false,
    is_per_diem: false,
  };
}

const CATEGORY_RE = /^[a-z0-9_]{1,64}$/;

/** The rules editor is a grid of inputs: every cell keeps its compact padding. */
const GRID = { className: "px-2 py-2" };

/**
 * Create a policy, or a new version of one. The existing version is never
 * touched; this always inserts.
 */
export function PoliciesVersionDialog({
  open,
  base,
  locations,
  locationsError,
  onClose,
  onSaved,
}: {
  open: boolean;
  base: Policy | null;
  locations: OrgLocation[];
  locationsError: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState(todayISO());
  const [description, setDescription] = useState("");
  const [grades, setGrades] = useState("");
  const [locationIds, setLocationIds] = useState<string[]>([]);
  const [rules, setRules] = useState<RuleRow[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(base?.name ?? "");
    setEffectiveFrom(todayISO());
    setDescription(base?.description ?? "");
    setGrades(base?.applicable_grades.join(", ") ?? "");
    setLocationIds(base?.applicable_locations ?? []);
    setRules(
      base && base.rules.length > 0
        ? base.rules.map((rule) => ({
            key: nextKey++,
            category_key: rule.category_key,
            city_tier: rule.city_tier,
            limit_type: rule.limit_type,
            limit_amount: rule.limit_amount,
            violation_action: rule.violation_action,
            requires_receipt: rule.requires_receipt,
            receipt_threshold: rule.receipt_threshold,
            requires_pre_approval: rule.requires_pre_approval,
            is_per_diem: rule.is_per_diem,
          }))
        : [blankRule()],
    );
    setProblem(null);
    setTouched(false);
  }, [open, base]);

  const update = (key: number, patch: Partial<RuleInput>) =>
    setRules((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  const ruleProblems = (rule: RuleRow) => ({
    category: !CATEGORY_RE.test(rule.category_key),
    amount: !MONEY_RE.test(rule.limit_amount),
    threshold: !MONEY_RE.test(rule.receipt_threshold),
  });

  const valid =
    name.trim().length > 0 &&
    Boolean(effectiveFrom) &&
    rules.length > 0 &&
    rules.every((rule) => {
      const p = ruleProblems(rule);
      return !p.category && !p.amount && !p.threshold;
    });

  const columns: ColumnDef<RuleRow>[] = [
    {
      id: "category_key",
      header: "Category key",
      meta: GRID,
      cell: ({ row }) => (
        <Input
          aria-label={`Rule ${row.index + 1} category key`}
          value={row.original.category_key}
          aria-invalid={touched && ruleProblems(row.original).category}
          className={cn("h-8 w-40 font-normal")}
          onChange={(event) =>
            update(row.original.key, {
              category_key: event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"),
            })
          }
        />
      ),
    },
    {
      id: "city_tier",
      header: "Tier",
      meta: GRID,
      cell: ({ row }) => (
        <Select
          value={row.original.city_tier}
          onValueChange={(value) => update(row.original.key, { city_tier: value as CityTier })}
        >
          <SelectTrigger size="sm" className="w-32" aria-label={`Rule ${row.index + 1} tier`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(CITY_TIER_LABEL).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ),
    },
    {
      id: "limit_type",
      header: "Limit type",
      meta: GRID,
      cell: ({ row }) => (
        <Select
          value={row.original.limit_type}
          onValueChange={(value) => update(row.original.key, { limit_type: value as LimitType })}
        >
          <SelectTrigger size="sm" className="w-28" aria-label={`Rule ${row.index + 1} limit type`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(LIMIT_TYPE_LABEL).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ),
    },
    {
      id: "limit_amount",
      header: "Limit (₹)",
      meta: GRID,
      cell: ({ row }) => (
        <Input
          aria-label={`Rule ${row.index + 1} limit amount`}
          inputMode="decimal"
          value={row.original.limit_amount}
          aria-invalid={touched && ruleProblems(row.original).amount}
          className="h-8 w-28 tabular-nums"
          onChange={(event) => update(row.original.key, { limit_amount: event.target.value.trim() })}
        />
      ),
    },
    {
      id: "violation_action",
      header: "On breach",
      meta: GRID,
      cell: ({ row }) => (
        <Select
          value={row.original.violation_action}
          onValueChange={(value) => update(row.original.key, { violation_action: value as ViolationAction })}
        >
          <SelectTrigger size="sm" className="w-44" aria-label={`Rule ${row.index + 1} action`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(VIOLATION_ACTION_LABEL).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ),
    },
    {
      id: "requires_receipt",
      header: "Receipt",
      meta: GRID,
      cell: ({ row }) => (
        <Checkbox
          id={`rule-${row.original.key}-receipt`}
          aria-label={`Rule ${row.index + 1} requires receipt`}
          checked={row.original.requires_receipt}
          onCheckedChange={(checked) => update(row.original.key, { requires_receipt: checked === true })}
        />
      ),
    },
    {
      id: "receipt_threshold",
      header: "Receipt above (₹)",
      meta: GRID,
      cell: ({ row }) => (
        <Input
          aria-label={`Rule ${row.index + 1} receipt threshold`}
          inputMode="decimal"
          value={row.original.receipt_threshold}
          aria-invalid={touched && ruleProblems(row.original).threshold}
          className="h-8 w-28 tabular-nums"
          onChange={(event) => update(row.original.key, { receipt_threshold: event.target.value.trim() })}
        />
      ),
    },
    {
      id: "requires_pre_approval",
      header: "Pre-approval",
      meta: GRID,
      cell: ({ row }) => (
        <Checkbox
          aria-label={`Rule ${row.index + 1} requires pre-approval`}
          checked={row.original.requires_pre_approval}
          onCheckedChange={(checked) => update(row.original.key, { requires_pre_approval: checked === true })}
        />
      ),
    },
    {
      id: "is_per_diem",
      header: "Per-diem",
      meta: GRID,
      cell: ({ row }) => (
        <Checkbox
          aria-label={`Rule ${row.index + 1} is per-diem`}
          checked={row.original.is_per_diem}
          onCheckedChange={(checked) => update(row.original.key, { is_per_diem: checked === true })}
        />
      ),
    },
    {
      id: "remove",
      header: () => <span className="sr-only">Remove</span>,
      meta: { ...GRID, label: "Remove", cellClassName: "text-right" },
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Remove rule ${row.index + 1}`}
          onClick={() => setRules((current) => current.filter((rule) => rule.key !== row.original.key))}
        >
          <Trash2 />
        </Button>
      ),
    },
  ];

  const save = async () => {
    setTouched(true);
    if (!valid) return;
    setIsSaving(true);
    setProblem(null);
    try {
      const body: PolicyInput = {
        name: name.trim(),
        effective_from: effectiveFrom,
        description: description.trim() || null,
        applicable_grades: grades
          .split(",")
          .map((grade) => grade.trim())
          .filter(Boolean),
        applicable_locations: locationIds,
        rules: rules.map(({ key: _key, ...rule }) => rule),
      };
      const saved = await post<Policy>("/expenses/policies", body);
      toast.success(`${saved.name} saved as a new version`);
      onSaved();
    } catch (error) {
      setProblem(errorDetail(error, "Could not save the policy."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !isSaving && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle>{base ? `New version of ${base.name}` : "New expense policy"}</DialogTitle>
          <DialogDescription>
            This creates a new policy version. {base ? "The current version is not edited; deactivate it once this one takes over." : "Existing policies are never edited."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="grid gap-1.5">
              <Label htmlFor="policy-name">Name</Label>
              <Input
                id="policy-name"
                value={name}
                maxLength={200}
                aria-invalid={touched && !name.trim()}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="policy-effective">In force from</Label>
              <Input
                id="policy-effective"
                type="date"
                value={effectiveFrom}
                aria-invalid={touched && !effectiveFrom}
                onChange={(event) => setEffectiveFrom(event.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="policy-grades">
                Grades <span className="text-muted-foreground">(comma separated; blank for all)</span>
              </Label>
              <Input id="policy-grades" value={grades} onChange={(event) => setGrades(event.target.value)} />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="policy-description">
              Description <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="policy-description"
              rows={2}
              maxLength={2000}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>

          <fieldset className="grid gap-2">
            <legend className="text-sm font-medium text-foreground">
              Locations <span className="font-normal text-muted-foreground">(none ticked means all locations)</span>
            </legend>
            {locationsError ? (
              <p className="text-sm text-destructive">{locationsError}</p>
            ) : locations.length === 0 ? (
              <p className="text-sm text-muted-foreground">No locations are set up, so this policy applies everywhere.</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {locations.map((location) => {
                  const id = `policy-location-${location.id}`;
                  return (
                    <div key={location.id} className="flex items-center gap-2">
                      <Checkbox
                        id={id}
                        checked={locationIds.includes(location.id)}
                        onCheckedChange={(checked) =>
                          setLocationIds((current) =>
                            checked === true
                              ? [...current, location.id]
                              : current.filter((value) => value !== location.id),
                          )
                        }
                      />
                      <Label htmlFor={id} className="font-normal">
                        {location.name}
                        {location.city && <span className="text-muted-foreground"> · {location.city}</span>}
                      </Label>
                    </div>
                  );
                })}
              </div>
            )}
          </fieldset>

          <div className="grid gap-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-foreground">Rules</p>
              <Button variant="outline" size="sm" onClick={() => setRules((current) => [...current, blankRule()])}>
                <Plus /> Add rule
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Category keys are lower-case with underscores, e.g. hotel_stay. Amounts in rupees.
            </p>
            {touched && rules.length === 0 && (
              <p className="text-sm text-destructive">Add at least one rule.</p>
            )}
            <DataTable
              variant="plain"
              columns={columns}
              data={rules}
              getRowId={(rule) => String(rule.key)}
              noun="rules"
              emptyMessage="No rules yet. Use Add rule to add one."
            />
            {touched && !valid && rules.length > 0 && (
              <p className="text-sm text-destructive">
                Every rule needs a category key, a limit amount and a receipt threshold in rupees (up to two decimals).
              </p>
            )}
          </div>

          {problem && <InlineProblem>{problem}</InlineProblem>}
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={isSaving} onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={isSaving || (touched && !valid)} onClick={() => void save()}>
            {isSaving && <Loader2 className="animate-spin" />}
            Save new version
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
