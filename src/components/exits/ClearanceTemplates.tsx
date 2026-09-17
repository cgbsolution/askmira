"use client";

import { ListChecks, Loader2, Plus } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/common/FormField";
import { ownerLabel, QueryPanel, useExitRoles } from "@/components/exits/common";
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
  DialogTrigger,
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
import { useApiQuery } from "@/hooks/useApiQuery";
import { post } from "@/lib/api";
import type {
  ClearanceOwnerCandidate,
  ClearanceOwnerRole,
  ClearanceTemplate,
  ClearanceTemplateInput,
} from "@/lib/types/payroll-ops";
import { humanizeRole } from "@/lib/utils";

/** The clearance items every new exit starts with. HR sees them; admins add. */
export function ClearanceTemplates() {
  const { isAdmin } = useExitRoles();
  const query = useApiQuery<ClearanceTemplate[]>("/exits/clearance-templates");

  return (
    <QueryPanel
      query={query}
      title="Clearance checklist setup"
      description="These items are copied onto each exit when it starts. Changing them does not alter exits already in progress."
      actions={
        isAdmin ? (
          <AddTemplateDialog
            onCreated={(created) =>
              query.setData((current) => (current ? [...current, created] : [created]))
            }
          />
        ) : undefined
      }
      isEmpty={(rows) => rows.length === 0}
      empty={{
        icon: ListChecks,
        title: "No checklist items",
        description: isAdmin
          ? "Add the items each department must sign off before someone leaves."
          : "An HR admin has not set up the clearance checklist yet.",
      }}
    >
      {(rows) => (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16 text-right">Order</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Item</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Mandatory</TableHead>
              <TableHead>Active</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...rows]
              .sort((first, second) => first.display_order - second.display_order)
              .map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="text-right tabular-nums">{row.display_order}</TableCell>
                  <TableCell>{row.department}</TableCell>
                  <TableCell className="text-foreground">{row.description}</TableCell>
                  <TableCell>{ownerLabel(row)}</TableCell>
                  <TableCell>
                    {row.is_mandatory ? (
                      <Badge variant="outline">Mandatory</Badge>
                    ) : (
                      <Badge variant="muted">Optional</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {row.active ? (
                      <Badge variant="success">Active</Badge>
                    ) : (
                      <Badge variant="muted">Inactive</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      )}
    </QueryPanel>
  );
}

function AddTemplateDialog({ onCreated }: { onCreated: (template: ClearanceTemplate) => void }) {
  const [open, setOpen] = useState(false);
  const [department, setDepartment] = useState("");
  const [description, setDescription] = useState("");
  const [isMandatory, setIsMandatory] = useState(true);
  const [displayOrder, setDisplayOrder] = useState("");
  const [ownerRole, setOwnerRole] = useState<ClearanceOwnerRole | "">("");
  const [ownerUserId, setOwnerUserId] = useState("");
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const owners = useApiQuery<ClearanceOwnerCandidate[]>(
    open && ownerRole === "named_user" ? "/exits/clearance-owners" : null,
  );

  const problems = {
    department: department.trim() ? null : "Department is required.",
    description: description.trim() ? null : "Describe the item.",
    displayOrder: /^\d+$/.test(displayOrder.trim()) ? null : "Enter a whole number.",
    ownerRole: ownerRole ? null : "Choose who signs this off.",
    ownerUser: ownerRole === "named_user" && !ownerUserId ? "Choose the person." : null,
  };
  const isValid = Object.values(problems).every((problem) => problem === null);

  const reset = () => {
    setDepartment("");
    setDescription("");
    setIsMandatory(true);
    setDisplayOrder("");
    setOwnerRole("");
    setOwnerUserId("");
    setTouched(false);
    setError(null);
  };

  const save = async () => {
    setTouched(true);
    if (!isValid || !ownerRole) return;
    const input: ClearanceTemplateInput = {
      department: department.trim(),
      description: description.trim(),
      is_mandatory: isMandatory,
      display_order: Number(displayOrder.trim()),
      owner_role: ownerRole,
      owner_user_id: ownerRole === "named_user" ? ownerUserId : null,
    };
    setIsSaving(true);
    setError(null);
    try {
      const created = await post<ClearanceTemplate>("/exits/clearance-templates", input);
      toast.success("Checklist item added");
      onCreated(created);
      setOpen(false);
      reset();
    } catch (caught) {
      setError(apiErrorMessage(caught, "The item could not be added."));
    } finally {
      setIsSaving(false);
    }
  };

  const shown = (problem: string | null) => (touched ? problem : null);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (isSaving) return;
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus /> Add item
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add a checklist item</DialogTitle>
          <DialogDescription>Applies to exits started after it is added.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <FormField htmlFor="template-department" label="Department" error={shown(problems.department)}>
            <Input
              id="template-department"
              value={department}
              maxLength={100}
              disabled={isSaving}
              placeholder="e.g. IT, Finance, Admin"
              aria-invalid={Boolean(shown(problems.department))}
              onChange={(event) => setDepartment(event.target.value)}
            />
          </FormField>
          <FormField htmlFor="template-description" label="Item" error={shown(problems.description)}>
            <Input
              id="template-description"
              value={description}
              maxLength={500}
              disabled={isSaving}
              placeholder="e.g. Laptop and charger returned"
              aria-invalid={Boolean(shown(problems.description))}
              onChange={(event) => setDescription(event.target.value)}
            />
          </FormField>
          <FormField htmlFor="template-order" label="Display order" error={shown(problems.displayOrder)}>
            <Input
              id="template-order"
              inputMode="numeric"
              value={displayOrder}
              disabled={isSaving}
              className="tabular-nums"
              aria-invalid={Boolean(shown(problems.displayOrder))}
              onChange={(event) => setDisplayOrder(event.target.value)}
            />
          </FormField>
          <FormField htmlFor="template-owner-role" label="Signed off by" error={shown(problems.ownerRole)}>
            <Select
              value={ownerRole}
              disabled={isSaving}
              onValueChange={(next) => {
                setOwnerRole(next as ClearanceOwnerRole);
                setOwnerUserId("");
              }}
            >
              <SelectTrigger
                id="template-owner-role"
                className="w-full"
                aria-invalid={Boolean(shown(problems.ownerRole))}
              >
                <SelectValue placeholder="Choose an owner" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hr">HR</SelectItem>
                <SelectItem value="reporting_manager">Reporting manager</SelectItem>
                <SelectItem value="named_user">A named person</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          {ownerRole === "named_user" && (
            <FormField
              htmlFor="template-owner-user"
              label="Person"
              hint={
                owners.data && owners.data.length === 0
                  ? "No users can own a clearance item yet."
                  : undefined
              }
              error={owners.error ? owners.error.detail : shown(problems.ownerUser)}
            >
              <Select
                value={ownerUserId}
                disabled={isSaving || owners.isLoading || Boolean(owners.error)}
                onValueChange={setOwnerUserId}
              >
                <SelectTrigger
                  id="template-owner-user"
                  className="w-full"
                  aria-invalid={Boolean(shown(problems.ownerUser))}
                >
                  <SelectValue
                    placeholder={owners.isLoading ? "Loading people…" : "Choose a person"}
                  />
                </SelectTrigger>
                <SelectContent>
                  {(owners.data ?? []).map((candidate) => (
                    <SelectItem key={candidate.user_id} value={candidate.user_id}>
                      {candidate.full_name} · {humanizeRole(candidate.role)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          )}
          <div className="flex items-center justify-between rounded-md border border-border px-3 py-2.5">
            <div>
              <Label htmlFor="template-mandatory">Mandatory</Label>
              <p className="text-xs text-muted-foreground">
                The settlement cannot be computed while a mandatory item is pending.
              </p>
            </div>
            <Switch
              id="template-mandatory"
              checked={isMandatory}
              disabled={isSaving}
              onCheckedChange={setIsMandatory}
            />
          </div>
          {error && <InlineProblem>{error}</InlineProblem>}
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={isSaving} onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button disabled={isSaving} onClick={() => void save()}>
            {isSaving && <Loader2 className="animate-spin" />}
            Add item
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
