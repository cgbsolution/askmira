"use client";

import { Loader2 } from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

import { DatePicker } from "@/components/common/DatePicker";
import { FormField } from "@/components/common/FormField";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useApiQuery } from "@/hooks/useApiQuery";
import { ApiError, post } from "@/lib/api";
import type { AssetAssignment, AssetCondition, AssetPage } from "@/lib/types/assets";

import { ConditionSelect } from "./AssetActionDialogs";
import { todayISO } from "./shared";

/**
 * Hand an in-stock asset to one named person — the onboarding direction:
 * start from the joiner and pick the laptop, rather than start from the laptop.
 * The register's own hand-over (start from the asset) stays where it is.
 */
export function HandOverDialog({
  employeeId,
  employeeName,
  open,
  onOpenChange,
  onDone,
}: {
  employeeId: string;
  employeeName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const stock = useApiQuery<AssetPage>(open ? "/assets?status=in_stock&page_size=200" : null);
  const [assetId, setAssetId] = useState("");
  const [dueBack, setDueBack] = useState("");
  const [condition, setCondition] = useState<AssetCondition>("good");
  const [notes, setNotes] = useState("");
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAssetId("");
    setDueBack("");
    setCondition("good");
    setNotes("");
    setTouched(false);
    setError(null);
  }, [open]);

  const assets = stock.data?.items ?? [];
  const chosen = assets.find((asset) => asset.id === assetId);

  useEffect(() => {
    if (chosen) setCondition(chosen.condition);
  }, [chosen]);

  const submit = async () => {
    setTouched(true);
    if (!chosen) return;
    setIsBusy(true);
    setError(null);
    try {
      await post<AssetAssignment>(`/assets/${chosen.id}/assign`, {
        employee_id: employeeId,
        expected_return_date: dueBack || null,
        condition_out: condition,
        notes: notes.trim() || null,
      });
      toast.success(`${chosen.asset_tag} handed to ${employeeName}`, {
        description: "They have been told and asked to acknowledge it.",
      });
      onOpenChange(false);
      onDone();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.detail : "Could not hand the asset over.");
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !isBusy && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Hand over an asset to {employeeName}</DialogTitle>
          <DialogDescription>
            Only assets in stock can be handed over. The person is asked to acknowledge receipt.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <FormField
            htmlFor="handover-asset"
            label="Asset"
            required
            error={touched && !chosen ? "Choose the asset to hand over." : null}
            hint={
              stock.isLoading
                ? "Loading the assets in stock…"
                : assets.length === 0
                  ? "Nothing is in stock. Add assets or take returns in Assets → Asset register."
                  : `${assets.length} in stock`
            }
          >
            <Select value={assetId} onValueChange={setAssetId} disabled={assets.length === 0}>
              <SelectTrigger id="handover-asset" className="w-full" aria-invalid={touched && !chosen}>
                <SelectValue placeholder="Choose an asset" />
              </SelectTrigger>
              <SelectContent>
                {assets.map((asset) => (
                  <SelectItem key={asset.id} value={asset.id}>
                    {asset.asset_tag} · {asset.name}
                    {asset.serial_number ? ` (S/N ${asset.serial_number})` : ""} — {asset.category_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField htmlFor="handover-condition" label="Condition at hand-over">
              <ConditionSelect
                id="handover-condition"
                value={condition}
                onChange={setCondition}
                disabled={isBusy}
              />
            </FormField>
            <FormField htmlFor="handover-due" label="Expected back" optional>
              <DatePicker id="handover-due" value={dueBack} min={todayISO()} onChange={setDueBack} />
            </FormField>
          </div>
          <FormField htmlFor="handover-notes" label="Notes" optional>
            <Textarea
              id="handover-notes"
              rows={2}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="e.g. With charger and laptop bag"
            />
          </FormField>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={isBusy} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={isBusy} onClick={() => void submit()}>
            {isBusy && <Loader2 className="animate-spin" />} Hand over
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
