"use client";

import { Plus, Trash2 } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/common/FormField";
import { BoardFormDialog } from "@/components/hiring/BoardFormDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, post } from "@/lib/api";

const AMOUNT = /^\d{1,14}(\.\d{1,2})?$/;
const SHARE = /^\d{1,3}(\.\d{1,2})?$/;

interface BonusRow {
  grade: string;
  amount: string;
}
interface MilestoneRow {
  key: string;
  label: string;
  share: string;
  days: string;
}

/**
 * Sum decimal percentage strings exactly, in hundredths, so "33.33 + 33.33 +
 * 33.34" is 100 and not 99.99999.
 */
function totalHundredths(values: string[]): number {
  return values.reduce((sum, value) => {
    const [whole, fraction = ""] = value.split(".");
    return sum + Number(whole) * 100 + Number(fraction.padEnd(2, "0").slice(0, 2));
  }, 0);
}

/**
 * Create a referral programme (admin). Bonus is per grade; milestones are
 * optional, and when given their shares must total 100.
 */
export function ReferralProgrammeDialog({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [bonus, setBonus] = useState<BonusRow[]>([{ grade: "", amount: "" }]);
  const [milestones, setMilestones] = useState<MilestoneRow[]>([]);
  const [roles, setRoles] = useState("");
  const [errors, setErrors] = useState<Partial<Record<"name" | "bonus" | "milestones", string>>>({});

  const reset = () => {
    setName("");
    setDescription("");
    setBonus([{ grade: "", amount: "" }]);
    setMilestones([]);
    setRoles("");
    setErrors({});
  };

  const updateBonus = (index: number, patch: Partial<BonusRow>) =>
    setBonus((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  const updateMilestone = (index: number, patch: Partial<MilestoneRow>) =>
    setMilestones((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  const submit = async (): Promise<boolean> => {
    const next: typeof errors = {};
    if (!name.trim()) next.name = "Give the programme a name.";

    const filledBonus = bonus.filter((row) => row.grade.trim() || row.amount.trim());
    const grades = filledBonus.map((row) => row.grade.trim());
    if (filledBonus.length === 0) next.bonus = "Add at least one grade and its bonus.";
    else if (filledBonus.some((row) => !row.grade.trim() || !AMOUNT.test(row.amount.trim()))) {
      next.bonus = "Each row needs a grade and an amount in rupees (up to 2 decimals).";
    } else if (new Set(grades).size !== grades.length) {
      next.bonus = "Each grade can appear only once.";
    }

    if (milestones.length > 0) {
      const incomplete = milestones.some(
        (row) =>
          !row.key.trim() ||
          !row.label.trim() ||
          !SHARE.test(row.share.trim()) ||
          !/^\d{1,4}$/.test(row.days.trim()) ||
          Number(row.days) > 1095,
      );
      if (incomplete) {
        next.milestones =
          "Each milestone needs a key, a label, a share % and days after joining (0 to 1095).";
      } else if (totalHundredths(milestones.map((row) => row.share.trim())) !== 10000) {
        next.milestones = "Milestone shares must total exactly 100%.";
      }
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return false;

    try {
      await post("/recruiting/referral-programmes", {
        name: name.trim(),
        description: description.trim() || null,
        bonus_by_grade: Object.fromEntries(
          filledBonus.map((row) => [row.grade.trim(), row.amount.trim()]),
        ),
        milestones:
          milestones.length > 0
            ? milestones.map((row) => ({
                key: row.key.trim(),
                label: row.label.trim(),
                share_percent: row.share.trim(),
                days_after_joining: Number(row.days.trim()),
              }))
            : null,
        eligible_roles: roles
          .split(",")
          .map((role) => role.trim())
          .filter(Boolean),
      });
      toast.success(`Programme "${name.trim()}" created`);
      onCreated();
      return true;
    } catch (error) {
      toast.error(error instanceof ApiError ? error.detail : "Could not create the programme.");
      return false;
    }
  };

  return (
    <BoardFormDialog
      trigger={
        <Button>
          <Plus /> New programme
        </Button>
      }
      title="New referral programme"
      description="Amounts are in rupees. If you leave milestones out, the server's default schedule applies."
      submitLabel="Create programme"
      onSubmit={submit}
      onClosed={reset}
      className="sm:max-w-2xl"
    >
      <FormField htmlFor="programme-name" label="Name" error={errors.name}>
        <Input
          id="programme-name"
          value={name}
          maxLength={160}
          required
          onChange={(event) => setName(event.target.value)}
        />
      </FormField>
      <FormField htmlFor="programme-description" label="Description" optional>
        <Textarea
          id="programme-description"
          value={description}
          rows={2}
          maxLength={4000}
          onChange={(event) => setDescription(event.target.value)}
        />
      </FormField>

      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium text-foreground">Bonus by grade</legend>
        {bonus.map((row, index) => (
          <div key={index} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
            <div className="grid gap-1">
              <Label htmlFor={`bonus-grade-${index}`} className="text-xs text-muted-foreground">
                Grade
              </Label>
              <Input
                id={`bonus-grade-${index}`}
                value={row.grade}
                maxLength={32}
                onChange={(event) => updateBonus(index, { grade: event.target.value })}
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor={`bonus-amount-${index}`} className="text-xs text-muted-foreground">
                Amount (₹)
              </Label>
              <Input
                id={`bonus-amount-${index}`}
                inputMode="decimal"
                className="tabular-nums"
                value={row.amount}
                onChange={(event) => updateBonus(index, { amount: event.target.value })}
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Remove this grade"
              disabled={bonus.length === 1}
              onClick={() => setBonus((rows) => rows.filter((_, i) => i !== index))}
            >
              <Trash2 />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-fit"
          onClick={() => setBonus((rows) => [...rows, { grade: "", amount: "" }])}
        >
          <Plus /> Add grade
        </Button>
        {errors.bonus && (
          <p role="alert" className="text-xs text-destructive">
            {errors.bonus}
          </p>
        )}
      </fieldset>

      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium text-foreground">
          Payment milestones <span className="font-normal text-muted-foreground">(optional)</span>
        </legend>
        {milestones.map((row, index) => (
          <div
            key={index}
            className="grid grid-cols-2 items-end gap-2 sm:grid-cols-[1fr_1.5fr_0.7fr_0.7fr_auto]"
          >
            <div className="grid gap-1">
              <Label htmlFor={`ms-key-${index}`} className="text-xs text-muted-foreground">
                Key
              </Label>
              <Input
                id={`ms-key-${index}`}
                value={row.key}
                maxLength={40}
                placeholder="joining"
                onChange={(event) => updateMilestone(index, { key: event.target.value })}
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor={`ms-label-${index}`} className="text-xs text-muted-foreground">
                Label
              </Label>
              <Input
                id={`ms-label-${index}`}
                value={row.label}
                maxLength={120}
                onChange={(event) => updateMilestone(index, { label: event.target.value })}
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor={`ms-share-${index}`} className="text-xs text-muted-foreground">
                Share %
              </Label>
              <Input
                id={`ms-share-${index}`}
                inputMode="decimal"
                className="tabular-nums"
                value={row.share}
                onChange={(event) => updateMilestone(index, { share: event.target.value })}
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor={`ms-days-${index}`} className="text-xs text-muted-foreground">
                Days after joining
              </Label>
              <Input
                id={`ms-days-${index}`}
                type="number"
                min={0}
                max={1095}
                className="tabular-nums"
                value={row.days}
                onChange={(event) => updateMilestone(index, { days: event.target.value })}
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Remove this milestone"
              onClick={() => setMilestones((rows) => rows.filter((_, i) => i !== index))}
            >
              <Trash2 />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-fit"
          disabled={milestones.length >= 12}
          onClick={() =>
            setMilestones((rows) => [...rows, { key: "", label: "", share: "", days: "" }])
          }
        >
          <Plus /> Add milestone
        </Button>
        {errors.milestones && (
          <p role="alert" className="text-xs text-destructive">
            {errors.milestones}
          </p>
        )}
      </fieldset>

      <FormField
        htmlFor="programme-roles"
        label="Eligible roles"
        optional
        hint="Comma-separated. Leave empty to open the programme to every role."
      >
        <Input
          id="programme-roles"
          value={roles}
          onChange={(event) => setRoles(event.target.value)}
        />
      </FormField>
    </BoardFormDialog>
  );
}
