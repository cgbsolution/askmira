"use client";

import { Loader2, Pencil, Plus, Tags } from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/common/FormField";
import { PageShell } from "@/components/common/PageShell";
import { apiErrorMessage, InlineProblem } from "@/components/payroll-ops/shared";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useApiQuery } from "@/hooks/useApiQuery";
import { patch, post } from "@/lib/api";
import type { AssetCategory, AssetCustodian } from "@/lib/types/assets";
import { humanizeRole } from "@/lib/utils";

import { QueryPanel } from "./shared";

const HR_COLLECTS = "hr";

/**
 * Asset categories (HR): the kinds of asset the company tracks, and the policy
 * each carries — depreciation life, acknowledgement, and who collects at exit.
 */
export function CategoriesScreen() {
  const query = useApiQuery<AssetCategory[]>("/assets/categories?include_inactive=true");
  const custodians = useApiQuery<AssetCustodian[]>("/assets/custodians");
  const [editing, setEditing] = useState<AssetCategory | null>(null);
  const [adding, setAdding] = useState(false);

  return (
    <PageShell
      title="Asset categories"
      description="What the company tracks, how long each kind takes to depreciate, and who collects it when somebody leaves."
      actions={
        <Button variant="accent" onClick={() => setAdding(true)}>
          <Plus /> Add category
        </Button>
      }
    >
      <QueryPanel
        query={query}
        isEmpty={(rows) => rows.length === 0}
        empty={{
          icon: Tags,
          title: "No categories yet",
          description:
            "Add one for each kind of asset you hand out — laptops, phones, access cards — before adding assets to the register.",
        }}
      >
        {(rows) => (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead>Depreciation</TableHead>
                  <TableHead>Collected at exit by</TableHead>
                  <TableHead>Acknowledgement</TableHead>
                  <TableHead className="text-right">Assets</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <p className="flex items-center gap-2 font-medium text-foreground">
                        {row.name}
                        {!row.active && <Badge variant="muted">Inactive</Badge>}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {row.code}
                        {row.description && ` · ${row.description}`}
                      </p>
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {row.depreciation_months
                        ? `Straight line over ${row.depreciation_months} months`
                        : "Holds its cost"}
                    </TableCell>
                    <TableCell>{row.custodian_name ?? "HR"}</TableCell>
                    <TableCell>{row.requires_acknowledgement ? "Required" : "Not needed"}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.asset_count}
                      <span className="block text-xs text-muted-foreground">
                        {row.in_stock_count} in stock
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => setEditing(row)}>
                        <Pencil /> Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </QueryPanel>

      <CategoryDialog
        open={adding || editing !== null}
        category={editing}
        custodians={custodians.data ?? []}
        onClose={() => {
          setAdding(false);
          setEditing(null);
        }}
        onSaved={query.reload}
      />
    </PageShell>
  );
}

function CategoryDialog({
  open,
  category,
  custodians,
  onClose,
  onSaved,
}: {
  open: boolean;
  category: AssetCategory | null;
  custodians: AssetCustodian[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [months, setMonths] = useState("");
  const [custodian, setCustodian] = useState(HR_COLLECTS);
  const [acknowledge, setAcknowledge] = useState(true);
  const [active, setActive] = useState(true);
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCode(category?.code ?? "");
    setName(category?.name ?? "");
    setDescription(category?.description ?? "");
    setMonths(category?.depreciation_months ? String(category.depreciation_months) : "");
    setCustodian(category?.custodian_user_id ?? HR_COLLECTS);
    setAcknowledge(category?.requires_acknowledgement ?? true);
    setActive(category?.active ?? true);
    setTouched(false);
    setError(null);
  }, [open, category]);

  const codeInvalid = !category && !/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(code.trim());
  const monthsInvalid =
    months.trim() !== "" && (!/^\d+$/.test(months.trim()) || Number(months) < 1 || Number(months) > 600);
  const nameMissing = !name.trim();

  const submit = async () => {
    setTouched(true);
    if (codeInvalid || monthsInvalid || nameMissing) return;
    const body = {
      name: name.trim(),
      description: description.trim() || null,
      depreciation_months: months.trim() ? Number(months.trim()) : null,
      custodian_user_id: custodian === HR_COLLECTS ? null : custodian,
      requires_acknowledgement: acknowledge,
    };
    setIsBusy(true);
    setError(null);
    try {
      if (category) {
        await patch<AssetCategory>(`/assets/categories/${category.id}`, { ...body, active });
      } else {
        await post<AssetCategory>("/assets/categories", { ...body, code: code.trim() });
      }
      toast.success(category ? `${name.trim()} updated` : `${name.trim()} added`);
      onClose();
      onSaved();
    } catch (caught) {
      setError(apiErrorMessage(caught, "The category could not be saved."));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !isBusy && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{category ? `Edit ${category.name}` : "Add a category"}</DialogTitle>
          <DialogDescription>
            The depreciation life sets the book value an unreturned asset recovers at exit.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            htmlFor="category-code"
            label="Code"
            required={!category}
            hint={category ? "A category's code cannot change." : "Letters, digits, - and _."}
            error={touched && codeInvalid ? "Use letters, digits, - or _, e.g. LAPTOP." : null}
          >
            <Input
              id="category-code"
              value={code}
              maxLength={32}
              disabled={isBusy || Boolean(category)}
              aria-invalid={touched && codeInvalid}
              placeholder="LAPTOP"
              onChange={(event) => setCode(event.target.value)}
            />
          </FormField>
          <FormField
            htmlFor="category-name"
            label="Name"
            required
            error={touched && nameMissing ? "Name the category." : null}
          >
            <Input
              id="category-name"
              value={name}
              maxLength={120}
              disabled={isBusy}
              aria-invalid={touched && nameMissing}
              placeholder="Laptops"
              onChange={(event) => setName(event.target.value)}
            />
          </FormField>
          <FormField
            htmlFor="category-months"
            label="Depreciation (months)"
            optional
            hint="Straight line to zero. Empty keeps the purchase cost."
            error={monthsInvalid ? "Enter whole months between 1 and 600." : null}
          >
            <Input
              id="category-months"
              inputMode="numeric"
              value={months}
              disabled={isBusy}
              aria-invalid={monthsInvalid}
              placeholder="36"
              onChange={(event) => setMonths(event.target.value)}
            />
          </FormField>
          <FormField
            htmlFor="category-custodian"
            label="Collected at exit by"
            hint="Owns the return item on a leaver's checklist."
          >
            <Select value={custodian} disabled={isBusy} onValueChange={setCustodian}>
              <SelectTrigger id="category-custodian" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={HR_COLLECTS}>HR</SelectItem>
                {custodians.map((person) => (
                  <SelectItem key={person.user_id} value={person.user_id}>
                    {person.full_name} ({humanizeRole(person.role)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField htmlFor="category-description" label="Description" optional className="sm:col-span-2">
            <Textarea
              id="category-description"
              rows={2}
              maxLength={2000}
              value={description}
              disabled={isBusy}
              onChange={(event) => setDescription(event.target.value)}
            />
          </FormField>
          <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2.5 sm:col-span-2">
            <div>
              <Label htmlFor="category-ack">Holder acknowledges receipt</Label>
              <p className="text-xs text-muted-foreground">
                The employee confirms under My assets that they have it.
              </p>
            </div>
            <Switch
              id="category-ack"
              checked={acknowledge}
              disabled={isBusy}
              onCheckedChange={setAcknowledge}
            />
          </div>
          {category && (
            <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2.5 sm:col-span-2">
              <div>
                <Label htmlFor="category-active">Active</Label>
                <p className="text-xs text-muted-foreground">
                  An inactive category keeps its assets but takes no new ones or requests.
                </p>
              </div>
              <Switch
                id="category-active"
                checked={active}
                disabled={isBusy}
                onCheckedChange={setActive}
              />
            </div>
          )}
        </div>
        {error && <InlineProblem>{error}</InlineProblem>}
        <DialogFooter>
          <Button variant="outline" disabled={isBusy} onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={isBusy} onClick={() => void submit()}>
            {isBusy && <Loader2 className="animate-spin" />}
            {category ? "Save changes" : "Add category"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
