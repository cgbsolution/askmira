"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { patch, post } from "@/lib/api";
import type { Department } from "@/lib/types/people";

import { errorDetail } from "./settingsShared";

const CODE = /^[A-Za-z0-9_-]+$/;
/** `Select` has no empty value, so "no parent" needs a sentinel of its own. */
const TOP_LEVEL = "__top__";

interface Values {
  name: string;
  code: string;
  parent_id: string;
  is_active: boolean;
}

const EMPTY: Values = { name: "", code: "", parent_id: TOP_LEVEL, is_active: true };

/**
 * Create or edit a department.
 *
 * Departments nest, so the parent list excludes the department being edited
 * and everything beneath it — a department cannot be its own ancestor, and a
 * cycle would make the org chart and every rolled-up report non-terminating.
 */
export function DepartmentDialog({
  open,
  editing,
  departments,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  editing: Department | null;
  departments: Department[];
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [values, setValues] = useState<Values>(EMPTY);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setValues(
      editing
        ? {
            name: editing.name,
            code: editing.code,
            parent_id: editing.parent_id ?? TOP_LEVEL,
            is_active: editing.is_active,
          }
        : EMPTY,
    );
  }, [open, editing]);

  const set = <K extends keyof Values>(key: K, value: Values[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  // Everything at or below the department being edited, which may not be its parent.
  const descendants = new Set<string>();
  if (editing) {
    descendants.add(editing.id);
    let grew = true;
    while (grew) {
      grew = false;
      for (const row of departments) {
        if (row.parent_id && descendants.has(row.parent_id) && !descendants.has(row.id)) {
          descendants.add(row.id);
          grew = true;
        }
      }
    }
  }
  const parents = departments.filter((row) => !descendants.has(row.id));

  const errors: Partial<Record<keyof Values, string>> = {};
  if (values.name.trim().length < 1) errors.name = "A name is required.";
  if (!CODE.test(values.code.trim()))
    errors.code = "Letters, digits, hyphen and underscore only.";
  const invalid = Object.keys(errors).length > 0;

  const submit = async () => {
    setIsBusy(true);
    const body = {
      name: values.name.trim(),
      code: values.code.trim(),
      parent_id: values.parent_id === TOP_LEVEL ? null : values.parent_id,
    };
    try {
      if (editing) {
        await patch(`/org/departments/${editing.id}`, { ...body, is_active: values.is_active });
        toast.success("Department updated.");
      } else {
        await post("/org/departments", body);
        toast.success("Department created.");
      }
      onSaved();
      onOpenChange(false);
    } catch (caught) {
      toast.error(errorDetail(caught, "Could not save the department."));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !isBusy && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? `Edit ${editing.name}` : "Add a department"}</DialogTitle>
          <DialogDescription>
            Departments are what reports, approval routing and the org chart group by.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <FormField htmlFor="department-name" label="Name" error={errors.name}>
            <Input
              id="department-name"
              value={values.name}
              onChange={(event) => set("name", event.target.value)}
              placeholder="Engineering"
            />
          </FormField>
          <FormField htmlFor="department-code" label="Short code" error={errors.code}>
            <Input
              id="department-code"
              value={values.code}
              onChange={(event) => set("code", event.target.value)}
              placeholder="ENG"
              className="font-mono"
            />
          </FormField>
          <FormField
            htmlFor="department-parent"
            label="Reports into"
            hint={
              editing
                ? "This department and everything under it are not offered — a department cannot sit inside itself."
                : undefined
            }
          >
            <Select value={values.parent_id} onValueChange={(next) => set("parent_id", next)}>
              <SelectTrigger id="department-parent" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TOP_LEVEL}>Top level</SelectItem>
                {parents.map((row) => (
                  <SelectItem key={row.id} value={row.id}>
                    {row.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          {editing && (
            <div className="flex items-center gap-3">
              <Switch
                id="department-active"
                checked={values.is_active}
                onCheckedChange={(next) => set("is_active", next)}
              />
              <Label htmlFor="department-active" className="text-sm font-normal">
                Active. People already in an inactive department keep it on their record.
              </Label>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isBusy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={isBusy || invalid}>
            {isBusy && <Loader2 className="animate-spin" />}
            {editing ? "Save changes" : "Create department"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
