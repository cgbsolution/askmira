"use client";

import { Loader2 } from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

import { DatePicker } from "@/components/common/DatePicker";
import { FormField } from "@/components/common/FormField";
import { apiErrorMessage, InlineProblem } from "@/components/payroll-ops/shared";
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
import { Textarea } from "@/components/ui/textarea";
import { patch, post } from "@/lib/api";
import type { Asset, AssetCategory, AssetCondition, AssetInput } from "@/lib/types/assets";

import { CONDITION_LABELS, isAmount } from "./shared";

const NO_LOCATION = "none";

export interface LocationOption {
  id: string;
  name: string;
  city: string | null;
}

interface FormState {
  categoryId: string;
  tag: string;
  name: string;
  serial: string;
  make: string;
  model: string;
  specs: string;
  notes: string;
  purchaseDate: string;
  cost: string;
  vendor: string;
  invoice: string;
  warrantyUntil: string;
  locationId: string;
  condition: AssetCondition;
}

function initial(asset: Asset | null): FormState {
  return {
    categoryId: asset?.category_id ?? "",
    tag: asset?.asset_tag ?? "",
    name: asset?.name ?? "",
    serial: asset?.serial_number ?? "",
    make: asset?.make ?? "",
    model: asset?.model ?? "",
    specs: asset?.specs ?? "",
    notes: asset?.notes ?? "",
    purchaseDate: asset?.purchase_date ?? "",
    cost: asset?.purchase_cost ?? "",
    vendor: asset?.vendor ?? "",
    invoice: asset?.invoice_number ?? "",
    warrantyUntil: asset?.warranty_until ?? "",
    locationId: asset?.location_id ?? NO_LOCATION,
    condition: asset?.condition ?? "new",
  };
}

/**
 * Add an asset to the register, or correct its details. Status and holder
 * change through their own actions, never here.
 */
export function AssetFormDialog({
  open,
  onOpenChange,
  asset,
  categories,
  locations,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The asset being edited; null to add a new one. */
  asset: Asset | null;
  categories: AssetCategory[];
  locations: LocationOption[];
  onSaved: (asset: Asset) => void;
}) {
  const [form, setForm] = useState<FormState>(() => initial(asset));
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(initial(asset));
      setTouched(false);
      setError(null);
    }
  }, [open, asset]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const choosable = categories.filter(
    (category) => category.active || category.id === asset?.category_id,
  );
  const costInvalid = form.cost.trim() !== "" && !isAmount(form.cost);
  const warrantyBeforePurchase = Boolean(
    form.warrantyUntil && form.purchaseDate && form.warrantyUntil < form.purchaseDate,
  );
  const missing = {
    category: !form.categoryId,
    tag: !asset && !form.tag.trim(),
    name: !form.name.trim(),
  };
  const isValid =
    !missing.category && !missing.tag && !missing.name && !costInvalid && !warrantyBeforePurchase;

  const submit = async () => {
    setTouched(true);
    if (!isValid) return;
    const body: AssetInput = {
      category_id: form.categoryId,
      name: form.name.trim(),
      serial_number: form.serial.trim() || null,
      make: form.make.trim() || null,
      model: form.model.trim() || null,
      specs: form.specs.trim() || null,
      notes: form.notes.trim() || null,
      purchase_date: form.purchaseDate || null,
      purchase_cost: form.cost.trim() || null,
      vendor: form.vendor.trim() || null,
      invoice_number: form.invoice.trim() || null,
      warranty_until: form.warrantyUntil || null,
      location_id: form.locationId === NO_LOCATION ? null : form.locationId,
      condition: form.condition,
    };
    setIsBusy(true);
    setError(null);
    try {
      const saved = asset
        ? await patch<Asset>(`/assets/${asset.id}`, body)
        : await post<Asset>("/assets", { ...body, asset_tag: form.tag.trim() });
      toast.success(asset ? `${saved.asset_tag} updated` : `${saved.asset_tag} added to the register`);
      onOpenChange(false);
      onSaved(saved);
    } catch (caught) {
      setError(apiErrorMessage(caught, "The asset could not be saved."));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !isBusy && onOpenChange(next)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{asset ? `Edit ${asset.asset_tag}` : "Add an asset"}</DialogTitle>
          <DialogDescription>
            The purchase cost and date drive the book value, which is what an unreturned asset
            recovers at exit.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            htmlFor="asset-category"
            label="Category"
            required
            error={touched && missing.category ? "Choose a category." : null}
          >
            <Select
              value={form.categoryId}
              disabled={isBusy}
              onValueChange={(value) => set("categoryId", value)}
            >
              <SelectTrigger
                id="asset-category"
                className="w-full"
                aria-invalid={touched && missing.category}
              >
                <SelectValue placeholder="Choose a category" />
              </SelectTrigger>
              <SelectContent>
                {choosable.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField
            htmlFor="asset-tag"
            label="Asset tag"
            required={!asset}
            hint={asset ? "The tag on the label cannot change." : "As printed on the label."}
            error={touched && missing.tag ? "The asset tag is required." : null}
          >
            <Input
              id="asset-tag"
              value={form.tag}
              maxLength={64}
              disabled={isBusy || Boolean(asset)}
              aria-invalid={touched && missing.tag}
              placeholder="e.g. LT-0042"
              onChange={(event) => set("tag", event.target.value)}
            />
          </FormField>
          <FormField
            htmlFor="asset-name"
            label="Name"
            required
            className="sm:col-span-2"
            error={touched && missing.name ? "Name the asset." : null}
          >
            <Input
              id="asset-name"
              value={form.name}
              maxLength={160}
              disabled={isBusy}
              aria-invalid={touched && missing.name}
              placeholder="e.g. ThinkPad T14 Gen 4"
              onChange={(event) => set("name", event.target.value)}
            />
          </FormField>
          <FormField htmlFor="asset-make" label="Make" optional>
            <Input
              id="asset-make"
              value={form.make}
              maxLength={80}
              disabled={isBusy}
              onChange={(event) => set("make", event.target.value)}
            />
          </FormField>
          <FormField htmlFor="asset-model" label="Model" optional>
            <Input
              id="asset-model"
              value={form.model}
              maxLength={120}
              disabled={isBusy}
              onChange={(event) => set("model", event.target.value)}
            />
          </FormField>
          <FormField htmlFor="asset-serial" label="Serial number" optional>
            <Input
              id="asset-serial"
              value={form.serial}
              maxLength={128}
              disabled={isBusy}
              onChange={(event) => set("serial", event.target.value)}
            />
          </FormField>
          <FormField htmlFor="asset-condition" label="Condition">
            <Select
              value={form.condition}
              disabled={isBusy}
              onValueChange={(value) => set("condition", value as AssetCondition)}
            >
              <SelectTrigger id="asset-condition" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(CONDITION_LABELS) as AssetCondition[]).map((value) => (
                  <SelectItem key={value} value={value}>
                    {CONDITION_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField htmlFor="asset-purchase-date" label="Purchase date" optional>
            <DatePicker
              id="asset-purchase-date"
              value={form.purchaseDate}
              disabled={isBusy}
              onChange={(value) => set("purchaseDate", value)}
            />
          </FormField>
          <FormField
            htmlFor="asset-cost"
            label="Purchase cost (₹)"
            optional
            error={costInvalid ? "Enter an amount like 84999 or 84999.50." : null}
          >
            <Input
              id="asset-cost"
              inputMode="decimal"
              value={form.cost}
              disabled={isBusy}
              aria-invalid={costInvalid}
              placeholder="0.00"
              onChange={(event) => set("cost", event.target.value)}
            />
          </FormField>
          <FormField htmlFor="asset-vendor" label="Vendor" optional>
            <Input
              id="asset-vendor"
              value={form.vendor}
              maxLength={160}
              disabled={isBusy}
              onChange={(event) => set("vendor", event.target.value)}
            />
          </FormField>
          <FormField htmlFor="asset-invoice" label="Invoice number" optional>
            <Input
              id="asset-invoice"
              value={form.invoice}
              maxLength={64}
              disabled={isBusy}
              onChange={(event) => set("invoice", event.target.value)}
            />
          </FormField>
          <FormField
            htmlFor="asset-warranty"
            label="Warranty until"
            optional
            error={warrantyBeforePurchase ? "The warranty cannot end before the purchase." : null}
          >
            <DatePicker
              id="asset-warranty"
              value={form.warrantyUntil}
              min={form.purchaseDate || undefined}
              disabled={isBusy}
              invalid={warrantyBeforePurchase}
              onChange={(value) => set("warrantyUntil", value)}
            />
          </FormField>
          <FormField htmlFor="asset-location" label="Location" optional>
            <Select
              value={form.locationId}
              disabled={isBusy}
              onValueChange={(value) => set("locationId", value)}
            >
              <SelectTrigger id="asset-location" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_LOCATION}>No location</SelectItem>
                {locations.map((location) => (
                  <SelectItem key={location.id} value={location.id}>
                    {location.name}
                    {location.city ? ` (${location.city})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField htmlFor="asset-specs" label="Specification" optional className="sm:col-span-2">
            <Textarea
              id="asset-specs"
              rows={2}
              maxLength={4000}
              value={form.specs}
              disabled={isBusy}
              placeholder="e.g. i7, 16 GB RAM, 512 GB SSD"
              onChange={(event) => set("specs", event.target.value)}
            />
          </FormField>
          <FormField htmlFor="asset-notes" label="Notes" optional className="sm:col-span-2">
            <Textarea
              id="asset-notes"
              rows={2}
              maxLength={4000}
              value={form.notes}
              disabled={isBusy}
              onChange={(event) => set("notes", event.target.value)}
            />
          </FormField>
        </div>
        {error && <InlineProblem>{error}</InlineProblem>}
        <DialogFooter>
          <Button variant="outline" disabled={isBusy} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={isBusy} onClick={() => void submit()}>
            {isBusy && <Loader2 className="animate-spin" />}
            {asset ? "Save changes" : "Add asset"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
