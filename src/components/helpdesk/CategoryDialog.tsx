"use client";

import { Loader2 } from "lucide-react";
import React, { useEffect, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { patch, post } from "@/lib/api";
import type { ManagedUser } from "@/lib/types/admin";
import type { CategoryInput, HelpdeskCategory, RequestKind } from "@/lib/types/helpdesk";
import { humanizeRole } from "@/lib/utils";

import { InlineError, REQUEST_KIND_LABEL, errorDetail } from "./shared";

const HR_QUEUE = "__hr";

const EMPTY: CategoryInput = {
  name: "",
  description: null,
  owner_user_id: null,
  sla_hours: 48,
  is_confidential: false,
  request_kind: "general",
  active: true,
  sort_order: 0,
};

/**
 * Create or edit one category. `category` null means create.
 *
 * Confidentiality and SLA apply to tickets raised from now on — a ticket
 * already raised keeps what it was raised under, and the dialog says so.
 */
export function CategoryDialog({
  open,
  category,
  users,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  category: HelpdeskCategory | null;
  users: ManagedUser[];
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<CategoryInput>(EMPTY);
  const [slaText, setSlaText] = useState("48");
  const [orderText, setOrderText] = useState("0");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const start: CategoryInput = category
      ? {
          name: category.name,
          description: category.description,
          owner_user_id: category.owner_user_id,
          sla_hours: category.sla_hours,
          is_confidential: category.is_confidential,
          request_kind: category.request_kind,
          active: category.active,
          sort_order: category.sort_order,
        }
      : EMPTY;
    setForm(start);
    setSlaText(String(start.sla_hours));
    setOrderText(String(start.sort_order));
    setError(null);
  }, [open, category]);

  const owners = users.filter(
    (user) =>
      user.role !== "platform_admin" && (user.is_active || user.id === form.owner_user_id),
  );

  const set = <K extends keyof CategoryInput>(key: K, value: CategoryInput[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const save = async () => {
    const sla = Number(slaText);
    const order = Number(orderText);
    if (!form.name.trim()) return setError("Give the category a name.");
    if (!Number.isInteger(sla) || sla < 1 || sla > 720) {
      return setError("The SLA is a whole number of hours, from 1 to 720.");
    }
    if (!Number.isInteger(order) || order < 0) return setError("Order is a whole number, 0 or more.");
    setError(null);
    setIsSaving(true);
    const body: CategoryInput = {
      ...form,
      name: form.name.trim(),
      description: form.description?.trim() || null,
      sla_hours: sla,
      sort_order: order,
    };
    try {
      if (category) {
        await patch<HelpdeskCategory>(`/helpdesk/categories/${category.id}`, body);
        toast.success(`Saved ${body.name}`);
      } else {
        await post<HelpdeskCategory>("/helpdesk/categories", body);
        toast.success(`Added ${body.name}`);
      }
      onOpenChange(false);
      onSaved();
    } catch (caught) {
      setError(errorDetail(caught, "Could not save the category."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !isSaving && onOpenChange(next)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{category ? `Edit ${category.name}` : "New helpdesk category"}</DialogTitle>
          <DialogDescription>
            What employees can ask about, who handles it and how fast.
            {category && " Changes apply to tickets raised from now on."}
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <FormField htmlFor="category-name" label="Name" required>
            <Input
              id="category-name"
              value={form.name}
              maxLength={120}
              disabled={isSaving}
              onChange={(event) => set("name", event.target.value)}
              placeholder="e.g. Letters & documents"
            />
          </FormField>
          <FormField
            htmlFor="category-description"
            label="Description"
            optional
            hint="Shown to employees when they pick this category."
          >
            <Textarea
              id="category-description"
              rows={2}
              maxLength={2000}
              value={form.description ?? ""}
              disabled={isSaving}
              onChange={(event) => set("description", event.target.value)}
            />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField htmlFor="category-kind" label="Kind of request">
              <Select
                value={form.request_kind}
                onValueChange={(value) => set("request_kind", value as RequestKind)}
                disabled={isSaving}
              >
                <SelectTrigger id="category-kind" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(REQUEST_KIND_LABEL) as RequestKind[]).map((value) => (
                    <SelectItem key={value} value={value}>
                      {REQUEST_KIND_LABEL[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField
              htmlFor="category-owner"
              label="Handled by"
              hint="Without an owner, tickets go to everyone in HR."
            >
              <Select
                value={form.owner_user_id ?? HR_QUEUE}
                onValueChange={(value) => set("owner_user_id", value === HR_QUEUE ? null : value)}
                disabled={isSaving}
              >
                <SelectTrigger id="category-owner" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={HR_QUEUE}>HR (shared queue)</SelectItem>
                  {owners.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.full_name} · {humanizeRole(user.role)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField
              htmlFor="category-sla"
              label="SLA (hours)"
              required
              hint="Calendar hours from raising to resolution."
            >
              <Input
                id="category-sla"
                inputMode="numeric"
                value={slaText}
                disabled={isSaving}
                onChange={(event) => setSlaText(event.target.value.replace(/[^0-9]/g, ""))}
              />
            </FormField>
            <FormField htmlFor="category-order" label="Order" hint="Lower comes first in the list.">
              <Input
                id="category-order"
                inputMode="numeric"
                value={orderText}
                disabled={isSaving}
                onChange={(event) => setOrderText(event.target.value.replace(/[^0-9]/g, ""))}
              />
            </FormField>
          </div>
          <div className="grid gap-3 rounded-md border border-border p-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-foreground">Confidential</p>
                <p className="text-xs text-muted-foreground">
                  Tickets are seen only by the employee, the owner and tenant or HR admins — not HR
                  ops. Use for grievances.
                </p>
              </div>
              <Switch
                checked={form.is_confidential}
                onCheckedChange={(value) => set("is_confidential", value)}
                disabled={isSaving}
                aria-label="Confidential"
              />
            </div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-foreground">Taking new tickets</p>
                <p className="text-xs text-muted-foreground">
                  Switch off to retire a category. Its tickets keep their label.
                </p>
              </div>
              <Switch
                checked={form.active}
                onCheckedChange={(value) => set("active", value)}
                disabled={isSaving}
                aria-label="Taking new tickets"
              />
            </div>
          </div>
          {error && <InlineError>{error}</InlineError>}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isSaving}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="animate-spin" />}
              {category ? "Save changes" : "Add category"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
